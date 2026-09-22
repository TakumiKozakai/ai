package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"ecsite/internal/apperr"
	"ecsite/internal/auth"
	"ecsite/internal/model"
	"ecsite/internal/service"
)

// A-01 GET /api/me
func (h *Handler) me(c *gin.Context) {
	u := currentUser(c)
	if u == nil {
		respondError(c, apperr.Unauthorized())
		return
	}
	me, err := h.users.Me(u)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, me)
}

// A-02 POST /api/auth/signup
func (h *Handler) signup(c *gin.Context) {
	var req signupRequest
	if !bindJSON(c, &req) {
		return
	}
	fe := validateSignup(&req)
	if !fe.has("email") {
		exists, err := h.users.EmailExists(req.Email)
		if err != nil {
			respondError(c, err)
			return
		}
		if exists {
			fe.add("email", "このメールアドレスは既に登録されています")
		}
	}
	if len(fe) > 0 {
		respondError(c, apperr.Validation(fe))
		return
	}

	u, err := h.users.Register(service.SignupInput{Name: req.Name, Email: req.Email, Password: req.Password, PhoneNumber: req.PhoneNumber})
	if err != nil {
		respondError(c, err)
		return
	}
	h.startSession(c, u, http.StatusCreated)
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// A-03 POST /api/auth/login
func (h *Handler) login(c *gin.Context) {
	var req loginRequest
	if !bindJSON(c, &req) {
		return
	}
	u, err := h.users.Authenticate(strings.ToLower(trim(req.Email)), req.Password)
	if err != nil {
		respondError(c, err)
		return
	}
	h.startSession(c, u, http.StatusOK)
}

// A-04 POST /api/auth/logout
func (h *Handler) logout(c *gin.Context) {
	h.setTokenCookie(c, "", -1, time.Unix(0, 0))
	c.Status(http.StatusNoContent)
}

// startSession issues a new JWT cookie and responds with the user in the A-01 format.
func (h *Handler) startSession(c *gin.Context, u *model.User, status int) {
	token, exp, err := h.jwt.Issue(u.ID, time.Now())
	if err != nil {
		respondError(c, err)
		return
	}
	me, err := h.users.Me(u)
	if err != nil {
		respondError(c, err)
		return
	}
	h.setTokenCookie(c, token, int(auth.TokenTTL.Seconds()), exp)
	c.JSON(status, me)
}

func (h *Handler) setTokenCookie(c *gin.Context, value string, maxAge int, expires time.Time) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     auth.CookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		Expires:  expires,
		HttpOnly: true,
		Secure:   h.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}
