# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## リポジトリの目的と構成

Claude Code 用の skill 群（設計書からの実装・レビュー・単体試験票の作成/レビュー/実行）と、その検証用 Spring Boot Todo アプリを管理するリポジトリ。

- 本体は `claude-skills/`。`codex/` と `docs/` は `.gitignore` で除外された一時置き場（Git 管理外）。
- `claude-skills/` 配下は開発工程別ディレクトリ（`01_要件定義` … `09_受入試験`）。実体があるのは以下。
  - `03_詳細設計/todo-app設計書.md` … 検証用アプリの設計書（設計書ベース skill の入力例）
  - `04_製造/` … 検証用アプリ（`app/`）と PostgreSQL の Docker 定義（`docker/`）
  - `05_単体試験/claude-playwrite-unit-test/` … 試験項目票・試験結果・HTML テンプレート・Playwright MCP 設定
- skill 定義は `claude-skills/.claude/skills/*/SKILL.md`。**skill を使うときは `claude-skills/` を cwd にして Claude Code を起動する**（`.claude/` がそこにあり、skill 内の相対パスもすべて `claude-skills/` 基準で解決される）。
- `claude-playwrite` の "playwrite" は意図的な表記揺れ。パス名として skill から参照されているため修正しない。
- skill 一覧と工程・分類の対応表の正本は `claude-skills/@Skills要件.md`。skill を追加・改名したらこの表も更新する。

## skill アーキテクチャ

### オーケストレータ／リーフ構成

オーケストレータ skill は子 skill の `SKILL.md` を順に Read し、その手順に従って実行する（ツール呼び出しではなくファイル読み込みによる委譲）。子の1つが失敗しても後続は継続し、最後に分類ごとの実行状態（成功／未実施／失敗）と指摘件数を集約して報告する。未実施・失敗分は指摘件数に含めない。

| オーケストレータ | 呼び出す子 skill |
| --- | --- |
| `review-implementation` | `review-implementation-against-design-doc` / `-for-bugs` / `-for-performance` / `-for-security` |
| `create-unit-testcase-for-screen` | `create-unit-testcase-normal-case` / `-front-validation` / `-server-validation` / `-server-error` |
| `review-unit-testcase-for-screen` | 上記4分類の `review-unit-testcase-*`（設計書ベース） |
| `review-unit-testcase-for-screen-from-source` | 上記4分類の `review-unit-testcase-*-from-source`（ソースベース） |
| `finalize-unit-testcase-for-screen` | `create-unit-testcase-for-screen-from-source`（未作成時のみ）→ `review-unit-testcase` と自動修正を指摘0件まで最大5回ループ |

### 2系統の入力と成果物

「設計書ベース」と「ソースベース（`-from-source` 接尾辞）」は別 skill で、成果物のファイル名も異なる。

- 設計書ベース: 試験分類別に4ファイル `試験項目票_{画面名称}_{正常系|フロントバリデーション|サーババリデーション|サーバエラー}.md`。出力先は既定で設計書と同じディレクトリ。
- ソースベース: 単一ファイル `05_単体試験/claude-playwrite-unit-test/試験項目票_{画面名称}.md`。
- レビュー結果 HTML: 指摘が1件以上あるときだけ作成する（0件ならチャット報告のみ）。

### 共通テンプレート

- 試験項目票の雛形: `claude-skills/.claude/skills/create-unit-testcase-for-screen/references/試験項目票_{画面名称}.md`（No. 採番規則・列の記述方針もここに集約）
- 試験結果票・レビュー結果 HTML のスタイル: `05_単体試験/claude-playwrite-unit-test/templates/試験結果票_{画面名称}_{yyyyMMddHHmm}.html`

### skill を新規作成・改修するときの書き方

既存 skill に合わせて以下を踏襲する。

- frontmatter は `name` / `description`。description は日本語で、発火フレーズ例（「〜して」）と他 skill との違いを含める。
- 本文は `$ARGUMENTS` から入力を読む番号付き手順。不足・曖昧な入力は独断で補わずユーザーに確認し、既存ファイルの上書き前にも確認する。
- 末尾に「スコープ外」セクションを置き、他 skill との境界を明記する。
- 試験項目票では画面要素を物理名（id・class）ではなく論理名（表示ラベル・ボタン文言）で書く。No. は画面内 1 始まりの連番で、実行可能な順（非永続→登録→境界値→削除・0件確認を最後）に並べる。
- 実装・レビュー系 skill は「実装先プロジェクトは設計書の場所と一致しない」前提でユーザーに確認する。差分系（`-diff`、`review-implementation`）は比較基準のコミット ID を自動提案しない。
- 子 skill から親（オーケストレータ）のパスは `claude-skills/` 基準の `.claude/skills/...` で書く。

## 検証用アプリ（`claude-skills/04_製造/`）

- スタック: Spring Boot 3.3.4 / Java 17 / Maven / Thymeleaf / Spring Data JPA / PostgreSQL 17（Docker）。
- Service 層なしの Controller → Repository → Entity 構成。`spring.jpa.hibernate.ddl-auto=update` でスキーマを自動生成し、マイグレーションツールは使わない。
- 事前準備: `docker/.env` と `app/.env` をそれぞれ `.env.example` からコピーして値を埋める（`.env` は Git 管理外）。

```bash
# DB 起動（claude-skills/04_製造/docker で）
docker compose up -d

# アプリ起動／停止（claude-skills/04_製造/app で）
./app-run.sh    # .env を読み込んで mvn spring-boot:run
./app-stop.sh   # SERVER_PORT（既定 8080）で待ち受けるプロセスを停止

# テスト・ビルド（claude-skills/04_製造/app で）
mvn test
mvn test -Dtest=TodoApplicationTests   # 単一テストクラス
mvn -q clean package -DskipTests
```

## Playwright 単体試験（`claude-skills/05_単体試験/claude-playwrite-unit-test/`）

- `.mcp.json` に Playwright MCP（`npx -y @playwright/mcp@latest --output-dir ./screenshots`）が定義済み。
- DB 検証には Postgres MCP（`crystaldba/postgres-mcp`）を別途登録する。接続文字列は環境変数 `DATABASE_URI` で渡し、読み取り専用モードにする。

```bash
claude mcp add postgres --env DATABASE_URI="$DATABASE_URI" \
  -- uvx --with "mcp<2" postgres-mcp --access-mode=restricted
```

（`--with "mcp<2"` は postgres-mcp が mcp 2.x に未対応なための固定。対応後は不要になる可能性がある）

- `run-playwright-unit-test` の実行前にアプリ（8080）と DB が起動していること。
- 成果物は `試験結果/` 配下: `試験結果票_{画面名称}_{yyyyMMddHHmm}.html` と `{画面名称}/` 内のキャプチャ（`No{No.}_実施キャプチャ_手順{n}_{OK/NG}.jpeg`）・DB 確認結果 md。
