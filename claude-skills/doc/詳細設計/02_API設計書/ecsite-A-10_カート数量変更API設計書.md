# ecsite カート数量変更API設計書

| 項目 | 内容 |
|---|---|
| API番号 | A-10 |
| メソッド | PATCH |
| パス | `/api/cart/items/:cartItemId` |
| 認証 | 必要 |
| 概要 | カート明細の数量変更 |
| 使用画面 | SC-03 |

## 1. API詳細

### A-10 `PATCH /api/cart/items/:cartItemId`

リクエスト:

```json
{ "quantity": 3 }
```

| ステータス | `code` | 条件 |
|---|---|---|
| 200 | - | 変更成功。レスポンスは A-08 と同じ形式（変更後のカート全体） |
| 404 | `NOT_FOUND` | ログインユーザーの明細として存在しない |
| 400 | `VALIDATION_ERROR` | `quantity` が1〜10の整数でない（`fieldErrors.quantity`） |
| 400 | `PRODUCT_UNPUBLISHED` | 商品が非公開 |
| 400 | `INSUFFICIENT_STOCK` | 数量が在庫数を超える |

- チェック順・メッセージは「ecsite-SC-03_カート画面設計書.md」の2.2。

## 2. 関連資料

- [API一覧](ecsite-API一覧.md)
- [API共通仕様書](ecsite-API共通仕様書.md)
- [テーブル定義書](../../基本設計/ecsite-テーブル定義書.md)
- [A-08 カート取得API設計書](ecsite-A-08_カート取得API設計書.md)
- [ecsite-カート画面設計書](../01_画面設計書/ecsite-SC-03_カート画面設計書.md)
