# CURRENT_STATE.md — 現在の状態

> このファイルは会話をまたいだコンテキスト共有用。
> 作業開始時にAIに読ませる。変更があるたびに更新する。

---

## 現在のフェーズ

**V1.1開発中 — Task1完了・Task2着手待ち**

---

## ロードマップ（優先順）

### 【完了】Step0：環境分離（インフラ）

| # | 内容 | 状態 |
|---|------|------|
| 0-1 | ローカルPostgreSQL18 + `oncall_dev` DB作成（両PC） | ✅ 完了 |
| 0-2 | `feature/v1.1` ブランチを切る | ✅ 完了 |

---

### 【完了】Task1：リファクタリングPhase1（契約の安定化）

| # | 内容 | 状態 |
|---|------|------|
| 1-1 | `GET /api/schedule/{year}/{month}` レスポンスを `doctor_id` に統一 | ✅ 完了 |
| 1-2 | `DELETE /api/schedule/{year}/{month}` エンドポイントを新設 | ✅ 完了 |
| 1-3 | `page.tsx` の localStorage（祝日・休日設定）を撤去 | ✅ 完了 |
| 1-4 | スケジュール「月削除」を DELETE API呼び出しに変更 | ✅ 完了 |

---

### 【次】Task2：保存時の警告UX

**目的：** 既存シフトの上書きやスコアへの影響を事前に伝え、意図しないデータ破壊を防ぐ。

| # | 内容 | スコープ | 状態 |
|---|------|---------|------|
| 2-1 | 保存時に「その月に登録済みシフトがある場合」上書き確認ポップアップを表示 | `src/app/hooks/useScheduleApi.ts` | 未着手 |
| 2-2 | 保存時に「スコア計算に影響が出る」旨の警告を表示 | `src/app/hooks/useScheduleApi.ts` | 未着手 |

---

### 【その次】Task3：V1.1新機能（出勤可能人数の可視化）

| # | 内容 | スコープ | 状態 |
|---|------|---------|------|
| 3-1 | `availability_service.py` 新設（日付ごとの出勤可能人数算出） | `backend/services/` | 未着手 |
| 3-2 | APIレスポンスに `availability_summary` を追加 | `backend/routers/` | 未着手 |
| 3-3 | フロントの日付セルに空き枠数バッジをレンダリング | `src/app/components/` | 未着手 |

---

### 【後々】Task4：AI診断機能（制約競合の可視化）

**目的：** 「解なし」エラーを「A先生とB先生の希望がぶつかっています」という具体的なアドバイスに変える。

| # | 内容 | 状態 |
|---|------|------|
| 3-1 | 制約をソフト化して「妥協解」を出力させる | 未着手 |
| 3-2 | 競合している制約を特定して統計レポートを生成 | 未着手 |

---

### 【後回し】Task5：リファクタリングPhase2〜5

- Phase2: 医師更新ロジックの重複排除（Admin/Public）
- Phase3: `page.tsx`, `useScheduleDnd.ts` のHook分割
- Phase4: `optimizer.py` のモジュール化（V2マルチシフト対応準備）
- Phase5: pytestの修復

---

## ビジネストラック

| タスク | 内容 | 状態 |
|--------|------|------|
| タスクA | 自院でのV1.1実戦投入・実績獲得 | Task2完了後に開始 |
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
| 2026-03-17 | Task1完了（doctor_id統一・DELETE API・localStorage撤去） |
| 2026-03-17 | Step0完了（ローカルDB・ブランチ・両PC同期） |
| 2026-03-17 | ロードマップ・開発体制・ファイル管理ルール整備完了 |

---

## 開発環境メモ

- フロント: `npm run dev` → `http://localhost:3000`
- バックエンド: `cd backend && uvicorn main:app --reload` → `http://localhost:8000`
- 本番DB: Neon（クラウドPostgreSQL）/ `.env` に `DATABASE_URL` を設定
- 開発DB: ローカルPostgreSQL / `DATABASE_URL_DEV` に設定済み（両PC）
- マイグレーション: `$env:DATABASE_URL="postgresql+asyncpg://postgres:pw@localhost/oncall_dev"; backend/.venv/Scripts/alembic upgrade head`
