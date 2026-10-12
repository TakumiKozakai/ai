# ec-site 商品詳細取得API設計書

| 項目 | 内容 |
|---|---|
| API番号 | A-07 |
| メソッド | GET |
| パス | `/api/products/:id` |
| 認証 | 不要 |
| 概要 | 商品詳細 |
| 使用画面 | SC-02 |

## 1. API詳細

### A-07 `GET /api/products/:id`

```json
{ "id": 10, "name": "コーヒー豆", "description": "深煎り...", "price": 1980, "imageUrl": null, "categoryName": "食品", "inStock": true, "maxQuantity": 10 }
```

| ステータス | 条件 |
|---|---|
| 200 | 公開中（`is_published = true`）の商品が存在する |
| 404 `NOT_FOUND` | 存在しない、非公開、`:id` が数値でない |

- `maxQuantity`: カートに入れられる数量の上限。在庫数と10の小さい方（在庫切れなら 0）。在庫数そのものは返さない。

## 2. 関連資料

- [API一覧](ec-site-API一覧.md)
- [API共通仕様書](ec-site-API共通仕様書.md)
- [テーブル定義書](../../基本設計/ec-site-テーブル定義書.md)
- [ec-site-商品詳細画面設計書](../01_画面設計書/ec-site-SC-02_商品詳細画面設計書.md)
