package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"ecsite/internal/apperr"
	"ecsite/internal/model"
)

const msgQuantityRange = "数量は1〜10の整数で入力してください"

// A-08 GET /api/cart
func (h *Handler) cart(c *gin.Context) {
	view, err := h.carts.Cart(currentUser(c).ID)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, view)
}

type addCartItemRequest struct {
	ProductID json.RawMessage `json:"productId"`
	Quantity  json.RawMessage `json:"quantity"`
}

// A-09 POST /api/cart/items. Checks run in the order of SC-02 2.2:
// product (404) -> quantity (400) -> per-item limit -> stock.
func (h *Handler) addCartItem(c *gin.Context) {
	var req addCartItemRequest
	if !bindJSON(c, &req) {
		return
	}
	productID, ok := parseJSONInt(req.ProductID)
	if !ok {
		respondError(c, apperr.NotFound())
		return
	}
	p, err := h.products.FindPublished(productID)
	if err != nil {
		respondError(c, err)
		return
	}
	if p == nil {
		respondError(c, apperr.NotFound())
		return
	}
	qty, ok := parseJSONInt(req.Quantity)
	if !validQuantity(qty, ok) {
		respondError(c, apperr.Validation(map[string]string{"quantity": "数量は1〜10の整数で選択してください"}))
		return
	}
	cartQuantity, err := h.carts.Add(currentUser(c).ID, p, int(qty))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"cartQuantity": cartQuantity})
}

// findCartItem loads the user's cart item from the path; a missing item is a 404.
func (h *Handler) findCartItem(c *gin.Context) (*model.CartItem, bool) {
	id, ok := pathID(c, "cartItemId")
	if !ok {
		return nil, false
	}
	item, err := h.carts.FindItem(currentUser(c).ID, id)
	if err != nil {
		respondError(c, err)
		return nil, false
	}
	if item == nil {
		respondError(c, apperr.NotFound())
		return nil, false
	}
	return item, true
}

type updateCartItemRequest struct {
	Quantity json.RawMessage `json:"quantity"`
}

// A-10 PATCH /api/cart/items/:cartItemId. Checks run in the order of SC-03 2.2.
func (h *Handler) updateCartItem(c *gin.Context) {
	item, ok := h.findCartItem(c)
	if !ok {
		return
	}
	var req updateCartItemRequest
	if !bindJSON(c, &req) {
		return
	}
	qty, ok := parseJSONInt(req.Quantity)
	if !validQuantity(qty, ok) {
		respondError(c, apperr.Validation(map[string]string{"quantity": msgQuantityRange}))
		return
	}
	view, err := h.carts.UpdateQuantity(currentUser(c).ID, item, int(qty))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, view)
}

// A-11 DELETE /api/cart/items/:cartItemId
func (h *Handler) deleteCartItem(c *gin.Context) {
	item, ok := h.findCartItem(c)
	if !ok {
		return
	}
	view, err := h.carts.Delete(currentUser(c).ID, item)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, view)
}
