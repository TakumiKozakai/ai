# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## リポジトリの目的と構成

Claude Code 用の skill 群（設計書からの実装・レビュー・単体試験票の作成/レビュー/実行）と、その検証用 Spring Boot Todo アプリを管理するリポジトリ。

- 本体は `claude-skills/`。`codex/` と `docs/` は `.gitignore` で除外された一時置き場（Git 管理外）。
- `claude-skills/` 配下は開発工程別ディレクトリ（`01_要件定義` … `09_受入試験`）。実体があるのは以下。
  - `03_詳細設計/todo-app設計書.md` … 検証用アプリの設計書（設計書ベース skill の入力例）
  - `04_製造/` … 検証用アプリ（`app/`）と PostgreSQL の Docker 定義（`docker/`）
  - `05_単体試験/claude-playwrite-unit-test/` … 試験項目票・試験結果・HTML テンプレート・Playwright MCP 設定
- skill 定義は `claude-skills/.claude/skills/*/SKILL.md`、サブエージェント定義は `claude-skills/.claude/agents/*.md`。**skill を使うときは `claude-skills/` を cwd にして Claude Code を起動する**（`.claude/` がそこにあり、skill 内の相対パスもすべて `claude-skills/` 基準で解決される）。
- `claude-playwrite` の "playwrite" は意図的な表記揺れ。パス名として skill から参照されているため修正しない。
- skill 一覧と工程・分類の対応表の正本は `claude-skills/@Skills要件.md`。skill を追加・改名したらこの表も更新する。

## skill アーキテクチャ

### オーケストレータ／リーフ構成

既存のオーケストレータ skill（下表の finalize 以外）は子 skill の `SKILL.md` を順に Read し、その手順に従って実行する（ファイル読み込みによる委譲。同一モデル・同一コンテキスト）。finalize だけは例外で、モデル分離のため子 skill を Skill ツールで呼ぶ（後述）。子の1つが失敗しても後続は継続し、最後に分類ごとの実行状態（成功／未実施／失敗）と指摘件数を集約して報告する。未実施・失敗分は指摘件数に含めない。

| オーケストレータ | 呼び出す子 skill |
| --- | --- |
| `review-implementation` | `review-implementation-against-design-doc` / `-for-bugs` / `-for-performance` / `-for-security` |
| `create-unit-case-for-screen` | `create-unit-case-normal-case` / `-front-validation` / `-server-validation` / `-server-error` |
| `review-unit-case-for-screen` | 上記4分類の `review-unit-case-*`（設計書ベース） |
| `review-unit-case-for-screen-from-source` | 上記4分類の `review-unit-case-*-from-source`（ソースベース） |
| `finalize-unit-case-normal-case` | 正常系版。`create-unit-case-normal-case`（未作成時のみ）→ サイクルA: `review-unit-case-normal-case` → 作成 skill の指摘反映モード、を収束まで最大5回 → サイクルB: `review-unit-case-normal-case-from-source` で同様に最大5回。分類ごとに独立した finalize |
| `finalize-unit-case-front-validation` | フロントバリデーション版。構成は `finalize-unit-case-normal-case` と同一で、対象を `create-unit-case-front-validation` / `review-unit-case-front-validation(-from-source)` に差し替えたもの |
| `finalize-unit-case-server-validation` | サーババリデーション版。構成は `finalize-unit-case-normal-case` と同一で、対象を `create-unit-case-server-validation` / `review-unit-case-server-validation(-from-source)` に差し替えたもの |
| `finalize-unit-case-server-error` | サーバエラー版。構成は `finalize-unit-case-normal-case` と同一で、対象を `create-unit-case-server-error` / `review-unit-case-server-error(-from-source)` に差し替えたもの |

### 2系統の入力と成果物

作成 skill（`create-unit-case-*`）は設計書ベースのみで、試験分類別に4ファイル `試験項目票_{画面名称}_正常系.md` / `_01_フロントバリデーション.md` / `_02_サーババリデーション.md` / `_03_異常系.md` を出力する（出力先は既定で設計書と同じディレクトリ）。

- レビュー skill には設計書ベースとソースベース（`-from-source` 接尾辞）の両方があり、どちらも同じ分類別4ファイルを対象にする。照合元がソースになるだけで成果物の形式は変わらない。
- レビュー結果 HTML: 単体実行では指摘が1件以上あるときだけ作成する（0件ならチャット報告のみ）。集約実行では作成しない。finalize は上限打ち切り時のみ作成する。

### 実行モードとサブエージェント

- **集約実行**: 親 skill から「集約実行」と明示して呼ばれた場合、子 skill は HTML を作らず、指摘一覧・実行状態・未確認観点を親に返す。明示が無ければ単体実行として振る舞う。正常系・フロントバリデーション・サーババリデーション・サーバエラーの子 skill はサブエージェントとして動くため（`AskUserQuestion` はサブエージェントで使えない）、単体実行でもユーザーに質問せず、確認したい内容を「要確認事項」「未確認観点」として返す。呼び出し元（finalize、または人と対話しているセッション）がユーザーに確認して「確認済み回答」として次の呼び出しに渡す。
- **指摘反映モード**: 分類別作成 skill は「指摘一覧」と「照合元（設計書／ソース）」を渡されると、新規作成ではなく既存の自分の分類の試験項目票へ指摘を反映する。対象行は No. とシナリオで特定し、曖昧なら要確認事項に回す。他分類に属する行は削除せず報告のみ。
- **モデル分離（`context: fork`）**: 正常系の `create-unit-case-normal-case` と `review-unit-case-normal-case(-from-source)` は frontmatter の `context: fork` / `agent` / `background: false` で、`.claude/agents/` のサブエージェント（`unit-case-creator` = Sonnet、`unit-case-reviewer` = Opus）として分離実行される。フロントバリデーション・サーババリデーション・サーバエラーの対応する作成/レビュー skill も同じ構成。fork は親の会話を見ないので、必要な情報はすべて引数で渡す。finalize からは必ず Skill ツールで呼ぶ（SKILL.md を読んで自分で実行するとモデル分離が効かない）。モデルは agent 定義に一本化し、skill 側には書かない。
- 4分類（正常系・フロントバリデーション・サーババリデーション・サーバエラー）すべての作成/レビュー/finalize skill が揃っている。

### 共通テンプレート

- 試験項目票の雛形: `claude-skills/.claude/skills/create-unit-case-for-screen/references/試験項目票_{画面名称}.md`（No. 採番規則・列の記述方針もここに集約）
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
