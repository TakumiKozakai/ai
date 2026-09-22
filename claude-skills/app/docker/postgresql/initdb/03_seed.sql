-- ecsite initial data: categories and products (no admin screen, see ecsite-画面一覧・共通仕様書.md 1.1).
-- Executed on first startup only, after 01_init.sql and 02_create_readonly_user.sh.
--
-- Products for checking each screen:
--   * 25 products, 24 published -> SC-01 shows 20 on page 1 and 4 on page 2
--   * 1 unpublished (ワイヤレス充電器)              -> not listed, detail is "not found"
--   * 2 out of stock (保存用ミネラルウォーター, 電気ケトル) -> 「在庫切れ」
--   * 1 low stock (ハンドドリップセット, stock 3)     -> quantity select 1..3, stock errors
--   * 3 with an image under /images/products/, others without (no-image.png)
--   * prices of 5,000 yen or more                    -> free shipping
--   * "100%" in a name                               -> % is searched literally

INSERT INTO categories (name, display_order) VALUES
    ('食品', 1),
    ('日用品', 2),
    ('家電', 3);

INSERT INTO products (category_id, name, description, price, stock_quantity, image_url, is_published) VALUES
    ((SELECT id FROM categories WHERE name = '食品'),   'コーヒー豆 深煎り 200g', E'深煎りのブラジル産コーヒー豆です。\nしっかりとした苦味とコクが特徴です。', 1980, 50, '/images/products/coffee-beans.png', true),
    ((SELECT id FROM categories WHERE name = '食品'),   'コーヒー豆 浅煎り 200g', 'エチオピア産。フルーティーな酸味が楽しめます。', 2180, 30, NULL, true),
    ((SELECT id FROM categories WHERE name = '食品'),   '緑茶ティーバッグ 50包', '静岡県産の茶葉を使用したティーバッグです。', 880, 100, NULL, true),
    ((SELECT id FROM categories WHERE name = '食品'),   '果汁100%オレンジジュース 1L', '濃縮還元ではないストレート果汁です。', 450, 40, NULL, true),
    ((SELECT id FROM categories WHERE name = '食品'),   'はちみつ 500g', '国産の純粋はちみつです。', 1580, 25, NULL, true),
    ((SELECT id FROM categories WHERE name = '食品'),   'ミックスナッツ 1kg', '素焼きのアーモンド・カシューナッツ・くるみのミックスです。', 2480, 20, NULL, true),
    ((SELECT id FROM categories WHERE name = '食品'),   'オリーブオイル 500ml', 'エクストラバージンオリーブオイルです。', 1280, 35, NULL, true),
    ((SELECT id FROM categories WHERE name = '食品'),   '保存用ミネラルウォーター 2L×6本', '5年保存できる備蓄用の天然水です。', 1200, 0, NULL, true),
    ((SELECT id FROM categories WHERE name = '食品'),   'グラノーラ 800g', 'ドライフルーツ入りのグラノーラです。', 980, 60, NULL, true),
    ((SELECT id FROM categories WHERE name = '日用品'), 'バスタオル 2枚組', '綿100%の吸水性に優れたバスタオルです。', 2980, 15, '/images/products/bath-towel.png', true),
    ((SELECT id FROM categories WHERE name = '日用品'), 'フェイスタオル 5枚組', '毎日使いやすい薄手のフェイスタオルです。', 1480, 40, NULL, true),
    ((SELECT id FROM categories WHERE name = '日用品'), '食器用洗剤 詰め替え 1L', '手肌にやさしい植物由来の洗剤です。', 398, 80, NULL, true),
    ((SELECT id FROM categories WHERE name = '日用品'), 'ハンドソープ 250ml', '泡で出るタイプのハンドソープです。', 350, 90, NULL, true),
    ((SELECT id FROM categories WHERE name = '日用品'), 'ティッシュペーパー 5箱', '1箱200組のティッシュペーパーです。', 498, 70, NULL, true),
    ((SELECT id FROM categories WHERE name = '日用品'), 'トイレットペーパー 12ロール', 'ダブル・30m巻きです。', 598, 50, NULL, true),
    ((SELECT id FROM categories WHERE name = '日用品'), 'ステンレスマグカップ 350ml', '真空断熱で温かさが長持ちします。', 1780, 25, NULL, true),
    ((SELECT id FROM categories WHERE name = '日用品'), 'ハンドドリップセット', 'ドリッパー・サーバー・ペーパーのセットです。', 3480, 3, NULL, true),
    ((SELECT id FROM categories WHERE name = '家電'),   'ワイヤレスイヤホン', 'ノイズキャンセリング機能付きの完全ワイヤレスイヤホンです。', 12800, 10, '/images/products/wireless-earphones.png', true),
    ((SELECT id FROM categories WHERE name = '家電'),   '電気ケトル 1.0L', '最短約3分でお湯が沸きます。', 3980, 0, NULL, true),
    ((SELECT id FROM categories WHERE name = '家電'),   'コーヒーメーカー', 'ミル付きの全自動コーヒーメーカーです。', 15800, 5, NULL, true),
    ((SELECT id FROM categories WHERE name = '家電'),   'モバイルバッテリー 10000mAh', 'スマートフォンを約2回充電できます。', 3280, 30, NULL, true),
    ((SELECT id FROM categories WHERE name = '家電'),   'USB充電器 2ポート', '急速充電に対応したUSB充電器です。', 1980, 40, NULL, true),
    ((SELECT id FROM categories WHERE name = '家電'),   'LEDデスクライト', '明るさを5段階で調節できます。', 4980, 12, NULL, true),
    ((SELECT id FROM categories WHERE name = '家電'),   'ワイヤレス充電器', '販売終了した商品です。', 2980, 20, NULL, false),
    ((SELECT id FROM categories WHERE name = '家電'),   'Bluetoothスピーカー', '防水仕様のコンパクトなスピーカーです。', 5980, 8, NULL, true);
