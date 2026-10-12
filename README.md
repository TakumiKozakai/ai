# ai

設計・実装・レビュー・単体試験用の Claude Code スキルと、その検証用 ECサイトアプリ、画面試験ツールを管理します。

## 構成

| ディレクトリ | 内容 |
|---|---|
| `.claude/` | 設計書からの実装・コードレビューのスキル |
| `ec-site-docs/` | 検証用アプリの設計書（`基本設計/`・`詳細設計/`）と画面設計書テンプレート（`templates/`） |
| `ec-site/ec-site-web/` | 検証用 ECサイトアプリ（フロントエンド React、バックエンド Go） |
| `ec-site/docker/` | PostgreSQL の Docker 定義 |
| `ec-site/ec-site-common/`・`ec-site-batch/`・`ec-site-infra/` | 空（今後追加） |
| `docs/` | `claude/`・`codex/` の作業メモ類 |
| `ec-site/ec-site-test/01_単体試験/` | 単体試験項目票の作成・レビュー・実施のスキル／エージェントと、画面試験ツール |

## 検証用 ECサイトアプリ

商品一覧・商品検索・カート・購入・会員登録を備えた ECサイトです。

- フロントエンド: React / TypeScript / Vite / React Router（`ec-site/ec-site-web/frontend`）
- バックエンド: Go / Gin / GORM、JWT 認証（`ec-site/ec-site-web/backend`）
- DB: PostgreSQL 17（Docker、`ec-site/docker`）。スキーマと初期データは `ec-site/docker/postgresql/initdb/` で作成

```bash
# DB 起動（ec-site/docker で。事前に .env.example を .env にコピーして値を設定）
docker compose up -d

# アプリ起動（ec-site/ec-site-web で。事前に .env.example を .env にコピーして値を設定）
./app-run.sh    # http://localhost:8080
```

- [画面一覧](ec-site-docs/詳細設計/01_画面設計書/ec-site-画面一覧.md)
- [画面共通仕様書](ec-site-docs/詳細設計/01_画面設計書/ec-site-画面共通仕様書.md)
- [API一覧](ec-site-docs/詳細設計/02_API設計書/ec-site-API一覧.md)
- [テーブル定義書](ec-site-docs/基本設計/ec-site-テーブル定義書.md)
- [DB再作成手順](ec-site/docker/DB再作成手順.md)

## 画面試験

画面試験は Playwright CLI で実行し、操作ごとのスクリーンショット、操作前後の PostgreSQL、S3、EC2 内ログを確認します。

- [スキルによる試験準備・実施手順](ec-site/ec-site-test/01_単体試験/screen-test/試験準備・実施手順.md)
- [コード作成スキル](ec-site/ec-site-test/01_単体試験/.claude/skills/write-playwright-unit-test/SKILL.md)
- [試験実施スキル](ec-site/ec-site-test/01_単体試験/.claude/skills/run-playwright-unit-test/SKILL.md)
- [構築手順書](ec-site/ec-site-test/01_単体試験/screen-test/構築手順書.md)
- [試験ツール](ec-site/ec-site-test/01_単体試験/screen-test/)
- [スキル一覧](@Skills要件.md)
