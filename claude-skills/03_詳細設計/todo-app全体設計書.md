# todo-app 設計書

## 概要

`todo-app` は、Spring Boot 3.3.4 + Thymeleaf + PostgreSQL で構築されたシンプルなTodo管理Webアプリケーションである。Todoの登録・一覧表示・状態管理・編集・削除ができる。もともとPlaywrightによる単体テストの対象アプリとして作られている。

## 背景・目的

Todoの基本項目（タイトル・詳細）に加え、「期限（dueDate）」と「状態（未着手/作業中/完了）」を管理できるようにする改修を行った。本ドキュメントは、その改修後の現時点の仕様を整理したものである。

なお、旧仕様では完了/未完了の二値（`completed: boolean`）のみを持っていたが、今回の改修で `status`（3値のenum）に統合し、`completed` は廃止した。

## 要件（機能一覧）

| No. | 機能 | 概要 |
|---|---|---|
| 1 | Todo一覧表示 | 登録済みのTodoを一覧表示する（`/todos`） |
| 2 | Todo追加 | タイトル（必須）、詳細（任意）、期限（任意）を入力して追加する |
| 3 | 状態変更 | 一覧行のセレクトボックスから状態（未着手/作業中/完了）を選択すると即座に更新される |
| 4 | Todo編集 | タイトル・詳細・期限・状態を編集画面から変更できる |
| 5 | Todo削除 | 一覧行から削除できる |
| 6 | バリデーション | タイトル未入力（空白のみ含む）の場合、追加・編集ともにエラーメッセージを表示する |

## アーキテクチャ・設計方針

- **構成**: フロントエンド/バックエンドを分離しない、Spring Boot + Thymeleafによるサーバーサイドレンダリング構成のモノリシックWebアプリケーション。
- **レイヤー構成**: `Controller`（画面遷移・リクエスト処理）→ `Repository`（Spring Data JPA によるDBアクセス）→ `Entity`（永続化オブジェクト）という一般的な3層構成。Serviceレイヤーは設けず、ControllerからRepositoryを直接呼び出すシンプルな構成になっている。
- **永続化**: `spring.jpa.hibernate.ddl-auto=update` により、Entityの定義からHibernateがテーブルスキーマを自動生成・更新する。専用のマイグレーションツール（Flyway/Liquiquibase等）は導入していない。
- **状態変更の即時反映UI**: 一覧行の状態セレクトボックスは `onchange="this.form.submit()"` により、選択と同時に専用エンドポイントへPOSTしてDBを更新する（旧仕様の完了チェックボックスと同じパターンを踏襲）。

## 詳細設計

### ディレクトリ構成

```
app/
├── pom.xml
├── app-run.sh / app-stop.sh
├── .env / .env.example
├── docker/
│   ├── docker-compose.yaml
│   └── postgresql/
└── src/
    ├── main/
    │   ├── java/com/example/todo/
    │   │   ├── TodoApplication.java
    │   │   ├── controller/
    │   │   │   ├── HomeController.java
    │   │   │   └── TodoController.java
    │   │   ├── entity/
    │   │   │   ├── Todo.java
    │   │   │   └── TodoStatus.java
    │   │   └── repository/
    │   │       └── TodoRepository.java
    │   └── resources/
    │       ├── application.properties
    │       ├── static/css/style.css
    │       └── templates/todo/
    │           ├── list.html
    │           └── edit.html
    └── test/java/com/example/todo/TodoApplicationTests.java
```

### エンティティ定義

#### `Todo`（`todo-app/src/main/java/com/example/todo/entity/Todo.java`）

`@Table(name = "todos")` にマッピングされるエンティティ。

| フィールド | 型 | DB制約 | 説明 |
|---|---|---|---|
| `id` | `Long` | PK, `IDENTITY`自動採番 | Todo識別子 |
| `title` | `String` | `NOT NULL`, `@NotBlank`（"タイトルは必須です"） | タイトル。空文字・空白のみは不可 |
| `description` | `String` | nullable | 詳細（任意） |
| `dueDate` | `LocalDate` | nullable, `@DateTimeFormat(pattern="yyyy-MM-dd")` | 期限（任意）。HTMLの `<input type="date">` の値をバインドする |
| `status` | `TodoStatus` | `NOT NULL`, `@Enumerated(EnumType.STRING)`, デフォルト `NOT_STARTED` | 状態（未着手/作業中/完了） |
| `createdAt` | `LocalDateTime` | `NOT NULL`, `updatable = false` | 作成日時（エンティティ生成時に `LocalDateTime.now()` を設定、以後更新不可） |

#### `TodoStatus`（`todo-app/src/main/java/com/example/todo/entity/TodoStatus.java`）

状態を表すenum。表示用の日本語ラベル（`label`）を保持し、`getLabel()` で取得する。

| 定数 | ラベル |
|---|---|
| `NOT_STARTED` | 未着手 |
| `IN_PROGRESS` | 作業中 |
| `DONE` | 完了 |

### DBスキーマ

マイグレーションファイルは存在せず、`Todo` エンティティの定義から `ddl-auto=update` によってPostgreSQL上に自動生成・更新される。現時点で `todos` テーブルは以下のカラム構成となる。

| カラム名 | 型（PostgreSQL） | NULL許容 | 備考 |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK, IDENTITY |
| `title` | varchar | NOT NULL | |
| `description` | varchar | NULL | |
| `due_date` | date | NULL | |
| `status` | varchar | NOT NULL | enum名（`NOT_STARTED`/`IN_PROGRESS`/`DONE`）を文字列で保存 |
| `created_at` | timestamp | NOT NULL | 更新不可 |

（推測）カラム名はHibernateのデフォルト命名戦略により、Javaのキャメルケースフィールド名（`dueDate`, `createdAt`）がスネークケース（`due_date`, `created_at`）に変換される。

初期化用SQL（`app/docker/postgresql/initdb/01_init.sql`）は、`ddl-auto=update` によりスキーマが自動生成されるため実質的に空（コメントのみ）となっている。

> 補足: 過去に存在した `completed`（boolean, NOT NULL）カラムは、Entity側のフィールド削除に伴い廃止された。`ddl-auto=update` はカラムの削除を行わないため、既存DBにこのカラムが残っている場合は、開発環境のDBを作り直す（`docker compose down -v && docker compose up -d`）などの対応が必要である。

### エンドポイント一覧（`TodoController`, ベースパス `/todos`）

| メソッド | パス | 概要 | 処理内容 |
|---|---|---|---|
| GET | `/todos` | 一覧表示 | 全Todoを取得し `todo/list` を表示。バリデーション用に空の `newTodo` と `statuses`（`TodoStatus.values()`）をモデルに渡す |
| POST | `/todos` | 追加 | フォーム入力（`newTodo`）をバリデーションし、成功時は保存して `/todos` にリダイレクト。エラー時は `todo/list` を再表示 |
| POST | `/todos/{id}/status` | 状態変更 | `status`（リクエストパラメータ）を該当Todoに設定して保存し、`/todos` にリダイレクト |
| POST | `/todos/{id}/delete` | 削除 | 該当Todoを削除し、`/todos` にリダイレクト |
| GET | `/todos/{id}/edit` | 編集画面表示 | 該当Todoを取得し `todo/edit` を表示（存在しない場合は `IllegalArgumentException`） |
| POST | `/todos/{id}` | 更新 | フォーム入力（title, description, dueDate, status）をバリデーションし、成功時は該当Todoに反映して保存、`/todos` にリダイレクト。エラー時は `todo/edit` を再表示 |

補足: `HomeController` により、ルートパス `/` は `/todos` にリダイレクトされる。

### 画面仕様

#### 一覧画面（`templates/todo/list.html`, `/todos`）

- 追加フォーム（`#todo-form`）
  - タイトル入力（`#todo-title-input`, テキスト, プレースホルダ「タイトルを入力」）
  - 詳細入力（`#todo-description-input`, テキスト, プレースホルダ「詳細(任意)」）
  - 期限入力（`#todo-duedate-input`, `type="date"`）
  - 追加ボタン（`#todo-add-button`）
  - タイトル未入力時のエラーメッセージ（`.error`）
- Todo一覧（`#todo-list`）: 各行（`#todo-item-{id}`）に以下を表示
  - 状態セレクト（`#todo-status-select-{id}`）: 未着手/作業中/完了を選択でき、変更すると即座に `POST /todos/{id}/status` が送信される
  - タイトル（`#todo-title-{id}`）
  - 詳細
  - 期限（`#todo-duedate-{id}`）
  - 編集リンク（`#todo-edit-link-{id}`, `/todos/{id}/edit` へ遷移）
  - 削除ボタン（`#todo-delete-button-{id}`）
  - 状態が「完了」の行には `completed` クラスが付与され、タイトルに取り消し線が表示される（CSS: `.todo-item.completed .todo-title`）
- Todoが0件の場合、`#empty-message` に「Todoはまだありません」を表示

#### 編集画面（`templates/todo/edit.html`, `/todos/{id}/edit`）

- タイトル入力（`#todo-edit-title-input`）、エラーメッセージ（`.error`）
- 詳細入力（`#todo-edit-description-input`）
- 期限入力（`#todo-edit-duedate-input`, `type="date"`）
- 状態セレクト（`#todo-edit-status-select`）
- 保存ボタン（`#todo-edit-save-button`） → `POST /todos/{id}`
- キャンセルリンク（`#todo-edit-cancel-link`） → `/todos` へ戻る

### スタイル（`static/css/style.css`）

- `.todo-form input[type="date"]`, `.todo-form select` に、既存のテキスト入力と統一感のあるボーダー・パディングを適用
- `.todo-duedate` は詳細（`.todo-description`）と同系色・やや小さいフォントサイズで表示

## 起動方法・環境変数

### 環境構築の流れ

1. `app/docker/` ディレクトリでPostgreSQLコンテナを起動する
   ```bash
   cd app/docker
   docker compose up -d
   ```
2. `app/` ディレクトリでアプリケーションを起動する
   ```bash
   cd app
   ./app-run.sh   # 内部で .env を読み込み `mvn spring-boot:run` を実行
   ```
3. ブラウザで `http://localhost:8080/todos`（`server.port=8080`）にアクセスする

停止時は `app/app-stop.sh` を使用する（`SERVER_PORT` で待受中のプロセスをkillする）。

### 環境変数（`.env` / `.env.example`）

| 変数名 | 用途 | デフォルト |
|---|---|---|
| `POSTGRES_DB` | 接続先DB名 | なし（必須） |
| `POSTGRES_USER` | DB接続ユーザー | なし（必須） |
| `POSTGRES_PASSWORD` | DB接続パスワード | なし（必須、`docker-compose.yaml`側でも未設定時はエラーになる） |
| `POSTGRES_PORT` | DB接続ポート | `5432` |

`application.properties` では、`spring.datasource.url` にこれらの環境変数を埋め込み、`jdbc:postgresql://localhost:${POSTGRES_PORT:5432}/${POSTGRES_DB:appdb}` としてPostgreSQLに接続する。`.env` はGit管理対象外（`.gitignore`）。

### 主要な依存関係（`pom.xml`）

- `spring-boot-starter-web`
- `spring-boot-starter-thymeleaf`
- `spring-boot-starter-data-jpa`
- `spring-boot-starter-validation`
- `org.postgresql:postgresql`（runtime）
- `spring-boot-devtools`（runtime, optional）
- `spring-boot-starter-test`（test）

Java 17、Spring Boot 3.3.4を使用。

## 検証方法

- ビルド・テスト: `todo-app` ディレクトリで `mvn test` を実行する（DBが起動していること、`.env` を読み込んでいることが前提）。現状のテストは `TodoApplicationTests.contextLoads()` のみで、アプリケーションコンテキストが正常に起動することを検証する。
- 手動確認: アプリ起動後、ブラウザから `/todos` にアクセスし、Todoの追加（期限あり/なし）、状態変更（一覧行・編集画面の双方）、削除、バリデーションエラー表示を確認する。
- 単体テスト: `unit-test/試験項目票_Todo一覧画面.md` に記載の試験項目に基づき、Playwright等でシナリオテストを行う運用になっている（ただし本ドキュメント作成時点で、当該試験項目票は `completed` ベースの旧仕様のままであり、期限・状態（3値）に対応した項目への更新は別途必要）。

## オープンな課題・TODO

- `unit-test/試験項目票_Todo一覧画面.md` の試験項目が旧仕様（`completed`のみ、期限なし）のままであり、期限・状態（未着手/作業中/完了）に対応した試験項目への更新が未実施。
- マイグレーションツール（Flyway等）は未導入であり、スキーマ変更時は `ddl-auto=update` の制約（カラム削除やNOT NULL制約変更が行われない）に開発者が都度対応する必要がある。
