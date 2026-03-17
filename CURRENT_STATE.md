# CURRENT_STATE.md — 現在の状態

> このファイルは会話をまたいだコンテキスト共有用。
> 作業開始時にAIに読ませる。変更があるたびに更新する。

---

## 現在のフェーズ

**V1.1 完成・mainプッシュ済み。Renderデプロイ作業中（Python 3.14→3.12固定対応中）**

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

### 【後回し】Task2.6：巨大ファイルの分割リファクタリング

**目的：** 1ファイルに責務が集中しすぎているファイルを分割し、Task3以降の実装を安全に進める土台を作る。
**方針：** 動作を変えない。型・インターフェースは変えない。分割後にTypeScript 0エラー・動作確認で完了。

---

#### フロントエンド分割

| # | 対象ファイル（現行） | 分割内容 | 削減見込 | 状態 |
|---|------|---------|---------|------|
| 2.6-1 | `useScheduleDnd.ts`（1380行） | 制約チェックロジック一式（`getPlacementConstraintMessage` / `validateScheduleViolations` / `isDoctorBlocked*` 等）を **`useScheduleConstraints.ts`** として分離 | ▲369行（1380→1011） | ✅ 完了 |
| 2.6-2 | `useScheduleDnd.ts` | スケジュールミューテーション分離 — 2.6-1の方針で吸収済み | — | ✅ 完了（統合） |
| 2.6-3 | `page.tsx`（804行） | ナビゲーションガードロジック（`confirmNavigationAway` useEffect + stale closure ref群 + `getScheduleSignature`）を **`useNavigationGuard.ts`** として分離 | ▲83行（804→721） | ✅ 完了 |
| 2.6-4 | `useScheduleApi.ts`（590行） | 医師設定系（`fetchDoctors` / `saveAllDoctorsSettings` / `applyUnavailableDaysFromDoctors` / `applyScoresFromDoctors` / committed refs）を **`useDoctorSettings.ts`** として分離 | ▲178行（590→412） | ✅ 完了 |

> ⚠️ 2.6-1・2.6-2は `useScheduleDnd` の内部state（`hardConstraints` / `schedule` 等）を参照するため、引数として渡す設計にすること

---

#### バックエンド分割

| # | 対象ファイル（現行） | 分割内容 | 削減見込 | 状態 |
|---|------|---------|---------|------|
| 2.6-5 | `optimizer.py`（866行） | `build_model()` 内の制約追加メソッド群（spacing / weekend / score / unavailable 系）を **`optimizer_constraints.py`** に `OnCallOptimizerConstraints` mixin として分離 | ▲約400行 | 未着手 |

> ⚠️ 2.6-5は `self.model` / `self.shifts` 等を参照するため mixin パターンを使うこと。リスク高めなので最後に実施する。

---

### 【完了】Task3：マルチテナント認証（病院ごとのデータ分離）

**目的：** 複数病院が同一サーバーを安全に使えるよう、JWT認証＋hospital_id行レベル分離を導入する。

| # | 内容 | スコープ | 状態 |
|---|------|---------|------|
| 3-1 | `hospitals` テーブル新設・Alembicマイグレーション | `backend/models/hospital.py`, `migrations/` | ✅ 完了 |
| 3-2 | JWT認証（python-jose HS256）`/api/auth/login` `/api/auth/register` | `backend/core/auth.py`, `backend/services/auth_service.py`, `backend/routers/auth.py` | ✅ 完了 |
| 3-3 | 全APIエンドポイントに `hospital_id = Depends(get_current_hospital)` を追加 | `backend/routers/doctor.py`, `schedule.py`, `optimize.py`, `settings.py` | ✅ 完了 |
| 3-4 | `useAuth.ts` 新設（JWT localStorage管理）・`login/page.tsx` 新設 | `src/app/hooks/useAuth.ts`, `src/app/login/page.tsx` | ✅ 完了 |
| 3-5 | `page.tsx` に認証ガード（未認証→/loginリダイレクト）・ログアウトボタン追加 | `src/app/page.tsx` | ✅ 完了 |
| 3-6 | 全APIフックに `getAuthHeaders()` (Authorization: Bearer) を追加 | `useScheduleApi.ts`, `useDoctorSettings.ts`, `useOptimizerConfig.ts`, `useCustomHolidays.ts` | ✅ 完了 |

### 【後で】Task4（旧Task3）：仮保存機能

**目的：** 作業中シフトを下書きとしてDBに保存し、別デバイス・別日でも続きから作業できるようにする。

| # | 内容 | 状態 |
|---|------|------|
| 4-1 | `draft_schedules` テーブル作成・マイグレーション | 未着手 |
| 4-2 | `POST/GET /api/schedule/draft` API | 未着手 |
| 4-3 | 「仮保存」「仮保存を読み込む」ボタン | 未着手 |

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
| タスクA | 自院でのV1.1実戦投入・実績獲得 | 🔄 Renderデプロイ確認後に開始 |
| タスクB | 他院へのヒアリング（V2要件定義） | タスクA完了後 |

---

## 全体目標

- **短期（今月〜来月）**: Renderデプロイ安定化 + 自院での実運用開始
- **中期（2〜3ヶ月）**: 他院3〜5施設を開発パートナーとして巻き込む
- **長期（半年〜1年）**: マルチテナント型SaaSとしてV2ローンチ

---

## 直近の変更履歴

| 日付 | 内容 |
|------|------|
| 2026-03-18 | Renderデプロイ修正: requirements.txt最小化・.python-version追加（Python 3.12.9固定） |
| 2026-03-18 | 同月土曜回数平準化（sat_month_fairness: 100）追加・ソフト制約の自動無効化UI実装 |
| 2026-03-18 | V1.1バグ修正3件: gap重み動的化・土曜上限ソフトペナルティ・unavailableゲート分離（respect=OFF時にソフト化） |
| 2026-03-18 | 用語統一: 「忌避日」→「不可日」、`soft_unavailable`ラベル/`respect_unavailable_days`ラベル更新 |
| 2026-03-18 | 日当直モード実装（`holiday_shift_mode: "combined"\|"split"`）— optimizer/スキーマ/型/UI/表示すべて対応 |
| 2026-03-17 | Task3完了（マルチテナント認証・JWT・hospital_id分離・フロント認証ガード・全APIにBearer付与） |
| 2026-03-17 | Task2.6フロント完了（2.6-1〜4: useScheduleConstraints / useNavigationGuard / useDoctorSettings の分離） |
| 2026-03-17 | Task2.6を新設（巨大ファイル分割リファクタリング・Task3前に実施予定） |
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
- 開発DB: Neon devブランチ（取得後 `.env` の `DATABASE_URL` に設定）
- マイグレーション: `$env:DATABASE_URL="<dev_branch_url>"; alembic upgrade head`
- 認証: JWT HS256 / 24h有効 / `JWT_SECRET_KEY` を `.env` に設定必須
- パスワードハッシュ: `bcrypt` 直接使用（passlib 非対応のため）
- 既存Ebina HospitalデータはID `a0000000-0000-4000-8000-000000000001`、初期PW: `EbinaHospital2024!`
