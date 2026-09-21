# 試験項目票: Todo一覧画面（サンプル1件）

対応spec: `specs/todo.spec.js`、設定: `config.todo-local.json`。
既存の試験項目票全体を代替するものではない。

| No. | シナリオ | 正常異常 | 前提条件 | 操作手順 | 期待結果 |
| --- | --- | --- | --- | --- | --- |
| 1 | タイトル未入力時は登録されない | 異常 | TodoアプリとDBが稼働中、確認ユーザーにSELECT権限がある、他の処理がTodoを更新しない | 1. Todo一覧を開く。2. タイトルを空欄にする。3. 追加ボタンを押す。 | Todoアプリの見出しが表示される。追加後に「タイトルは必須です」が表示される。DBのTodoデータが操作前後で一致する。各操作のスクリーンショットが保存される。 |

## DB確認用クエリ

No.1の操作前後で実行する。`unchanged: true` で結果を比較する。

```sql
SELECT id, title, description, due_date, status, created_at FROM todos ORDER BY id
```

## AWS

ローカルTodoではS3・EC2は対象外。AWS確認を行う場合は `config.example.json` をもとに、
実環境の期待キー・ログ文字列と、この票の確認内容を合わせて定義する。
