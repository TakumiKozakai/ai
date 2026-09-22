package handler

import (
	"encoding/json"
	"strings"
	"testing"
)

func validSignup() signupRequest {
	return signupRequest{Name: "山田 太郎", Email: "taro@example.com", Password: "pass1234", PasswordConfirm: "pass1234", PhoneNumber: "09012345678"}
}

func TestValidateSignup_Valid(t *testing.T) {
	r := validSignup()
	r.Name = "　山田 太郎 "
	r.Email = " Taro@Example.COM "
	if fe := validateSignup(&r); len(fe) != 0 {
		t.Fatalf("unexpected errors: %v", fe)
	}
	if r.Name != "山田 太郎" || r.Email != "taro@example.com" {
		t.Errorf("not normalized: name=%q email=%q", r.Name, r.Email)
	}
}

func TestValidateSignup_Errors(t *testing.T) {
	tests := []struct {
		name   string
		modify func(*signupRequest)
		field  string
		want   string
	}{
		{"name blank", func(r *signupRequest) { r.Name = "　 " }, "name", "氏名を入力してください"},
		{"name too long", func(r *signupRequest) { r.Name = strings.Repeat("あ", 101) }, "name", "氏名は100文字以内で入力してください"},
		{"email blank", func(r *signupRequest) { r.Email = " " }, "email", "メールアドレスを入力してください"},
		{"email too long", func(r *signupRequest) { r.Email = strings.Repeat("a", 244) + "@example.com" }, "email", "メールアドレスは255文字以内で入力してください"},
		{"email without dot", func(r *signupRequest) { r.Email = "user@localhost" }, "email", "メールアドレスの形式が正しくありません"},
		{"password empty", func(r *signupRequest) { r.Password = "" }, "password", "パスワードを入力してください"},
		{"password short", func(r *signupRequest) { r.Password, r.PasswordConfirm = "pass123", "pass123" }, "password", "パスワードは8〜64文字で入力してください"},
		{"password long", func(r *signupRequest) { r.Password = strings.Repeat("a1", 33) }, "password", "パスワードは8〜64文字で入力してください"},
		{"password full-width", func(r *signupRequest) { r.Password = "pass１２３４" }, "password", "パスワードに使用できるのは半角英数字と記号のみです"},
		{"password space", func(r *signupRequest) { r.Password = "pass 1234" }, "password", "パスワードに使用できるのは半角英数字と記号のみです"},
		{"password letters only", func(r *signupRequest) { r.Password = "password" }, "password", "パスワードは英字と数字をそれぞれ1文字以上含めてください"},
		{"password digits and symbols", func(r *signupRequest) { r.Password = "1234!!!!" }, "password", "パスワードは英字と数字をそれぞれ1文字以上含めてください"},
		{"confirm empty", func(r *signupRequest) { r.PasswordConfirm = "" }, "passwordConfirm", "パスワード（確認）を入力してください"},
		{"confirm mismatch", func(r *signupRequest) { r.PasswordConfirm = "pass12345" }, "passwordConfirm", "パスワードが一致しません"},
		{"phone hyphen", func(r *signupRequest) { r.PhoneNumber = "090-1234-5678" }, "phoneNumber", "電話番号はハイフンなしの半角数字10〜11桁で入力してください"},
		{"phone short", func(r *signupRequest) { r.PhoneNumber = "012345678" }, "phoneNumber", "電話番号はハイフンなしの半角数字10〜11桁で入力してください"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := validSignup()
			tt.modify(&r)
			fe := validateSignup(&r)
			if got := fe[tt.field]; got != tt.want {
				t.Errorf("%s = %q, want %q (all: %v)", tt.field, got, tt.want, fe)
			}
		})
	}
}

func TestValidateSignup_ConfirmSkippedWhenPasswordInvalid(t *testing.T) {
	r := validSignup()
	r.Password, r.PasswordConfirm = "password", "different1"
	fe := validateSignup(&r)
	if _, ok := fe["passwordConfirm"]; ok {
		t.Errorf("passwordConfirm should not be checked: %v", fe)
	}
}

func TestValidateSignup_PhoneOptional(t *testing.T) {
	r := validSignup()
	r.PhoneNumber = " "
	if fe := validateSignup(&r); len(fe) != 0 || r.PhoneNumber != "" {
		t.Errorf("errors=%v phone=%q", fe, r.PhoneNumber)
	}
}

func validAddress() newAddressRequest {
	return newAddressRequest{RecipientName: "山田 太郎", PostalCode: "1234567", Prefecture: "東京都", City: "千代田区", AddressLine: "1-1-1", PhoneNumber: "0312345678"}
}

func TestValidateNewAddress(t *testing.T) {
	tests := []struct {
		name   string
		modify func(*newAddressRequest)
		field  string
		want   string
	}{
		{"recipient blank", func(a *newAddressRequest) { a.RecipientName = "" }, "recipientName", "宛名を入力してください"},
		{"recipient long", func(a *newAddressRequest) { a.RecipientName = strings.Repeat("あ", 101) }, "recipientName", "宛名は100文字以内で入力してください"},
		{"postal blank", func(a *newAddressRequest) { a.PostalCode = "" }, "postalCode", "郵便番号を入力してください"},
		{"postal hyphen", func(a *newAddressRequest) { a.PostalCode = "123-4567" }, "postalCode", "郵便番号はハイフンなしの半角数字7桁で入力してください"},
		{"postal full-width", func(a *newAddressRequest) { a.PostalCode = "１２３４５６７" }, "postalCode", "郵便番号はハイフンなしの半角数字7桁で入力してください"},
		{"prefecture blank", func(a *newAddressRequest) { a.Prefecture = "" }, "prefecture", "都道府県を選択してください"},
		{"prefecture unknown", func(a *newAddressRequest) { a.Prefecture = "東京" }, "prefecture", "都道府県を選択してください"},
		{"city blank", func(a *newAddressRequest) { a.City = "" }, "city", "市区町村を入力してください"},
		{"city long", func(a *newAddressRequest) { a.City = strings.Repeat("あ", 101) }, "city", "市区町村は100文字以内で入力してください"},
		{"address line blank", func(a *newAddressRequest) { a.AddressLine = "" }, "addressLine", "町名・番地を入力してください"},
		{"address line long", func(a *newAddressRequest) { a.AddressLine = strings.Repeat("あ", 201) }, "addressLine", "町名・番地は200文字以内で入力してください"},
		{"building long", func(a *newAddressRequest) { a.Building = strings.Repeat("あ", 201) }, "building", "建物名は200文字以内で入力してください"},
		{"phone blank", func(a *newAddressRequest) { a.PhoneNumber = "" }, "phoneNumber", "電話番号を入力してください"},
		{"phone 12 digits", func(a *newAddressRequest) { a.PhoneNumber = "090123456789" }, "phoneNumber", "電話番号はハイフンなしの半角数字10〜11桁で入力してください"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := validAddress()
			tt.modify(&a)
			fe := fieldErrors{}
			validateNewAddress(&a, fe)
			if got := fe[tt.field]; got != tt.want {
				t.Errorf("%s = %q, want %q (all: %v)", tt.field, got, tt.want, fe)
			}
			if len(fe) != 1 {
				t.Errorf("want exactly one error, got %v", fe)
			}
		})
	}

	a := validAddress()
	a.Building = strings.Repeat("あ", 200)
	fe := fieldErrors{}
	if in := validateNewAddress(&a, fe); len(fe) != 0 || in.Building == "" {
		t.Errorf("200-char building should be valid: %v", fe)
	}
}

func TestValidateKeyword(t *testing.T) {
	if k, msg := validateKeyword("　" + strings.Repeat("a", 100) + " "); msg != "" || len(k) != 100 {
		t.Errorf("100 chars after trim should be valid: %q %q", k, msg)
	}
	if _, msg := validateKeyword(strings.Repeat("あ", 101)); msg != "キーワードは100文字以内で入力してください" {
		t.Errorf("101 chars: %q", msg)
	}
}

func TestParseJSONIntAndQuantity(t *testing.T) {
	tests := []struct {
		raw   string
		valid bool
	}{
		{`1`, true}, {`10`, true}, {`0`, false}, {`11`, false}, {`2.5`, false},
		{`"2"`, false}, {`null`, false}, {``, false}, {`-1`, false},
	}
	for _, tt := range tests {
		q, ok := parseJSONInt(json.RawMessage(tt.raw))
		if got := validQuantity(q, ok); got != tt.valid {
			t.Errorf("quantity %s: valid=%v, want %v", tt.raw, got, tt.valid)
		}
	}
}

func TestValidPaymentMethod(t *testing.T) {
	for _, m := range []string{"CREDIT_CARD", "BANK_TRANSFER", "CASH_ON_DELIVERY"} {
		if !validPaymentMethod(m) {
			t.Errorf("%s should be valid", m)
		}
	}
	for _, m := range []string{"", "credit_card", "PAYPAY"} {
		if validPaymentMethod(m) {
			t.Errorf("%q should be invalid", m)
		}
	}
}
