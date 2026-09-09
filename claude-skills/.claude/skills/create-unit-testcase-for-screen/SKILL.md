---
name: create-unit-testcase-for-screen
description: 設計書（自由形式のMarkdown）を読み込み、画面単位の試験項目票を試験分類別（正常系・フロントバリデーション・サーババリデーション・サーバエラー）に作成する。内部で4つの分類別skillを順に呼び出すオーケストレーターskill。「設計書からテストケースを作って」「画面の単体テスト項目票を作成して」等の依頼で使用する。ソースコードからではなく設計書から作成する点、対象が画面単位である点が特徴。
---

引数 `$ARGUMENTS` で渡された「設計書ファイルパス」（および省略可能な「出力先ディレクトリ」）をもとに、以下の手順で試験分類別の試験項目票一式を作成してください。

1. `$ARGUMENTS` から設計書ファイルパスと出力先ディレクトリを読み取る
   - 出力先ディレクトリが省略された場合は、設計書ファイルと同じディレクトリを出力先とする
2. 以下4つのskillのSKILL.mdを順に読み込み、その手順に従って同じ設計書ファイルパス・出力先ディレクトリで実行する（`.claude/skills/`は、本skill自身が配置されている `claude-skills/` を基準に解決する）
   1. `.claude/skills/create-unit-testcase-normal-case/SKILL.md`（正常系）
   2. `.claude/skills/create-unit-testcase-front-validation/SKILL.md`（異常系-フロントバリデーション）
   3. `.claude/skills/create-unit-testcase-server-validation/SKILL.md`（異常系-サーババリデーション）
   4. `.claude/skills/create-unit-testcase-server-error/SKILL.md`（異常系-サーバエラー）
   - 各skill実行中にユーザーへの確認（設計書記載不足の確認、上書き確認等）が発生した場合はそのまま対話し、完了後に次のskillへ進む
   - 設計書の読み込み失敗やファイル保存失敗など、あるskillの処理自体が異常終了した場合は、その旨をエラーとして記録し、後続のskillの実行は継続する（1つの分類の失敗で全体を止めない）
   - ユーザーが対話中に全体の中止を明示的に指示した場合は、その時点で後続のskillの呼び出しを中止し、それまでに作成済みのファイルはそのまま保持する
3. 各skillの実行結果（作成/スキップ/失敗/未実施の別、試験項目件数、保存先パス）を一覧にまとめて報告する
