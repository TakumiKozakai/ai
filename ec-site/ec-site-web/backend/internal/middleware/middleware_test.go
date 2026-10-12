package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequireXRequestedWith(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequireXRequestedWith())
	ok := func(c *gin.Context) { c.Status(http.StatusNoContent) }
	r.GET("/x", ok)
	r.POST("/x", ok)
	r.PATCH("/x", ok)
	r.DELETE("/x", ok)

	tests := []struct {
		method string
		header string
		want   int
	}{
		{http.MethodGet, "", http.StatusNoContent},
		{http.MethodPost, "", http.StatusForbidden},
		{http.MethodPatch, "", http.StatusForbidden},
		{http.MethodDelete, "fetch", http.StatusForbidden},
		{http.MethodPost, "XMLHttpRequest", http.StatusNoContent},
		{http.MethodDelete, "XMLHttpRequest", http.StatusNoContent},
	}
	for _, tt := range tests {
		req := httptest.NewRequest(tt.method, "/x", nil)
		if tt.header != "" {
			req.Header.Set("X-Requested-With", tt.header)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != tt.want {
			t.Errorf("%s with %q: got %d, want %d", tt.method, tt.header, w.Code, tt.want)
		}
	}
}

func TestRequireUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/x", RequireUser(), func(c *gin.Context) { c.Status(http.StatusNoContent) })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))
	if w.Code != http.StatusUnauthorized {
		t.Errorf("got %d, want 401", w.Code)
	}
}
