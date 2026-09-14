# MacでのDocker環境構築

Intel Mac上でCUI（ターミナル）のみでDocker環境を構築する手順です。HomebrewでColima、Docker CLI、Docker Composeを導入し、CIや本番に近いLinuxコンテナ環境をローカルに用意します。

## 採用する構成

**Colima + Docker CLI + Docker Compose**

- Colima、Docker CLI、Docker Composeはオープンソースで、Docker Desktopのような商用利用上の制限を避けられます。
- `docker`および`docker compose`コマンドをそのまま使えるため、既存のComposeファイルやCI用スクリプトを流用できます。
- CPU、メモリ、ディスク容量を起動時に指定できます。
- ColimaはLimaを利用してLinux VMを管理します。Intel MacではQEMUベースのVMをmacOSのHypervisor.framework（HVF）で高速化し、その上でDockerエンジンを動作させます。

## 前提

- Intelチップ搭載のMac
- ターミナルが使えること
- Homebrewがインストール済みであること

## 構築手順

### 1. ColimaとDocker CLIをインストールする

```bash
brew install colima docker docker-compose
```

### 2. Colima VMを起動する

CPU、メモリ、ディスクはMacのスペックや用途に合わせて調整します。以下はCPU 4コア、メモリ8 GB、ディスク60 GBの例です。

```bash
colima start --cpu 4 --memory 8 --disk 60
```

初回起動時はVMイメージのダウンロードなどで数分かかることがあります。

### 3. Docker contextと接続を確認する

`colima`のDocker contextがデフォルトになっていることを確認します。

```bash
docker context ls
```

続けて、CLIのバージョンとDockerエンジンへの接続を確認します。

```bash
docker --version
docker compose version
docker ps
docker run hello-world
```

`docker ps`がエラーなく一覧を返し、`hello-world`が正常終了すれば、Dockerエンジンに接続できています。

### 4. 既存のSpring Bootプロジェクトを設定する

今回は既存の`claude-playwrite-unit-test/todo-app`を使用します。Spring BootアプリはmacOS上で起動し、PostgreSQLだけをDockerコンテナで動かします。

```bash
cd claude-playwrite-unit-test/todo-app
java --version
mvn --version
```

`todo-app`はJava 17とMavenを使用しているため、`java`と`mvn`が利用できることを確認します。

#### pom.xml

現在のH2 Database用依存関係を削除し、PostgreSQL JDBCドライバーを追加します。

```xml
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
</dependency>
```

#### src/main/resources/application.properties

H2 Database用の接続設定とH2コンソール設定を削除し、PostgreSQL用の設定に置き換えます。DBの接続情報は環境変数から取得します。

```properties
spring.application.name=todo-app

spring.datasource.url=jdbc:postgresql://localhost:${POSTGRES_PORT:5432}/${POSTGRES_DB:appdb}
spring.datasource.driver-class-name=org.postgresql.Driver
spring.datasource.username=${POSTGRES_USER:appuser}
spring.datasource.password=${POSTGRES_PASSWORD}

spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=true

server.port=8080
```

#### docker/ディレクトリ

リポジトリルート直下に`docker/`ディレクトリを作成し、Docker関連ファイルをアプリ本体（`todo-app`）から分離します。構成は以下の通りです。

```
docker/
├── docker-compose.yaml
└── postgresql/
    ├── Dockerfile
    └── initdb/
        └── 01_init.sql
```

`.env`は`docker-compose.yaml`と同じ階層ではなく、`todo-app`側で一元管理します（後述）。

`docker/postgresql/Dockerfile`は公式イメージをベースに、初期化SQLスクリプト（`docker-entrypoint-initdb.d`）を実行できるようにします。

```dockerfile
FROM postgres:17-alpine

COPY initdb/ /docker-entrypoint-initdb.d/
```

`docker/postgresql/initdb/01_init.sql`は初期化用SQLの置き場です。`todo-app`は`spring.jpa.hibernate.ddl-auto=update`でHibernateがテーブルを自動生成するため、現時点では空のプレースホルダーとし、将来拡張機能の有効化や初期データ投入が必要になった際に追記します。

`docker/docker-compose.yaml`はPostgreSQLのポートをmacOSの`localhost`に公開し、`./postgresql`をビルドコンテキストとしてイメージをビルドします。

```yaml
services:
  db:
    build:
      context: ./postgresql
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres-data:
```

#### todo-app/.env.example

`.env`はDocker（PostgreSQL）とSpring Boot（`todo-app`）の両方で使う接続情報のため、`todo-app`側で一元管理します。`todo-app/.env.example`はサンプルとして管理し、パスワードは空欄にします。

```dotenv
POSTGRES_DB=appdb
POSTGRES_USER=appuser
POSTGRES_PASSWORD=''
POSTGRES_PORT=5432
```

既存の`.gitignore`に以下を追加し、実際の接続情報を含む`todo-app/.env`をGitの管理対象から除外します。

```gitignore
todo-app/.env
```

`todo-app/.env.example`を`todo-app/.env`にコピーし、`POSTGRES_PASSWORD`に十分に強い値を設定します。値はシングルクォートで囲み、`todo-app/.env`はコミットしません。

```bash
cd claude-playwrite-unit-test/todo-app
cp .env.example .env
vim .env
```

`docker-compose.yaml`は`docker/`ディレクトリにあるため、`docker compose`実行時は`--env-file`で`todo-app/.env`を明示的に指定します（後述）。

### 5. PostgreSQLとSpring Bootを起動・確認する

最初のターミナルで`docker`ディレクトリに移動し、`--env-file`で`todo-app/.env`を指定してPostgreSQLコンテナを起動し、状態を確認します。

```bash
cd claude-playwrite-unit-test/docker
docker compose --env-file ../todo-app/.env up -d
docker compose ps
```

`db`の状態が`healthy`になったら、別のターミナルで`todo-app/.env`を環境変数として読み込み、Spring BootアプリをmacOS上で起動します。

```bash
cd claude-playwrite-unit-test/todo-app
set -a
source .env
set +a
mvn spring-boot:run
```

`http://localhost:8080`へアクセスし、`todo-app`が表示されることを確認します。

停止時はSpring Bootを起動したターミナルで`Ctrl+C`を押し、`docker`ディレクトリでPostgreSQLコンテナを停止・削除します。

```bash
cd claude-playwrite-unit-test/docker
docker compose --env-file ../todo-app/.env down
```

PostgreSQLのデータは`postgres-data`ボリュームに残ります。データも削除する場合は、対象を確認した上で`docker compose --env-file ../todo-app/.env down --volumes`を実行します。

## Colimaの停止・再開・自動起動

作業終了時にVMを停止し、必要に応じて再開します。

```bash
colima stop
colima start
```

Mac起動時にColimaも自動起動する場合は、Homebrewのサービスとして登録します。

```bash
brew services start colima
```

## 既存プロジェクトとCIの確認

- 既存のComposeファイルがある場合は、プロジェクトのディレクトリで`docker compose up -d`を実行します。
- GitHub ActionsなどのCIで使用するコンテナイメージをローカルで実行し、想定した振る舞いになることを確認します。
- Composeファイルやビルドスクリプトが、Docker Desktopのファイル共有UIなどの固有機能に依存していないか確認します。

## 注意点と代替案

- ColimaにはデフォルトでGUIがないため、コンテナの状態は`docker ps`や`docker compose ps`などで確認します。
- GUIが必要な場合はRancher Desktop、rootless運用やセキュリティを重視する場合はPodmanも選択肢です。
- `docker`および`docker compose`コマンドとの互換性を優先する場合は、ColimaとDocker CLIの組み合わせが扱いやすい構成です。
