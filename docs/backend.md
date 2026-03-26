---
name: バックエンド構成
description: Python FastAPI バックエンドのルーター・モデル・スキーマ・サービスの詳細
---

# バックエンド構成

## 技術スタック
- **FastAPI**（非同期WebAPI）
- **SQLAlchemy**（非同期ORM）
- **asyncpg**（非同期PostgreSQLドライバ）
- **Pydantic**（バリデーション・スキーマ）
- **Alembic**（DBマイグレーション）
- **Google OR-Tools**（CP-SAT最適化ソルバー）
- **jpholiday**（日本の祝日）
- **PostgreSQL Neon**（クラウドDB）
- **Google Gemini API**（`google-genai` SDK — 画像OCR・ドキュメント解析）

---

## エントリーポイント

`backend/main.py`
- FastAPIアプリ初期化
- CORS設定（フロントエンドからのリクエスト許可）
- SlowAPI レート制限設定
- 全ルーターの登録

---

## 認証

- JWT（HS256）による病院単位の認証
- `backend/core/auth.py` — トークン生成・検証・`get_current_hospital` dependency
- `backend/services/auth_service.py` — bcrypt パスワードハッシュ（passlib非対応のため直接使用）
- `backend/.env` に `JWT_SECRET_KEY` 必須

---

## APIエンドポイント一覧

### 認証（認証不要）
| パス | メソッド | 機能 |
|------|---------|------|
| `/api/auth/login` | POST | ログイン（JWT発行）レート制限10/分 |
| `/api/auth/register` | POST | 病院新規登録 レート制限5/分 |

### 認証必須（Bearer JWT）
| パス | メソッド | ファイル | 機能 |
|------|---------|---------|------|
| `/api/auth/password` | PUT | `routers/auth.py` | パスワード変更 |
| `/api/optimize/` | POST | `routers/optimize.py` | スケジュール最適化生成（成功時に`soft_unavail_violations`でソフト不可日違反を返却） |
| `/api/optimize/diagnose` | POST | `routers/optimize.py` | 解なし時の制約診断（Phase1: MUS検出→Phase2: 不可日/ロック競合→Phase2b: 管理者設定の最小変更値探索+人手不足日検出。Geminiは一時スキップ・コード保持） |
| `/api/demo/optimize` | POST | `routers/demo.py` | 公開デモ用生成（認証不要・DB不使用・レート制限1分3回・医師15人上限） |
| `/api/settings/kv/{key}` | GET/PUT | `routers/settings.py` | 汎用KV設定（setup_completed, onboarding_seen等） |
| `/api/schedule/save` | POST | `routers/schedule.py` | スケジュールをDBに保存 |
| `/api/schedule/{year}/{month}` | GET | `routers/schedule.py` | 月別スケジュール取得 |
| `/api/schedule/range` | GET | `routers/schedule.py` | 期間指定スケジュール取得 |
| `/api/schedule/draft/{year}/{month}` | GET | `routers/schedule.py` | 仮保存スケジュール取得 |
| `/api/schedule/draft/{year}/{month}` | PUT | `routers/schedule.py` | 仮保存スケジュール保存（upsert） |
| `/api/schedule/draft/{year}/{month}` | DELETE | `routers/schedule.py` | 仮保存スケジュール削除 |
| `/api/schedule/export/{year}/{month}` | GET | `routers/schedule.py` | PDF/Excel出力（`?format=pdf\|xlsx`）。A4縦・2カラム（左1-15日/右16-末日）・太め罫線。Excel: 日付/日直/当直+医師別集計（COUNTIFS）、土曜/日祝は非表示ヘルパー列 |
| `/api/doctors/` | GET/POST | `routers/doctor.py` | 医師一覧取得・追加 |
| `/api/doctors/{id}` | GET/PUT/DELETE | `routers/doctor.py` | 医師操作 |
| `/api/doctors/bulk-lock` | PATCH | `routers/doctor.py` | 全医師一括ロック |
| `/api/doctors/bulk-soften` | PATCH | `routers/doctor.py` | 個別不可日の一括ソフト化/復元（固定不可曜日は対象外） |
| `/api/settings/optimizer_config` | GET/PUT | `routers/settings.py` | 最適化設定 |
| `/api/settings/published_months` | GET/PUT | `routers/settings.py` | 当直表の公開月管理（`["2026-04","2026-05"]`形式） |
| `/api/settings/custom_holidays` | GET/POST | `routers/settings.py` | カスタム祝日設定 |

### AI連携・インポート（認証必須）
| パス | メソッド | ファイル | 機能 |
|------|---------|---------|------|
| `/api/import/parse-image` | POST | `routers/import_image.py` | 当直表画像をGemini Vision APIで解析→スケジュールJSON返却（年月・日別日直/当直の医師名） |
| `/api/import/confirm` | POST | `routers/import_image.py` | 解析結果＋医師名マッピングを受け取りDBに保存（既存シフト上書き・新規医師作成対応） |
| `/api/import/parse-doctors` | POST | `routers/import_image.py` | 画像・Excel・Word・PDF・テキストから医師名リストをAI抽出 |
| `/api/import/register-doctors` | POST | `routers/import_image.py` | 抽出した医師名を一括登録（同名スキップ） |
| `/api/auth/transfer-code` | POST | `routers/auth.py` | 引き継ぎコード発行（12文字・24時間有効・既存コード置換） |
| `/api/auth/transfer-import` | POST | `routers/auth.py` | 引き継ぎコードでデータ移行（医師・シフト・設定を丸ごとコピー） |
| `/api/auth/account` | DELETE | `routers/auth.py` | アカウント完全削除（パスワード確認必須） |

### 認証不要（マジックリンク）
| パス | メソッド | 機能 |
|------|---------|------|
| `/api/public/doctors/{token}` | GET/PUT | 医師が不可日を自己入力。GETレスポンスに `doctor_message`（管理者からの案内メッセージ）・`unavail_day_limit`（個別不可日の上限数）を含む |
| `/api/schedule/public/{doctor_token}/{year}/{month}` | GET | トークンで認証し公開月の全体スケジュールを医師名付きで返却（`{published, schedule, doctors, publish_comment}`）。認証不要 |
| `/api/schedule/public-export/{doctor_token}/{year}/{month}` | GET | トークン認証で当直表PDF/Excelダウンロード（`?format=pdf\|xlsx`）。Excelは統計なしのシンプル当直表のみ。公開月のみ。認証不要 |
| `/api/schedule/public-shifts/{doctor_token}` | GET | 医師個人の確定済みシフトをJSON返却（公開月のみ・過去3ヶ月〜未来6ヶ月）。認証不要 |
| `/api/schedule/ical/{doctor_token}` | GET | ICSフィード（Googleカレンダー同期用）— 医師個人の確定済みシフトを終日イベント .ics 形式で返却。`?year=&month=`で月限定可。公開月のみ。認証不要 |
| `/api/shared-entry/token` | GET | 共有入力ページトークン取得（なければ自動発行） |
| `/api/shared-entry/token/regenerate` | POST | 共有入力ページトークン再発行 |
| `/api/shared-entry/public/{token}/doctors` | GET | 共有トークンから医師リスト取得（名前・ロック状態・個別トークン・管理者メッセージ・不可日上限） |
| `/api/holidays/` | GET | 祝日一覧取得（グローバル） |
| `/api/health` | GET | ヘルスチェック |

---

## データモデル（`backend/models/`）

| ファイル | テーブル | 主なカラム |
|---------|---------|---------|
| `hospital.py` | `hospitals` | id(UUID), name(unique), password_hash |
| `doctor.py` | `doctors` | id(UUID), name, hospital_id(FK), is_active, access_token, is_locked, min/max/target_score |
| `shift.py` | `shift_assignments` | id(UUID), date, doctor_id(FK), shift_type |
| `holiday.py` | `holidays` | id(UUID), date(unique), name |
| `unavailable_day.py` | `unavailable_days` | id(UUID), doctor_id(FK), date, day_of_week, is_fixed, target_shift, is_soft_penalty |
| `system_setting.py` | `system_settings` | id(UUID), hospital_id(FK), key, value(JSONB) |
| `weight_preset.py` | `weight_presets` | id(UUID), name(unique), gap5〜sunhol_3rd・sat_month_fairness 等の各重み値 |
| `transfer_code.py` | `transfer_codes` | id(UUID), hospital_id(FK), code(unique), expires_at, created_at |

**リレーション:**
- `Hospital` → `Doctor`（cascade delete）
- `Doctor` → `ShiftAssignment`（cascade delete）
- `Doctor` → `UnavailableDay`（cascade delete）
- `shift_assignments` / `unavailable_days` は doctor join 経由で hospital_id 分離

---

## スキーマ（`backend/schemas/`）

| ファイル | 主なスキーマ |
|---------|------|
| `optimize.py` | `OptimizeRequest`, `OptimizeResponse`, `ObjectiveWeights`, `HardConstraints`（`holiday_shift_mode: "combined"\|"split"` 含む）, `LockedShift`, `ConstraintDiagnostic`, `DiagnosticInfo` |
| `doctor.py` | `DoctorCreate`, `DoctorUpdate`, `DoctorBulkLockUpdate`, `PublicDoctorUpdate` |
| `holiday.py` | `HolidayResponse` |
| `settings.py` | `CustomHolidaysResponse`, `CustomHolidaysUpsertRequest` |
| `unavailable_day.py` | 不可日スキーマ群 |

---

## サービス（`backend/services/`）

| ファイル | 役割 |
|---------|------|
| `optimizer.py` | **OnCallOptimizerクラス** — CP-SATによるスケジュール最適化の中核。`pre_validate()` で7つの事前算術チェック（解なし早期検知）: ①医師数vs間隔 ②日別の勤務可能人数 ③スコア範囲矛盾 ④ロックvs不可日 ⑤前月クロス間隔→月初人手不足 ⑥土日祝上限vs必要枠数 ⑦土曜上限vs土曜数 |
| `optimizer_history.py` | 過去シフト履歴からスコアを計算（`build_past_total_scores`, `score_historical_shift`）。combinedモード自動判定: 日祝nightで同日同医師dayがない場合は1.5点（day+night合算）として計算 |
| `holiday_service.py` | 祝日管理（jpholidayで日本の祝日を自動設定） |
| `auth_service.py` | bcryptパスワードハッシュ・病院認証・パスワード更新 |
| `settings_service.py` | システム設定のKVS Upsert（hospital_id スコープ）+ 仮保存スケジュール CRUD + 公開月管理（published_months） |
| `doctor_service.py` | 医師ロック状態の一括更新 |
| `unavailable_day_service.py` | 不可日の置き換え処理（`replace_doctor_unavailable_days`） |

---

## コア設定（`backend/core/`）

| ファイル | 役割 |
|---------|------|
| `config.py` | 環境変数読み込み・Settingsクラス（DB URL、JWT_SECRET_KEY、CORS） |
| `db.py` | SQLAlchemy非同期エンジン・セッション・Baseクラス（sslmode/channel_binding自動除去） |
| `auth.py` | JWT生成・検証・`get_current_hospital` FastAPI dependency |

---

## 起動方法

```bash
cd backend
uvicorn main:app --reload
```

デフォルトポート: `http://localhost:8000`

---

## 環境変数（`.env`）

| 変数 | 必須 | 説明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL接続URL（asyncpg形式） |
| `JWT_SECRET_KEY` | ✅ | JWT署名キー |
| `GEMINI_API_KEY` | AI機能使用時 | Google Gemini APIキー（Google AI Studioで発行） |
| `GEMINI_MODEL` | 任意 | 使用するGeminiモデル（デフォルト: `gemini-3-flash-preview`） |
| `FRONTEND_URL` | 本番時 | CORS許可するフロントエンドURL（`*`で全許可） |
