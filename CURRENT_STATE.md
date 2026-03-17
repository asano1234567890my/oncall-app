# CURRENT_STATE.md — 現在の状態

> このファイルは会話をまたいだコンテキスト共有用。
> 作業開始時にAIに読ませる。変更があるたびに更新する。

---

## 現在のフェーズ

**Ver 1.0 完成・V1.1開発準備中**
まず環境分離（Step0）を行い、安全な開発環境を確保してから実装に入る。

---

## ロードマップ（優先順）

### 【最初】Step0：環境分離（インフラ）← NEW

| # | 内容 | 状態 |
|---|------|------|
| 0-1 | Neonのブランチ機能で「開発用DB」を作成 | 未着手 |
| 0-2 | `feature/v1.1` ブランチを切る | 未着手 |

---

### 【最優先】Task1：リファクタリングPhase1（契約の安定化）

**目的：** APIの契約不一致・localStorageによる状態ズレを解消する。SaaS化の前提。

| # | 内容 | スコープ | 状態 |
|---|------|---------|------|
| 1-1 | `GET /api/schedule/{year}/{month}` レスポンスを `doctor_name` → `doctor_id` に統一 | `backend/routers/schedule.py` + FE同時変更 | 未着手 |
| 1-2 | `DELETE /api/schedule/{year}/{month}` エンドポイントを新設 | `backend/routers/schedule.py` | 未着手 |
| 1-3 | `page.tsx` の localStorage（祝日・休日設定）を撤去してDB管理に一本化 | `src/app/page.tsx` | 未着手 |
| 1-4 | スケジュール「月削除」をlocalクリア → DELETE API呼び出しに変更 | `src/app/page.tsx` | 未着手 |

> ⚠️ 1-1はBE+FEセットで実装すること（フロントが壊れるため）

---

### 【次】Task2：V1.1新機能（出勤可能人数の可視化）

| # | 内容 | スコープ | 状態 |
|---|------|---------|------|
| 2-1 | `availability_service.py` 新設（日付ごとの出勤可能人数算出） | `backend/services/` | 未着手 |
| 2-2 | APIレスポンスに `availability_summary` を追加 | `backend/routers/` | 未着手 |
| 2-3 | フロントの日付セルに空き枠数バッジをレンダリング | `src/app/components/` | 未着手 |

---

### 【その次】Task3（旧Step4）：AI診断機能（制約競合の可視化） ← NEW

**目的：** 「解なし」エラーを「A先生とB先生の希望がぶつかっています」という具体的なアドバイスに変える。

| # | 内容 | 状態 |
|---|------|------|
| 3-1 | 制約をソフト化して「妥協解」を出力させる | 未着手 |
| 3-2 | 競合している制約を特定して統計レポートを生成 | 未着手 |

---

### 【後回し】Task4：リファクタリングPhase2〜5

- Phase2: 医師更新ロジックの重複排除（Admin/Public）
- Phase3: `page.tsx`, `useScheduleDnd.ts` のHook分割
- Phase4: `optimizer.py` のモジュール化（V2マルチシフト対応準備）
- Phase5: pytestの修復

---

## ビジネストラック

| タスク | 内容 | 状態 |
|--------|------|------|
| タスクA | 自院でのV1.1実戦投入・実績獲得 | Task1完了後に開始 |
| タスクB | 他院へのヒアリング（V2要件定義） | タスクA完了後 |

---

## 全体目標

- **短期（今月〜来月）**: Task1完了 + 自院での実運用開始
- **中期（2〜3ヶ月）**: 他院3〜5施設を開発パートナーとして巻き込む
- **長期（半年〜1年）**: マルチテナント型SaaSとしてV2ローンチ

---

## 直近の変更履歴

| 日付 | 内容 |
|------|------|
| 2026-03-17 | Step0（環境分離）・Task3（AI診断）を追加 |
| 2026-03-17 | ロードマップをCURRENT_STATEに反映。開発体制・ファイル管理ルール整備完了 |

---

## 開発環境メモ

- フロント: `npm run dev` → `http://localhost:3000`
- バックエンド: `cd backend && uvicorn main:app --reload` → `http://localhost:8000`
- DB: Neon（クラウドPostgreSQL）/ `.env` に `DATABASE_URL` を設定
- マイグレーション: リポジトリルートで `alembic upgrade head`
