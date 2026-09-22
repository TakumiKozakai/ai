package service

import (
	"fmt"
	"net/http"

	"gorm.io/gorm"

	"ecsite/internal/apperr"
	"ecsite/internal/model"
	"ecsite/internal/repository"
)

// Values of CartItemView.Problem (see A-08).
const (
	ProblemUnpublished       = "UNPUBLISHED"
	ProblemOutOfStock        = "OUT_OF_STOCK"
	ProblemInsufficientStock = "INSUFFICIENT_STOCK"
)

type CartService struct {
	db       *gorm.DB
	carts    repository.CartRepository
	products repository.ProductRepository
}

func NewCartService(db *gorm.DB) *CartService {
	return &CartService{db: db}
}

type CartItemView struct {
	CartItemID    int64   `json:"cartItemId"`
	ProductID     int64   `json:"productId"`
	ProductName   string  `json:"productName"`
	ImageURL      *string `json:"imageUrl"`
	UnitPrice     int     `json:"unitPrice"`
	Quantity      int     `json:"quantity"`
	Subtotal      int     `json:"subtotal"`
	Published     bool    `json:"published"`
	Problem       *string `json:"problem"`
	StockQuantity *int    `json:"stockQuantity"`
}

type CartView struct {
	Items          []CartItemView `json:"items"`
	TotalQuantity  int            `json:"totalQuantity"`
	SubtotalAmount int            `json:"subtotalAmount"`
	Purchasable    bool           `json:"purchasable"`
}

// ItemProblem returns why the item cannot be purchased, or "" when it can.
func ItemProblem(p model.Product, quantity int) string {
	switch {
	case !p.IsPublished:
		return ProblemUnpublished
	case p.StockQuantity == 0:
		return ProblemOutOfStock
	case p.StockQuantity < quantity:
		return ProblemInsufficientStock
	default:
		return ""
	}
}

func BuildCartView(items []model.CartItem) CartView {
	view := CartView{Items: make([]CartItemView, 0, len(items)), Purchasable: len(items) > 0}
	for _, it := range items {
		p := it.Product
		v := CartItemView{
			CartItemID: it.ID, ProductID: p.ID, ProductName: p.Name, ImageURL: p.ImageURL,
			UnitPrice: p.Price, Quantity: it.Quantity, Subtotal: p.Price * it.Quantity, Published: p.IsPublished,
		}
		if problem := ItemProblem(p, it.Quantity); problem != "" {
			v.Problem = &problem
			view.Purchasable = false
			if problem == ProblemInsufficientStock {
				stock := p.StockQuantity
				v.StockQuantity = &stock
			}
		}
		view.Items = append(view.Items, v)
		view.TotalQuantity += it.Quantity
		view.SubtotalAmount += v.Subtotal
	}
	return view
}

func (s *CartService) Cart(userID int64) (*CartView, error) {
	items, err := s.carts.ListByUser(s.db, userID)
	if err != nil {
		return nil, err
	}
	view := BuildCartView(items)
	return &view, nil
}

// Add adds quantity of the published product p to the user's cart (A-09).
// quantity must already be validated to be 1..10.
func (s *CartService) Add(userID int64, p *model.Product, quantity int) (int, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		existing, err := s.carts.FindByUserAndProduct(tx, userID, p.ID)
		if err != nil {
			return err
		}
		inCart := 0
		if existing != nil {
			inCart = existing.Quantity
		}
		total := inCart + quantity
		if total > MaxQuantityPerItem {
			return apperr.New(http.StatusBadRequest, "CART_QUANTITY_LIMIT",
				fmt.Sprintf("1商品あたりの数量は10点までです（カート内: %d点）", inCart))
		}
		if total > p.StockQuantity {
			return apperr.New(http.StatusBadRequest, "INSUFFICIENT_STOCK",
				fmt.Sprintf("在庫が不足しているためカートに追加できません（カート内: %d点）", inCart))
		}
		if existing != nil {
			return s.carts.UpdateQuantity(tx, existing, total)
		}
		return s.carts.Create(tx, &model.CartItem{UserID: userID, ProductID: p.ID, Quantity: quantity})
	})
	if err != nil {
		return 0, err
	}
	return s.carts.SumQuantity(s.db, userID)
}

// FindItem returns the user's cart item, or nil when it does not exist.
func (s *CartService) FindItem(userID, cartItemID int64) (*model.CartItem, error) {
	return s.carts.FindByIDAndUser(s.db, cartItemID, userID)
}

// UpdateQuantity changes the quantity of the item (A-10). quantity must already be validated.
func (s *CartService) UpdateQuantity(userID int64, item *model.CartItem, quantity int) (*CartView, error) {
	if !item.Product.IsPublished {
		return nil, apperr.New(http.StatusBadRequest, "PRODUCT_UNPUBLISHED", "この商品は現在購入できません")
	}
	if quantity > item.Product.StockQuantity {
		return nil, apperr.New(http.StatusBadRequest, "INSUFFICIENT_STOCK",
			fmt.Sprintf("在庫が不足しています（在庫: %d点）", item.Product.StockQuantity))
	}
	if err := s.carts.UpdateQuantity(s.db, item, quantity); err != nil {
		return nil, err
	}
	return s.Cart(userID)
}

func (s *CartService) Delete(userID int64, item *model.CartItem) (*CartView, error) {
	if err := s.carts.Delete(s.db, item); err != nil {
		return nil, err
	}
	return s.Cart(userID)
}
