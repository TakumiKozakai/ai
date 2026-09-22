package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"ecsite/internal/apperr"
	"ecsite/internal/service"
)

type createOrderRequest struct {
	AddressID     string             `json:"addressId"`
	NewAddress    *newAddressRequest `json:"newAddress"`
	PaymentMethod string             `json:"paymentMethod"`
}

// A-13 POST /api/orders. Input is validated first; cart checks (409) run only when valid.
func (h *Handler) createOrder(c *gin.Context) {
	var req createOrderRequest
	if !bindJSON(c, &req) {
		return
	}
	userID := currentUser(c).ID
	fe := fieldErrors{}
	in := service.PlaceOrderInput{PaymentMethod: trim(req.PaymentMethod)}

	switch addressID := trim(req.AddressID); addressID {
	case "":
		fe.add("addressId", "配送先を選択してください")
	case "new":
		in.UseNewAddress = true
		na := req.NewAddress
		if na == nil {
			na = &newAddressRequest{}
		}
		in.NewAddress = validateNewAddress(na, fe)
	default:
		id, err := strconv.ParseInt(addressID, 10, 64)
		owned := false
		if err == nil && id > 0 {
			if owned, err = h.orders.AddressBelongsTo(userID, id); err != nil {
				respondError(c, err)
				return
			}
		}
		if !owned {
			fe.add("addressId", "配送先を選択してください")
		}
		in.AddressID = id
	}

	if !validPaymentMethod(in.PaymentMethod) {
		fe.add("paymentMethod", "支払方法を選択してください")
	}
	if len(fe) > 0 {
		respondError(c, apperr.Validation(fe))
		return
	}

	orderNumber, err := h.orders.PlaceOrder(userID, in)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"orderNumber": orderNumber})
}

// A-14 GET /api/orders/:orderNumber
func (h *Handler) order(c *gin.Context) {
	view, err := h.orders.Order(currentUser(c).ID, c.Param("orderNumber"))
	if err != nil {
		respondError(c, err)
		return
	}
	if view == nil {
		respondError(c, apperr.NotFound())
		return
	}
	c.JSON(http.StatusOK, view)
}
