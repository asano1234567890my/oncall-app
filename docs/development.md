---
name: 開発・起動ガイド
description: ローカル開発環境のセットアップ・起動方法・テスト・よく使うコマンド
---

# 開発・起動ガイド

## 開発環境

| 項目 | 内容 |
|------|------|
| OS | Windows 11 Pro |
| エディタ | Cursor |
| ターミナル | PowerShell（Cursor内蔵ターミナル） |
| AI | Claude Code（bash環境で動作 — ユーザー向けコマンド例はPowerShell構文で記載） |
| Git | Git for Windows |

> **注意**: Cursor内のターミナルはPowerShellがデフォルト。`export VAR=value` ではなく `$env:VAR="value"` を使うこと。コマンド連結は `&&` ではなく `;` を使うこと。

---

## 前提条件
- Node.js（npm）
- **Python 3.12**（3.12.9 推奨 — `.python-version` に固定済み。3.14はpydantic-core非対応）
- PostgreSQL（Neon）接続情報

---

## セットアップ

### フロントエンド

```powershell
cd oncall-app
npm install
```

### バックエンド

```powershell
cd oncall-app/backend
python -m venv .venv           # 仮想環境作成（初回のみ）
.venv\Scripts\Activate.ps1     # 仮想環境有効化（PowerShell）
pip install -r requirements.txt
```

### 環境変数

`backend/.env` に以下を設定：

```
DATABASE_URL=postgresql+asyncpg://<user>:<password>@<host>/<db>
JWT_SECRET_KEY=<任意のランダム文字列（本番環境では必ず強固なキーを使うこと）>
```

- `JWT_SECRET_KEY` を設定しないとログイン・認証が機能しない
- Renderデプロイ時は環境変数ダッシュボードに両変数を設定すること
- `PYTHON_VERSION=3.12.9` も Render 環境変数に設定しておくと安全（`.python-version` と二重固定）

---

## 起動

### フロントエンド（Next.js）

```powershell
cd oncall-app
npm run dev
```

→ `http://localhost:3000` で起動

### バックエンド（FastAPI）

```powershell
cd oncall-app\backend
.venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

### スマホ実機テスト（同一ネットワーク内）

```powershell
# バックエンド（外部公開）
cd oncall-app\backend
uvicorn main:app --reload --host 0.0.0.0

# フロント（別ターミナル・外部公開+API先を変更）
cd oncall-app
$env:NEXT_PUBLIC_API_URL="http://<PCのIP>:8000"; npm run dev -- -H 0.0.0.0
```

→ スマホから `http://<PCのIP>:3000` でアクセス
→ PCのIPは `Get-NetIPAddress -AddressFamily IPv4` で確認

→ `http://localhost:8000` で起動
→ APIドキュメント: `http://localhost:8000/docs`

---

## テスト

```powershell
cd oncall-app\backend
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

```powershell
cd oncall-app

# 現在のバージョン確認
alembic current

# 新しいマイグレーション作成
alembic revision --autogenerate -m "説明"

# マイグレーション適用
alembic upgrade head
```

---

## デプロイ構成

| サービス | ホスティング | URL |
|---------|------------|-----|
| フロントエンド | Vercel | `https://oncall-8pxrfeoch-asano1234567890mys-projects.vercel.app` |
| バックエンド | Render | `https://oncall-app-preview.onrender.com` |

### フロントエンド → バックエンド接続（NEXT_PUBLIC_API_URL）

- フロントエンドは `NEXT_PUBLIC_API_URL` でバックエンドのURLを参照する
- **この値はリポジトリルートの `.env.production` に記載されている**（Vercelの環境変数設定に依存しない）
- バックエンドのURLが変わった場合は **`.env.production` を更新してpush** すること
- `NEXT_PUBLIC_*` はNext.jsのビルド時に静的に埋め込まれるため、変更後は再デプロイが必要

### バックエンドCORS設定

- `backend/main.py` で `FRONTEND_URL` 環境変数を参照してCORSオリジンを許可している
- Renderの環境変数に `FRONTEND_URL=*`（全許可）を設定済み
- 本番運用時はVercelのURLに絞ること

### Renderデプロイ注意事項

- リポジトリルートに `.python-version`（内容: `3.12.9`）を置くことで Python バージョンを固定
- Renderダッシュボードで `PYTHON_VERSION=3.12.9` 環境変数を追加しておくと二重固定になり安全
- `requirements.txt` は直接importするパッケージのみに絞ること（numpy / pandas 等の未使用パッケージはビルドを遅くし破損の原因になる）
- `requirements.txt` は必ず **UTF-8** で保存すること（Windowsのメモ帳で編集するとUTF-16になりRenderがパース失敗する）

---

## よく使うコマンド

```powershell
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
