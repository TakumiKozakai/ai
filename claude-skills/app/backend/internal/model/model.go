// Package model defines GORM models mapped to the tables created by
// app/docker/postgresql/initdb/01_init.sql. AutoMigrate is not used.
package model

import "time"

type User struct {
	ID           int64
	Email        string
	PasswordHash string
	Name         string
	PhoneNumber  *string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Address struct {
	ID            int64
	UserID        int64
	RecipientName string
	PostalCode    string
	Prefecture    string
	City          string
	AddressLine   string
	Building      *string
	PhoneNumber   string
	IsDefault     bool
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type Category struct {
	ID           int64
	Name         string
	DisplayOrder int
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Product struct {
	ID            int64
	CategoryID    int64
	Category      Category
	Name          string
	Description   *string
	Price         int
	StockQuantity int
	ImageURL      *string `gorm:"column:image_url"`
	IsPublished   bool
	Version       int
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type CartItem struct {
	ID        int64
	UserID    int64
	ProductID int64
	Product   Product
	Quantity  int
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Order struct {
	ID                    int64
	OrderNumber           string
	UserID                int64
	Status                string
	PaymentMethod         string
	SubtotalAmount        int
	ShippingFee           int
	TotalAmount           int
	ShippingRecipientName string
	ShippingPostalCode    string
	ShippingPrefecture    string
	ShippingCity          string
	ShippingAddressLine   string
	ShippingBuilding      *string
	ShippingPhoneNumber   string
	OrderedAt             time.Time
	CreatedAt             time.Time
	UpdatedAt             time.Time
	Items                 []OrderItem
}

// OrderItem has no UpdatedAt because rows are never updated after creation.
type OrderItem struct {
	ID          int64
	OrderID     int64
	ProductID   int64
	ProductName string
	UnitPrice   int
	Quantity    int
	Subtotal    int
	CreatedAt   time.Time
}

const OrderStatusOrdered = "ORDERED"

// PaymentMethods lists the values allowed by ck_orders_payment_method.
var PaymentMethods = []string{"CREDIT_CARD", "BANK_TRANSFER", "CASH_ON_DELIVERY"}

// Prefectures lists the 47 prefectures in JIS X 0401 order.
var Prefectures = []string{
	"北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
	"茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
	"新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
	"静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
	"奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
	"徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
	"熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
}
