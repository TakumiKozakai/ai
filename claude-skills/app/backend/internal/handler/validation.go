package handler

import (
	"bytes"
	"encoding/json"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"ecsite/internal/model"
	"ecsite/internal/service"
)

var (
	emailPattern      = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
	passwordCharset   = regexp.MustCompile(`^[\x21-\x7E]+$`)
	hasLetter         = regexp.MustCompile(`[A-Za-z]`)
	hasDigit          = regexp.MustCompile(`[0-9]`)
	postalCodePattern = regexp.MustCompile(`^[0-9]{7}$`)
	phonePattern      = regexp.MustCompile(`^[0-9]{10,11}$`)
)

// fieldErrors keeps only the first error of each field.
type fieldErrors map[string]string

func (f fieldErrors) add(field, message string) {
	if _, ok := f[field]; !ok {
		f[field] = message
	}
}

func (f fieldErrors) has(field string) bool {
	_, ok := f[field]
	return ok
}

// trim removes leading and trailing half-width and full-width spaces.
func trim(s string) string { return strings.TrimSpace(s) }

func runeLen(s string) int { return utf8.RuneCountInString(s) }

// parseJSONInt accepts only a JSON integer number (not a string, float or null).
func parseJSONInt(raw json.RawMessage) (int64, bool) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return 0, false
	}
	n, ok := v.(json.Number)
	if !ok {
		return 0, false
	}
	i, err := strconv.ParseInt(string(n), 10, 64)
	return i, err == nil
}

// validateKeyword returns the trimmed keyword and an error message ("" when valid). SC-01 2.2.
func validateKeyword(raw string) (string, string) {
	k := trim(raw)
	if runeLen(k) > 100 {
		return k, "キーワードは100文字以内で入力してください"
	}
	return k, ""
}

// validQuantity reports whether the quantity is an integer between 1 and 10.
func validQuantity(q int64, ok bool) bool {
	return ok && q >= 1 && q <= service.MaxQuantityPerItem
}

type signupRequest struct {
	Name            string `json:"name"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	PasswordConfirm string `json:"passwordConfirm"`
	PhoneNumber     string `json:"phoneNumber"`
}

// validateSignup normalizes the request and validates it (SC-06 2.2) except the email
// duplicate check, which needs the database.
func validateSignup(r *signupRequest) fieldErrors {
	fe := fieldErrors{}
	r.Name = trim(r.Name)
	r.Email = strings.ToLower(trim(r.Email))
	r.PhoneNumber = trim(r.PhoneNumber)

	switch {
	case r.Name == "":
		fe.add("name", "氏名を入力してください")
	case runeLen(r.Name) > 100:
		fe.add("name", "氏名は100文字以内で入力してください")
	}

	switch {
	case r.Email == "":
		fe.add("email", "メールアドレスを入力してください")
	case runeLen(r.Email) > 255:
		fe.add("email", "メールアドレスは255文字以内で入力してください")
	case !emailPattern.MatchString(r.Email):
		fe.add("email", "メールアドレスの形式が正しくありません")
	}

	switch n := runeLen(r.Password); {
	case r.Password == "":
		fe.add("password", "パスワードを入力してください")
	case n < 8 || n > 64:
		fe.add("password", "パスワードは8〜64文字で入力してください")
	case !passwordCharset.MatchString(r.Password):
		fe.add("password", "パスワードに使用できるのは半角英数字と記号のみです")
	case !hasLetter.MatchString(r.Password) || !hasDigit.MatchString(r.Password):
		fe.add("password", "パスワードは英字と数字をそれぞれ1文字以上含めてください")
	}

	switch {
	case r.PasswordConfirm == "":
		fe.add("passwordConfirm", "パスワード（確認）を入力してください")
	case !fe.has("password") && r.PasswordConfirm != r.Password:
		fe.add("passwordConfirm", "パスワードが一致しません")
	}

	if r.PhoneNumber != "" && !phonePattern.MatchString(r.PhoneNumber) {
		fe.add("phoneNumber", "電話番号はハイフンなしの半角数字10〜11桁で入力してください")
	}
	return fe
}

type newAddressRequest struct {
	RecipientName string `json:"recipientName"`
	PostalCode    string `json:"postalCode"`
	Prefecture    string `json:"prefecture"`
	City          string `json:"city"`
	AddressLine   string `json:"addressLine"`
	Building      string `json:"building"`
	PhoneNumber   string `json:"phoneNumber"`
}

// validateNewAddress normalizes and validates the new address (SC-04 2.2).
func validateNewAddress(a *newAddressRequest, fe fieldErrors) service.NewAddressInput {
	in := service.NewAddressInput{
		RecipientName: trim(a.RecipientName), PostalCode: trim(a.PostalCode), Prefecture: trim(a.Prefecture),
		City: trim(a.City), AddressLine: trim(a.AddressLine), Building: trim(a.Building), PhoneNumber: trim(a.PhoneNumber),
	}
	requiredMax := func(field, value, label string, max int) {
		switch {
		case value == "":
			fe.add(field, label+"を入力してください")
		case runeLen(value) > max:
			fe.add(field, label+"は"+strconv.Itoa(max)+"文字以内で入力してください")
		}
	}

	requiredMax("recipientName", in.RecipientName, "宛名", 100)

	switch {
	case in.PostalCode == "":
		fe.add("postalCode", "郵便番号を入力してください")
	case !postalCodePattern.MatchString(in.PostalCode):
		fe.add("postalCode", "郵便番号はハイフンなしの半角数字7桁で入力してください")
	}

	if !slices.Contains(model.Prefectures, in.Prefecture) {
		fe.add("prefecture", "都道府県を選択してください")
	}

	requiredMax("city", in.City, "市区町村", 100)
	requiredMax("addressLine", in.AddressLine, "町名・番地", 200)

	if runeLen(in.Building) > 200 {
		fe.add("building", "建物名は200文字以内で入力してください")
	}

	switch {
	case in.PhoneNumber == "":
		fe.add("phoneNumber", "電話番号を入力してください")
	case !phonePattern.MatchString(in.PhoneNumber):
		fe.add("phoneNumber", "電話番号はハイフンなしの半角数字10〜11桁で入力してください")
	}
	return in
}

func validPaymentMethod(m string) bool {
	return slices.Contains(model.PaymentMethods, m)
}
