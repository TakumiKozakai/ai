# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## リポジトリの目的と構成

Claude Code 用の skill 群（設計書からの実装・レビュー・単体試験票の作成/レビュー/実行）と、その検証用 ECサイトアプリ（React + Go）を管理するリポジトリ。

- 本体は `claude-skills/`。ルートの `docs/`（と、作られた場合の `codex/`）はコミットしない一時置き場。`.gitignore` には入れていないため `git status` に未追跡として表示されるが、`git add` の対象に含めない。
- `claude-skills/` 配下は `app/`・`doc/`・`test/` の3ディレクトリ（工程別の番号付きディレクトリは廃止）。実体があるのは以下。`test/02_結合試験/`・`test/03_総合試験/` は `.gitkeep` のみの空ディレクトリ。
  - `doc/詳細設計/` … 検証用アプリの設計書（設計書ベース skill の入力例）
  - `doc/templates/` … 画面設計書のテンプレート `画面設計書_{画面名称}.md`（画面項目定義／入力チェック内容／画面処理の3章構成と記述方針）
  - `app/` … 検証用アプリと、PostgreSQL の Docker 定義（`app/docker/`）
  - `test/01_単体試験/` … 単体試験項目票の作成・レビュー・実施 skill／エージェント一式（`.claude/`）と CLI実行環境 `screen-test/`、画面単位の成果物を置く `01_画面/`（`00_templates/` にテンプレート、`01_試験項目/` に試験項目票、`02_試験結果/` に実施結果）
- skill 定義は `claude-skills/.claude/skills/*/SKILL.md`、サブエージェント定義は `claude-skills/.claude/agents/*.md`。**skill を使うときは `claude-skills/` を cwd にして Claude Code を起動する**（`.claude/` がそこにあり、skill 内の相対パスもすべて `claude-skills/` 基準で解決される）。**ただし単体試験項目票の作成・レビュー・実施（`write-unit-case-*` / `review-unit-case-*` / `write-playwright-unit-test` / `run-playwright-unit-test` と `unit-case-writer` / `unit-case-reviewer` エージェント）は `claude-skills/test/01_単体試験/` に独自の `.claude/` と `.mcp.json` を持つため、これらを使うときは `test/01_単体試験/` を cwd にして Claude Code を起動する**（設計書 `../../doc/詳細設計/` やアプリ `../../app/` は相対パスで参照する）。
- skill 一覧と工程・分類の対応表の正本はリポジトリルートの `@Skills要件.md`。skill を追加・改名したらこの表も更新する。

## skill アーキテクチャ

### オーケストレータ／リーフ構成（コードレビュー系）

`review-implementation` は子 skill（`review-implementation-against-design-doc` / `-for-bugs` / `-for-performance` / `-for-security`）の `SKILL.md` を順に Read し、その手順に従って実行する（ファイル読み込みによる委譲。同一モデル・同一コンテキスト）。子の1つが失敗しても後続は継続し、最後に観点ごとの実行状態（成功／未実施／失敗）と指摘件数を集約して報告する。未実施・失敗分は指摘件数に含めない。

### 単体試験項目票の Writer/Reviewer 構成

単体試験項目票は skill ではなく **エージェントが入口** になる。ユーザーはメインセッションで `unit-case-writer` に設計書パスを添えて「試験項目票を作って」と頼むだけで、分類の指定はしない（`@"unit-case-writer (agent)"` メンションでも呼べる）。対象画面機能（イベント。例:「登録ボタン押下」）を添えると、4分類ともその機能に絞って作成・レビューし、既存の票には該当機能の行だけをマージする（他機能の既存行は保持。画面全体の網羅性は保証しない）。

```
メインセッション ─Agent ツール─▶ unit-case-writer（Sonnet）
   ▲ 要判断で停止 → ユーザーに確認 →   │ Skill: write-unit-case-*（4分類）で作成・指摘反映
   └ SendMessage で再開 ───────────    ├─Agent ツール（初回）／SendMessage（2回目以降）─▶ unit-case-reviewer（Opus・1起動）
                                        │   ◀── 分類別の指摘一覧・要確認事項 ──   │ Skill: review-unit-case-*（4分類）
                                        ▼ 指摘が無くなるまで最大3回 → 完了報告
```

- **`unit-case-writer`**（`test/01_単体試験/.claude/agents/unit-case-writer.md`、Sonnet）: 4分類の `write-unit-case-*` を Skill ツールで順に実行して4ファイルを作り、`unit-case-reviewer` を Agent ツールで起動してレビューさせ、返った指摘を `write-unit-case-*` の指摘反映モードで反映する。これを4ファイルとも指摘が無くなるまで最大3回繰り返す。3回目で残った指摘は反映せず報告し、そのときだけ `試験項目票レビュー結果_{画面名称}_完成_{yyyyMMddHHmm}.html` を作る。「他分類への移動が必要な行」は Writer が移動先へ「抜け（新規）」で追加させ、移動元へ「削除」を指示して自分で動かす。
- **`unit-case-reviewer`**（`test/01_単体試験/.claude/agents/unit-case-reviewer.md`、Opus、`disallowedTools: Edit, NotebookEdit, Agent`）: 同じ実行の中では **1起動** で、Writer が `SendMessage` で再開して続けてレビューさせる（同じ人がずっとレビューするイメージ）。再開時は記憶ではなくファイルを再読してレビューする。ユーザーが「試験項目票_◯◯_01_正常系.md を設計書でレビューして」と単体レビューを頼むときも、この Reviewer を直接呼ぶ。
- **skill は手順書**: `write-unit-case-*` / `review-unit-case-*` は `context: fork` を持たず `user-invocable: false`。エージェントが Skill ツールで自分のコンテキストに読み込んで実行する。モデルは agent 定義だけで決まり、skill 側には書かない。単体の「作成だけ」は無い。
- **ユーザー確認の往復**: `AskUserQuestion` はサブエージェントでは使えないため、Writer・Reviewer はユーザーに質問しない。判断が必要な事項（要確認事項・上書き可否・失敗時の対応）は Writer が `【要判断】` として結果に返して止まる。メインセッションはそれをユーザーに確認し、回答を「確認済み回答」（判断できない事項は「保留」、中止は「中止」）として Writer の agent ID 宛に `SendMessage` で送る。Writer は同じ位置から再開する。再開できない場合は確認済み回答を添えて Writer を新規起動すれば、既存ファイルを使ってサイクルを最初からやり直す。
- **入れ子の前提**: メイン → Writer → Reviewer で2階層のサブエージェント入れ子を使う。Claude Code 既定（3階層）で動く。`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` を 1 にすると Writer が Reviewer を起動できない。
- **レビューは設計書ベースのみ**。ソースコードを照合元にするレビューは廃止した（旧 `review-unit-case-*-from-source`）。Writer・Reviewer ともローカルファイルの静的解析だけで動き、実行中アプリ・DB・MCP・外部サービスには接続しない。

### 成果物

`write-unit-case-*` は試験分類別に4ファイル `試験項目票_{画面名称}_01_正常系.md` / `_02_異常系.md` / `_03_フロントバリデーション.md` / `_04_サーババリデーション.md` を出力する（出力先は既定で `test/01_単体試験/01_画面/01_試験項目/`）。分類と skill の対応は `01_正常系` = `normal-case`、`02_異常系` = `server-error`、`03_フロントバリデーション` = `front-validation`、`04_サーババリデーション` = `server-validation`。

- **指摘反映モード**: `write-unit-case-*` は「指摘一覧」を渡されると、新規作成ではなく既存の自分の分類の試験項目票へ指摘を反映する。対象行は No. とシナリオで特定し、曖昧なら要確認事項に回す。他分類に属する行は削除せず行の全内容を添えて報告し、移動は Writer が行う。種別「削除」は Writer からの移動指示専用。
- **集約実行**: Writer から「集約実行」と明示して呼ばれた場合、`review-unit-case-*` は HTML を作らず、指摘一覧・実行状態・要確認事項を返す。明示が無い（ユーザーが Reviewer を直接呼んだ）単体実行では、指摘が1件以上あるときだけ `試験項目票レビュー結果_{画面名称}_{分類}_設計書_{yyyyMMddHHmm}.html` を作る（0件ならチャット報告のみ）。

### 共通テンプレート

- 試験項目票の雛形: `test/01_単体試験/01_画面/00_templates/試験項目票_{画面名称}.md`（No. 採番規則・列の記述方針もここに集約）。`write-unit-case-*` が通常モードの手順3で Read する（cwd は `test/01_単体試験/` なので skill 内では `01_画面/00_templates/...` と相対パスで参照する）
- 試験結果票のスタイル: `test/01_単体試験/01_画面/00_templates/試験結果票_{画面名称}_{yyyyMMddHHmm}.html`。レビュー結果 HTML も同様のスタイルとする

### skill を新規作成・改修するときの書き方

既存 skill に合わせて以下を踏襲する。

- frontmatter は `name` / `description`。description は日本語で、発火フレーズ例（「〜して」）と他 skill との違いを含める。エージェント専用の手順書 skill（`write-unit-case-*` / `review-unit-case-*`）は `user-invocable: false` を付け、description に発火フレーズではなく「どのエージェントが実行するか」を書く。
- 本文は `$ARGUMENTS` から入力を読む番号付き手順。不足・曖昧な入力は独断で補わずユーザーに確認し、既存ファイルの上書き前にも確認する。サブエージェント内で動く skill・エージェントは質問できないので、「要確認事項」「要判断」として結果に返す。
- 末尾に「スコープ外」セクションを置き、他 skill との境界を明記する。
- 試験項目票では画面要素を物理名（id・class）ではなく論理名（表示ラベル・ボタン文言）で書く。No. は画面内 1 始まりの連番で、実行可能な順（非永続→登録→境界値→削除・0件確認を最後）に並べる。
- 実装・レビュー系 skill は「実装先プロジェクトは設計書の場所と一致しない」前提でユーザーに確認する。差分系（`-diff`、`review-implementation`）は比較基準のコミット ID を自動提案しない。
- skill から他の skill・テンプレートのパスは `claude-skills/` 基準の `.claude/skills/...` で書く。

## 検証用アプリ（`claude-skills/app/`）

- ECサイト（商品一覧・検索・カート・購入・会員登録）。設計書は `doc/詳細設計/ecsite-*.md`（API は `ecsite-API設計書.md`、構成・認証は `ecsite-画面一覧・共通仕様書.md`）。旧 Todo アプリの設計書 `todo-app*.md` も残っている。
- フロントエンド `frontend/`: React 19 / TypeScript / Vite / React Router の SPA。API 呼び出しは `src/api/client.ts` に集約し、全リクエストに `X-Requested-With: XMLHttpRequest` を付ける。
- バックエンド `backend/`: Go / Gin / GORM / PostgreSQL 17（Docker）。`handler`（入力チェック）→ `service`（業務ロジック・トランザクション）→ `repository` → `model` 構成。認証は JWT を HttpOnly Cookie `ecsite_token` に入れる。
- スキーマと初期データは `docker/postgresql/initdb/`（`01_init.sql`・`03_seed.sql`）で作成し、GORM の `AutoMigrate` は使わない。initdb はボリュームが空の初回起動時のみ実行されるため、変更したら `docker/DB再作成手順.md` に従って作り直す。
- 事前準備: `docker/.env` と `app/.env` をそれぞれ `.env.example` からコピーして値を埋める（`.env` は Git 管理外。`JWT_SECRET` は32文字以上。`docker/.env` の `POSTGRES_PLAYWRIGHT_PASSWORD` は compose の必須変数）。Node.js 20.19 以上が必要（Homebrew の Node が壊れている環境では `test/01_単体試験/screen-test/.runtime/` の Node 22 を PATH に足す）。

```bash
# DB 起動（claude-skills/app/docker で）
docker compose up -d

# アプリ起動／停止（claude-skills/app で）
./app-run.sh    # .env を読み込み、frontend をビルドして backend から配信（http://localhost:8080）。サーバーログは logs/app.log にも追記
./app-stop.sh   # SERVER_PORT（既定 8080）で待ち受けるプロセスを停止

# 開発時は別々に起動（frontend は http://localhost:5173、/api は 8080 へ proxy）
(cd backend && go run ./cmd/server)   # .env の値を環境変数に読み込んでおく
(cd frontend && npm run dev)

# テスト・ビルド
(cd backend && go vet ./... && go test ./...)
(cd backend && go test ./internal/handler -run TestValidateSignup)   # 単一テスト
(cd frontend && npm run build)        # tsc による型チェック + vite build
```

## Playwright CLI 画面試験（`claude-skills/test/01_単体試験/screen-test/`）

- 環境構築は `screen-test/構築手順書.md`、スキルによるコード作成から実施までは `screen-test/試験準備・実施手順.md`、生成物の契約は `screen-test/テストコード作成規約.md`。
- テスト用コード（runner・spec・fixture・単体テスト）はすべて TypeScript。Node.js 22.18+ の型ストリップで `.ts` を直接実行し、ビルド工程は無い（`tsc` は型チェックのみ）。import には `.ts` 拡張子を付け、`enum` など型除去で消せない構文は使わない（`tsconfig.json` の `erasableSyntaxOnly`）。
- `write-playwright-unit-test` は試験票1ファイルから `specs/<suite-id>.spec.ts` と `plans/<suite-id>/config.example.json`・`mapping.md`、前提データが要るNo.には `plans/<suite-id>/seed/*.sql` を作成する。元票のSHA-256、No.との対応、未確定事項を記録し、外部接続・試験実施は行わない。
- runner は `src/runner.ts`（設定の型と検証は `src/config.ts`、外部アクセスは `db.ts`・`aws.ts`・`appLog.ts`・`browser.ts`）。`bash with-runtime.sh node src/runner.ts --config plans/<suite-id>/config.local.json` で票ごとの設定を指定する。No.ごとに seed 投入→DB事前→ログ位置記録→Playwright Test CLI→DB事後→アプリログ→S3一覧→EC2内ログを実施する。
- DBは試験専用ユーザー `playwright_user`（DML可・DDL不可。`app/docker/postgresql/initdb/04_create_playwright_user.sh`／既存DBには `app/docker/setup-playwright-user.sh`）1つで seed とスナップショットを行う。psql は Mac 本体に導入し、ローカル（Docker）と AWS 側 DB を設定の接続先だけで切り替える。スナップショットは `database.queries` の名前付き複数SELECTを読み取り専用トランザクションで取得する。
- seed は `plans/` 配下の `.sql` を `psql -1` で実行し、接続先DB名・ユーザーを確認してから投入する。設定に `database.allowSeed: true` が必要。試験用データは接頭辞等で識別して「削除→登録」の冪等な形にし、全削除・DDL・psqlメタコマンド・トランザクション制御は書かない（`--validate` で検査）。
- アプリログ（`appLog`）はローカルのログファイルの打鍵中の追記分だけを `app.log` に保存して文字列を確認する。ECサイトは `app/app-run.sh` が `app/logs/app.log`（`APP_LOG_FILE`）へ追記する。EC2内ログはAWS CLI / SSMで固定tailコマンドを実行する。S3・EC2の接続先と期待値は `config.local.json` で設定する。
- Playwright MCP・Postgres MCPは通常の試験実行に使用しない。`.mcp.json` に自動起動するサーバーは登録しない。
- `run-playwright-unit-test` は試験項目票1ファイル・対応表・レビュー済みspec/config/seedの一致を確認して、その設定を指定しCLIを実行する。コード作成や期待値の修正は行わない。`_02_異常系` の障害注入は対象外。
- 各操作は `specs/evidence.ts` のstepを使用して撮影する。seed失敗時は画面操作をせず、画面が失敗してもDB事後・アプリログ・AWSの収集を試み、未実施や取得エラーを成功扱いしない。
- 成果物は `screen-test/runs/<UTC日時>-<ID>/` に実行単位で保存し、Git管理外。従来のMCP証跡は既存ファイルとして保持する。
- サンプル: ECサイトの商品検索1件（`specs/ecsite-sample.spec.ts`・`plans/ecsite-sample/`。seed・複数クエリ・appLogの例）。旧Todoの必須入力検証1件（`specs/todo.spec.ts`・`plans/todo/`・`config.todo-local.json`）は現状のアプリでは動かない。ローカル設定ではS3・EC2は理由付き対象外で、AWSを確認したとは扱わない。
- DB全体の復元・S3削除などの初期化は自動実行しない。DBの変更は設定で指定した seed のみ。

```bash
# screen-test で実行。with-runtime.sh は .runtime/ の Node 22 とブラウザを PATH に通して引数のコマンドを実行する
bash with-runtime.sh npm run typecheck    # tsc による型チェック（出力なし）
bash with-runtime.sh npm run test:unit    # runner の単体テスト（node --test "tests/unit/*.test.ts"。DB・AWS・ブラウザに接続しない）
bash with-runtime.sh node --test --test-name-pattern "<テスト名の一部>" "tests/unit/*.test.ts"   # 単一テスト（例: "seed requires"）
bash with-runtime.sh npm run test:list    # spec の一覧（実行はしない）
bash with-runtime.sh npm run test:smoke   # playwright.smoke.config.ts のスモーク
bash with-runtime.sh node src/runner.ts --config plans/<suite-id>/config.local.json --validate   # 設定検証のみ（接続なし）
bash with-runtime.sh node src/runner.ts --config plans/<suite-id>/config.local.json   # 票ごとの試験実施
```
