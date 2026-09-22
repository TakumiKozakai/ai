# claude-skills

設計・実装・レビュー・単体試験用の Claude Code スキルと、その検証用 ECサイトアプリ、画面試験ツールを管理します。

## 構成

| ディレクトリ | 内容 |
|---|---|
| `claude-skills/.claude/` | 設計書からの実装・コードレビューのスキル |
| `claude-skills/doc/` | 検証用アプリの設計書（`詳細設計/`）と画面設計書テンプレート（`templates/`） |
| `claude-skills/app/` | 検証用 ECサイトアプリ（フロントエンド React、バックエンド Go、DB PostgreSQL） |
| `claude-skills/test/01_単体試験/` | 単体試験項目票の作成・レビュー・実施のスキル／エージェントと、画面試験ツール |

## 検証用 ECサイトアプリ

商品一覧・商品検索・カート・購入・会員登録を備えた ECサイトです。

- フロントエンド: React / TypeScript / Vite / React Router（`claude-skills/app/frontend`）
- バックエンド: Go / Gin / GORM、JWT 認証（`claude-skills/app/backend`）
- DB: PostgreSQL 17（Docker、`claude-skills/app/docker`）。スキーマと初期データは `docker/postgresql/initdb/` で作成

```bash
# DB 起動（claude-skills/app/docker で。事前に .env.example を .env にコピーして値を設定）
docker compose up -d

# アプリ起動（claude-skills/app で。事前に .env.example を .env にコピーして値を設定）
./app-run.sh    # http://localhost:8080
```

- [画面一覧・共通仕様書](claude-skills/doc/詳細設計/ecsite-画面一覧・共通仕様書.md)
- [API設計書](claude-skills/doc/詳細設計/ecsite-API設計書.md)
- [ER図・テーブル定義書](claude-skills/doc/詳細設計/ecsite-ER図・テーブル定義書.md)
- [DB再作成手順](claude-skills/app/docker/DB再作成手順.md)

## 画面試験

画面試験は Playwright CLI で実行し、操作ごとのスクリーンショット、操作前後の PostgreSQL、S3、EC2 内ログを確認します。

- [スキルによる試験準備・実施手順](claude-skills/test/01_単体試験/screen-test/試験準備・実施手順.md)
- [コード作成スキル](claude-skills/test/01_単体試験/.claude/skills/write-playwright-unit-test/SKILL.md)
- [試験実施スキル](claude-skills/test/01_単体試験/.claude/skills/run-playwright-unit-test/SKILL.md)
- [構築手順書](claude-skills/test/01_単体試験/screen-test/構築手順書.md)
- [試験ツール](claude-skills/test/01_単体試験/screen-test/)
- [スキル一覧](claude-skills/@Skills要件.md)
