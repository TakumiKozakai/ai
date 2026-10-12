# ec-site ER図（物理名版）

ECサイトのテーブル間の関係を物理名で表示する。論理名での表示は [ER図（論理名版）](ec-site-ER図_論理名.md)、設計方針・共通カラム・各テーブルの詳細は [テーブル定義書](ec-site-テーブル定義書.md) を参照。

## 1. ER図

共通の作成日時・更新日時は省略する。

```mermaid
erDiagram
    users ||--o{ addresses : "住所を登録する"
    users ||--o{ cart_items : "カートに入れる"
    users ||--o{ orders : "注文する"
    categories ||--o{ products : "分類する"
    products ||--o{ cart_items : "カートに入る"
    products ||--o{ order_items : "注文される"
    orders ||--|{ order_items : "明細を持つ"

    users {
        bigint id PK
        varchar email UK
        varchar password_hash
        varchar name
        varchar phone_number
    }
    addresses {
        bigint id PK
        bigint user_id FK
        varchar recipient_name
        char postal_code
        varchar prefecture
        varchar city
        varchar address_line
        varchar building
        varchar phone_number
        boolean is_default
    }
    categories {
        bigint id PK
        varchar name UK
        integer display_order
    }
    products {
        bigint id PK
        bigint category_id FK
        varchar name
        text description
        integer price
        integer stock_quantity
        varchar image_url
        boolean is_published
        integer version
    }
    cart_items {
        bigint id PK
        bigint user_id FK
        bigint product_id FK
        integer quantity
    }
    orders {
        bigint id PK
        varchar order_number UK
        bigint user_id FK
        varchar status
        varchar payment_method
        integer subtotal_amount
        integer shipping_fee
        integer total_amount
        varchar shipping_recipient_name
        char shipping_postal_code
        varchar shipping_prefecture
        varchar shipping_city
        varchar shipping_address_line
        varchar shipping_building
        varchar shipping_phone_number
        timestamp ordered_at
    }
    order_items {
        bigint id PK
        bigint order_id FK
        bigint product_id FK
        varchar product_name
        integer unit_price
        integer quantity
        integer subtotal
    }
```

## 2. テーブル一覧

| テーブル | 論理名 | 概要 |
|---|---|---|
| `users` | ユーザー | 会員登録したユーザー。ログインIDはメールアドレス |
| `addresses` | 配送先住所 | ユーザーが登録する配送先。1ユーザーに複数件、うち1件を既定にできる |
| `categories` | カテゴリ | 商品の分類。商品一覧の絞り込みに使う |
| `products` | 商品 | 販売する商品と在庫数 |
| `cart_items` | カート明細 | ユーザーのカートに入っている商品と数量 |
| `orders` | 注文 | 購入確定した注文のヘッダ。配送先・金額を購入時点の値で保持する |
| `order_items` | 注文明細 | 注文に含まれる商品。商品名・単価を購入時点の値で保持する |
