# ec-site ER図（論理名版）

ECサイトのテーブル間の関係を論理名で表示する。物理名での表示とテーブル一覧は [ER図（物理名版）](ec-site-ER図_物理名.md)、設計方針・共通カラム・各テーブルの詳細は [テーブル定義書](ec-site-テーブル定義書.md) を参照。

## 1. ER図

テーブル名・項目名を論理名で表示する。型・キー・関連・多重度は物理名版と同じ。共通の作成日時・更新日時は省略する。

```mermaid
erDiagram
    ユーザー ||--o{ 配送先住所 : "住所を登録する"
    ユーザー ||--o{ カート明細 : "カートに入れる"
    ユーザー ||--o{ 注文 : "注文する"
    カテゴリ ||--o{ 商品 : "分類する"
    商品 ||--o{ カート明細 : "カートに入る"
    商品 ||--o{ 注文明細 : "注文される"
    注文 ||--|{ 注文明細 : "明細を持つ"

    ユーザー {
        bigint ユーザーID PK
        varchar メールアドレス UK
        varchar パスワードハッシュ
        varchar 氏名
        varchar 電話番号
    }
    配送先住所 {
        bigint 配送先住所ID PK
        bigint ユーザーID FK
        varchar 宛名
        char 郵便番号
        varchar 都道府県
        varchar 市区町村
        varchar 町名番地
        varchar 建物名部屋番号
        varchar 配送用電話番号
        boolean 既定配送先フラグ
    }
    カテゴリ {
        bigint カテゴリID PK
        varchar カテゴリ名 UK
        integer 表示順
    }
    商品 {
        bigint 商品ID PK
        bigint カテゴリID FK
        varchar 商品名
        text 商品説明
        integer 販売価格
        integer 在庫数
        varchar 商品画像URL
        boolean 公開フラグ
        integer バージョン
    }
    カート明細 {
        bigint カート明細ID PK
        bigint ユーザーID FK
        bigint 商品ID FK
        integer 数量
    }
    注文 {
        bigint 注文ID PK
        varchar 注文番号 UK
        bigint ユーザーID FK
        varchar 注文ステータス
        varchar 支払方法
        integer 商品合計
        integer 送料
        integer 支払総額
        varchar 配送先宛名
        char 配送先郵便番号
        varchar 配送先都道府県
        varchar 配送先市区町村
        varchar 配送先町名番地
        varchar 配送先建物名
        varchar 配送先電話番号
        timestamp 注文日時
    }
    注文明細 {
        bigint 注文明細ID PK
        bigint 注文ID FK
        bigint 商品ID FK
        varchar 商品名
        integer 単価
        integer 数量
        integer 小計
    }
```
