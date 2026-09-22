package service

import (
	"regexp"
	"testing"
	"time"

	"ecsite/internal/model"
)

func TestShippingFee(t *testing.T) {
	for subtotal, want := range map[int]int{0: 500, 4999: 500, 5000: 0, 12000: 0} {
		if got := ShippingFee(subtotal); got != want {
			t.Errorf("ShippingFee(%d) = %d, want %d", subtotal, got, want)
		}
	}
}

func TestFormatOrderNumber(t *testing.T) {
	// 2026-09-21 15:30 UTC is 2026-09-22 00:30 in Japan time.
	now := time.Date(2026, 9, 21, 15, 30, 0, 0, time.UTC)
	if got := FormatOrderNumber(now, 42); got != "20260922-000042" {
		t.Errorf("got %q", got)
	}
	if got := FormatOrderNumber(now, 999999); !regexp.MustCompile(`^\d{8}-\d{6}$`).MatchString(got) {
		t.Errorf("bad format %q", got)
	}
}

func TestAsJST(t *testing.T) {
	stored := time.Date(2026, 9, 21, 14, 5, 0, 0, time.UTC) // wall clock read from "timestamp"
	got := AsJST(stored)
	if got.Format(time.RFC3339) != "2026-09-21T14:05:00+09:00" {
		t.Errorf("got %s", got.Format(time.RFC3339))
	}
}

func TestNormalizePage(t *testing.T) {
	tests := []struct {
		raw        string
		totalPages int
		want       int
	}{
		{"", 2, 1}, {"abc", 2, 1}, {"0", 2, 1}, {"-1", 2, 1}, {"2", 2, 2}, {"3", 2, 1}, {"1", 0, 1},
	}
	for _, tt := range tests {
		if got := NormalizePage(tt.raw, tt.totalPages); got != tt.want {
			t.Errorf("NormalizePage(%q, %d) = %d, want %d", tt.raw, tt.totalPages, got, tt.want)
		}
	}
}

func TestParseCategoryID(t *testing.T) {
	if ParseCategoryID("") != nil || ParseCategoryID("abc") != nil {
		t.Error("empty or non-numeric should be nil")
	}
	if id := ParseCategoryID("999"); id == nil || *id != 999 {
		t.Error("numeric should be kept even if the category does not exist")
	}
}

func TestItemProblem(t *testing.T) {
	tests := []struct {
		name string
		p    model.Product
		qty  int
		want string
	}{
		{"ok", model.Product{IsPublished: true, StockQuantity: 5}, 5, ""},
		{"unpublished wins", model.Product{IsPublished: false, StockQuantity: 0}, 1, ProblemUnpublished},
		{"out of stock", model.Product{IsPublished: true, StockQuantity: 0}, 1, ProblemOutOfStock},
		{"insufficient", model.Product{IsPublished: true, StockQuantity: 2}, 3, ProblemInsufficientStock},
	}
	for _, tt := range tests {
		if got := ItemProblem(tt.p, tt.qty); got != tt.want {
			t.Errorf("%s: got %q, want %q", tt.name, got, tt.want)
		}
	}
}

func TestBuildCartView(t *testing.T) {
	items := []model.CartItem{
		{ID: 1, Quantity: 2, Product: model.Product{ID: 10, Name: "A", Price: 1000, IsPublished: true, StockQuantity: 5}},
		{ID: 2, Quantity: 3, Product: model.Product{ID: 11, Name: "B", Price: 500, IsPublished: true, StockQuantity: 1}},
	}
	v := BuildCartView(items)
	if v.TotalQuantity != 5 || v.SubtotalAmount != 3500 || v.Purchasable {
		t.Fatalf("unexpected view: %+v", v)
	}
	if v.Items[0].Problem != nil || v.Items[0].StockQuantity != nil {
		t.Errorf("item A should have no problem: %+v", v.Items[0])
	}
	if p := v.Items[1].Problem; p == nil || *p != ProblemInsufficientStock || *v.Items[1].StockQuantity != 1 {
		t.Errorf("item B should be insufficient with stock 1: %+v", v.Items[1])
	}

	if empty := BuildCartView(nil); empty.Purchasable || empty.Items == nil {
		t.Errorf("empty cart must not be purchasable and items must be []: %+v", empty)
	}
}
