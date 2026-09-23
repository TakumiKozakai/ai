-- ecsite-sample No1: 検索対象の試験用商品を1件だけ用意する。
-- 試験用データは接頭辞 PW_ で識別し、前回分を削除してから登録する（何度実行しても同じ状態になる）。
-- 初期データ（03_seed.sql）や他の試験のデータには触れない。
DELETE FROM cart_items WHERE product_id IN (SELECT id FROM products WHERE left(name, 3) = 'PW_');
DELETE FROM products WHERE left(name, 3) = 'PW_';

INSERT INTO products (category_id, name, description, price, stock_quantity, image_url, is_published)
VALUES ((SELECT id FROM categories WHERE name = '食品'), 'PW_サンプル商品 検索確認用',
        'Playwright 画面試験のサンプル用商品です。', 1234, 10, NULL, true);
