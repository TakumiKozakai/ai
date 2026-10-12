# ec-site API一覧

ECサイトのバックエンド（Go + Gin）が提供する JSON API の仕様。通信形式・認証・アクセス制御・CSRF対策は [API共通仕様書](ec-site-API共通仕様書.md)、テーブルは [テーブル定義書](../../基本設計/ec-site-テーブル定義書.md)、各項目の入力チェックの内容とエラーメッセージは `../01_画面設計書/` の各画面設計書の「2.2 サーバー側」を参照。

## 1. 共通仕様

[API共通仕様書](ec-site-API共通仕様書.md) を参照。

## 2. API一覧

| No. | メソッド | パス | 認証 | 概要 | 使用画面 | 設計書 |
|---|---|---|---|---|---|---|
| A-01 | GET | `/api/me` | 不要 | ログインユーザーとカート数量の取得 | 共通ヘッダー、ルートガード | [設計書](ec-site-A-01_ログインユーザー取得API設計書.md) |
| A-02 | POST | `/api/auth/signup` | 不要 | 会員登録（登録後ログイン状態にする） | SC-06 | [設計書](ec-site-A-02_会員登録API設計書.md) |
| A-03 | POST | `/api/auth/login` | 不要 | ログイン | SC-07 | [設計書](ec-site-A-03_ログインAPI設計書.md) |
| A-04 | POST | `/api/auth/logout` | 不要 | ログアウト | 共通ヘッダー | [設計書](ec-site-A-04_ログアウトAPI設計書.md) |
| A-05 | GET | `/api/categories` | 不要 | カテゴリ一覧 | SC-01 | [設計書](ec-site-A-05_カテゴリ一覧取得API設計書.md) |
| A-06 | GET | `/api/products` | 不要 | 商品検索 | SC-01 | [設計書](ec-site-A-06_商品検索API設計書.md) |
| A-07 | GET | `/api/products/:id` | 不要 | 商品詳細 | SC-02 | [設計書](ec-site-A-07_商品詳細取得API設計書.md) |
| A-08 | GET | `/api/cart` | 必要 | カート内容 | SC-03 | [設計書](ec-site-A-08_カート取得API設計書.md) |
| A-09 | POST | `/api/cart/items` | 必要 | カートに追加 | SC-02 | [設計書](ec-site-A-09_カート追加API設計書.md) |
| A-10 | PATCH | `/api/cart/items/:cartItemId` | 必要 | カート明細の数量変更 | SC-03 | [設計書](ec-site-A-10_カート数量変更API設計書.md) |
| A-11 | DELETE | `/api/cart/items/:cartItemId` | 必要 | カート明細の削除 | SC-03 | [設計書](ec-site-A-11_カート明細削除API設計書.md) |
| A-12 | GET | `/api/checkout` | 必要 | 購入手続きの表示内容 | SC-04 | [設計書](ec-site-A-12_購入手続き情報取得API設計書.md) |
| A-13 | POST | `/api/orders` | 必要 | 注文確定 | SC-04 | [設計書](ec-site-A-13_注文確定API設計書.md) |
| A-14 | GET | `/api/orders/:orderNumber` | 必要 | 注文内容 | SC-05 | [設計書](ec-site-A-14_注文内容取得API設計書.md) |
