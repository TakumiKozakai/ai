# ecsite 注文内容取得API設計書

| 項目 | 内容 |
|---|---|
| API番号 | A-14 |
| メソッド | GET |
| パス | `/api/orders/:orderNumber` |
| 認証 | 必要 |
| 概要 | 注文内容 |
| 使用画面 | SC-05 |

## 1. API詳細

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

## 2. 関連資料

- [API一覧](ecsite-API一覧.md)
- [API共通仕様書](ecsite-API共通仕様書.md)
- [テーブル定義書](../../基本設計/ecsite-テーブル定義書.md)
- [ecsite-注文完了画面設計書](../01_画面設計書/ecsite-SC-05_注文完了画面設計書.md)
