# ecsite カート明細削除API設計書

| 項目 | 内容 |
|---|---|
| API番号 | A-11 |
| メソッド | DELETE |
| パス | `/api/cart/items/:cartItemId` |
| 認証 | 必要 |
| 概要 | カート明細の削除 |
| 使用画面 | SC-03 |

## 1. API詳細

### A-11 `DELETE /api/cart/items/:cartItemId`

| ステータス | 条件 |
|---|---|
| 200 | 削除成功。レスポンスは A-08 と同じ形式（削除後のカート全体） |
| 404 `NOT_FOUND` | ログインユーザーの明細として存在しない |

## 2. 関連資料

- [API一覧](ecsite-API一覧.md)
- [API共通仕様書](ecsite-API共通仕様書.md)
- [テーブル定義書](../../基本設計/ecsite-テーブル定義書.md)
- [A-08 カート取得API設計書](ecsite-A-08_カート取得API設計書.md)
- [ecsite-カート画面設計書](../01_画面設計書/ecsite-SC-03_カート画面設計書.md)
