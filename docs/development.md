---
name: 開発・起動ガイド
description: ローカル開発環境のセットアップ・起動方法・テスト・よく使うコマンド
---

# 開発・起動ガイド

## 前提条件
- Node.js（npm）
- Python 3.10+
- PostgreSQL（Neon）接続情報

---

## セットアップ

### フロントエンド

```bash
cd oncall-app
npm install
```

### バックエンド

```bash
cd oncall-app/backend
python -m venv .venv           # 仮想環境作成（初回のみ）
.venv/Scripts/activate         # 仮想環境有効化（Windows）
pip install -r requirements.txt
```

### 環境変数

`backend/.env` に以下を設定：

```
DATABASE_URL=postgresql+asyncpg://<user>:<password>@<host>/<db>
```

---

## 起動

### フロントエンド（Next.js）

```bash
cd oncall-app
npm run dev
```

→ `http://localhost:3000` で起動

### バックエンド（FastAPI）

```bash
cd oncall-app/backend
.venv/Scripts/activate
uvicorn main:app --reload
```

→ `http://localhost:8000` で起動
→ APIドキュメント: `http://localhost:8000/docs`

---

## テスト

```bash
cd oncall-app/backend
pytest
```

### テストファイル一覧

| ファイル | 内容 |
|---------|------|
| `tests/test_optimizer.py` | OnCallOptimizerのユニットテスト |
| `tests/test_optimize_schema.py` | OptimizeRequestスキーマのテスト |
| `tests/test_doctor_service.py` | Doctorサービスのテスト |
| `tests/test_optimizer_history_scores.py` | 履歴スコア計算テスト |
| `tests/test_optimizer_locked_shifts.py` | ロック済みシフト処理テスト |

---

## DBマイグレーション

```bash
cd oncall-app

# 現在のバージョン確認
alembic current

# 新しいマイグレーション作成
alembic revision --autogenerate -m "説明"

# マイグレーション適用
alembic upgrade head
```

---

## よく使うコマンド

```bash
# Gitの状態確認
git status

# ビルド確認
npm run build

# 型チェック
npx tsc --noEmit

# リント
npm run lint
```

---

## ディレクトリ構成（簡略）

```
oncall-app/
├── src/app/              # Next.js フロントエンド
│   ├── page.tsx          # メインダッシュボード
│   ├── components/       # UIコンポーネント
│   ├── hooks/            # カスタムフック
│   ├── utils/            # ユーティリティ
│   └── types/            # 型定義
├── backend/              # FastAPI バックエンド
│   ├── main.py           # エントリーポイント
│   ├── routers/          # APIルーター
│   ├── models/           # DBモデル
│   ├── schemas/          # リクエスト/レスポンス定義
│   ├── services/         # ビジネスロジック
│   ├── core/             # DB・設定
│   └── tests/            # テスト
├── migrations/           # Alembicマイグレーション
├── docs/                 # ドキュメント（このフォルダ）
└── public/               # 静的ファイル
```
