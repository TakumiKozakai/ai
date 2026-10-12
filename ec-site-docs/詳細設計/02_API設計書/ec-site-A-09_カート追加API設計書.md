# ec-site カート追加API設計書

| 項目 | 内容 |
|---|---|
| API番号 | A-09 |
| メソッド | POST |
| パス | `/api/cart/items` |
| 認証 | 必要 |
| 概要 | カートに追加 |
| 使用画面 | SC-02 |

## 1. API詳細

### A-09 `POST /api/cart/items`

リクエスト:

```json
{ "productId": 10, "quantity": 2 }
```

| ステータス | `code` | 条件 |
|---|---|---|
| 201 | - | 追加成功。レスポンスは `{ "cartQuantity": 5 }`（追加後のカート数量の合計） |
| 404 | `NOT_FOUND` | 商品が存在しない・非公開・`productId` が数値でない |
| 400 | `VALIDATION_ERROR` | `quantity` が1〜10の整数でない（`fieldErrors.quantity`） |
| 400 | `CART_QUANTITY_LIMIT` | カート内の数量との合計が10を超える |
| 400 | `INSUFFICIENT_STOCK` | カート内の数量との合計が在庫数を超える |

- チェック順・メッセージ・追加処理（同じ商品は数量を加算）は「ec-site-SC-02_商品詳細画面設計書.md」の2.2・3.3。

## 2. 関連資料

- [API一覧](ec-site-API一覧.md)
- [API共通仕様書](ec-site-API共通仕様書.md)
- [テーブル定義書](../../基本設計/ec-site-テーブル定義書.md)
- [ec-site-商品詳細画面設計書](../01_画面設計書/ec-site-SC-02_商品詳細画面設計書.md)
