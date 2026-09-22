// Package repository accesses the database with GORM. Every method takes the *gorm.DB
// to use so that services can run it inside a transaction. "Not found" is returned as a
// nil result with a nil error.
package repository

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"ecsite/internal/model"
)

func notFoundToNil[T any](v *T, err error) (*T, error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return v, nil
}

// ---- users ----

type UserRepository struct{}

func (UserRepository) FindByID(db *gorm.DB, id int64) (*model.User, error) {
	var u model.User
	return notFoundToNil(&u, db.First(&u, id).Error)
}

func (UserRepository) FindByEmail(db *gorm.DB, email string) (*model.User, error) {
	var u model.User
	return notFoundToNil(&u, db.Where("email = ?", email).First(&u).Error)
}

func (UserRepository) ExistsByEmail(db *gorm.DB, email string) (bool, error) {
	var n int64
	err := db.Model(&model.User{}).Where("email = ?", email).Count(&n).Error
	return n > 0, err
}

func (UserRepository) Create(db *gorm.DB, u *model.User) error {
	return db.Create(u).Error
}

// ---- categories / products ----

type ProductRepository struct{}

func (ProductRepository) ListCategories(db *gorm.DB) ([]model.Category, error) {
	var cs []model.Category
	err := db.Order("display_order ASC, id ASC").Find(&cs).Error
	return cs, err
}

// ProductSearch is the condition of the product search (SC-01).
type ProductSearch struct {
	Keyword    string // already trimmed; empty means no keyword condition
	CategoryID *int64
}

func (s ProductSearch) scope(db *gorm.DB) *gorm.DB {
	db = db.Model(&model.Product{}).Where("is_published = ?", true)
	if s.Keyword != "" {
		pattern := "%" + EscapeLike(s.Keyword) + "%"
		db = db.Where(`(name ILIKE ? ESCAPE '\' OR description ILIKE ? ESCAPE '\')`, pattern, pattern)
	}
	if s.CategoryID != nil {
		db = db.Where("category_id = ?", *s.CategoryID)
	}
	return db
}

func (ProductRepository) Count(db *gorm.DB, s ProductSearch) (int64, error) {
	var n int64
	err := s.scope(db).Count(&n).Error
	return n, err
}

func (ProductRepository) List(db *gorm.DB, s ProductSearch, offset, limit int) ([]model.Product, error) {
	var ps []model.Product
	err := s.scope(db).Order("id DESC").Offset(offset).Limit(limit).Find(&ps).Error
	return ps, err
}

func (ProductRepository) FindPublished(db *gorm.DB, id int64) (*model.Product, error) {
	var p model.Product
	return notFoundToNil(&p, db.Preload("Category").Where("is_published = ?", true).First(&p, id).Error)
}

// DecrementStock subtracts quantity with optimistic locking on version and returns the
// number of updated rows (0 means another transaction changed the product).
func (ProductRepository) DecrementStock(db *gorm.DB, id int64, quantity, version int, now time.Time) (int64, error) {
	res := db.Exec(
		`UPDATE products SET stock_quantity = stock_quantity - ?, version = version + 1, updated_at = ?
		 WHERE id = ? AND version = ?`,
		quantity, now, id, version)
	return res.RowsAffected, res.Error
}

// EscapeLike escapes LIKE wildcards so that % and _ match literally.
func EscapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// ---- cart_items ----

type CartRepository struct{}

func (CartRepository) ListByUser(db *gorm.DB, userID int64) ([]model.CartItem, error) {
	var items []model.CartItem
	err := db.Preload("Product").Where("user_id = ?", userID).Order("created_at ASC, id ASC").Find(&items).Error
	return items, err
}

func (CartRepository) SumQuantity(db *gorm.DB, userID int64) (int, error) {
	var sum int
	err := db.Model(&model.CartItem{}).Where("user_id = ?", userID).Select("COALESCE(SUM(quantity), 0)").Scan(&sum).Error
	return sum, err
}

func (CartRepository) FindByIDAndUser(db *gorm.DB, id, userID int64) (*model.CartItem, error) {
	var item model.CartItem
	return notFoundToNil(&item, db.Preload("Product").Where("user_id = ?", userID).First(&item, id).Error)
}

func (CartRepository) FindByUserAndProduct(db *gorm.DB, userID, productID int64) (*model.CartItem, error) {
	var item model.CartItem
	return notFoundToNil(&item, db.Where("user_id = ? AND product_id = ?", userID, productID).First(&item).Error)
}

func (CartRepository) Create(db *gorm.DB, item *model.CartItem) error {
	return db.Omit(clause.Associations).Create(item).Error
}

func (CartRepository) UpdateQuantity(db *gorm.DB, item *model.CartItem, quantity int) error {
	return db.Model(item).Update("quantity", quantity).Error
}

func (CartRepository) Delete(db *gorm.DB, item *model.CartItem) error {
	return db.Delete(item).Error
}

func (CartRepository) DeleteByUser(db *gorm.DB, userID int64) error {
	return db.Where("user_id = ?", userID).Delete(&model.CartItem{}).Error
}

// ---- addresses ----

type AddressRepository struct{}

func (AddressRepository) ListByUser(db *gorm.DB, userID int64) ([]model.Address, error) {
	var as []model.Address
	err := db.Where("user_id = ?", userID).Order("is_default DESC, created_at ASC, id ASC").Find(&as).Error
	return as, err
}

func (AddressRepository) FindByIDAndUser(db *gorm.DB, id, userID int64) (*model.Address, error) {
	var a model.Address
	return notFoundToNil(&a, db.Where("user_id = ?", userID).First(&a, id).Error)
}

func (AddressRepository) HasDefault(db *gorm.DB, userID int64) (bool, error) {
	var n int64
	err := db.Model(&model.Address{}).Where("user_id = ? AND is_default = ?", userID, true).Count(&n).Error
	return n > 0, err
}

func (AddressRepository) Create(db *gorm.DB, a *model.Address) error {
	return db.Create(a).Error
}

// ---- orders ----

type OrderRepository struct{}

func (OrderRepository) ExistsByOrderNumber(db *gorm.DB, orderNumber string) (bool, error) {
	var n int64
	err := db.Model(&model.Order{}).Where("order_number = ?", orderNumber).Count(&n).Error
	return n > 0, err
}

// Create inserts the order and its items.
func (OrderRepository) Create(db *gorm.DB, o *model.Order) error {
	return db.Create(o).Error
}

func (OrderRepository) FindByNumberAndUser(db *gorm.DB, orderNumber string, userID int64) (*model.Order, error) {
	var o model.Order
	err := db.Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("id ASC") }).
		Where("order_number = ? AND user_id = ?", orderNumber, userID).First(&o).Error
	return notFoundToNil(&o, err)
}
