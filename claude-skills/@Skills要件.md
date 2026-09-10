# Skills要件

## Skill一覧

| 大分類 | 中分類 | 小分類 | Skill名 | Skill概要 |
| --- | --- | --- | --- | --- |
| 設計 | 詳細設計 | | | 設計書執筆 |
| 設計Rv | | | | 設計書Rv用 |
| 開発環境構築 | | | | AIに技術スタックを与え、それ用の構築手順書を作成させる |
| | | | | 作成した手順書をもとにAIに構築させ、手順書にFBさせる |
| 製造 | | | implement-from-design-doc | 新規設計書から実装する |
| | | | implement-from-design-doc-diff | 改修設計書から実装する |
| コードレビュー | 統合 | | review-implementation | 下記4観点のRvをまとめて実行し、指摘がある場合に結果をHTMLに出力する（オーケストレータ） |
| | 実装誤り検知 | | review-implementation-against-design-doc | 設計書内容と一致しているかをRvする |
| | 潜在バグ検知 | | review-implementation-for-bugs | 潜在的なバグが無いかをRvする |
| | 性能問題検知 | | review-implementation-for-performance | パフォーマンスやリソース消費に悪影響が無いかをRvする |
| | セキュリティ問題検知 | | review-implementation-for-security | セキュリティ的欠陥が無いかをRvする |
| 単体試験項目作成 | 画面 | 統合 | create-unit-case-for-screen | 設計書をもとに下記3分類の試験票をまとめて作成する（オーケストレータ） |
| | | 正常系 | create-unit-case-normal-case | 設計書をもとに正常系項目を起票する |
| | | 入力チェック | create-unit-case-front-validation<br>create-unit-case-server-validation | 設計書をもとに入力チェック項目を起票する |
| | | 異常系 | create-unit-case-server-error | 設計書をもとに異常系項目を起票する |
| | | 全分類 | create-unit-case-for-screen-from-source | ソースをもとに試験票を作成する |
| | API | 正常系 | | |
| | | 入力チェック | | |
| | | 異常系 | | |
| | バッチ | 正常系 | | |
| | | 入力チェック | | |
| | | 異常系 | | |
| 単体試験項目Rv | 画面 | 統合 | review-unit-case-for-screen | 設計書をもとに下記3分類の試験票をまとめてRvする（オーケストレータ） |
| | | 正常系 | review-unit-case-normal-case | 設計書をもとに正常系項目をRvする |
| | | 入力チェック | review-unit-case-front-validation<br>review-unit-case-server-validation | 設計書をもとに入力チェック項目をRvする |
| | | 異常系 | review-unit-case-server-error | 設計書をもとに異常系項目をRvする |
| | | 統合 | review-unit-case-for-screen-from-source | ソースをもとに下記3分類の試験票をまとめてRvする（オーケストレータ） |
| | | 正常系 | review-unit-case-normal-case-from-source | ソースをもとに正常系項目をRvする |
| | | 入力チェック | review-unit-case-front-validation-from-source<br>review-unit-case-server-validation-from-source | ソースをもとに入力チェック項目をRvする |
| | | 異常系 | review-unit-case-server-error-from-source | ソースをもとに異常系項目をRvする |
| 単体試験項目完成 | 画面 | 正常系 | finalize-unit-case-normal-case | 正常系の試験票を未作成時に設計書から作成し、設計書Rv→ソースRvの順に、Rv→指摘反映を収束または各最大5回まで繰り返す。作成・反映はSonnet、RvはOpusのサブエージェント |
| | | 入力チェック（フロント） | finalize-unit-case-front-validation | フロントバリデーションの試験票を未作成時に設計書から作成し、設計書Rv→ソースRvの順に、Rv→指摘反映を収束または各最大5回まで繰り返す。作成・反映はSonnet、RvはOpusのサブエージェント |
| | | 入力チェック（サーバ） | finalize-unit-case-server-validation | サーババリデーションの試験票を未作成時に設計書から作成し、設計書Rv→ソースRvの順に、Rv→指摘反映を収束または各最大5回まで繰り返す。作成・反映はSonnet、RvはOpusのサブエージェント |
| | | 異常系 | finalize-unit-case-server-error | サーバエラーの試験票を未作成時に設計書から作成し、設計書Rv→ソースRvの順に、Rv→指摘反映を収束または各最大5回まで繰り返す。作成・反映はSonnet、RvはOpusのサブエージェント |
| 単体試験実施 | | | run-playwright-unit-test | 試験票をもとに試験実施する |

## 使い方

### finalize-unit-case-normal-case

#### 使い方

- 引数（`$ARGUMENTS`。自由記述で渡す）
  - 設計書ファイルパス（必須）
  - 対象画面のソースファイルパス（テンプレート・コントローラ等。複数可、必須）
  - 出力先ディレクトリ（省略可。省略時は設計書ファイルと同じディレクトリ）
- 呼び出し例: `/finalize-unit-case-normal-case 設計書パス: 03_詳細設計/todo-app設計書.md / ソースパス: src/main/resources/templates/todo/list.html, src/main/java/.../TodoController.java`
- 本skillは `context: fork` を持たず、**呼び出したセッションでそのまま動作する**（司令塔）。ユーザーとの対話（引数不足の確認、上限到達時の続行判断等）はすべて本skillが行う
- 内部で `create-unit-case-normal-case` / `review-unit-case-normal-case` / `review-unit-case-normal-case-from-source` を Skill ツール経由で呼び出す（3つとも `context: fork` の子skillのため、SKILL.md を自分で読んで実行するのではなく、必ずSkillツールで呼ぶ）

#### Skillの詳細

- 対象は正常系の試験項目票（`試験項目票_{画面名称}_正常系.md`）1ファイルのみ
- 流れ: (1) 票が無ければ `create-unit-case-normal-case` で作成 → (2) **サイクルA**: `review-unit-case-normal-case`（設計書ベース）でレビューし、指摘を `create-unit-case-normal-case` の指摘反映モードで反映、を指摘が収束するまで最大5回 → (3) **サイクルB**: 同様に `review-unit-case-normal-case-from-source`（ソースベース）で最大5回
- 作成・指摘反映は `unit-case-creator` サブエージェント（Sonnet）、レビューは `unit-case-reviewer` サブエージェント（Opus）が担当する。`context: fork` の子skillは呼び出し元の会話を見ないため、設計書パス・出力先・画面名称・これまでに得た「確認済み回答」などを毎回引数として渡す
- 子skillはサブエージェントとして動くため `AskUserQuestion` が使えず、ユーザーに直接質問できない。判断に迷う事項は「要確認事項」（作成・反映）または「未確認観点」（レビュー）として本skillに返し、**本skillがユーザーに確認して「確認済み回答」を添えて再度呼び出す**
- 各サイクルは次のいずれかで終了する: **収束**（指摘0件）／**収束（未確認残存）**（指摘0件だが解消できない未確認観点が残る）／**見送り残存で終了**（残る指摘がすべて見送り・保留）／**上限打ち切り**（5回で指摘が残る）／**ユーザー中止**
- サイクルAが上限打ち切りになった場合はサイクルBへ進むかユーザーに確認する。いずれかのサイクルが上限打ち切りで終わった場合のみ `試験項目票レビュー結果_{画面名称}_正常系_finalize_{yyyyMMddHHmm}.html` を出力する
- 収束しても自動反映のみで完結させず、最終的な人による目視レビューを推奨する旨を毎回報告する

### finalize-unit-case-front-validation

#### 使い方

- 引数・呼び出し方は `finalize-unit-case-normal-case` と同一（設計書ファイルパス・対象画面のソースファイルパス・出力先ディレクトリ）
- 呼び出し例: `/finalize-unit-case-front-validation 設計書パス: 03_詳細設計/todo-app設計書.md / ソースパス: src/main/resources/templates/todo/list.html`

#### Skillの詳細

- `finalize-unit-case-normal-case` と全く同じ仕組み・終了状態・用語（確認済み回答／未解決事項／見送り記録／保留）で、対象を `試験項目票_{画面名称}_01_フロントバリデーション.md` に差し替えたもの
- 呼び出す子skillは `create-unit-case-front-validation` / `review-unit-case-front-validation` / `review-unit-case-front-validation-from-source`
- 出力先ディレクトリに1件も無いときの作成は全体を通常モードで実行する（対象分類はこの票のみなので分類指定は不要）

### finalize-unit-case-server-validation

#### 使い方

- 引数・呼び出し方は `finalize-unit-case-normal-case` と同一

#### Skillの詳細

- 構成は `finalize-unit-case-normal-case` と同一で、対象を `試験項目票_{画面名称}_02_サーババリデーション.md` に差し替えたもの
- 呼び出す子skillは `create-unit-case-server-validation` / `review-unit-case-server-validation` / `review-unit-case-server-validation-from-source`

### finalize-unit-case-server-error

#### 使い方

- 引数・呼び出し方は `finalize-unit-case-normal-case` と同一

#### Skillの詳細

- 構成は `finalize-unit-case-normal-case` と同一で、対象を `試験項目票_{画面名称}_03_異常系.md` に差し替えたもの
- 呼び出す子skillは `create-unit-case-server-error` / `review-unit-case-server-error` / `review-unit-case-server-error-from-source`
- 反映モードでは、外部リソースを異常状態にする項目を最後にまとめて配置し復旧手順を含める、というサーバエラー分類固有の記述ルールを反映後の並び替えでも維持する

### create-unit-case-normal-case

#### 使い方

- `$ARGUMENTS` は「通常モード」と「指摘反映モード」で内容が異なる
  - 通常モード: 設計書ファイルパス（必須）、出力先ディレクトリ（省略可）
  - 指摘反映モード: 設計書ファイルパス、出力先ディレクトリ、指摘一覧（種別・対象No.・シナリオ・指摘内容・根拠）、照合元（設計書／ソース。ソースの場合はソースファイルパス）、確認済み回答（あれば）。指摘一覧と照合元の両方が含まれていれば指摘反映モードとして動作する
- 単体で `/create-unit-case-normal-case 03_詳細設計/todo-app設計書.md` のように直接呼び出すことも、`create-unit-case-for-screen` や `finalize-unit-case-normal-case` から呼び出されることもある
- `context: fork` / `agent: unit-case-creator` / `background: false` の子skillのため、Skill ツール経由で呼ぶと Sonnet のサブエージェントとして分離実行される

#### Skillの詳細

- 通常モード: 設計書のフロント処理・サーバ処理の正常な操作フロー、一覧表示、正常に受理される境界値（文字数上限ちょうど等）を洗い出し、No./シナリオ/正常異常/前提条件/操作手順/期待結果の表として `試験項目票_{画面名称}_正常系.md` に保存する。画面要素は物理名でなく論理名で記述し、No.は実行可能な順（非永続の表示確認→登録→境界値→削除・0件確認の順）に並べる
- 指摘反映モード: 既存の票を読み込み、指摘を種別ごとに反映する（抜け＝行追加、誤り＝行修正、分類誤り＝列値訂正のみ、表記ゆれ＝修正）。対象行は対象No.とシナリオの両方一致で特定し、一致しない・複数該当する場合は反映せず要確認事項として返す
- 「他分類に属する項目が含まれている」という分類誤りの指摘は、行を削除せず「他分類への移動が必要な行」として報告するだけに留める（実際の移動は人か、移動先分類のskillが抜けとして拾う）
- サブエージェントのため `AskUserQuestion` が使えず、判断に迷う事項は起票・反映せず「要確認事項」として返す。既存ファイルがあり上書き可否が不明な場合も同様に確認を求める
- 画面名称は引数で渡されていればそれを用い、無く設計書から一意に特定できない場合は保存せず状態「失敗」で候補を返す

### create-unit-case-front-validation

#### 使い方

- `create-unit-case-normal-case` と同じ引数構成（通常モード／指摘反映モード）
- 担当ファイルは `試験項目票_{画面名称}_01_フロントバリデーション.md`

#### Skillの詳細

- 仕組みは `create-unit-case-normal-case` と同一。対象は「フロント側でエラーとして拒否される境界値」（文字数上限超過・必須未入力等）と相関項目チェック
- 正常/異常列は常に「異常」を記載し、期待結果に表示されるエラーメッセージ文言を具体的に書く
- サーバ側にも同じ検証がある場合、フロント視点の項目として重複起票してよい（サーババリデーション票との重複は分類誤りとしない）
- DB検証は通常不要（フロントで弾かれサーバに到達しない想定）だが、必要な場合は記載できる

### create-unit-case-server-validation

#### 使い方

- `create-unit-case-normal-case` と同じ引数構成（通常モード／指摘反映モード）
- 担当ファイルは `試験項目票_{画面名称}_02_サーババリデーション.md`

#### Skillの詳細

- 仕組みは `create-unit-case-normal-case` と同一。対象は「サーバ側でエラーとして拒否される境界値」と相関項目チェック
- フロントのチェックを回避してサーバへ直接不正な値を送るケース（開発者ツールでの属性無効化、curl直叩き等）を操作手順に具体的に記述し、期待結果にHTTPステータス・エラーメッセージを書く
- フロント側にも同じ検証がある場合、サーバ視点の項目として重複起票してよい（フロントバリデーション票との重複は分類誤りとしない）

### create-unit-case-server-error

#### 使い方

- `create-unit-case-normal-case` と同じ引数構成（通常モード／指摘反映モード）
- 担当ファイルは `試験項目票_{画面名称}_03_異常系.md`

#### Skillの詳細

- 仕組みは `create-unit-case-normal-case` と同一。対象はDB接続断・制約違反、ファイル操作エラー、AWSサービスアクセスエラー等、外部リソース起因の異常
- 前提条件に外部リソースを異常状態にする手順、操作手順の末尾に正常状態へ復旧させる手順を必ず含める
- No.の並びでは、外部リソースを異常にする項目を最後にまとめて配置し、各項目内で復旧まで完結させて他の項目に影響を残さない。指摘反映モードで行の並び替えが起きた場合もこのルールを維持する

### review-unit-case-normal-case

#### 使い方

- 引数: 設計書ファイルパス（必須）、試験項目票ディレクトリ（省略可。省略時は設計書と同じディレクトリ）
- 大元skill（`review-unit-case-for-screen` / `finalize-unit-case-normal-case`）から呼ぶ場合は「集約実行」であることと画面名称・確認済み回答・未解決事項を明示して渡す。明示が無ければ単体実行として振る舞う
- `context: fork` / `agent: unit-case-reviewer` / `background: false` の子skillのため、Skill ツール経由で呼ぶと Opus のサブエージェントとして分離実行される

#### Skillの詳細

- `試験項目票_{画面名称}_正常系.md` を設計書と突き合わせ、抜け（対応する行が無い正常フロー・境界値・DB確認用クエリ）、誤り（遷移先・表示文言の不一致、物理名の使用、No.の連番違反・並び順違反、DB定義との不整合等）、分類誤り（正常/異常列や他分類項目の混入）、表記ゆれを検出する
- 指摘は重大度順（抜け＞誤り＞分類誤り＞表記ゆれ）に整理し、種別・対象No.（新規は「(新規)」）・指摘内容・根拠を持つ
- 集約実行の場合はHTMLを作らず、指摘一覧・実行状態・未確認観点（と本skill内で得た確認済み回答）を大元skillに返す。単体実行の場合は指摘が1件以上あれば `試験項目票レビュー結果_{画面名称}_正常系_設計書_{yyyyMMddHHmm}.html` を作成する
- サブエージェントのため質問できず、判断に迷う観点は「未確認」として返す。渡された確認済み回答は再確認せず用い、照合元の記載と矛盾する場合は確認済み回答を優先する
- 試験項目票・設計書は変更しない（レビューのみ）

### review-unit-case-normal-case-from-source

#### 使い方

- 引数: 対象画面のソースファイルパス（複数可、必須）、試験項目票ディレクトリ（必須。省略時はユーザーに確認、集約実行では失敗を返す）
- それ以外は `review-unit-case-normal-case` と同様（集約実行の明示、確認済み回答・未解決事項の受け渡し）

#### Skillの詳細

- 照合元が設計書ではなくソースコード（テンプレート・コントローラ・フォームクラス・サービス・リポジトリ等の関連ソース）になる点以外は `review-unit-case-normal-case` と同じ
- 遷移先・表示文言はコントローラのマッピング・リダイレクト先・メッセージ定義と、DBスキーマとの整合性はpostgres MCPの `list_objects` 等で確認する（MCPが使えない場合はその観点のみ未確認とする）
- 単体実行時のHTML名は `試験項目票レビュー結果_{画面名称}_正常系_ソース_{yyyyMMddHHmm}.html`

### review-unit-case-front-validation

#### 使い方

- `review-unit-case-normal-case` と同じ引数構成（設計書ファイルパス・試験項目票ディレクトリ）
- 担当ファイルは `試験項目票_{画面名称}_01_フロントバリデーション.md`

#### Skillの詳細

- 仕組みは `review-unit-case-normal-case` と同一。観点はフロント側の入力チェック仕様（必須・文字数・形式・相関項目チェック）に対応する行の有無、エラーメッセージ文言の一致、DB検証記述の要否（フロントで弾かれる想定のため通常不要という前提自体も検証する）
- 正常に受理される境界値・サーバ側バリデーション・サーバエラーが混入していれば分類誤りとするが、フロント・サーバ双方で同じ検証を起票した重複は分類誤りとしない
- 単体実行時のHTML名は `試験項目票レビュー結果_{画面名称}_01_フロントバリデーション_設計書_{yyyyMMddHHmm}.html`

### review-unit-case-front-validation-from-source

#### 使い方

- `review-unit-case-normal-case-from-source` と同じ引数構成（ソースファイルパス・試験項目票ディレクトリ）
- 担当ファイルは `試験項目票_{画面名称}_01_フロントバリデーション.md`

#### Skillの詳細

- 照合元がソース（テンプレート・JS・フロント側メッセージ定義）になる点以外は `review-unit-case-front-validation` と同じ
- ブラウザ標準のバリデーションメッセージ（`required` 属性のみで文言を定義していない等）は、送信抑止やエラー表示位置はソースから照合できるが文言自体は照合できないため、未確認観点として返す
- 単体実行時のHTML名は `試験項目票レビュー結果_{画面名称}_01_フロントバリデーション_ソース_{yyyyMMddHHmm}.html`

### review-unit-case-server-validation

#### 使い方

- `review-unit-case-normal-case` と同じ引数構成（設計書ファイルパス・試験項目票ディレクトリ）
- 担当ファイルは `試験項目票_{画面名称}_02_サーババリデーション.md`

#### Skillの詳細

- 仕組みは `review-unit-case-normal-case` と同一。観点はサーバ側の入力チェック仕様に対応する行の有無、フロント回避手順（開発者ツール・curl等）の具体性、レスポンスのHTTPステータス・エラーメッセージの一致
- フロント・サーバ双方で同じ検証を起票した重複は分類誤りとしない。画面のサーバ処理検証のための直接リクエストはAPI用試験項目票の対象として除外しない
- 単体実行時のHTML名は `試験項目票レビュー結果_{画面名称}_02_サーババリデーション_設計書_{yyyyMMddHHmm}.html`

### review-unit-case-server-validation-from-source

#### 使い方

- `review-unit-case-normal-case-from-source` と同じ引数構成（ソースファイルパス・試験項目票ディレクトリ）
- 担当ファイルは `試験項目票_{画面名称}_02_サーババリデーション.md`

#### Skillの詳細

- 照合元がソース（コントローラ・フォームクラスのバリデーションアノテーション・Validatorクラス・メッセージ定義等）になる点以外は `review-unit-case-server-validation` と同じ
- フロント回避方法が実装上成立するか（存在しないエンドポイント・パラメータ名でないか）も確認する
- 単体実行時のHTML名は `試験項目票レビュー結果_{画面名称}_02_サーババリデーション_ソース_{yyyyMMddHHmm}.html`

### review-unit-case-server-error

#### 使い方

- `review-unit-case-normal-case` と同じ引数構成（設計書ファイルパス・試験項目票ディレクトリ）
- 担当ファイルは `試験項目票_{画面名称}_03_異常系.md`

#### Skillの詳細

- 仕組みは `review-unit-case-normal-case` と同一。観点は設計書上の外部リソースアクセス処理ごとにエラー系の行があるか、前提条件に異常状態の具体的記述があるか、操作手順末尾に復旧手順があるか、異常項目が最後にまとめて配置され前後に影響しない並びになっているか
- 秘密情報（接続文字列・認証情報等）が指摘・根拠に含まれる場合はマスクする
- 単体実行時のHTML名は `試験項目票レビュー結果_{画面名称}_03_異常系_設計書_{yyyyMMddHHmm}.html`

### review-unit-case-server-error-from-source

#### 使い方

- `review-unit-case-normal-case-from-source` と同じ引数構成（ソースファイルパス・試験項目票ディレクトリ）
- 担当ファイルは `試験項目票_{画面名称}_03_異常系.md`

#### Skillの詳細

- 照合元がソース（コントローラ・サービス・リポジトリ・外部サービスクライアント・例外ハンドラ・エラーページテンプレート等）になる点以外は `review-unit-case-server-error` と同じ
- 例外の捕捉箇所・ロールバックの有無等、ソースからしか読み取れない挙動も照合対象にする
- 単体実行時のHTML名は `試験項目票レビュー結果_{画面名称}_03_異常系_ソース_{yyyyMMddHHmm}.html`

### Skill名

#### 使い方

#### Skillの詳細
