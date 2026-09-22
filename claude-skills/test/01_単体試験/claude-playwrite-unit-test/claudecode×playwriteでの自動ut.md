# Claude Code × Playwright による単体試験の自動化ガイド

設計書（Markdown）から単体試験項目票を作り、Playwright のテストコードに変換して、画面・DB・S3・EC2ログの証跡付きで試験を実施するまでの全体像をまとめる。各工程の詳しい手順・規約は、工程ごとの正本（下表）を参照する。

> ファイル名の「playwrite」は意図的な表記揺れ（ディレクトリ名 `claude-playwrite-unit-test` と同じ）。本文中のツール名は正式名称の **Playwright** で書く。

| 知りたいこと | 正本 |
| --- | --- |
| skill・エージェントの役割分担、Writer/Reviewer の往復 | リポジトリルートの `CLAUDE.md`、`claude-skills/@Skills要件.md` |
| 試験項目票の書き方（列・No. 採番・DB確認用クエリ） | [templates/試験項目票_{画面名称}.md](templates/試験項目票_{画面名称}.md) |
| テストコード作成から試験実施までの依頼手順 | [screen-test/試験準備・実施手順.md](../screen-test/試験準備・実施手順.md) |
| 試験ツールの導入・接続設定・成果物 | [screen-test/構築手順書.md](../screen-test/構築手順書.md) |
| 試験項目票からテストコードへの変換ルール | [screen-test/テストコード作成規約.md](../screen-test/テストコード作成規約.md) |

---

## 1. 全体の流れ

```
設計書（doc/詳細設計/*.md）
   │ ① 試験項目票の作成・レビュー
   │    unit-case-writer ⇄ unit-case-reviewer（write-unit-case-* / review-unit-case-*）
   ▼
試験項目票（01_試験項目/試験項目票_{画面名称}_{分類}.md）×4分類
   │ ② テストコードの作成（試験項目票1ファイルずつ）
   │    write-playwright-unit-test
   ▼
spec・確認設定・対応表（screen-test/specs/<suite-id>.spec.js、screen-test/plans/<suite-id>/）
   │ ③ 環境準備（実施者が行う。自動では行わない）
   │ ④ 試験実施
   │    run-playwright-unit-test → runner.py → Playwright Test CLI・psql・AWS CLI
   ▼
実行結果（screen-test/runs/<UTC日時>-<ID>/：HTML結果票・スクリーンショット・DB前後・S3・EC2ログ）
```

| 工程 | 担当 | 接続先 | 変更するもの |
| --- | --- | --- | --- |
| ① 作成・レビュー | `unit-case-writer`（Sonnet）／`unit-case-reviewer`（Opus） | なし（ローカルファイルの静的解析のみ） | 試験項目票 |
| ② コード作成 | `write-playwright-unit-test` | なし（構文確認・テスト列挙・設定検証のみ） | spec・設定例・対応表 |
| ③ 環境準備 | 実施者 | - | アプリ・DB・初期データ・`config.local.json` |
| ④ 試験実施 | `run-playwright-unit-test` | 対象アプリ・DB（読み取り専用）・設定したAWS | 実行結果（`runs/`）のみ |

- **試験実行中に LLM・MCP は使わない。** 画面操作はレビュー済みの JavaScript（Playwright Test）を固定の手順で実行し、Claude Code は照合・起動・結果の集約だけを行う。同じ spec を繰り返し実行できる。
- `.mcp.json` にサーバーは登録していない（空）。旧構成の Playwright MCP・Postgres MCP による打鍵は廃止した。
- 試験項目票が期待結果の正本。コード作成・実施のどの工程でも、試験を通すために期待結果を実際の結果へ合わせない。票の修正が必要なら①へ戻す。

---

## 2. ディレクトリ構成

単体試験の skill・エージェントを使うときは **`claude-skills/test/01_単体試験/` を cwd にして** Claude Code を起動する（独自の `.claude/` と `.mcp.json` があるため）。設計書・アプリは `../../doc/詳細設計/`・`../../app/` のように相対パスで参照する。

```
claude-skills/test/01_単体試験/
├── .claude/
│   ├── agents/
│   │   ├── unit-case-writer.md          # ① 試験項目票の作成・指摘反映（Sonnet）
│   │   └── unit-case-reviewer.md        # ① 試験項目票のレビュー（Opus）
│   └── skills/
│       ├── write-unit-case-{normal-case,server-error,front-validation,server-validation}/   # ① Writer 用の手順書
│       ├── review-unit-case-{normal-case,server-error,front-validation,server-validation}/  # ① Reviewer 用の手順書
│       ├── write-playwright-unit-test/  # ② テストコード作成
│       └── run-playwright-unit-test/    # ④ 試験実施
├── .mcp.json                            # 空（MCP サーバーは使わない）
├── 01_試験項目/                          # ① の出力先（画面ごとに4ファイル）
├── 02_試験結果/                          # 実施結果の保管用（現行ツールは自動では出力しない。3.3 参照）
├── claude-playwrite-unit-test/          # このガイドと共通テンプレート
│   └── templates/
│       ├── 試験項目票_{画面名称}.md
│       └── 試験結果票_{画面名称}_{yyyyMMddHHmm}.html   # レビュー結果 HTML のスタイル見本
└── screen-test/                         # ②〜④ の試験ツール
    ├── runner.py                        # No. ごとに DB 事前→画面→DB 事後→S3→EC2 を実行し結果を集約
    ├── with-runtime.sh                  # .runtime/ の Node 22・ブラウザを使ってコマンドを実行
    ├── specs/                           # ② が作る spec（evidence.js の step で操作ごとに撮影）
    ├── plans/<suite-id>/                # ② が作る config.example.json・mapping.md（③で config.local.json を作る）
    └── runs/                            # ④ の実行結果（Git 管理外）
```

---

## 3. 成果物

### 3.1 試験項目票（①の出力）

- ファイル名: `試験項目票_{画面名称}_{分類}.md`。分類は `01_正常系`／`02_異常系`／`03_フロントバリデーション`／`04_サーババリデーション` の4つで、1画面につき4ファイルになる。
- 列は `No.｜シナリオ｜正常/異常｜前提条件｜操作手順｜期待結果`。DB の期待値は期待結果欄に文章で書き、SQL は「DB確認用クエリ」セクションに対応 No. と対にして書く。
- 画面要素は物理名（id・class）ではなく論理名（表示ラベル・ボタン文言）で書く。No. は画面内で1から始まる連番で、実行可能な順（非永続の確認→登録→境界値→削除・0件確認）に並べる。
- 記述ルールの詳細はテンプレート `templates/試験項目票_{画面名称}.md` に集約している。

### 3.2 テストコード・設定・対応表（②の出力）

| ファイル | 内容 |
| --- | --- |
| `screen-test/specs/<suite-id>.spec.js` | 1 No. につき `test('NoN シナリオ', ...)` を1つ。入力・クリック・選択・遷移ごとに `step` で撮影し、期待結果を `expect` で判定する |
| `screen-test/plans/<suite-id>/config.example.json` | 実施順の `cases`、DB の前後確認（`unchanged`／`expectedAfter`）、S3・EC2 の期待値。未確定の接続値は `REPLACE_WITH_...` |
| `screen-test/plans/<suite-id>/mapping.md` | 元票のパスと SHA-256、全 No. と test・確認内容の対応、「実装済み／保留／対象外」の区分 |

- 元票の SHA-256 を記録するので、票を変更したら②でコードと対応表を同期してから実施する（④は不一致を検知すると実行しない）。
- `_02_異常系` の外部障害注入（DB 停止など）は現行ツールの対象外。対応表に「対象外」として残す。

### 3.3 実行結果（④の出力）

`screen-test/runs/<UTC日時>-<ID>/` に実行ごとに保存する。以前の結果は上書き・削除しない。

| ファイル | 内容 |
| --- | --- |
| `index.html` | 全体結果と各証跡へのリンク（HTML 結果票） |
| `summary.json`・`run.json` | 機械可読の全体結果、開始時刻・対象 No. |
| `No{N}/browser/.../step-XX.png` | 操作ごとのスクリーンショット |
| `No{N}/db-before.json`・`db-after.json` | DB の事前・事後の SELECT 結果 |
| `No{N}/s3.json`・`ec2.json`・`ec2.log` | S3 一覧、EC2 内ログの取得結果（AWS を使う場合） |
| `No{N}/checks.json`・`playwright-report/` | 確認項目ごとの判定、Playwright のレポート |

判定は確認項目ごとに次の4種類。

| 結果 | 意味 |
| --- | --- |
| PASS | 確認を実施し、期待を満たした |
| FAIL | assertion 不一致、接続失敗、証跡の取得失敗など |
| NOT_RUN | 前提を満たさず未実施。合格ではない |
| NOT_APPLICABLE | 理由を明記した対象外。そのサービスを確認したことにはならない |

- No. 単位では、いずれかが FAIL なら不合格、NOT_RUN が残れば合格にしない。画面だけ成功しても全体を OK にしない。
- `runs/` には業務データ・スクリーンショット・ログが含まれ得るため Git 管理外。`02_試験結果/` へ保管する場合は、秘密情報が含まれないことを確認してから手で移す。

---

## 4. 実行例

Claude Code の起動:

```bash
cd claude-skills/test/01_単体試験
claude
```

### ① 試験項目票を作る

```text
unit-case-writer で ../../doc/詳細設計/ecsite-商品一覧画面設計書.md の試験項目票を作って
```

- 4分類の票を作り、Reviewer のレビュー→指摘反映を指摘が無くなるまで（最大3回）繰り返す。
- 対象画面機能（例:「検索ボタン押下」）を添えると、その機能の行だけを作成・レビューし、既存の票にマージする。
- 判断が必要な事項があると Writer は `【要判断】` を返して止まる。回答するとその位置から再開する。
- 既存の票だけをレビューする場合は Reviewer を直接呼ぶ（指摘がある場合のみレビュー結果 HTML を作る）。

```text
unit-case-reviewer で 01_試験項目/試験項目票_商品一覧画面_01_正常系.md を ../../doc/詳細設計/ecsite-商品一覧画面設計書.md でレビューして
```

### ② テストコードを作る

```text
write-playwright-unit-test で次の試験項目票からコードを作ってください。
試験項目票: 01_試験項目/試験項目票_商品一覧画面_01_正常系.md
アプリソース: ../../app
設計書: ../../doc/詳細設計/ecsite-商品一覧画面設計書.md
suite-id: ecsite-product-list-normal
S3・EC2: 対象外（ローカルのECサイトにAWS連携はない）
```

受け取った `mapping.md` で、No. と test の1対1対応、保留事項、初期データ・認証・再実行条件を確認する（確認観点は [試験準備・実施手順](../screen-test/試験準備・実施手順.md) の4章）。

### ③ 環境を準備する（実施者）

1. 試験ツールを導入する（Node 22・Python 3.10 以上・psql・Playwright・Chromium。[構築手順書](../screen-test/構築手順書.md)）。
2. 対象アプリと DB を起動し、初期データを用意する（ECサイトは `claude-skills/app/`。起動方法は `CLAUDE.md` の「検証用アプリ」）。ログインが必要な画面は、認証状態の準備方法も決めておく。
3. `plans/<suite-id>/config.example.json` を `config.local.json` にコピーして接続値を設定し、DB は `.pgpass` 等で読み取り専用ユーザー（`readonly_user`）の認証情報を用意する。
4. 接続せずに設定を検証する（`screen-test/` で実行）。

```bash
python3 runner.py --config plans/<suite-id>/config.local.json --validate
bash with-runtime.sh node node_modules/@playwright/test/cli.js test 'specs/<suite-id>\.spec\.js$' --list --reporter=json
```

### ④ 試験を実施する

```text
run-playwright-unit-test で次の試験を実施してください。
試験項目票: 01_試験項目/試験項目票_商品一覧画面_01_正常系.md
対応表: screen-test/plans/ecsite-product-list-normal/mapping.md
実行設定: screen-test/plans/ecsite-product-list-normal/config.local.json
対象: 票の全No.
初期状態・認証・実行対象の確認: 準備済み（実際の確認内容を記載）
```

- 元票の SHA-256・No. の対応・設定の一致を確認してから `runner.py` を実行し、No. ごとに画面・DB・S3・EC2 を分けて報告する。
- 手動で実施する場合も同じ設定を使う: `bash with-runtime.sh python3 runner.py --config plans/<suite-id>/config.local.json`
- ルートの `npm test` は `screen-test/config.local.json`（従来のサンプル用）を読むので、票ごとの実施には使わない。

---

## 5. 運用上の注意

- **自動で行わないこと**: ツールの導入、アプリの起動、疎通確認、DB の復元、S3 の削除、障害注入、失敗した試験の再実行。いずれも実施者が判断して行う。
- **データの状態**: 登録・更新・削除を伴う試験は、専用の環境と初期データの準備手順を決めてから実施する。共有 DB を他の人が更新すると `unchanged` の確認が失敗する。
- **権限**: DB は SELECT のみのユーザーで、読み取り専用トランザクションで接続する。AWS は S3 の一覧取得と、対象 EC2 への SSM コマンド送信に必要な権限だけにする。
- **秘密情報**: パスワード・AWS アクセスキーは試験項目票・チャット・設定例に書かない。`config.local.json`・`.pgpass`・`runs/` は Git 管理外。
- **再実行**: 失敗の原因（試験の不一致／環境・接続の問題／準備不足）を切り分け、コードや設定の修正が必要なら②へ戻す。再実行の結果は別の run-id に保存される。
- **既存サンプル**: `screen-test/` の Todo 用サンプル（`specs/todo.spec.js`、`plans/todo/`、`config.todo-local.json`、`試験項目票_Todo一覧画面_04_サーババリデーション.md`）は、検証用アプリを ECサイトに置き換える前のもの。現在のアプリでは動かないため、書き方の参考にとどめる。
