# ecsite 注文確定API設計書

| 項目 | 内容 |
|---|---|
| API番号 | A-13 |
| メソッド | POST |
| パス | `/api/orders` |
| 認証 | 必要 |
| 概要 | 注文確定 |
| 使用画面 | SC-04 |

## 1. API詳細

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

- 入力チェックの内容は「ecsite-SC-04_購入手続き画面設計書.md」の2.2、注文確定処理（トランザクション・注文番号の採番）は同3.3。
- 入力チェックを先に行い、エラーが無い場合のみカートのチェック（409）を行う。

## 2. 関連資料

- [API一覧](ecsite-API一覧.md)
- [API共通仕様書](ecsite-API共通仕様書.md)
- [テーブル定義書](../../基本設計/ecsite-テーブル定義書.md)
- [A-12 購入手続き情報取得API設計書](ecsite-A-12_購入手続き情報取得API設計書.md)
- [ecsite-購入手続き画面設計書](../01_画面設計書/ecsite-SC-04_購入手続き画面設計書.md)
