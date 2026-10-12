# ec-site 購入手続き情報取得API設計書

| 項目 | 内容 |
|---|---|
| API番号 | A-12 |
| メソッド | GET |
| パス | `/api/checkout` |
| 認証 | 必要 |
| 概要 | 購入手続きの表示内容 |
| 使用画面 | SC-04 |

## 1. API詳細

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

- `addresses` は既定の住所を先頭、以降は `created_at` 昇順。送料の計算は「ec-site-SC-04_購入手続き画面設計書.md」の1.2。
- `prefectures` は47都道府県（JIS X 0401 の順）。

## 2. 関連資料

- [API一覧](ec-site-API一覧.md)
- [API共通仕様書](ec-site-API共通仕様書.md)
- [テーブル定義書](../../基本設計/ec-site-テーブル定義書.md)
- [ec-site-購入手続き画面設計書](../01_画面設計書/ec-site-SC-04_購入手続き画面設計書.md)
