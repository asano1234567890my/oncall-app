# CURRENT_STATE.md — 現在の状態

> このファイルは会話をまたいだコンテキスト共有用。
> 作業開始時にAIに読ませる。変更があるたびに更新する。

---

## 現在のフェーズ

**V1.1開発中 — Task2完了・Task2.5（optimizer config保存）完了・Task3着手待ち**

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

### 【完了】Task2：警告UXの強化

**目的：** 意図しないデータ破壊・設定の取りこぼしを防ぐ。

| # | 内容 | スコープ | 状態 |
|---|------|---------|------|
| 2-1 | シフト保存時に「登録済みシフトを上書きします」確認ポップアップを表示 | `src/app/hooks/useScheduleApi.ts` | ✅ 完了 |
| 2-2 | シフト保存時に「スコア計算に影響が出る」旨の警告を表示 | `src/app/hooks/useScheduleApi.ts` | ✅ 完了 |
| 2-3 | 医師の個別不可日・固定不可曜日を変更したのに未登録のままページ離脱しようとした際に警告を表示 | `src/app/page.tsx` | ✅ 完了 |
| 2-4 | 空シフト（未定）のまま保存しようとした際に警告を表示（日直は日曜・祝日のみ対象） | `src/app/hooks/useScheduleDnd.ts` | ✅ 完了 |
| 2-5 | `GET /api/schedule/{year}/{month}` が全日を返すよう修正（空スロットも `null` で返却） | `backend/routers/schedule.py` | ✅ 完了 |

---

### 【完了】Task2.5：optimizer config（スコア・重み・ハード設定）のDB永続化

**目的：** スコア範囲・重みづけ・ハード制約をDBに保存し、リロード後も設定が復元されるようにする。

| # | 内容 | スコープ | 状態 |
|---|------|---------|------|
| 2.5-1 | `system_settings` テーブルに `optimizer_config` キーで保存する backend 実装 | `backend/schemas/settings.py`, `backend/services/settings_service.py`, `backend/routers/settings.py` | ✅ 完了 |
| 2.5-2 | `useOptimizerConfig` フックを新設（マウント時にロード・PUT保存） | `src/app/hooks/useOptimizerConfig.ts` | ✅ 完了 |
| 2.5-3 | score_min/max エリアに「スコア・重み・ルールを保存」ボタンを追加 | `src/app/components/SettingsPanel.tsx` | ✅ 完了 |
| 2.5-4 | WeightsConfig・RulesConfig ヘッダーに「保存」ボタンを追加 | `src/app/components/settings/WeightsConfig.tsx`, `RulesConfig.tsx` | ✅ 完了 |
| 2.5-5 | `DoctorListManager` の説明文に重み・ルール設定の案内を追記 | `src/app/components/settings/DoctorListManager.tsx` | ✅ 完了 |

---

### 【その次】Task3：仮保存機能

**目的：** 作業中シフトを下書きとしてDBに保存し、別デバイス・別日でも続きから作業できるようにする。

**DB設計：** `draft_schedules` テーブルを新設（確定データの `shift_assignments` とは完全分離）

| # | 内容 | スコープ | 状態 |
|---|------|---------|------|
| 3-1 | `draft_schedules` テーブル作成・マイグレーション | `backend/models/`, `alembic/` | 未着手 |
| 3-2 | `POST /api/schedule/draft` `GET /api/schedule/draft/{year}/{month}` を実装 | `backend/routers/` | 未着手 |
| 3-3 | D&Dビューに「仮保存」ボタンと「仮保存を読み込む」ボタンを追加 | `src/app/components/` | 未着手 |
| 3-4 | 確定済みシフトをD&Dビューに読み込んで再編集（管理者のみ・警告必須） | `src/app/hooks/useScheduleApi.ts` | 未着手 |

> ⚠️ 3-4は過去スコア計算に影響するため、管理者権限チェックと強い警告を必須とする

---

### 【後々】Task4：V1.1新機能（出勤可能人数の可視化）

| # | 内容 | スコープ | 状態 |
|---|------|---------|------|
| 3-1 | `availability_service.py` 新設（日付ごとの出勤可能人数算出） | `backend/services/` | 未着手 |
| 3-2 | APIレスポンスに `availability_summary` を追加 | `backend/routers/` | 未着手 |
| 3-3 | フロントの日付セルに空き枠数バッジをレンダリング | `src/app/components/` | 未着手 |

---

### 【後々】Task5：AI診断機能（制約競合の可視化）

**目的：** 「解なし」エラーを「A先生とB先生の希望がぶつかっています」という具体的なアドバイスに変える。

| # | 内容 | 状態 |
|---|------|------|
| 3-1 | 制約をソフト化して「妥協解」を出力させる | 未着手 |
| 3-2 | 競合している制約を特定して統計レポートを生成 | 未着手 |

---

### 【後回し】Task6：リファクタリングPhase2〜5

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
| 2026-03-17 | Task2.5完了（optimizer config DB永続化・スコア/重み/ルール保存ボタン追加） |
| 2026-03-17 | Task2完了（保存時警告・離脱警告・空シフト警告・全日返却） |
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
