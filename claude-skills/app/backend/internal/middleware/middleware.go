// Package middleware provides the CSRF header check, JWT authentication and panic recovery.
package middleware

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"ecsite/internal/apperr"
	"ecsite/internal/auth"
	"ecsite/internal/model"
	"ecsite/internal/service"
)

const userKey = "currentUser"

// RequireXRequestedWith rejects state-changing requests without
// "X-Requested-With: XMLHttpRequest" (common spec 4.3).
func RequireXRequestedWith() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
			if c.GetHeader("X-Requested-With") != "XMLHttpRequest" {
				e := apperr.Forbidden()
				c.AbortWithStatusJSON(e.Status, e)
				return
			}
		}
		c.Next()
	}
}

// LoadUser sets the current user when the JWT cookie is valid and the user exists.
// An invalid or missing token simply leaves the request unauthenticated.
func LoadUser(jwt *auth.JWT, users *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(auth.CookieName)
		if err != nil || token == "" {
			c.Next()
			return
		}
		userID, err := jwt.Parse(token)
		if err != nil {
			c.Next()
			return
		}
		u, err := users.FindByID(userID)
		if err != nil {
			log.Printf("internal error: load user %d: %v", userID, err)
			e := apperr.Internal()
			c.AbortWithStatusJSON(e.Status, e)
			return
		}
		if u != nil {
			c.Set(userKey, u)
		}
		c.Next()
	}
}

// RequireUser returns 401 when no user is logged in.
func RequireUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		if CurrentUser(c) == nil {
			e := apperr.Unauthorized()
			c.AbortWithStatusJSON(e.Status, e)
			return
		}
		c.Next()
	}
}

func CurrentUser(c *gin.Context) *model.User {
	if v, ok := c.Get(userKey); ok {
		return v.(*model.User)
	}
	return nil
}

// Recovery logs a panic and responds with the common 500 error.
func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, err any) {
		log.Printf("panic: %s %s: %v", c.Request.Method, c.Request.URL.Path, err)
		e := apperr.Internal()
		c.AbortWithStatusJSON(e.Status, e)
	})
}
