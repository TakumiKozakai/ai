// Package apperr defines API errors returned to the client in the common error format
// (see doc/詳細設計/ecsite-API設計書.md 1.2).
package apperr

import "net/http"

type Error struct {
	Status      int               `json:"-"`
	Code        string            `json:"code"`
	Message     string            `json:"message"`
	FieldErrors map[string]string `json:"fieldErrors,omitempty"`
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

func New(status int, code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}

func Validation(fieldErrors map[string]string) *Error {
	return &Error{Status: http.StatusBadRequest, Code: "VALIDATION_ERROR", Message: "入力内容に誤りがあります", FieldErrors: fieldErrors}
}

func BadRequest() *Error {
	return New(http.StatusBadRequest, "BAD_REQUEST", "リクエストが不正です")
}

func Unauthorized() *Error {
	return New(http.StatusUnauthorized, "UNAUTHORIZED", "ログインしてください")
}

func LoginFailed() *Error {
	return New(http.StatusUnauthorized, "LOGIN_FAILED", "メールアドレスまたはパスワードが正しくありません")
}

func Forbidden() *Error {
	return New(http.StatusForbidden, "FORBIDDEN", "リクエストが不正です")
}

func NotFound() *Error {
	return New(http.StatusNotFound, "NOT_FOUND", "ページが見つかりません")
}

func Internal() *Error {
	return New(http.StatusInternalServerError, "INTERNAL_ERROR", "システムエラーが発生しました")
}

func CartEmpty() *Error {
	return New(http.StatusConflict, "CART_EMPTY", "カートに商品が入っていません")
}

func CartNotPurchasable() *Error {
	return New(http.StatusConflict, "CART_NOT_PURCHASABLE", "購入できない商品がカートに含まれています。数量を変更するか削除してください")
}

func OrderConflict() *Error {
	return New(http.StatusConflict, "ORDER_CONFLICT", "他のお客様の購入と重なったため注文を確定できませんでした。カートの内容を確認して、もう一度お試しください")
}
