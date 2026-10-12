# ecsite ログアウトAPI設計書

| 項目 | 内容 |
|---|---|
| API番号 | A-04 |
| メソッド | POST |
| パス | `/api/auth/logout` |
| 認証 | 不要 |
| 概要 | ログアウト |
| 使用画面 | 共通ヘッダー |

## 1. API詳細

### A-04 `POST /api/auth/logout`

Cookie `ecsite_token` を削除し、`204` を返す。未ログインで呼び出しても `204`。

## 2. 関連資料

- [API一覧](ecsite-API一覧.md)
- [API共通仕様書](ecsite-API共通仕様書.md)
- [テーブル定義書](../../基本設計/ecsite-テーブル定義書.md)
