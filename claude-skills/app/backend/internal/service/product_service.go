package service

import (
	"strconv"

	"gorm.io/gorm"

	"ecsite/internal/model"
	"ecsite/internal/repository"
)

const (
	ProductPageSize    = 20
	MaxQuantityPerItem = 10
)

type ProductService struct {
	db       *gorm.DB
	products repository.ProductRepository
}

func NewProductService(db *gorm.DB) *ProductService {
	return &ProductService{db: db}
}

type CategoryView struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func (s *ProductService) Categories() ([]CategoryView, error) {
	cs, err := s.products.ListCategories(s.db)
	if err != nil {
		return nil, err
	}
	views := make([]CategoryView, 0, len(cs))
	for _, c := range cs {
		views = append(views, CategoryView{ID: c.ID, Name: c.Name})
	}
	return views, nil
}

type ProductSummary struct {
	ID       int64   `json:"id"`
	Name     string  `json:"name"`
	Price    int     `json:"price"`
	ImageURL *string `json:"imageUrl"`
	InStock  bool    `json:"inStock"`
}

type ProductPage struct {
	Items      []ProductSummary `json:"items"`
	TotalCount int64            `json:"totalCount"`
	Page       int              `json:"page"`
	TotalPages int              `json:"totalPages"`
}

// Search runs the product search of SC-01. keyword must already be trimmed and validated.
// categoryIDRaw and pageRaw are the raw query values; invalid values are normalized.
func (s *ProductService) Search(keyword, categoryIDRaw, pageRaw string) (*ProductPage, error) {
	cond := repository.ProductSearch{Keyword: keyword, CategoryID: ParseCategoryID(categoryIDRaw)}
	total, err := s.products.Count(s.db, cond)
	if err != nil {
		return nil, err
	}
	totalPages := int((total + ProductPageSize - 1) / ProductPageSize)
	page := NormalizePage(pageRaw, totalPages)

	ps, err := s.products.List(s.db, cond, (page-1)*ProductPageSize, ProductPageSize)
	if err != nil {
		return nil, err
	}
	items := make([]ProductSummary, 0, len(ps))
	for _, p := range ps {
		items = append(items, ProductSummary{ID: p.ID, Name: p.Name, Price: p.Price, ImageURL: p.ImageURL, InStock: p.StockQuantity > 0})
	}
	return &ProductPage{Items: items, TotalCount: total, Page: page, TotalPages: totalPages}, nil
}

// ParseCategoryID treats an empty or non-numeric value as "not specified".
func ParseCategoryID(raw string) *int64 {
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return nil
	}
	return &id
}

// NormalizePage returns 1 for a missing, non-numeric, less than 1 or out-of-range page.
func NormalizePage(raw string, totalPages int) int {
	page, err := strconv.Atoi(raw)
	if err != nil || page < 1 || page > totalPages {
		return 1
	}
	return page
}

type ProductDetail struct {
	ID           int64   `json:"id"`
	Name         string  `json:"name"`
	Description  *string `json:"description"`
	Price        int     `json:"price"`
	ImageURL     *string `json:"imageUrl"`
	CategoryName string  `json:"categoryName"`
	InStock      bool    `json:"inStock"`
	MaxQuantity  int     `json:"maxQuantity"`
}

// FindPublished returns nil when the product does not exist or is not published.
func (s *ProductService) FindPublished(id int64) (*model.Product, error) {
	return s.products.FindPublished(s.db, id)
}

func (s *ProductService) Detail(id int64) (*ProductDetail, error) {
	p, err := s.FindPublished(id)
	if err != nil || p == nil {
		return nil, err
	}
	return &ProductDetail{
		ID: p.ID, Name: p.Name, Description: p.Description, Price: p.Price, ImageURL: p.ImageURL,
		CategoryName: p.Category.Name, InStock: p.StockQuantity > 0,
		MaxQuantity: min(p.StockQuantity, MaxQuantityPerItem),
	}, nil
}
