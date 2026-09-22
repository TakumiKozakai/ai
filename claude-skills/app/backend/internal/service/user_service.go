package service

import (
	"errors"

	"gorm.io/gorm"

	"ecsite/internal/apperr"
	"ecsite/internal/auth"
	"ecsite/internal/model"
	"ecsite/internal/repository"
)

const msgEmailTaken = "このメールアドレスは既に登録されています"

type UserService struct {
	db    *gorm.DB
	users repository.UserRepository
	carts repository.CartRepository
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

// Me is the response of GET /api/me (A-01).
type Me struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	CartQuantity int    `json:"cartQuantity"`
}

func (s *UserService) FindByID(id int64) (*model.User, error) {
	return s.users.FindByID(s.db, id)
}

func (s *UserService) Me(u *model.User) (*Me, error) {
	qty, err := s.carts.SumQuantity(s.db, u.ID)
	if err != nil {
		return nil, err
	}
	return &Me{ID: u.ID, Name: u.Name, Email: u.Email, CartQuantity: qty}, nil
}

func (s *UserService) EmailExists(email string) (bool, error) {
	return s.users.ExistsByEmail(s.db, email)
}

// SignupInput holds values already normalized and validated by the handler.
type SignupInput struct {
	Name        string
	Email       string
	Password    string
	PhoneNumber string
}

func (s *UserService) Register(in SignupInput) (*model.User, error) {
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		return nil, err
	}
	u := &model.User{Email: in.Email, PasswordHash: hash, Name: in.Name}
	if in.PhoneNumber != "" {
		u.PhoneNumber = &in.PhoneNumber
	}
	if err := s.users.Create(s.db, u); err != nil {
		// Another request registered the same email after the duplicate check.
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, apperr.Validation(map[string]string{"email": msgEmailTaken})
		}
		return nil, err
	}
	return u, nil
}

// Authenticate checks the email (already trimmed and lowercased) and password.
// An unknown email and a wrong password return the same error.
func (s *UserService) Authenticate(email, password string) (*model.User, error) {
	if email == "" || password == "" {
		return nil, apperr.LoginFailed()
	}
	u, err := s.users.FindByEmail(s.db, email)
	if err != nil {
		return nil, err
	}
	if u == nil || !auth.CheckPassword(u.PasswordHash, password) {
		return nil, apperr.LoginFailed()
	}
	return u, nil
}
