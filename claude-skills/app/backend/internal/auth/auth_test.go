package auth

import (
	"testing"
	"time"
)

const secret = "0123456789abcdef0123456789abcdef"

func TestJWTRoundTrip(t *testing.T) {
	j := NewJWT(secret, TokenTTL)
	token, exp, err := j.Issue(42, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if d := time.Until(exp); d < 23*time.Hour || d > 25*time.Hour {
		t.Errorf("expiry should be about 24h later, got %v", d)
	}
	id, err := j.Parse(token)
	if err != nil || id != 42 {
		t.Fatalf("Parse = %d, %v", id, err)
	}
}

func TestJWTRejectsExpiredAndForged(t *testing.T) {
	j := NewJWT(secret, TokenTTL)
	expired, _, _ := j.Issue(1, time.Now().Add(-25*time.Hour))
	if _, err := j.Parse(expired); err == nil {
		t.Error("expired token should be rejected")
	}

	other, _, _ := NewJWT("ffffffffffffffffffffffffffffffff", TokenTTL).Issue(1, time.Now())
	if _, err := j.Parse(other); err == nil {
		t.Error("token signed with another key should be rejected")
	}

	if _, err := j.Parse("not-a-jwt"); err == nil {
		t.Error("garbage should be rejected")
	}
}

func TestPassword(t *testing.T) {
	hash, err := HashPassword("pass1234")
	if err != nil {
		t.Fatal(err)
	}
	if hash == "pass1234" || !CheckPassword(hash, "pass1234") || CheckPassword(hash, "pass12345") {
		t.Error("bcrypt hash/check failed")
	}
}
