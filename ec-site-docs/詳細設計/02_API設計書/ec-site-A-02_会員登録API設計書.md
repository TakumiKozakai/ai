# ec-site 会員登録API設計書

| 項目 | 内容 |
|---|---|
| API番号 | A-02 |
| メソッド | POST |
| パス | `/api/auth/signup` |
| 認証 | 不要 |
| 概要 | 会員登録（登録後ログイン状態にする） |
| 使用画面 | SC-06 |

## 1. API詳細

### A-02 `POST /api/auth/signup`

リクエスト:

```json
{ "name": "山田 太郎", "email": "Taro@Example.com", "password": "pass1234", "passwordConfirm": "pass1234", "phoneNumber": "09012345678" }
```

| ステータス | 条件 | レスポンス |
|---|---|---|
| 201 | 登録成功。`users` を作成し、JWT を Cookie に設定する | A-01 と同じ形式（`cartQuantity` は 0） |
| 400 `VALIDATION_ERROR` | 入力チェックエラー（メールアドレスの重複を含む） | `fieldErrors` のキーは `name`・`email`・`password`・`passwordConfirm`・`phoneNumber` |

- 入力チェックの内容と優先順は「ec-site-SC-06_会員登録画面設計書.md」の2.2。
- メールアドレスは小文字に変換して保存・照合する。パスワードは bcrypt でハッシュ化して保存する。`phoneNumber` が未入力なら NULL を保存する。
- 保存時に一意制約 `uq_users_email` 違反となった場合（同時登録）も、`email` の重複エラーとして `400` を返す。
- ログイン中に呼び出した場合も登録処理を行う（画面側でログイン中は会員登録画面を表示しない）。

## 2. 関連資料

- [API一覧](ec-site-API一覧.md)
- [API共通仕様書](ec-site-API共通仕様書.md)
- [テーブル定義書](../../基本設計/ec-site-テーブル定義書.md)
- [A-01 ログインユーザー取得API設計書](ec-site-A-01_ログインユーザー取得API設計書.md)
- [ec-site-会員登録画面設計書](../01_画面設計書/ec-site-SC-06_会員登録画面設計書.md)
