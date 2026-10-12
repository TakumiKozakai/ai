package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// A-12 GET /api/checkout
func (h *Handler) checkout(c *gin.Context) {
	view, err := h.orders.Checkout(currentUser(c).ID)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, view)
}
