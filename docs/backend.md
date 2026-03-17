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
| `/api/optimize/` | POST | `routers/optimize.py` | スケジュール最適化生成 |
| `/api/schedule/save` | POST | `routers/schedule.py` | スケジュールをDBに保存 |
| `/api/schedule/{year}/{month}` | GET | `routers/schedule.py` | 月別スケジュール取得 |
| `/api/schedule/range` | GET | `routers/schedule.py` | 期間指定スケジュール取得 |
| `/api/doctors/` | GET/POST | `routers/doctor.py` | 医師一覧取得・追加 |
| `/api/doctors/{id}` | GET/PUT/DELETE | `routers/doctor.py` | 医師操作 |
| `/api/doctors/bulk-lock` | PATCH | `routers/doctor.py` | 全医師一括ロック |
| `/api/settings/optimizer_config` | GET/PUT | `routers/settings.py` | 最適化設定 |
| `/api/settings/custom_holidays` | GET/POST | `routers/settings.py` | カスタム祝日設定 |

### 認証不要（マジックリンク）
| パス | メソッド | 機能 |
|------|---------|------|
| `/api/public/doctors/{token}` | GET/PUT | 医師が不可日を自己入力 |
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
| `weight_preset.py` | `weight_presets` | id(UUID), name(unique), 各重み値 |

**リレーション:**
- `Hospital` → `Doctor`（cascade delete）
- `Doctor` → `ShiftAssignment`（cascade delete）
- `Doctor` → `UnavailableDay`（cascade delete）
- `shift_assignments` / `unavailable_days` は doctor join 経由で hospital_id 分離

---

## スキーマ（`backend/schemas/`）

| ファイル | 主なスキーマ |
|---------|------|
| `optimize.py` | `OptimizeRequest`, `OptimizeResponse`, `ObjectiveWeights`, `HardConstraints`, `LockedShift` |
| `doctor.py` | `DoctorCreate`, `DoctorUpdate`, `DoctorBulkLockUpdate`, `PublicDoctorUpdate` |
| `holiday.py` | `HolidayResponse` |
| `settings.py` | `CustomHolidaysResponse`, `CustomHolidaysUpsertRequest` |
| `unavailable_day.py` | 不可日スキーマ群 |

---

## サービス（`backend/services/`）

| ファイル | 役割 |
|---------|------|
| `optimizer.py` | **OnCallOptimizerクラス** — CP-SATによるスケジュール最適化の中核 |
| `optimizer_history.py` | 過去シフト履歴からスコアを計算（`build_past_total_scores`, `score_historical_shift`） |
| `holiday_service.py` | 祝日管理（jpholidayで日本の祝日を自動設定） |
| `auth_service.py` | bcryptパスワードハッシュ・病院認証・パスワード更新 |
| `settings_service.py` | システム設定のKVS Upsert（hospital_id スコープ） |
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
