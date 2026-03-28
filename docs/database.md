---
name: データベース構成
description: PostgreSQL Neon のテーブル設計・リレーション・マイグレーション履歴
---

# データベース構成

## 接続情報
- **DB**: PostgreSQL（クラウドサービス: Neon）
- **接続設定**: `backend/.env` の `DATABASE_URL`
- **ドライバ**: asyncpg（非同期）
- **ORM**: SQLAlchemy（非同期）
- **マイグレーション**: Alembic

---

## テーブル一覧

### `hospitals`（病院マスタ）

| カラム | 型 | 説明 |
|-------|-----|------|
| `id` | UUID (PK) | 病院ID |
| `name` | String (unique) | 病院名 |
| `email` | String (unique, nullable) | メールアドレス |
| `password_hash` | String | bcryptハッシュ |
| `is_superadmin` | Boolean | 開発者管理フラグ（default: false） |
| `created_at` | DateTime(tz) | アカウント作成日時 |
| `last_login_at` | DateTime(tz, nullable) | 最終ログイン日時 |

---

### `doctors`（医師マスタ）

| カラム | 型 | 説明 |
|-------|-----|------|
| `id` | UUID (PK) | 医師ID |
| `hospital_id` | UUID (FK → hospitals) | 所属病院 |
| `name` | String | 医師名 |
| `experience_years` | Integer | 経験年数 |
| `is_active` | Boolean | 有効フラグ |
| `access_token` | String | マジックリンク用トークン |
| `is_locked` | Boolean | 入力ロック状態（締切後はTrue） |
| `is_external` | Boolean | 外部医師（ダミー）フラグ（default: false） |
| `min_score` | Float | 月間スコア下限 |
| `max_score` | Float | 月間スコア上限 |
| `target_score` | Float | 月間目標スコア |

---

### `shift_assignments`（シフト割当）

| カラム | 型 | 説明 |
|-------|-----|------|
| `id` | UUID (PK) | シフトID |
| `date` | Date | 担当日 |
| `doctor_id` | UUID (FK → doctors) | 担当医師 |
| `shift_type` | String | シフト種別（night / day_off 等） |

---

### `holidays`（祝日）

| カラム | 型 | 説明 |
|-------|-----|------|
| `id` | UUID (PK) | 祝日ID |
| `date` | Date (unique) | 祝日の日付 |
| `name` | String | 祝日名 |

---

### `unavailable_days`（医師の不可日）

| カラム | 型 | 説明 |
|-------|-----|------|
| `id` | UUID (PK) | 不可日ID |
| `doctor_id` | UUID (FK → doctors) | 対象医師 |
| `date` | Date (nullable) | 特定日付による不可日 |
| `day_of_week` | Integer (nullable) | 曜日による固定不可（0=月〜6=日） |
| `is_fixed` | Boolean | Trueならハード制約として扱う |
| `target_shift` | String | 対象シフト種別 |
| `is_soft_penalty` | Boolean | Trueならソフト制約（ペナルティ）として扱う |

---

### `system_settings`（汎用システム設定）

| カラム | 型 | 説明 |
|-------|-----|------|
| `id` | UUID (PK) | 設定ID |
| `hospital_id` | UUID (FK → hospitals) | 所属病院 |
| `key` | String | 設定キー |
| `value` | JSONB | 設定値（任意のJSON） |

- unique制約: `(hospital_id, key)` — `uq_system_settings_hospital_key`
- カスタム祝日・optimizer_config などを格納するKVSとして機能

---

### `weight_presets`（重みプリセット）

| カラム | 型 | 説明 |
|-------|-----|------|
| `id` | UUID (PK) | プリセットID |
| `name` | String (unique) | プリセット名 |
| `gap5` 〜 `sunhol_3rd` | Float | 各ソフト制約の重み値 |
| `sat_month_fairness` | Float | 同月土曜当直回数の平準化重み |

---

### `usage_events`（利用イベントログ）

| カラム | 型 | 説明 |
|-------|-----|------|
| `id` | UUID (PK) | イベントID |
| `hospital_id` | UUID (FK → hospitals) | 操作アカウント |
| `event_type` | String(50) | イベント種別（generate, diagnose, schedule_save, draft_save, export_pdf, export_xlsx, ai_parse_image, ai_parse_doctors, login, register, public_schedule_view, ical_subscribe, shared_entry_access） |
| `created_at` | DateTime(tz) | 発生日時 |
| `metadata` | JSONB (nullable) | 付加情報（year, month, doctor_count, status等） |

- インデックス: `(hospital_id, event_type, created_at)`, `(created_at)`

---

## リレーション

```
hospitals
  ├── doctors (cascade delete)
  │     ├── shift_assignments (cascade delete)
  │     └── unavailable_days  (cascade delete)
  ├── system_settings (cascade delete)
  └── usage_events (cascade delete)
```

---

## マイグレーション履歴（Alembic）

| バージョン | 内容 |
|---------|------|
| `f8d08b10001d` | 初期モデル作成 |
| `ffbcbb4c0eff` | 初期テーブル作成 |
| `7459e666945d` | `access_token` 追加 |
| `3f2c9494f6ff` | `is_locked` 追加 |
| `e617c9afe632` | スコア関連カラム追加 |
| `2a282ee77c3b` | holidayテーブル追加・更新 |
| `3addaa9af519` | shift_assignmentsにON DELETE CASCADE追加 |
| `c3cddc2718ad` | unavailable_daysにshift_target関連カラム追加 |
| `9d91c9b3e2f7` | unavailable_daysのshift_targetカラム確認・修正 |
| `a1b2c3d4e5f6` | hospitalsテーブル追加・doctors/system_settingsにhospital_id FK追加・Ebina Hospitalシード |
| `a5c81cf5d030` | transfer_codesテーブル追加 |
| `27efd28f6bd1` | doctors.is_external追加（外部医師ダミー方式） |
| `d17de90b0197` | hospitals.email追加 |
| (P1-19) | hospitals.is_superadmin/created_at/last_login_at追加・usage_eventsテーブル新設 |

---

## マイグレーションコマンド

```bash
cd oncall-app

# 新しいマイグレーション作成
alembic revision --autogenerate -m "変更内容の説明"

# マイグレーション適用
alembic upgrade head

# 現在のバージョン確認
alembic current
```
