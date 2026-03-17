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
- 全ルーターの登録

---

## APIエンドポイント一覧

| パス | メソッド | ファイル | 機能 |
|------|---------|---------|------|
| `/health` | GET | `routers/health.py` | ヘルスチェック |
| `/api/optimize/` | POST | `routers/optimize.py` | スケジュール最適化生成 |
| `/api/schedule/save` | POST | `routers/schedule.py` | スケジュールをDBに保存 |
| `/api/doctors/` | GET | `routers/doctor.py` | 全医師一覧取得 |
| `/api/doctors/{id}` | GET | `routers/doctor.py` | 特定医師の詳細取得 |
| `/api/doctors/{id}` | PATCH/PUT | `routers/doctor.py` | 医師情報更新 |
| `/api/doctors/bulk-lock` | PATCH/POST | `routers/doctor.py` | 全医師の一括ロック/アンロック |
| `/api/public/doctors/{token}` | GET | `routers/public_doctor.py` | マジックリンク経由で医師情報取得 |
| `/api/public/doctors/{token}` | PUT | `routers/public_doctor.py` | 医師が不可日を自己入力 |
| `/api/holidays/` | GET | `routers/holiday.py` | 祝日一覧取得（year or year_month） |
| `/api/settings/custom_holidays` | GET/POST/PUT | `routers/settings.py` | カスタム祝日設定 |

---

## データモデル（`backend/models/`）

| ファイル | テーブル | 主なカラム |
|---------|---------|---------|
| `doctor.py` | `doctors` | id(UUID), name, experience_years, is_active, access_token, is_locked, min/max/target_score |
| `shift.py` | `shift_assignments` | id(UUID), date, doctor_id(FK), shift_type |
| `holiday.py` | `holidays` | id(UUID), date(unique), name |
| `unavailable_day.py` | `unavailable_days` | id(UUID), doctor_id(FK), date, day_of_week, is_fixed, target_shift, is_soft_penalty |
| `system_setting.py` | `system_settings` | id(UUID), key(unique), value(JSONB) |
| `weight_preset.py` | `weight_presets` | id(UUID), name(unique), 各重み値 |

**リレーション:**
- `Doctor` → `ShiftAssignment`（cascade delete）
- `Doctor` → `UnavailableDay`（cascade delete）

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
| `settings_service.py` | システム設定のKVS Upsert |
| `doctor_service.py` | 医師ロック状態の一括更新 |
| `unavailable_day_service.py` | 不可日の置き換え処理（`replace_doctor_unavailable_days`） |

---

## コア設定（`backend/core/`）

| ファイル | 役割 |
|---------|------|
| `config.py` | 環境変数読み込み・Settingsクラス（プロジェクト名、CORS、DB URL） |
| `db.py` | SQLAlchemy非同期エンジン・セッション・Baseクラス |

---

## 起動方法

```bash
cd backend
uvicorn main:app --reload
```

デフォルトポート: `http://localhost:8000`
