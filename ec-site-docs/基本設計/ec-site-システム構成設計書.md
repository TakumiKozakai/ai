# ec-site システム構成設計書

ECサイトアプリの構成・設計方針・起動構成を定義する。画面仕様は `../詳細設計/01_画面設計書/`、API仕様は `../詳細設計/02_API設計書/` を参照。

## 1. 前提

### 1.1 構成

- **フロントエンド**: React（TypeScript）による SPA。ビルドは Vite、画面遷移は React Router で行う。画面はすべてブラウザ側で描画し、データはバックエンドの JSON API から取得する。
- **バックエンド**: Go + Gin による JSON API。DBアクセスは GORM、認証は JWT、パスワードハッシュは bcrypt で行う。
- **DB**: PostgreSQL 17（`ec-site/docker`）。スキーマはDDL（`ec-site/docker/postgresql/initdb/01_init.sql`）で作成し、GORM の `AutoMigrate` は使わない。
- **レイヤー構成（バックエンド）**: `handler`（リクエスト・レスポンスの変換、入力チェック）→ `service`（業務ロジック、トランザクション）→ `repository`（GORM によるDBアクセス）→ `model`（テーブルに対応する構造体）。
- **対象外**: 管理画面（商品・カテゴリ登録、注文ステータス変更）、注文履歴画面、配送先住所の編集・削除画面、会員情報変更・退会、パスワード再設定、実際の決済処理。

### 1.2 ディレクトリ構成

```
ec-site/ec-site-web/
├── backend/                   # Go
│   ├── go.mod
│   ├── cmd/server/main.go     # 起動・ルーティング
│   └── internal/
│       ├── config/            # 環境変数の読み込み
│       ├── model/             # GORM モデル
│       ├── repository/        # DBアクセス
│       ├── service/           # 業務ロジック・トランザクション
│       ├── handler/           # Gin ハンドラ・入力チェック
│       ├── middleware/        # 認証・CSRF対策ヘッダー・エラー処理
│       └── auth/              # JWT の発行・検証、パスワードハッシュ
└── frontend/                  # React
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx            # ルーティング定義
        ├── api/               # API クライアント
        ├── components/        # 共通ヘッダー・メッセージ表示・ルートガード等
        ├── pages/             # 画面コンポーネント
        └── utils/             # 金額・日時の表示形式
```

### 1.3 起動構成

| 用途 | 構成 |
|---|---|
| 開発時 | バックエンド `http://localhost:8080`、フロントエンド開発サーバー（Vite）`http://localhost:5173`。Vite の proxy で `/api` をバックエンドへ転送する（ブラウザからは同一オリジンに見える） |
| 試験・本番 | フロントエンドをビルド（`npm run build`）し、バックエンドが `frontend/dist` の静的ファイルを配信する。`/api` 以外のパスで該当ファイルが無い場合は `index.html` を返す（SPA のルーティング用）。アクセス先は `http://localhost:8080` の1つ |

- バックエンドの設定は環境変数で与える（DB接続情報、`JWT_SECRET`、`SERVER_PORT`、`COOKIE_SECURE`、`STATIC_DIR`）。`ec-site/ec-site-web/.env.example` に項目を列挙する。
- 日時はすべて日本時間（`Asia/Tokyo`）で扱う。
