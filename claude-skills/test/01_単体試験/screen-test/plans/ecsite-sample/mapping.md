# テストコード対応表: 商品一覧画面 / サンプル（ツール動作確認用）

- suite-id: `ecsite-sample`
- 元票: なし（ツールの seed・複数クエリ・appLog の動作確認用に作ったサンプル。試験項目票から生成したものではない）
- 根拠資料: `../../doc/詳細設計/ecsite-商品一覧画面設計書.md`（検索フォーム・件数表示・価格表示）、`app/frontend/src/pages/ProductListPage.tsx`（キーワード入力欄の `aria-label="キーワード"`）、`app/docker/postgresql/initdb/01_init.sql`（products 列）
- 対象No.: 1
- spec: `specs/ecsite-sample.spec.ts`
- 設定例: `plans/ecsite-sample/config.example.json`
- 事前データ: `plans/ecsite-sample/seed/01_products.sql`
- ローカル実行設定: `plans/ecsite-sample/config.local.json`（Git管理外）
- 全体状態: 実施不可（psql 導入・`playwright_user` 作成・ローカル設定が未準備）

## No.との対応

| No. | シナリオ / test名 | 状態 | 事前データ(seed) | 操作→step / 画面assertion | DB前後の確認 | アプリログ | S3 | EC2 | 保留・対象外の理由 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | No1 キーワードで試験用商品を検索できる | 実装済み | `01_products.sql`: 接頭辞 `PW_` の商品を削除→「PW_サンプル商品 検索確認用」（食品・¥1,234・在庫10・公開）を登録 | 手順1→商品一覧を開き見出し「商品一覧」、手順2→キーワード入力、手順3→検索押下・「1件の商品が見つかりました」・商品名リンク・「¥1,234」。各stepで撮影 | `pw_products`: `PW_` 商品。expectedBefore で投入結果を確認し、検索は参照のみのため unchanged | 打鍵中の追記に `/api/products?` と `keyword=PW_` | ECサイトはS3を使用しない・対象外 | ローカル実施・対象外（appLogで確認） | なし |

## 初期状態・認証・再実行条件

- 対象環境: ローカル `http://localhost:8080`（`app/app-run.sh`）、Docker の PostgreSQL `localhost:5432`。
- 認証: 商品一覧はログイン不要。DB は `playwright_user`、パスワードは `~/.pgpass`。
- 初期データ: `03_seed.sql` のカテゴリ「食品」が存在すること。試験用商品は seed が用意する。
- ケース間依存: なし。
- 再実行: seed が `PW_` 商品を削除してから登録するため、そのまま再実行できる。`PW_` 商品を含む注文（order_items）がある場合は削除が失敗し、seed が FAIL になる（画面操作は実施しない）。
- 変更・削除を行う操作: seed による `PW_` 商品と、それを参照する cart_items の削除・登録のみ。画面操作は参照のみ。

## 未確定事項

| 対象No. / 設定 | 確認事項 | 実施を止める理由 | 回答 |
| --- | --- | --- | --- |
| ローカル設定 | `database.name` を `app/docker/.env` の `POSTGRES_DB` に、`appLog.path` を `app/logs/app.log` の絶対パスに置き換える | 設定例はプレースホルダ | 実施時に準備する |

## 静的検証

| 検証 | 結果 | 補足 |
| --- | --- | --- |
| TypeScript型チェック | 未検証 | `npm run typecheck`（typescript 導入後） |
| Playwright列挙とNo.の一致 | 成功 | `playwright test --list` で1件、title が設定と一致 |
| 設定検証 | 成功 | `node src/runner.ts --config plans/ecsite-sample/config.example.json --validate`。接続は行っていない |

## 実施前レビュー

- 対象No.の操作・期待結果・外部確認が設計書と一致: 静的確認済み
- 準備データ・接続先・実行範囲: 未確認
- 構築時点の実施状況: 未実施
