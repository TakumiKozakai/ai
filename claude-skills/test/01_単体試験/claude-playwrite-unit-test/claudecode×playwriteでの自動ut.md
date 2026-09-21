> **旧構成の参考資料です。** 通常の試験実行はPlaywright CLI・psql・AWS CLIへ移行しました。
> 現行の構築・実行手順は [画面試験ツールの構築手順書](../screen-test/構築手順書.md) を参照してください。
> 以下のMCP登録・旧成果物規約は現行構成には適用しません。

# Claude Code × Playwright MCP による自動単体テスト構築ガイド

自然言語で書いたテストケース（Markdown）を入力に、Claude Codeがブラウザ操作・スクリーンショット取得・DB検証までを自動で行うための導入手順と実行フローをまとめる。

> 補足: タイトルにある「Playwrite」はおそらく「Playwright」の表記揺れだが、依頼どおりのファイル名にしている。本文中のツール名は正式名称の **Playwright** で統一する。

---

## 1. 全体構成

```
[テストケース.md] ──読込──▶ [Claude Code]
                               │
                 ┌─────────────┼─────────────┐
                 ▼                            ▼
        [Playwright MCP]              [Postgres MCP]
        ブラウザ操作・撮影              SQL実行（検証用）
                 │                            │
                 ▼                            ▼
        スクリーンショット(.jpeg)      SQL実行結果(.md)
```

- **Claude Code** がテスト実行のオーケストレーター（司令塔）になる
- **Playwright MCP**（Microsoft公式 `@playwright/mcp`）がブラウザの実操作とスクリーンショット取得を担当
- **Postgres MCP**（`crystaldba/postgres-mcp`）がテスト結果検証用のDBアクセス・SQL実行を担当
- Claude CodeがMCP経由で得た結果をもとに期待値と突合し、OK/NG判定・ファイル保存・試験結果票（試験項目票そのものではなく実施結果を記録する別ファイル）への記載までを行う

Claude Code自体が「MCPクライアント」としてこれらのツールを呼び出す形になるため、Playwright/PostgreSQLを直接インストールする必要はなく、**MCPサーバーを2つ登録するだけ**で成立する。

---

## 2. 必要なツール

| ツール | 役割 | 備考 |
| --- | --- | --- |
| Node.js 18以上 | Playwright MCP / npx実行に必要 | `node -v` で確認 |
| Claude Code CLI | テスト実行の本体 | 2026年1月のv2.1.15以降はnpmではなく公式インストーラ推奨 |
| Playwright MCP (`@playwright/mcp`) | ブラウザ操作・スクリーンショット | Microsoft公式、Apache-2.0 |
| Postgres MCP (`postgres-mcp` / crystaldba) | DBへのSQL実行・検証 | 読み取り専用モードあり |
| テスト対象のWebアプリ | ローカル or 検証環境で起動済みであること | - |

---

## 3. セットアップ手順

### 3.1 Node.jsの確認

```bash
node -v   # v18以上であること
```

### 3.2 Claude Code CLIのインストール

公式インストーラ（推奨、自動アップデートあり）:

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

npm経由でも可能（旧方式・非推奨扱い）:

```bash
npm install -g @anthropic-ai/claude-code
```

インストール確認:

```bash
claude --version
```

### 3.3 Playwright MCPサーバーの登録

このリポジトリでは `test/01_単体試験/.mcp.json` に登録済み（`--output-dir ./試験結果`、バージョンは `@playwright/mcp@0.0.80` に固定）。単体試験関連の skill・エージェントを使うときは **`test/01_単体試験/` を cwd にして** Claude Code を起動する（`claude-skills/` 直下では `.mcp.json` が読み込まれない）。

> なぜバージョンを固定しているか: `run-playwright-unit-test` は `browser_take_screenshot` の `filename` を明示したときの解決先（`--output-dir` ではなくセッションの cwd 基準になり、親ディレクトリも自動作成されない）という、公式にドキュメント化されていない実装依存の挙動を前提にしている（`@playwright/mcp@0.0.80` の `packages/playwright-core/src/tools/backend/context.ts` の `workspaceFile()` で確認済み）。`@latest` のまま更新すると、この挙動が変わってキャプチャの保存先が壊れる可能性がある。バージョンを上げる場合は同じ挙動が保たれるか実際に確認してから、この節・`test/01_単体試験/.mcp.json`・`CLAUDE.md` を合わせて更新する。

自分のプロジェクトで一から登録する場合の手順は以下（参考。バージョンは適宜固定することを推奨）。

```bash
claude mcp add playwright -- npx -y @playwright/mcp@latest
```

チームで共有する場合（`.mcp.json` がプロジェクト直下に生成され、Git管理できる）:

```bash
claude mcp add --scope project playwright -- npx -y @playwright/mcp@latest
```

よく使うオプション（`args` に追記）:

| オプション | 内容 |
| --- | --- |
| `--browser <name>` | 使用ブラウザ（chromium/firefox/webkit等）を指定 |
| `--headless` | ヘッドレス実行（未指定時はヘッド付き＝画面が見える） |
| `--output-dir <path>` | スクリーンショット等の出力先ディレクトリを固定 |
| `--isolated` | プロファイルをディスクに保存せずメモリ上のみで実行 |

例（スクリーンショット出力先を固定する場合。このリポジトリでの実際の値）:

```bash
claude mcp add --scope project playwright -- npx -y @playwright/mcp@0.0.80 --output-dir ./試験結果
```

### 3.4 Postgres MCPサーバーの登録

検証用DBのため、**読み取り専用（restricted）モード**での登録を推奨する。認証情報はコマンド履歴に残さないよう環境変数化する。

```bash
export DATABASE_URI="postgresql://readonly_user:password@localhost:5432/dbname"

claude mcp add postgres --env DATABASE_URI="$DATABASE_URI" \
  -- uvx --with "mcp<2" postgres-mcp --access-mode=restricted
```

> **注意（2026年8月時点の既知の非互換）**: `postgres-mcp`（`crystaldba/postgres-mcp`）は依存パッケージ`mcp`の2.x系（`FastMCP`が`MCPServer`に改名される破壊的変更）に未対応。`uvx postgres-mcp ...`をそのまま実行すると`ModuleNotFoundError: No module named 'mcp.server.fastmcp'`で起動に失敗する。`uvx --with "mcp<2" postgres-mcp ...`として`mcp`を1系に固定することで回避できる（`postgres-mcp`側がmcp 2.x対応した後は不要になる可能性がある）。

（`uvx` が無い場合は `pipx install postgres-mcp` 等でインストールしたコマンドを直接指定してもよい。DockerイメージでもOK。）

DB側のユーザーは最小権限にしておく。ロールが未作成の場合はまず作成する:

```sql
-- ロールが無ければ作成（既にあればパスワードのみ更新）
CREATE ROLE readonly_user WITH LOGIN PASSWORD 'password';

GRANT CONNECT ON DATABASE dbname TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- Hibernateのddl-auto=update等でアプリ起動後に作成されるテーブルにも
-- 読み取り権限を及ぼすため、デフォルト権限も設定しておく
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;
```

### 3.5 動作確認

```bash
claude mcp list
```

`playwright` と `postgres` が `✔ Connected` になっていることを確認する。セッション内では `/mcp` でも確認できる。

---

## 4. ディレクトリ構成（このリポジトリでの実際の配置）

「試験項目票の作成」と「実施」で別々のSkillセットを試作していた時期の名残で、旧版はこの節に独自のディレクトリ構成を提案していた。現在は `claude-skills/test/01_単体試験/` 配下に統一されている。

```
claude-skills/
├── doc/詳細設計/
│   └── todo-app一覧画面設計書.md       # 試験項目票作成の入力（設計書）
├── app/                              # 検証用アプリ
│   └── docker/                       # DB・readonlyユーザー作成スクリプト
└── test/01_単体試験/
    ├── .mcp.json                     # Playwright MCP定義（--output-dir ./試験結果）
    ├── .claude/
    │   ├── agents/
    │   │   ├── unit-case-writer.md   # 試験項目票の作成・反映を担うWriter（Sonnet）
    │   │   └── unit-case-reviewer.md # 試験項目票のレビューを担うReviewer（Opus）
    │   └── skills/
    │       ├── write-unit-case-normal-case/       # Writerが実行する手順書（正常系）
    │       ├── write-unit-case-server-error/       #   同（異常系）
    │       ├── write-unit-case-front-validation/    #   同（フロントバリデーション）
    │       ├── write-unit-case-server-validation/   #   同（サーババリデーション）
    │       ├── review-unit-case-normal-case/       # Reviewerが実行する手順書（正常系）
    │       ├── review-unit-case-server-error/       #   同（異常系）
    │       ├── review-unit-case-front-validation/    #   同（フロントバリデーション）
    │       ├── review-unit-case-server-validation/   #   同（サーババリデーション）
    │       └── run-playwright-unit-test/           # 試験項目票1件を実施するSkill
    ├── 試験項目票/                     # write-unit-case-* の出力先（画面ごとに4ファイル）
    ├── 試験結果/                       # run-playwright-unit-test の出力先
    └── claude-playwrite-unit-test/     # このファイルと共通テンプレートの置き場
        ├── claudecode×playwriteでの自動ut.md  # このファイル
        └── templates/
            ├── 試験項目票_{画面名称}.md
            └── 試験結果票_{画面名称}_{yyyyMMddHHmm}.html
```

単体試験関連のSkill・エージェントを使うときは **`test/01_単体試験/` を cwd にして** Claude Codeを起動する（`.claude/` と `.mcp.json` がそこにあるため）。設計書やアプリのソースは `../../doc/詳細設計/`・`../../app/` のように相対パスで参照する。skill・エージェントの詳しい役割分担は `CLAUDE.md`（リポジトリルート。`claude-skills/` の一つ上にある）と `claude-skills/@Skills要件.md` を正本とする（本節はディレクトリ構成の見取り図に留める）。以降の節で `test/01_単体試験/.claude/skills/...` のように書くパスは、この構成図と同じ「`claude-skills/` を起点とした説明用パス」であり、実行時にセッション内で入力するパス（cwdが `test/01_単体試験/` なら `.claude/skills/...`）とは基準が異なる点に注意する。

---

## 5. 試験項目票・試験結果票のフォーマット

画面・試験分類ごとに「試験項目票」（入力・試験項目一覧）と「試験結果票」（出力・実施結果）のペアで管理する。試験分類は **正常系・異常系・フロントバリデーション・サーババリデーション** の4つで、1画面につき最大4ファイルになる。テンプレートは `claude-playwrite-unit-test/templates/` に置き、`write-unit-case-*` が読み込んで分類ごとに複製する。

### 5.1 試験項目票（`試験項目票_{画面名称}_{分類}.md`）

画面・分類単位で試験項目を表形式にまとめる（`{分類}` は `01_正常系` / `02_異常系` / `03_フロントバリデーション` / `04_サーババリデーション`）。

```markdown
# 試験項目票: Todo一覧画面(/todos)

| No. | シナリオ | 正常/異常 | 前提条件 | 操作手順 | 期待結果 |
|-----|---------|-----------|---------|---------|---------|
| 1 | 新規登録（正常系） | 正常 | なし | 1. `/todos` を開く<br>2. タイトルを入力<br>3. 登録ボタンを押下 | 一覧に登録したTodoが表示されること |

## DB確認用クエリ

| 対応No. | 確認用クエリ |
|---------|-------------|
| 1 | `SELECT ...` |
```

- No.の命名規則: ファイル（画面・分類）単位で1から始まる連番（ゼロ埋め不要）。実行可能な順（非永続の表示確認→登録→境界値→削除・0件確認の順）に並べる
- 操作手順・期待結果はセル内で複数行になる場合、`<br>` で改行する。画面要素は物理名（id・class）ではなく論理名（表示ラベル・ボタン文言）で書く
- DBの期待値を検証したい場合は、期待結果欄に検証内容を文章で書き、実際のSQL文は「DB確認用クエリ」セクションに対応No.と対にして記載する（期待結果欄にSQL文そのものは書かない）
- 詳しい記述ルールは `claude-playwrite-unit-test/templates/試験項目票_{画面名称}.md` に集約されている

### 5.2 試験結果票（`試験結果票_{画面名称}_{分類}_{実行日時yyyyMMddHHmm}.html`）

試験項目票の各No.に対する実施結果を記録する。`run-playwright-unit-test` が `claude-playwrite-unit-test/templates/試験結果票_{画面名称}_{yyyyMMddHHmm}.html` から新規作成する。

| No. | シナリオ | 実施日 | OK/NG |
|-----|---------|--------|-------|
| 1 | 新規登録（正常系） | 2026/08/29 14:30 | OK |

- No.は試験項目票のNo.と対応させる
- OK/NGは画面（・DB）の実際の結果と期待結果を突合した最終判定を記載する。Playwrightで再現できない手順（開発者ツール操作等）は「未実施（理由）」と記載する

---

## 6. 出力ファイルの命名規則

| 種別 | 命名規則 | 例 |
| --- | --- | --- |
| 試験項目票 | `試験項目票_{対象画面}_{分類}.md` | `試験項目票_Todo一覧画面_01_正常系.md` |
| 試験結果票 | `試験結果票_{対象画面}_{分類}_{実行日時yyyyMMddHHmm}.html` | `試験結果票_Todo一覧画面_01_正常系_202608291430.html` |
| スクリーンショット | `No{No.}_実施キャプチャ_手順{n}_{OK/NG}.jpeg`（`試験結果/{対象画面}/{分類}/` 配下） | `試験結果/Todo一覧画面/01_正常系/No1_実施キャプチャ_手順1_OK.jpeg` |
| テーブル確認結果 | `No{No.}_テーブル確認結果_{OK/NG}.md`（同上） | `試験結果/Todo一覧画面/01_正常系/No1_テーブル確認結果_OK.md` |

補足:

- Playwright MCPの `browser_take_screenshot` はデフォルトでJPEG形式を返す（`raw: true` を指定するとPNG）ため、そのままJPEG保存の要件を満たせる。`filename` パラメータを明示すると、そのパスは `.mcp.json` の `--output-dir` ではなく **Claude Codeセッションのcwd**（`test/01_単体試験/`）を基準に解決される（`--output-dir` はファイル名省略時のデフォルト名にのみ効く）。そのため `filename` には `試験結果/{画面名称}/{分類}/No{No.}_実施キャプチャ_手順{n}_PENDING.jpeg` のように `試験結果/` から始まる相対パスを指定する。また親ディレクトリは自動作成されないため、撮影前に `mkdir -p` で用意しておく
- OK/NGはNo.単位（試験項目1件）の判定結果であり、**その試験項目に含まれる全ステップのスクリーンショットにも同じ最終判定を付与する**。手順実行中は判定が確定していないため、いったん仮ファイル名（`_PENDING`）で保存し、全ステップ完了・期待結果検証後にOK/NGへリネームする
- 試験結果・スクリーンショットは（テスト対象データに秘密情報が含まれない前提で）Git管理する

---

## 7. Claude Codeによる実行フロー

`run-playwright-unit-test` に試験項目票を1つ渡すと、Claude Codeは以下の順で処理する（詳細は `test/01_単体試験/.claude/skills/run-playwright-unit-test/SKILL.md` を参照）。

1. **対象外チェック**: ファイル名が `_02_異常系` の場合は実行せず、対象外である旨を報告して終了する
2. **事前確認**: 対象アプリが起動していること、DB検証がある場合はPostgres MCPが接続済みであることを確認する
3. **試験項目票読込**: 表からNo./シナリオ/正常異常/前提条件/操作手順/期待結果と、DB確認用クエリをパースする
4. Noごとに、前提条件を満たしたうえで操作手順を1ステップずつ実行し（`browser_snapshot` で要素特定、`browser_take_screenshot` で撮影）、期待結果と突合してOK/NG（またはPlaywrightで再現できない手順は「未実施」）を判定する。DB確認用クエリがある行はPostgres MCPの `execute_sql` で検証する
5. スクリーンショットの `_PENDING` を最終判定にリネームし、DB確認結果をNo別・サマリの2種類のmdに保存する
6. 試験結果票（未作成ならテンプレートから新規作成）の該当No.行に `実施日` と判定を記載する
7. 最後に全体の判定件数（OK/NG/未実施）と保存先ファイル一覧を報告する

---

## 8. Skillとしての実装

試験項目票の「作成」「レビュー」は Writer/Reviewer の2エージェントが担い、「実施」は `run-playwright-unit-test` が担う。実装の詳細（frontmatter・手順本文）はこの節に埋め込まず、実体である `test/01_単体試験/.claude/` 配下のファイルと `CLAUDE.md`（リポジトリルート）・`claude-skills/@Skills要件.md` を参照する（重複管理を避け、実装と記述が食い違うのを防ぐため）。

- `test/01_単体試験/.claude/agents/unit-case-writer.md` … 試験項目票の作成・レビュー依頼・指摘反映のサイクルを回すWriter（Sonnet）
- `test/01_単体試験/.claude/agents/unit-case-reviewer.md` … 試験項目票をレビューするReviewer（Opus）
- `test/01_単体試験/.claude/skills/write-unit-case-{normal-case,server-error,front-validation,server-validation}/SKILL.md` … Writerが分類ごとに実行する作成・反映の手順書（`user-invocable: false`。ユーザーが直接呼ぶものではない）
- `test/01_単体試験/.claude/skills/review-unit-case-{normal-case,server-error,front-validation,server-validation}/SKILL.md` … Reviewerが分類ごとに実行するレビューの手順書（同上）
- `test/01_単体試験/.claude/skills/run-playwright-unit-test/SKILL.md` … 試験項目票1件をPlaywright MCP・Postgres MCPで実施するSkill

> 補足: 2026年1月24日にAnthropicはスラッシュコマンド機能をSkillsに統合した。付随ファイルの同梱やサブエージェント起動などSkillsの方が上位互換のため、現行の推奨形式である `.claude/skills/<name>/SKILL.md` で作成している。`user-invocable: false` を付けたSkill（Writer/Reviewer専用の手順書）は `/` メニューには出ず、対応するエージェントからのみ呼び出せる。

---

## 9. 実行例

`test/01_単体試験/` を cwd にして Claude Codeを起動する。

```bash
cd claude-skills/test/01_単体試験
claude
```

セッション内で、設計書から試験項目票（4分類）を作成・レビューして完成させる:

```
unit-case-writer で ../../doc/詳細設計/todo-app一覧画面設計書.md の試験項目票を作って
```

完了すると `試験項目票/` に4ファイル（`試験項目票_Todo一覧画面_01_正常系.md` 等）ができる。既存の票だけをレビューしたい場合は Reviewer を直接呼ぶ:

```
unit-case-reviewer で 試験項目票/試験項目票_Todo一覧画面_01_正常系.md を ../../doc/詳細設計/todo-app一覧画面設計書.md でレビューして
```

試験項目票が用意できたら、対象アプリ（`../../app`）・DB（`../../app/docker`）を起動したうえで、分類ごとに1ファイルずつ試験を実行する（`_02_異常系` は対象外）:

```
run-playwright-unit-test 試験項目票/試験項目票_Todo一覧画面_01_正常系.md
```

Claude Codeがブラウザを操作している様子（ヘッド付きモードなら）が実際に画面上で確認でき、完了後に以下のようなファイルが生成される。

```
試験結果/Todo一覧画面/01_正常系/No1_実施キャプチャ_手順1_OK.jpeg
試験結果/Todo一覧画面/01_正常系/No1_テーブル確認結果_OK.md
試験結果/試験結果票_Todo一覧画面_01_正常系_202608291430.html
```

---

## 10. セキュリティ・運用上の注意

- DB接続情報（`DATABASE_URI`）はコマンド引数やリポジトリに直書きせず、環境変数や `.env`（Git管理外）で管理する
- 検証用DBユーザーはSELECT権限のみの最小権限にし、`--access-mode=restricted` で書き込みを禁止する
- テスト実行で画面操作した結果、実データに書き込みが発生するテストケースの場合は、検証環境専用のDB・テナントを使うこと
- `.mcp.json` をGit管理する場合、認証情報は環境変数参照（`${DATABASE_URI}` 等）にし、値自体はコミットしない
- Playwright MCPはデフォルトでヘッド付きブラウザを起動する。CI等で使う場合は `--headless` を付ける

---

## 11. トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| `claude mcp list` で `Failed to connect` | 初回は `npx` のダウンロード待ちのことが多い。数秒待って再実行 |
| Postgres MCPが接続できない | `DATABASE_URI` の形式（`postgresql://user:pass@host:port/db`）を確認 |
| スクリーンショットがPNGになる | `browser_take_screenshot` 呼び出し時に `raw: true` を指定していないか確認（未指定＝JPEG） |
| 要素がクリックできない | `browser_snapshot` を取り直し、最新の `ref` を使って操作する |

---

## 12. 参考情報

- [Claude Code | Playwright](https://playwright.dev/mcp/clients/claude-code)
- [Playwright MCP | Playwright](https://playwright.dev/docs/getting-started-mcp)
- [Playwright MCP Snapshots](https://playwright.dev/mcp/snapshots)
- [Connect to MCP servers - Claude Code Docs](https://code.claude.com/docs/en/mcp-quickstart)
- [GitHub - microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)
- [GitHub - crystaldba/postgres-mcp](https://github.com/crystaldba/postgres-mcp)
- [postgres-mcp · PyPI](https://pypi.org/project/postgres-mcp/)
- [@anthropic-ai/claude-code - npm](https://www.npmjs.com/package/@anthropic-ai/claude-code)
