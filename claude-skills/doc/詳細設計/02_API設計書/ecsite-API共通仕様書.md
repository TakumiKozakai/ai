# ecsite API共通仕様書

全APIに共通する通信形式・認証・アクセス制御・例外処理を定義する。個別APIは [API一覧](ecsite-API一覧.md)、構成は [システム構成設計書](../../基本設計/ecsite-システム構成設計書.md) を参照。

## 1. 共通仕様

### 1.1 リクエスト

- ベースパスは `/api`。リクエストボディは JSON（`Content-Type: application/json`、UTF-8）。
- 状態を変更するAPI（`POST`・`PATCH`・`DELETE`）はヘッダー `X-Requested-With: XMLHttpRequest` が必須（無い場合は `403`）。
- 認証は Cookie `ecsite_token`（JWT）で行う。
- JSON のキーはキャメルケース（例: `productId`）とする。

### 1.2 レスポンス

- 成功時は JSON を返す（本文が無い場合は `204 No Content`）。金額は整数（円）、日時は ISO 8601（`+09:00`）。
- エラー時は以下の形式の JSON を返す。

```json
{
  "code": "VALIDATION_ERROR",
  "message": "入力内容に誤りがあります",
  "fieldErrors": { "email": "このメールアドレスは既に登録されています" }
}
```

| キー | 型 | 説明 |
|---|---|---|
| `code` | string | エラー種別（下表） |
| `message` | string | 画面にそのまま表示できるメッセージ |
| `fieldErrors` | object | `VALIDATION_ERROR` のときのみ。キーは項目名、値はその項目のエラーメッセージ（1項目につき1つ） |

| HTTPステータス | `code` | `message` | 用途 |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | 「入力内容に誤りがあります」 | 入力チェックエラー。項目ごとのメッセージは `fieldErrors` |
| 400 | 各APIで定義（例: `CART_QUANTITY_LIMIT`） | 各APIで定義 | 項目に紐づかない業務エラー |
| 400 | `BAD_REQUEST` | 「リクエストが不正です」 | JSON として解析できない、型が違う等 |
| 401 | `UNAUTHORIZED` | 「ログインしてください」 | 未ログイン、JWT が不正・期限切れ |
| 401 | `LOGIN_FAILED` | 「メールアドレスまたはパスワードが正しくありません」 | ログイン失敗（`POST /api/auth/login` のみ） |
| 403 | `FORBIDDEN` | 「リクエストが不正です」 | `X-Requested-With` ヘッダーが無い |
| 404 | `NOT_FOUND` | 「ページが見つかりません」 | 存在しない・他ユーザーのリソース、パスのIDが数値でない、存在しないAPI |
| 409 | 各APIで定義（例: `CART_EMPTY`） | 各APIで定義 | カートの状態等により処理できない |
| 500 | `INTERNAL_ERROR` | 「システムエラーが発生しました」 | 上記以外（DBアクセス例外等）。詳細はログにのみ出力 |

- 入力チェックは、文字列項目の前後の空白（半角・全角スペース）を除去してから行う（パスワードを除く）。
- 項目が JSON に無い場合と `null` の場合は、未入力として扱う。

## 2. 認証・アクセス制御

### 2.1 JWT

- ログイン・会員登録に成功すると、バックエンドが JWT を発行し、Cookie `ecsite_token` に設定する。
  - 署名方式: HS256（鍵は環境変数 `JWT_SECRET`）
  - クレーム: `sub`（ユーザーID）、`iat`（発行日時）、`exp`（有効期限。発行から24時間）
  - Cookie 属性: `HttpOnly`、`SameSite=Lax`、`Path=/`、有効期限は JWT と同じ24時間。`Secure` は環境変数 `COOKIE_SECURE=true` のとき付与する（ローカルの http では付与しない）
- JWT は `HttpOnly` Cookie に入れ、トークンを Cookie 以外に出さない。画面側のログイン状態の判定は [画面共通仕様書](../01_画面設計書/ecsite-画面共通仕様書.md) を参照。
- リフレッシュトークンは使わない。有効期限が切れたら再ログインが必要になる。
- ログアウト（`POST /api/auth/logout`）は Cookie `ecsite_token` を削除する。JWT はサーバー側で無効化しないため、Cookie 以外の経路でトークンを保持していれば有効期限まで使える（本アプリではトークンを Cookie 以外に出さない）。
- ログインのたびに新しい JWT を発行する。

### 2.2 API のアクセス制御

- **ログイン不要のAPI**: `GET /api/me`（未ログインなら401を返す）、`GET /api/categories`、`GET /api/products`、`GET /api/products/:id`、`POST /api/auth/signup`、`POST /api/auth/login`、`POST /api/auth/logout`。
- **ログイン必要のAPI**: 上記以外（カート・購入手続き・注文）。Cookie の JWT が無い・署名不正・有効期限切れ・ユーザーが存在しない場合は `401` を返す。
- 他ユーザーのデータ（カート明細・住所・注文）は、すべて「ID かつ ログインユーザーの `user_id`」で検索し、他ユーザーのデータは存在しないもの（`404`）として扱う。

### 2.3 CSRF 対策

- Cookie は `SameSite=Lax` のため、他サイトから送信された POST 等のリクエストには JWT が付かない。
- 加えて、状態を変更するAPI（`POST`・`PATCH`・`DELETE`）はリクエストヘッダー `X-Requested-With: XMLHttpRequest` を必須とし、無い場合は `403` を返す。

## 3. 例外処理

- 例外の詳細（スタックトレース・エラーメッセージ）は画面・APIのレスポンスに含めず、バックエンドのログにのみ出力する。
- バックエンドで例外が発生した場合、処理中のトランザクションはロールバックされ、DBは処理前の状態のままとなる。
