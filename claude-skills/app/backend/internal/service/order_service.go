package service

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"time"

	"gorm.io/gorm"

	"ecsite/internal/apperr"
	"ecsite/internal/model"
	"ecsite/internal/repository"
)

const (
	FreeShippingThreshold = 5000
	ShippingFeeAmount     = 500
	orderNumberAttempts   = 3
)

var JST = time.FixedZone("Asia/Tokyo", 9*60*60)

// ShippingFee is free when the subtotal is 5,000 yen or more.
func ShippingFee(subtotal int) int {
	if subtotal >= FreeShippingThreshold {
		return 0
	}
	return ShippingFeeAmount
}

// FormatOrderNumber returns "yyyyMMdd-NNNNNN" using the date in Japan time.
func FormatOrderNumber(now time.Time, random int) string {
	return fmt.Sprintf("%s-%06d", now.In(JST).Format("20060102"), random%1000000)
}

// AsJST reinterprets a "timestamp without time zone" value (read as UTC wall clock)
// as Japan time.
func AsJST(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), JST)
}

type OrderService struct {
	db        *gorm.DB
	carts     repository.CartRepository
	products  repository.ProductRepository
	addresses repository.AddressRepository
	orders    repository.OrderRepository
	now       func() time.Time
	random    func() int
}

func NewOrderService(db *gorm.DB) *OrderService {
	return &OrderService{
		db:     db,
		now:    func() time.Time { return time.Now().In(JST) },
		random: func() int { return rand.IntN(1000000) },
	}
}

type LineItemView struct {
	ProductName string `json:"productName"`
	UnitPrice   int    `json:"unitPrice"`
	Quantity    int    `json:"quantity"`
	Subtotal    int    `json:"subtotal"`
}

type AddressView struct {
	ID            int64   `json:"id"`
	RecipientName string  `json:"recipientName"`
	PostalCode    string  `json:"postalCode"`
	Prefecture    string  `json:"prefecture"`
	City          string  `json:"city"`
	AddressLine   string  `json:"addressLine"`
	Building      *string `json:"building"`
	PhoneNumber   string  `json:"phoneNumber"`
	IsDefault     bool    `json:"isDefault"`
}

type CheckoutView struct {
	Items          []LineItemView `json:"items"`
	SubtotalAmount int            `json:"subtotalAmount"`
	ShippingFee    int            `json:"shippingFee"`
	TotalAmount    int            `json:"totalAmount"`
	Addresses      []AddressView  `json:"addresses"`
	Prefectures    []string       `json:"prefectures"`
}

// checkCart returns the cart items when they can be purchased, or a 409 error.
func (s *OrderService) checkCart(db *gorm.DB, userID int64) ([]model.CartItem, CartView, error) {
	items, err := s.carts.ListByUser(db, userID)
	if err != nil {
		return nil, CartView{}, err
	}
	view := BuildCartView(items)
	if len(items) == 0 {
		return nil, view, apperr.CartEmpty()
	}
	if !view.Purchasable {
		return nil, view, apperr.CartNotPurchasable()
	}
	return items, view, nil
}

// Checkout returns the content of the checkout screen (A-12).
func (s *OrderService) Checkout(userID int64) (*CheckoutView, error) {
	_, cart, err := s.checkCart(s.db, userID)
	if err != nil {
		return nil, err
	}
	addrs, err := s.addresses.ListByUser(s.db, userID)
	if err != nil {
		return nil, err
	}
	view := &CheckoutView{
		Items:          make([]LineItemView, 0, len(cart.Items)),
		SubtotalAmount: cart.SubtotalAmount,
		ShippingFee:    ShippingFee(cart.SubtotalAmount),
		Addresses:      make([]AddressView, 0, len(addrs)),
		Prefectures:    model.Prefectures,
	}
	view.TotalAmount = view.SubtotalAmount + view.ShippingFee
	for _, it := range cart.Items {
		view.Items = append(view.Items, LineItemView{ProductName: it.ProductName, UnitPrice: it.UnitPrice, Quantity: it.Quantity, Subtotal: it.Subtotal})
	}
	for _, a := range addrs {
		view.Addresses = append(view.Addresses, AddressView{
			ID: a.ID, RecipientName: a.RecipientName, PostalCode: a.PostalCode, Prefecture: a.Prefecture, City: a.City,
			AddressLine: a.AddressLine, Building: a.Building, PhoneNumber: a.PhoneNumber, IsDefault: a.IsDefault,
		})
	}
	return view, nil
}

func (s *OrderService) AddressBelongsTo(userID, addressID int64) (bool, error) {
	a, err := s.addresses.FindByIDAndUser(s.db, addressID, userID)
	return a != nil, err
}

type NewAddressInput struct {
	RecipientName string
	PostalCode    string
	Prefecture    string
	City          string
	AddressLine   string
	Building      string
	PhoneNumber   string
}

// PlaceOrderInput holds values already validated by the handler.
type PlaceOrderInput struct {
	UseNewAddress bool
	AddressID     int64
	NewAddress    NewAddressInput
	PaymentMethod string
}

// PlaceOrder confirms the order in one transaction (SC-04 3.3) and returns the order number.
func (s *OrderService) PlaceOrder(userID int64, in PlaceOrderInput) (string, error) {
	now := s.now()
	var orderNumber string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		items, cart, err := s.checkCart(tx, userID)
		if err != nil {
			return err
		}

		addr, err := s.shippingAddress(tx, userID, in)
		if err != nil {
			return err
		}

		for _, it := range items {
			rows, err := s.products.DecrementStock(tx, it.ProductID, it.Quantity, it.Product.Version, now)
			if err != nil {
				return err
			}
			if rows == 0 {
				return apperr.OrderConflict()
			}
		}

		orderNumber, err = s.newOrderNumber(tx, now)
		if err != nil {
			return err
		}
		fee := ShippingFee(cart.SubtotalAmount)
		order := &model.Order{
			OrderNumber: orderNumber, UserID: userID, Status: model.OrderStatusOrdered, PaymentMethod: in.PaymentMethod,
			SubtotalAmount: cart.SubtotalAmount, ShippingFee: fee, TotalAmount: cart.SubtotalAmount + fee,
			ShippingRecipientName: addr.RecipientName, ShippingPostalCode: addr.PostalCode, ShippingPrefecture: addr.Prefecture,
			ShippingCity: addr.City, ShippingAddressLine: addr.AddressLine, ShippingBuilding: addr.Building,
			ShippingPhoneNumber: addr.PhoneNumber, OrderedAt: now,
		}
		for _, it := range items {
			order.Items = append(order.Items, model.OrderItem{
				ProductID: it.ProductID, ProductName: it.Product.Name, UnitPrice: it.Product.Price,
				Quantity: it.Quantity, Subtotal: it.Product.Price * it.Quantity,
			})
		}
		if err := s.orders.Create(tx, order); err != nil {
			return err
		}
		return s.carts.DeleteByUser(tx, userID)
	})
	if err != nil {
		return "", err
	}
	return orderNumber, nil
}

// shippingAddress saves the new address or loads the selected registered address.
func (s *OrderService) shippingAddress(tx *gorm.DB, userID int64, in PlaceOrderInput) (*model.Address, error) {
	if !in.UseNewAddress {
		addr, err := s.addresses.FindByIDAndUser(tx, in.AddressID, userID)
		if err != nil {
			return nil, err
		}
		if addr == nil {
			return nil, apperr.Validation(map[string]string{"addressId": "配送先を選択してください"})
		}
		return addr, nil
	}
	hasDefault, err := s.addresses.HasDefault(tx, userID)
	if err != nil {
		return nil, err
	}
	na := in.NewAddress
	addr := &model.Address{
		UserID: userID, RecipientName: na.RecipientName, PostalCode: na.PostalCode, Prefecture: na.Prefecture,
		City: na.City, AddressLine: na.AddressLine, PhoneNumber: na.PhoneNumber, IsDefault: !hasDefault,
	}
	if na.Building != "" {
		addr.Building = &na.Building
	}
	if err := s.addresses.Create(tx, addr); err != nil {
		return nil, err
	}
	return addr, nil
}

func (s *OrderService) newOrderNumber(tx *gorm.DB, now time.Time) (string, error) {
	for range orderNumberAttempts {
		n := FormatOrderNumber(now, s.random())
		exists, err := s.orders.ExistsByOrderNumber(tx, n)
		if err != nil {
			return "", err
		}
		if !exists {
			return n, nil
		}
	}
	return "", errors.New("order number collided 3 times")
}

type ShippingView struct {
	RecipientName string  `json:"recipientName"`
	PostalCode    string  `json:"postalCode"`
	Prefecture    string  `json:"prefecture"`
	City          string  `json:"city"`
	AddressLine   string  `json:"addressLine"`
	Building      *string `json:"building"`
	PhoneNumber   string  `json:"phoneNumber"`
}

type OrderView struct {
	OrderNumber    string         `json:"orderNumber"`
	OrderedAt      time.Time      `json:"orderedAt"`
	PaymentMethod  string         `json:"paymentMethod"`
	Shipping       ShippingView   `json:"shipping"`
	Items          []LineItemView `json:"items"`
	SubtotalAmount int            `json:"subtotalAmount"`
	ShippingFee    int            `json:"shippingFee"`
	TotalAmount    int            `json:"totalAmount"`
}

// Order returns the user's order (A-14), or nil when it does not exist.
func (s *OrderService) Order(userID int64, orderNumber string) (*OrderView, error) {
	o, err := s.orders.FindByNumberAndUser(s.db, orderNumber, userID)
	if err != nil || o == nil {
		return nil, err
	}
	view := &OrderView{
		OrderNumber: o.OrderNumber, OrderedAt: AsJST(o.OrderedAt).Truncate(time.Second), PaymentMethod: o.PaymentMethod,
		Shipping: ShippingView{
			RecipientName: o.ShippingRecipientName, PostalCode: o.ShippingPostalCode, Prefecture: o.ShippingPrefecture,
			City: o.ShippingCity, AddressLine: o.ShippingAddressLine, Building: o.ShippingBuilding, PhoneNumber: o.ShippingPhoneNumber,
		},
		Items:          make([]LineItemView, 0, len(o.Items)),
		SubtotalAmount: o.SubtotalAmount, ShippingFee: o.ShippingFee, TotalAmount: o.TotalAmount,
	}
	for _, it := range o.Items {
		view.Items = append(view.Items, LineItemView{ProductName: it.ProductName, UnitPrice: it.UnitPrice, Quantity: it.Quantity, Subtotal: it.Subtotal})
	}
	return view, nil
}
