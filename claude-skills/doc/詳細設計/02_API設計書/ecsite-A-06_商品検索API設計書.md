# ecsite 商品検索API設計書

| 項目 | 内容 |
|---|---|
| API番号 | A-06 |
| メソッド | GET |
| パス | `/api/products` |
| 認証 | 不要 |
| 概要 | 商品検索 |
| 使用画面 | SC-01 |

## 1. API詳細

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

- 検索条件・並び順・1ページの件数（20件）、`categoryId`・`page` の不正値の扱いは「ecsite-SC-01_商品一覧画面設計書.md」の2.2・3.1。
- `page` は補正後の実際のページ番号を返す。
- `inStock`: `stock_quantity` が1以上なら `true`。

## 2. 関連資料

- [API一覧](ecsite-API一覧.md)
- [API共通仕様書](ecsite-API共通仕様書.md)
- [テーブル定義書](../../基本設計/ecsite-テーブル定義書.md)
- [ecsite-商品一覧画面設計書](../01_画面設計書/ecsite-SC-01_商品一覧画面設計書.md)
