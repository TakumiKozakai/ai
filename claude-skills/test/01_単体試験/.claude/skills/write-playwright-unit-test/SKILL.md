---
name: write-playwright-unit-test
description: Markdownの試験項目票から、Playwright CLI用テストコード（TypeScript）、事前データ投入SQL、DB・アプリログ・S3・EC2確認設定、試験No.との対応表を作成・更新する。「試験項目からテストコードを作って」「Playwrightのコードにして」で使用する。試験票の起票・試験実施は行わない。
---

## 入力と作業場所

`$ARGUMENTS` から試験項目票1ファイルを受け取る。任意入力はアプリソース・設計書のパス、設定例、suite-id、対象No.、確認済み回答。cwdは `test/01_単体試験/`。パスはこのcwd基準とし、スキル内のMarkdownリンクはこのファイル基準。

試験項目票が一意に決まらない場合だけ確認する。suite-idは既存と衝突しない英小文字・数字・ハイフンで決めてよい。対象No.の指定がなければ票全体を対象にする。

## 1. 根拠と実装の確認

次を読み、現在の実装に合う成果物を作る。

- [テストコード作成規約](../../../screen-test/テストコード作成規約.md)
- [準備・実施手順](../../../screen-test/試験準備・実施手順.md)
- `screen-test/src/runner.ts`・`src/config.ts`（設定の型と検証）、`screen-test/playwright.config.ts`、`screen-test/specs/evidence.ts`
- 事前データを作る場合は `../../app/docker/postgresql/initdb/01_init.sql`（テーブル定義）と `03_seed.sql`（初期データ）
- 入力の試験項目票、票に対応するDB確認SQL、指定された設計書・アプリソース

期待結果の正本は試験項目票。アプリソースはlocator・型・DBスキーマの確認に使い、現在の実装に合わせて期待結果を書き換えない。票と設計書の矛盾、未指定の入力値・期待値・SQL・認証手順は対応するNo.を添えて確認事項にする。情報不足と、サービスが試験対象でないことを区別する。

## 2. 対応表を先に作る

`screen-test/plans/<suite-id>/mapping.md` に [対応表テンプレート](../../../screen-test/templates/mapping.template.md) の内容を具体化する。

- 元票のパス（`screen-test/` 基準）と生ファイルのSHA-256を記録する。
- 票にある全No.を転記し、対象No.、シナリオ、spec・test名、事前データ、操作とstep、画面assertion、DB前後、アプリログ、S3、EC2、初期状態と再実行条件を対応付ける。
- 各No.を「実装済み」「保留」「対象外」に分ける。保留と対象外には理由を付ける。状態は実装状況であり試験の合否ではない。
- `_02_異常系` の外部障害注入は現在の実行ツールの対象外。実行可能な形を装ったコードや、障害を注入するスクリプトを作らない。
- 票全体が対象なら1件の保留でも全体を「実施不可」とする。部分実施はユーザーが対象No.を指定した場合のみ、その範囲を明記した別設定にする。

不明点があっても独立して確定できるNo.のコードと対応表は作成し、最後に必要な質問をまとめる。不明な業務条件をダミー値・常に成功するassertion・`test.skip`で埋めない。

## 3. テストコードと設定を作る

- spec: `screen-test/specs/<suite-id>.spec.ts`
- 設定例: `screen-test/plans/<suite-id>/config.example.json`
- 事前データ: `screen-test/plans/<suite-id>/seed/NN_<内容>.sql`（前提データが必要なNo.のみ）
- 対応表: `screen-test/plans/<suite-id>/mapping.md`

specはTypeScriptで書き、import には `.ts` 拡張子を付ける（Node.js の型ストリップで実行するため `enum` 等の型除去で消せない構文は使わない）。1件のNo.につき `test('NoN シナリオ', ...)` を1つ作る。`./evidence.ts` の `test`・`expect` とfixtureの `step` を使い、入力・クリック・選択・遷移ごとに撮影する。票の手順番号をstep名に含め、期待結果はassertionにする。

設定の `cases` は実施順。各idは `NoN`、titleはtest名と完全一致、specは `specs/` 基準のファイル名にする。生成した票以外のcasesを混在させない。ルートの `config.local.json` や他票の設定を流用して上書きしない。

DBは票のSELECTを `database.queries` に名前付きで入れ（テーブル・観点ごとに複数可）、前後で実行する。票の期待から `unchanged`（全件または名前の配列）または `expectedAfter` を定義する。DB確認が指定されていないNo.は、現runnerがDB必須であることを説明して確認方法を質問する。勝手にSQLや「DB不変」を追加しない。

事前データは票の前提条件（「〇〇が登録されている」等）からだけ作る。[作成規約](../../../screen-test/テストコード作成規約.md) の5章に従い、試験用データを接頭辞等で識別して「前回分を削除→登録」の冪等なSQLにし、`cases[].seed` に指定して設定の `database.allowSeed: true` を付ける。投入結果は `expectedBefore` で確認する。前提条件にない値・件数を推測で作らない。既存データ全削除・初期データの変更・DDLは書かない。

アプリログはローカル実施で票にログの期待がある場合に `appLog`（`path` は `REPLACE_WITH_...` を含む絶対パスの例、`contains` に期待文言）を設定する。試験前から残るログと区別できる文言（試験用データの値等）を選ぶ。

アプリログ・S3・EC2は票の期待に基づき設定する。対象外と確認できたものだけ `notApplicable` に理由を書く。未確定の接続値は設定例に `REPLACE_WITH_...` として残せるが、対応表は「実施不可」とする。実環境の認証情報・秘密値は生成しない。

既存コードは差分を読み、今回の対象No.のみ更新する。削除・無関係な手動修正の上書きはしない。元票の更新に追従する場合は、コード・期待値・対応表を先に更新し、その後にハッシュを更新する。

## 4. 実行せずに検証する

ユーザーのコマンド実行ルールに従って、既存のローカルツールだけで確認する。未導入なら追加導入せず未検証として報告する。

`screen-test/` で次を実行できる。

```bash
bash with-runtime.sh npm run typecheck
bash with-runtime.sh node node_modules/@playwright/test/cli.js test 'specs/<suite-id>\.spec\.ts$' --list --reporter=json
bash with-runtime.sh node src/runner.ts --config plans/<suite-id>/config.example.json --validate
```

`--validate` は seed ファイルの場所・禁止構文（psqlメタコマンド・トランザクション制御）も検査する。

山括弧部分は実ファイル名に置き換える。test列挙と対応表・casesのNo.、件数、titleを突き合わせる。import時に通信・画面操作するコードを作らない。`--list` はブラウザ実施ではなく、成功しても画面の合否とは扱わない。
`--list` のJSONに出るskippedは未実行の表示なので、実試験のskipや対象外件数とは区別する。

設定例に未確定値がある場合、`--validate` の失敗を隠さず項目を記録する。接続可能性を検証したとは報告しない。`--validate` が成功しても対応表の保留事項が解消したとは限らない。

## 完了報告

生成先、対象票・No.、実装済み／保留／対象外の件数、静的検証結果、実施前に埋める設定と準備、確認事項を報告する。全対象No.の根拠と実装が揃った場合のみ「コード作成完了」とする。未実施であることと、次に使う `run-playwright-unit-test` の呼び出し例を添える。

## スコープ外

- 試験項目票自体の作成・修正（既存Writer/Reviewerの担当）
- 対象アプリ・DB・AWSへの接続、打鍵、疎通確認
- クライアント導入、環境起動、seed 以外のDB復元・データ削除、障害注入
- 試験実施と、失敗を通すための期待値の変更
