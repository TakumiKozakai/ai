package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"ecsite/internal/apperr"
)

// RegisterFallback serves the built frontend (common spec 1.3). Unknown /api paths get
// the JSON 404; other GET paths get the file under staticDir, or index.html so that
// React Router can render the screen.
func RegisterFallback(r *gin.Engine, staticDir string) {
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		isGet := c.Request.Method == http.MethodGet || c.Request.Method == http.MethodHead
		if path == "/api" || strings.HasPrefix(path, "/api/") || !isGet {
			respondError(c, apperr.NotFound())
			return
		}
		index := filepath.Join(staticDir, "index.html")
		if _, err := os.Stat(index); err != nil {
			c.String(http.StatusNotFound, "frontend is not built: run npm run build in app/frontend")
			return
		}
		file := filepath.Join(staticDir, filepath.FromSlash(filepath.Clean("/"+path)))
		if info, err := os.Stat(file); err == nil && !info.IsDir() {
			c.File(file)
			return
		}
		c.File(index)
	})
}
