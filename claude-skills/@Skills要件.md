# Skills要件

| 大分類 | 中分類 | 小分類 | 内容 | Skill名 |
| --- | --- | --- | --- | --- |
| 設計 | 詳細設計 | | 設計書執筆 | |
| 設計Rv | | | 設計書Rv用 | |
| 開発環境構築 | | | AIに技術スタックを与え、それ用の構築手順書を作成させる | |
| | | | 作成した手順書をもとにAIに構築させ、手順書にFBさせる | |
| 製造 | | | 新規設計書から実装する | implement-from-design-doc |
| | | | 改修設計書から実装する | implement-from-design-doc-diff |
| コードレビュー | 統合 | | 下記4観点のRvをまとめて実行し、指摘がある場合に結果をHTMLに出力する（オーケストレータ） | review-implementation |
| | 実装誤り検知 | | 設計書内容と一致しているかをRvする | review-implementation-against-design-doc |
| | 潜在バグ検知 | | 潜在的なバグが無いかをRvする | review-implementation-for-bugs |
| | 性能問題検知 | | パフォーマンスやリソース消費に悪影響が無いかをRvする | review-implementation-for-performance |
| | セキュリティ問題検知 | | セキュリティ的欠陥が無いかをRvする | review-implementation-for-security |
| 単体試験項目作成 | 画面 | 統合 | 設計書をもとに下記3分類の試験票をまとめて作成する（オーケストレータ） | create-unit-testcase-for-screen |
| | | 正常系 | 設計書をもとに試験票を作成する | create-unit-testcase-normal-case |
| | | 入力チェック | 設計書をもとに試験票を作成する | create-unit-testcase-front-validation, create-unit-testcase-server-validation |
| | | 異常系 | | create-unit-testcase-server-error |
| | | 全分類 | ソースをもとに試験票を作成する | create-unit-testcase-for-screen-from-source |
| | API | 正常系 | | |
| | | 入力チェック | | |
| | | 異常系 | | |
| | バッチ | 正常系 | | |
| | | 入力チェック | | |
| | | 異常系 | | |
| 単体試験項目Rv | | | 設計書をもとに試験票をRvする | |
| | | | ソースをもとに試験票をRvする | review-unit-testcase |
| 単体試験項目完成 | 画面試験 | | ソースをもとに試験票を未作成時に作成し、Rv・修正を指摘0件または最大5回まで繰り返す | finalize-unit-testcase-for-screen |
| 単体試験実施 | | | 試験票をもとに試験実施する | run-playwright-unit-test |
