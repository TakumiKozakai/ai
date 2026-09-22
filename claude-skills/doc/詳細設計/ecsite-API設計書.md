# ecsite API設計書

ECサイトのバックエンド（Go + Gin）が提供する JSON API の仕様。認証・アクセス制御・CSRF対策は「ecsite-画面一覧・共通仕様書.md」の4章、テーブルは「ecsite-ER図・テーブル定義書.md」、各項目の入力チェックの内容とエラーメッセージは各画面設計書の「2.2 サーバー側」を参照。

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

## 2. API一覧

| No. | メソッド | パス | 認証 | 概要 | 使用画面 |
|---|---|---|---|---|---|
| A-01 | GET | `/api/me` | 不要 | ログインユーザーとカート数量の取得 | 共通ヘッダー、ルートガード |
| A-02 | POST | `/api/auth/signup` | 不要 | 会員登録（登録後ログイン状態にする） | SC-06 |
| A-03 | POST | `/api/auth/login` | 不要 | ログイン | SC-07 |
| A-04 | POST | `/api/auth/logout` | 不要 | ログアウト | 共通ヘッダー |
| A-05 | GET | `/api/categories` | 不要 | カテゴリ一覧 | SC-01 |
| A-06 | GET | `/api/products` | 不要 | 商品検索 | SC-01 |
| A-07 | GET | `/api/products/:id` | 不要 | 商品詳細 | SC-02 |
| A-08 | GET | `/api/cart` | 必要 | カート内容 | SC-03 |
| A-09 | POST | `/api/cart/items` | 必要 | カートに追加 | SC-02 |
| A-10 | PATCH | `/api/cart/items/:cartItemId` | 必要 | カート明細の数量変更 | SC-03 |
| A-11 | DELETE | `/api/cart/items/:cartItemId` | 必要 | カート明細の削除 | SC-03 |
| A-12 | GET | `/api/checkout` | 必要 | 購入手続きの表示内容 | SC-04 |
| A-13 | POST | `/api/orders` | 必要 | 注文確定 | SC-04 |
| A-14 | GET | `/api/orders/:orderNumber` | 必要 | 注文内容 | SC-05 |

## 3. API詳細

### A-01 `GET /api/me`

ログイン中なら `200`、未ログイン（JWT が無い・不正・期限切れ・ユーザーが存在しない）なら `401 UNAUTHORIZED`。

```json
{ "id": 1, "name": "山田 太郎", "email": "taro@example.com", "cartQuantity": 3 }
```

- `cartQuantity`: ログインユーザーの `cart_items.quantity` の合計（0件なら 0）。

### A-02 `POST /api/auth/signup`

リクエスト:

```json
{ "name": "山田 太郎", "email": "Taro@Example.com", "password": "pass1234", "passwordConfirm": "pass1234", "phoneNumber": "09012345678" }
```

| ステータス | 条件 | レスポンス |
|---|---|---|
| 201 | 登録成功。`users` を作成し、JWT を Cookie に設定する | A-01 と同じ形式（`cartQuantity` は 0） |
| 400 `VALIDATION_ERROR` | 入力チェックエラー（メールアドレスの重複を含む） | `fieldErrors` のキーは `name`・`email`・`password`・`passwordConfirm`・`phoneNumber` |

- 入力チェックの内容と優先順は「ecsite-会員登録画面設計書.md」の2.2。
- メールアドレスは小文字に変換して保存・照合する。パスワードは bcrypt でハッシュ化して保存する。`phoneNumber` が未入力なら NULL を保存する。
- 保存時に一意制約 `uq_users_email` 違反となった場合（同時登録）も、`email` の重複エラーとして `400` を返す。
- ログイン中に呼び出した場合も登録処理を行う（画面側でログイン中は会員登録画面を表示しない）。

### A-03 `POST /api/auth/login`

リクエスト:

```json
{ "email": "taro@example.com", "password": "pass1234" }
```

| ステータス | 条件 | レスポンス |
|---|---|---|
| 200 | 認証成功。新しい JWT を Cookie に設定する | A-01 と同じ形式 |
| 401 `LOGIN_FAILED` | メールアドレスが未登録、パスワードが不一致、いずれかが未入力 | エラー形式 |

- メールアドレスは前後の空白を除去し小文字に変換してから `users.email` と照合する。パスワードは bcrypt で照合する。
- 入力値の形式チェックは行わない。未登録とパスワード不一致は区別しない。
- ログイン失敗回数によるアカウントロックは行わない。

### A-04 `POST /api/auth/logout`

Cookie `ecsite_token` を削除し、`204` を返す。未ログインで呼び出しても `204`。

### A-05 `GET /api/categories`

`categories` を `display_order` 昇順、同値は `id` 昇順で返す。

```json
[ { "id": 1, "name": "食品" }, { "id": 2, "name": "日用品" } ]
```

### A-06 `GET /api/products`

クエリパラメータ: `keyword`（任意）、`categoryId`（任意）、`page`（任意、1始まり）。

```json
{
  "items": [ { "id": 10, "name": "コーヒー豆", "price": 1980, "imageUrl": null, "inStock": true } ],
  "totalCount": 25,
  "page": 1,
  "totalPages": 2
}
```

| ステータス | 条件 |
|---|---|
| 200 | 検索成功（0件を含む）。0件の場合は `items` が空、`totalCount` が 0、`totalPages` が 0、`page` が 1 |
| 400 `VALIDATION_ERROR` | `keyword` が100文字を超える（`fieldErrors.keyword`） |

- 検索条件・並び順・1ページの件数（20件）、`categoryId`・`page` の不正値の扱いは「ecsite-商品一覧画面設計書.md」の2.2・3.1。
- `page` は補正後の実際のページ番号を返す。
- `inStock`: `stock_quantity` が1以上なら `true`。

### A-07 `GET /api/products/:id`

```json
{ "id": 10, "name": "コーヒー豆", "description": "深煎り...", "price": 1980, "imageUrl": null, "categoryName": "食品", "inStock": true, "maxQuantity": 10 }
```

| ステータス | 条件 |
|---|---|
| 200 | 公開中（`is_published = true`）の商品が存在する |
| 404 `NOT_FOUND` | 存在しない、非公開、`:id` が数値でない |

- `maxQuantity`: カートに入れられる数量の上限。在庫数と10の小さい方（在庫切れなら 0）。在庫数そのものは返さない。

### A-08 `GET /api/cart`

```json
{
  "items": [
    {
      "cartItemId": 5, "productId": 10, "productName": "コーヒー豆", "imageUrl": null,
      "unitPrice": 1980, "quantity": 2, "subtotal": 3960,
      "published": true, "problem": null, "stockQuantity": null
    }
  ],
  "totalQuantity": 2,
  "subtotalAmount": 3960,
  "purchasable": true
}
```

- `items` は `cart_items.created_at` の昇順。`unitPrice` は現在の `products.price`。
- `problem`: 購入できない理由。`null`（購入可）、`UNPUBLISHED`（非公開）、`OUT_OF_STOCK`（在庫0）、`INSUFFICIENT_STOCK`（在庫が1以上かつ数量より少ない）。判定の優先順はこの順。
- `stockQuantity`: `problem` が `INSUFFICIENT_STOCK` のときのみ在庫数、それ以外は `null`。
- `purchasable`: カートが1件以上あり、かつ全明細の `problem` が `null` のとき `true`。

### A-09 `POST /api/cart/items`

リクエスト:

```json
{ "productId": 10, "quantity": 2 }
```

| ステータス | `code` | 条件 |
|---|---|---|
| 201 | - | 追加成功。レスポンスは `{ "cartQuantity": 5 }`（追加後のカート数量の合計） |
| 404 | `NOT_FOUND` | 商品が存在しない・非公開・`productId` が数値でない |
| 400 | `VALIDATION_ERROR` | `quantity` が1〜10の整数でない（`fieldErrors.quantity`） |
| 400 | `CART_QUANTITY_LIMIT` | カート内の数量との合計が10を超える |
| 400 | `INSUFFICIENT_STOCK` | カート内の数量との合計が在庫数を超える |

- チェック順・メッセージ・追加処理（同じ商品は数量を加算）は「ecsite-商品詳細画面設計書.md」の2.2・3.3。

### A-10 `PATCH /api/cart/items/:cartItemId`

リクエスト:

```json
{ "quantity": 3 }
```

| ステータス | `code` | 条件 |
|---|---|---|
| 200 | - | 変更成功。レスポンスは A-08 と同じ形式（変更後のカート全体） |
| 404 | `NOT_FOUND` | ログインユーザーの明細として存在しない |
| 400 | `VALIDATION_ERROR` | `quantity` が1〜10の整数でない（`fieldErrors.quantity`） |
| 400 | `PRODUCT_UNPUBLISHED` | 商品が非公開 |
| 400 | `INSUFFICIENT_STOCK` | 数量が在庫数を超える |

- チェック順・メッセージは「ecsite-カート画面設計書.md」の2.2。

### A-11 `DELETE /api/cart/items/:cartItemId`

| ステータス | 条件 |
|---|---|
| 200 | 削除成功。レスポンスは A-08 と同じ形式（削除後のカート全体） |
| 404 `NOT_FOUND` | ログインユーザーの明細として存在しない |

### A-12 `GET /api/checkout`

```json
{
  "items": [ { "productName": "コーヒー豆", "unitPrice": 1980, "quantity": 2, "subtotal": 3960 } ],
  "subtotalAmount": 3960,
  "shippingFee": 500,
  "totalAmount": 4460,
  "addresses": [
    { "id": 3, "recipientName": "山田 太郎", "postalCode": "1234567", "prefecture": "東京都", "city": "千代田区",
      "addressLine": "1-1-1", "building": null, "phoneNumber": "09012345678", "isDefault": true }
  ],
  "prefectures": ["北海道", "青森県", "...", "沖縄県"]
}
```

| ステータス | `code` | 条件 |
|---|---|---|
| 200 | - | 表示可能 |
| 409 | `CART_EMPTY` | カートが0件（`message`:「カートに商品が入っていません」） |
| 409 | `CART_NOT_PURCHASABLE` | 購入できない明細がある（`message`:「購入できない商品がカートに含まれています。数量を変更するか削除してください」） |

- `addresses` は既定の住所を先頭、以降は `created_at` 昇順。送料の計算は「ecsite-購入手続き画面設計書.md」の1.2。
- `prefectures` は47都道府県（JIS X 0401 の順）。

### A-13 `POST /api/orders`

リクエスト:

```json
{
  "addressId": "new",
  "newAddress": { "recipientName": "山田 太郎", "postalCode": "1234567", "prefecture": "東京都", "city": "千代田区",
                  "addressLine": "1-1-1", "building": "", "phoneNumber": "09012345678" },
  "paymentMethod": "CREDIT_CARD"
}
```

- `addressId`: 登録済み住所を使う場合はその `addresses.id`（文字列）、新しい住所を使う場合は `"new"`。
- `newAddress`: `addressId` が `"new"` のときのみ使用する。それ以外のときは内容を無視する。

| ステータス | `code` | 条件 |
|---|---|---|
| 201 | - | 注文確定。レスポンスは `{ "orderNumber": "20260921-483920" }` |
| 400 | `VALIDATION_ERROR` | 入力チェックエラー。`fieldErrors` のキーは `addressId`・`recipientName`・`postalCode`・`prefecture`・`city`・`addressLine`・`building`・`phoneNumber`・`paymentMethod` |
| 409 | `CART_EMPTY` | カートが0件（A-12 と同じメッセージ） |
| 409 | `CART_NOT_PURCHASABLE` | 購入できない明細がある（A-12 と同じメッセージ） |
| 409 | `ORDER_CONFLICT` | 在庫更新が他の購入と競合した（`message`:「他のお客様の購入と重なったため注文を確定できませんでした。カートの内容を確認して、もう一度お試しください」） |

- 入力チェックの内容は「ecsite-購入手続き画面設計書.md」の2.2、注文確定処理（トランザクション・注文番号の採番）は同3.3。
- 入力チェックを先に行い、エラーが無い場合のみカートのチェック（409）を行う。

### A-14 `GET /api/orders/:orderNumber`

```json
{
  "orderNumber": "20260921-483920",
  "orderedAt": "2026-09-21T14:05:00+09:00",
  "paymentMethod": "CREDIT_CARD",
  "shipping": { "recipientName": "山田 太郎", "postalCode": "1234567", "prefecture": "東京都", "city": "千代田区",
                "addressLine": "1-1-1", "building": null, "phoneNumber": "09012345678" },
  "items": [ { "productName": "コーヒー豆", "unitPrice": 1980, "quantity": 2, "subtotal": 3960 } ],
  "subtotalAmount": 3960,
  "shippingFee": 500,
  "totalAmount": 4460
}
```

| ステータス | 条件 |
|---|---|
| 200 | ログインユーザーの注文として存在する |
| 404 `NOT_FOUND` | 存在しない、他ユーザーの注文 |

- 値はすべて `orders`・`order_items` に保存された購入時点の値。`items` は `order_items.id` の昇順。
