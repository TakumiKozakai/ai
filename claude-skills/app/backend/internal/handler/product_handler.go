package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"ecsite/internal/apperr"
)

// A-05 GET /api/categories
func (h *Handler) categories(c *gin.Context) {
	cs, err := h.products.Categories()
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, cs)
}

// A-06 GET /api/products
func (h *Handler) searchProducts(c *gin.Context) {
	keyword, msg := validateKeyword(c.Query("keyword"))
	if msg != "" {
		respondError(c, apperr.Validation(map[string]string{"keyword": msg}))
		return
	}
	page, err := h.products.Search(keyword, c.Query("categoryId"), c.Query("page"))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, page)
}

// A-07 GET /api/products/:id
func (h *Handler) productDetail(c *gin.Context) {
	id, ok := pathID(c, "id")
	if !ok {
		return
	}
	p, err := h.products.Detail(id)
	if err != nil {
		respondError(c, err)
		return
	}
	if p == nil {
		respondError(c, apperr.NotFound())
		return
	}
	c.JSON(http.StatusOK, p)
}
