# ec-site カテゴリ一覧取得API設計書

| 項目 | 内容 |
|---|---|
| API番号 | A-05 |
| メソッド | GET |
| パス | `/api/categories` |
| 認証 | 不要 |
| 概要 | カテゴリ一覧 |
| 使用画面 | SC-01 |

## 1. API詳細

### A-05 `GET /api/categories`

`categories` を `display_order` 昇順、同値は `id` 昇順で返す。

```json
[ { "id": 1, "name": "食品" }, { "id": 2, "name": "日用品" } ]
```

## 2. 関連資料

- [API一覧](ec-site-API一覧.md)
- [API共通仕様書](ec-site-API共通仕様書.md)
- [テーブル定義書](../../基本設計/ec-site-テーブル定義書.md)
- [ec-site-商品一覧画面設計書](../01_画面設計書/ec-site-SC-01_商品一覧画面設計書.md)
