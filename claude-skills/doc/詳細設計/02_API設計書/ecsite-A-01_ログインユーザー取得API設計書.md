# ecsite ログインユーザー取得API設計書

| 項目 | 内容 |
|---|---|
| API番号 | A-01 |
| メソッド | GET |
| パス | `/api/me` |
| 認証 | 不要 |
| 概要 | ログインユーザーとカート数量の取得 |
| 使用画面 | 共通ヘッダー、ルートガード |

## 1. API詳細

### A-01 `GET /api/me`

ログイン中なら `200`、未ログイン（JWT が無い・不正・期限切れ・ユーザーが存在しない）なら `401 UNAUTHORIZED`。

```json
{ "id": 1, "name": "山田 太郎", "email": "taro@example.com", "cartQuantity": 3 }
```

- `cartQuantity`: ログインユーザーの `cart_items.quantity` の合計（0件なら 0）。

## 2. 関連資料

- [API一覧](ecsite-API一覧.md)
- [API共通仕様書](ecsite-API共通仕様書.md)
- [テーブル定義書](../../基本設計/ecsite-テーブル定義書.md)
