# CLAUDE.md — oncall-app プロジェクト概要

> **作業開始時に必ず `CURRENT_STATE.md` を読むこと。**

## プロジェクト概要

病院の**当直・日直スケジュールを自動生成する**フルスタックWebアプリ。

- フロントエンドで医師・制約・重みを設定し、バックエンドのCP-SAT最適化ソルバーでスケジュールを生成する
- 医師ごとにマジックリンク（access_token）経由で個別に不可日を入力できる
- **次期V2**: ランディングページ・初心者向け`/app`・オンボーディング・公開デモを実装予定（`docs/ux_redesign.md` 参照）
- 生成されたスケジュールはドラッグ&ドロップで手動調整でき、DB保存可能

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 |
| バックエンド | Python / FastAPI（非同期） |
| DB | PostgreSQL（Neon クラウド）/ SQLAlchemy / asyncpg |
| 最適化 | Google OR-Tools CP-SAT |
| マイグレーション | Alembic |
| 祝日 | jpholiday（日本の祝日） |

---

## 起動方法

### フロントエンド
```bash
npm run dev          # http://localhost:3000
```

### バックエンド
```bash
cd backend
uvicorn main:app --reload   # http://localhost:8000
# APIドキュメント: http://localhost:8000/docs
```

---

## スコア設定

| シフト種別 | スコア |
|---------|------|
| 日直（日曜・祝日の午前） | 0.5 |
| 当直（平日・日曜・祝日の夜間） | 1.0 |
| 当直（土曜夜間） | 1.5 |

---

## 主要ファイル

### フロントエンド
| ファイル | 役割 |
|---------|------|
| `src/app/page.tsx` | メインダッシュボード |
| `src/app/components/ScheduleBoard.tsx` | スケジュール表示・ドラッグ編集 |
| `src/app/components/SettingsPanel.tsx` | 設定パネル（制約・重み・休日） |
| `src/app/hooks/useDashboardState.ts` | 全体状態管理 |
| `src/app/hooks/useScheduleApi.ts` | API通信 |
| `src/app/hooks/useScheduleDnd.ts` | ドラッグ&ドロップ |
| `src/app/types/dashboard.ts` | 型定義 |

### バックエンド
| ファイル | 役割 |
|---------|------|
| `backend/main.py` | FastAPIエントリーポイント |
| `backend/services/optimizer.py` | **最適化の中核**（OnCallOptimizerクラス） |
| `backend/services/optimizer_history.py` | 過去シフト履歴のスコア計算 |
| `backend/routers/optimize.py` | POST /api/optimize/ |
| `backend/routers/doctor.py` | 医師管理API |
| `backend/routers/public_doctor.py` | マジックリンクAPI |
| `backend/core/db.py` | DB接続 |

---

## 詳細ドキュメント

| ファイル | 内容 |
|---------|------|
| `docs/frontend.md` | フロントエンドの詳細（ページ・コンポーネント・フック） |
| `docs/backend.md` | バックエンドの詳細（API・モデル・スキーマ・サービス） |
| `docs/optimizer.md` | 最適化ロジックの詳細（制約・重み・スコア） |
| `docs/database.md` | DBテーブル設計・マイグレーション履歴 |
| `docs/development.md` | 開発環境セットアップ・よく使うコマンド |
| `docs/product_strategy.md` | プロダクト戦略・ロードマップ・価格・GTM |
| `docs/system_spec_for_ai_guide.md` | **AIガイド用システム仕様書**（機能実装時に必ず追記すること） |
| `docs/future_schedule_requirements.md` | 将来対応したいシフト生成要件（現仕様では不可能なニーズの記録） |

---

## AIへの行動指針（記憶）

### docs/*.md と CURRENT_STATE.md の扱い
これらは**セーブポイント・仕様の教科書・事実・記憶**である。

- 仕様変更・新機能が決まった時点で**即**該当docsに記録する（実装前でも「設計確定・未着手」として記録）
- 実装完了後は**必ず**docsを更新してからユーザーに報告する
- 会話の中で決まったことはその場で反映する
- docsが古い・漏れていると感じたら先に読み直して確認してから作業する
- 作業完了後は `CURRENT_STATE.md`（プロジェクト内）→ 親ファイル（`C:\Users\user\CURRENT_STATE.md`）の順で更新する（親ファイルはOneDriveで自動同期されるため手動アップロード不要）
- **機能実装・改修完了後は `docs/system_spec_for_ai_guide.md`（AIガイド用仕様書）も更新する**
  - この文書はAIガイド（チャットUI）の知識ベースとなる
  - 新機能・仕様変更・制約の追加/変更があれば該当セクションに追記
  - 過去セッションの履歴は参照せず、現コードと仕様書が常に最新の真実

---

## 開発ルール

### 実装前に必ずdocsを更新する

変更に着手する前に、影響を受けるdocsファイルを先に更新すること。

**更新対象の判断基準：**

| 変更内容 | 更新するdocsファイル |
|---------|------|
| API追加・変更 | `docs/backend.md` |
| DBスキーマ変更 | `docs/database.md` |
| 最適化ロジック変更 | `docs/optimizer.md` |
| フロントエンド構造変更 | `docs/frontend.md` |
| 機能追加・仕様変更（全般） | `docs/system_spec_for_ai_guide.md` |

**順序：**
1. 影響範囲を特定し、該当docsを更新
2. バックエンド（DB → API → 最適化）を実装
3. フロントエンドを追従実装（APIの振る舞いが確定してから）

---

### ファイルスコープ（触ってよい範囲）

タスクに応じて、以下のスコープ内のファイルのみを変更する。スコープ外への波及が必要な場合は、先に確認する。

| 担当領域 | スコープ（変更してよいファイル） |
|---------|------|
| フロント基盤 | `src/app/page.tsx`, `src/app/hooks/*`, `src/app/types/*` |
| フロントUI | `src/app/components/*`, `src/app/entry/*`, `src/app/admin/*` |
| バックエンドDB | `backend/models/*`, `backend/core/*`, `alembic/*` |
| バックエンドAPI | `backend/routers/*`, `backend/schemas/*`, `backend/services/settings_service.py` |
| 最適化コア | `backend/services/optimizer.py` |
| 最適化I/O | `backend/schemas/optimize.py`, `backend/routers/optimize.py`, `backend/services/optimizer_history.py` |
| テスト | `tests/*` |

---

## 作業完了時の手順（毎回必ずユーザーに伝えること）

作業が完了したら、以下をユーザーに案内する：

1. `CURRENT_STATE.md`（このプロジェクト内）を更新した
2. **`C:\Users\user\CURRENT_STATE.md`（親ファイル）も必要に応じて更新する**

> 親ファイルは OneDrive で自動同期されるため手動アップロード不要。

---

## 注意事項

- `.env` はgitignore済み。`DATABASE_URL` を手動で設定すること
- バックエンドとフロントエンドは**別プロセスで起動**する必要がある
- マイグレーションはルートの `alembic.ini` から実行する（`backend/` ではなく `oncall-app/` で）
- `is_locked=True` の医師は不可日の自己入力ができなくなる（締切後のロック）
- ロック済みシフト（フロントエンドで固定）は最適化で変更されない
