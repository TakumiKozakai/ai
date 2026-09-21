# DB再作成手順（Todo → ecsite スキーマへの切り替え）

既存のDBボリュームを削除し、ecsite のスキーマ（`postgresql/initdb/01_init.sql`）でDBを作り直す手順。

## 背景

PostgreSQL イメージの初期化スクリプト（`postgresql/initdb/` → コンテナ内 `/docker-entrypoint-initdb.d/`）は、**データボリューム `postgres-data` が空のときの初回起動時にだけ**実行される。既存ボリュームにTodoのデータが残っている限り、コンテナを再起動しても ecsite のテーブルは作成されない。そのため、ボリュームを削除してから起動し直す。

初回起動時に実行されるスクリプト（ファイル名順）:

| ファイル | 内容 |
|---|---|
| `01_init.sql` | ecsite の7テーブル・インデックス・制約を作成（`pg_trgm` 拡張の有効化を含む） |
| `02_create_readonly_user.sh` | 試験用の `readonly_user` を作成し、全テーブルへの SELECT 権限を付与 |

## 注意

- **手順1でTodoのデータはすべて削除され、元に戻せない。** 残したいデータがある場合は、先に下記「（任意）事前バックアップ」を行う。
- `.env` の `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_READONLY_PASSWORD` は再作成後の値になる。変更したい場合は手順1の前に `.env` を編集しておく。
- Todoアプリ（`app/`、`spring.jpa.hibernate.ddl-auto=update`）を再作成後のDBに接続すると、`todos` テーブルが追加で作られる。ecsite のテーブルには影響しないが、不要であれば再作成後にTodoアプリを起動しない。

## 前提

- 作業ディレクトリ: `claude-skills/app/docker`
- Docker エンジンが起動していること（Colima の場合は `./colima-start.sh`）
- `.env` が作成済みであること（未作成なら `.env.example` をコピーして値を埋める）

## （任意）事前バックアップ

Todoのデータを残したい場合のみ実行する。コンテナが起動している状態で行う。

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > backup_todo_$(date +%Y%m%d%H%M).sql
```

## 手順1: コンテナとDBボリュームを削除する

```bash
docker compose down -v
```

- `down`: コンテナとネットワークを停止・削除する
- `-v`: compose で定義したボリューム（`postgres-data`）も削除する。**これによりDBのデータが消える**

## 手順2: イメージを再ビルドして起動する

```bash
docker compose up -d --build
```

- `--build`: `postgresql/Dockerfile` からイメージを作り直す。`initdb/` の内容はビルド時にイメージへコピーされるため、`01_init.sql` を変更した後は必ず付ける
- `-d`: バックグラウンドで起動する

起動時、空のボリュームに対して `01_init.sql` → `02_create_readonly_user.sh` の順で実行される。

## 確認

1. コンテナが healthy になったことを確認する（`STATUS` 列が `Up ... (healthy)` になるまで数秒待つ）

   ```bash
   docker compose ps
   ```

2. テーブルが作成されたことを確認する。`addresses` / `cart_items` / `categories` / `order_items` / `orders` / `products` / `users` の7件が表示されればよい

   ```bash
   docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"'
   ```

3. 初期化スクリプトがエラーになっていないことをログで確認する（`ERROR` が出ていないこと）

   ```bash
   docker compose logs db | grep -iE "error|initdb"
   ```

## うまくいかない場合

| 症状 | 原因と対処 |
|---|---|
| `\dt` で `todos` しか表示されない／テーブルが無い | ボリュームが削除されていない。`docker volume ls` で `docker_postgres-data` 等が残っていないか確認し、手順1からやり直す |
| ログに `01_init.sql` の `ERROR` が出てコンテナが停止する | DDL の誤り。初期化スクリプトが途中で失敗すると初期化は完了しないため、`01_init.sql` を修正後、手順1・2をやり直す |
| `POSTGRES_PASSWORD is required` 等で起動しない | `.env` の値が空。`.env` を埋めてから手順2を実行する |
| ポート 5432 が使用中で起動しない | 他の PostgreSQL が起動している。停止するか、`.env` の `POSTGRES_PORT` を変更する |
