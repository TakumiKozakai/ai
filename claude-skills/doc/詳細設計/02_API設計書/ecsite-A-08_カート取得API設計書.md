# ecsite カート取得API設計書

| 項目 | 内容 |
|---|---|
| API番号 | A-08 |
| メソッド | GET |
| パス | `/api/cart` |
| 認証 | 必要 |
| 概要 | カート内容 |
| 使用画面 | SC-03 |

## 1. API詳細

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

## 2. 関連資料

- [API一覧](ecsite-API一覧.md)
- [API共通仕様書](ecsite-API共通仕様書.md)
- [テーブル定義書](../../基本設計/ecsite-テーブル定義書.md)
- [ecsite-カート画面設計書](../01_画面設計書/ecsite-SC-03_カート画面設計書.md)
