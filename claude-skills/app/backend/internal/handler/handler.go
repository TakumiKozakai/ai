// Package handler implements the JSON API (doc/詳細設計/ecsite-API設計書.md).
package handler

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"ecsite/internal/apperr"
	"ecsite/internal/auth"
	"ecsite/internal/config"
	"ecsite/internal/middleware"
	"ecsite/internal/model"
	"ecsite/internal/service"
)

type Handler struct {
	cfg      *config.Config
	jwt      *auth.JWT
	users    *service.UserService
	products *service.ProductService
	carts    *service.CartService
	orders   *service.OrderService
}

func New(cfg *config.Config, jwt *auth.JWT, users *service.UserService, products *service.ProductService,
	carts *service.CartService, orders *service.OrderService) *Handler {
	return &Handler{cfg: cfg, jwt: jwt, users: users, products: products, carts: carts, orders: orders}
}

// Register sets up the /api routes.
func (h *Handler) Register(r *gin.Engine) {
	api := r.Group("/api", middleware.RequireXRequestedWith(), middleware.LoadUser(h.jwt, h.users))

	api.GET("/me", h.me)
	api.POST("/auth/signup", h.signup)
	api.POST("/auth/login", h.login)
	api.POST("/auth/logout", h.logout)
	api.GET("/categories", h.categories)
	api.GET("/products", h.searchProducts)
	api.GET("/products/:id", h.productDetail)

	authed := api.Group("", middleware.RequireUser())
	authed.GET("/cart", h.cart)
	authed.POST("/cart/items", h.addCartItem)
	authed.PATCH("/cart/items/:cartItemId", h.updateCartItem)
	authed.DELETE("/cart/items/:cartItemId", h.deleteCartItem)
	authed.GET("/checkout", h.checkout)
	authed.POST("/orders", h.createOrder)
	authed.GET("/orders/:orderNumber", h.order)
}

// respondError writes an apperr.Error as is, and logs any other error as a 500.
func respondError(c *gin.Context, err error) {
	var ae *apperr.Error
	if errors.As(err, &ae) {
		c.AbortWithStatusJSON(ae.Status, ae)
		return
	}
	log.Printf("internal error: %s %s: %v", c.Request.Method, c.Request.URL.Path, err)
	c.AbortWithStatusJSON(http.StatusInternalServerError, apperr.Internal())
}

// bindJSON decodes the request body; a malformed body is a 400 BAD_REQUEST.
func bindJSON(c *gin.Context, v any) bool {
	if err := c.ShouldBindJSON(v); err != nil {
		respondError(c, apperr.BadRequest())
		return false
	}
	return true
}

// pathID parses a numeric path parameter; a non-numeric value is a 404.
func pathID(c *gin.Context, name string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil || id <= 0 {
		respondError(c, apperr.NotFound())
		return 0, false
	}
	return id, true
}

func currentUser(c *gin.Context) *model.User {
	return middleware.CurrentUser(c)
}
