## 3. `backend/AGENTS.md`（backend 用）

```md
# oncall-app Backend AGENTS

このディレクトリ配下では、バックエンド専任エンジニアとして振る舞う。  
担当は FastAPI のルーティング、SQLAlchemy AsyncSession による DB 操作、Alembic マイグレーション、永続化ロジックである。

## 1. 前提技術

- Python 3.10+
- FastAPI
- Uvicorn
- PostgreSQL (Neon)
- asyncpg
- SQLAlchemy 2.x Async
- Alembic

フロントエンドは Next.js から JSON でリクエストを送る前提。

## 2. 主な対象ファイル

- `backend/main.py`
- `backend/core/*`
- `backend/models/*`
- `backend/schemas/*`
- `backend/routers/*`
- `backend/services/*`
- `migrations/versions/*`
- `alembic.ini`

## 3. この層の責務

- API ルーティング
- Pydantic スキーマ
- DB モデル
- DB 永続化
- 非同期トランザクション管理
- マイグレーション
- Optimizer 呼び出し境界の整備

## 4. 壊してはいけない仕様

### 4-1. 外部I/O は UUID ベース

- DB 主キーとフロントとの通信は UUID を維持する。
- 外部I/O を配列インデックス前提に戻さない。
- 外部I/O と DB は UUID ベース

/api/optimize の router / service 境界で UUID ↔ int 変換を行う

optimizer 内部は連続整数インデックスのみを扱う

optimize の response は UUID に復元して返す

### 4-2. system_settings の JSONB 構造

手動休日・無効化祝日は JSONB で扱う。  
以下の value 構造を壊さない。

```json
{
  "manual_holidays": [],
  "ignored_holidays": []
}
4-3. health check

GET /api/health は軽量な DB 生存確認のまま維持する。

コールドスタート対策の一部なので、挙動を勝手に変えない。

4-4. マジックリンク / ロック

以下は実装済み前提として維持する。

access_token

is_locked

4-5. 医師削除

物理削除を基本方針にしない。

Doctor.is_active を使う論理削除前提を維持する。

過去 ShiftAssignment を壊さない。

5. 非同期 DB 実装ルール
5-1. AsyncSession

DB 操作は AsyncSession と await を使う。

同期的処理を混在させない。

5-2. トランザクション

AsyncSession は autobegin する。
無闇に session.begin() をネストして "A transaction is already begun" を起こさない。

原則:

最後に await session.commit() を1回行う

または明確なコンテキストでトランザクション境界を管理する

5-3. SELECT 後の状態

SELECT 実行後もトランザクションが開始済みである前提で扱う。
begin の重複や commit/rollback の責務を曖昧にしない。

6. Alembic ルール
6-1. nullable=False カラム追加

既存テーブルに nullable=False のカラムを追加する場合、autogenerate をそのまま信用しない。
既存データを壊さない安全な手順を取ること。

推奨:

nullable=True で追加

既存行を埋める

nullable=False に変更

または一時的 server_default を付与する。

6-2. stamp head

alembic stamp head は危険操作

本番 / Neon では原則禁止

ローカル限定かつ明示的許可があるときのみ検討する

7. 外部キーと削除

Doctor の物理削除は過去シフトを壊すリスクが高い

ondelete="CASCADE" を安易に採用しない

論理削除を優先する

8. import / モジュール構成

集約 import により循環 import が起きる場合は、モジュール直接 import へ切り替える

router 登録や schema 参照で循環依存を増やさない

9. API 実装原則

フロント都合で API を変えない

schema 変更が必要なら、変更点と影響範囲を明示する

ルーターで解決すべき変換と、services で扱う純粋ロジックを分離する

DB モデル変更時は migration と schema の整合を必ず取る

10. 現時点の重要ルーティング

POST /api/optimize

POST /api/schedule

DELETE /api/schedule/{year}/{month}

GET/POST/PUT/DELETE /api/doctors

GET/PUT /api/public/doctors/{access_token}

GET /api/health

これら既存 API の責務を無断で変更しない。

11. optimizer との境界

optimizer 内部で必要な整形・変換は router / service 境界で処理する

optimizer に余計な HTTP / DB / UUID 表示責務を持ち込まない

backend 側は入力バリデーション、変換、永続化を主担当とする

12. 実装時ルール

既存 DB / schema / router / service の責務分離を崩さない

小さい変更で直せるものを大改修しない

migration が必要なら必ず意識する

仕様変更ではなくバグ修正で済むなら互換性維持を優先する

質問や選択が必要な場合は、選択肢ごとの差分・影響範囲・推奨案を短く整理する

13. 完了時の報告フォーマット
【PMへのバックエンド変更報告書】

■ 対象ファイル
・[変更したファイル名]

■ 実施したバックエンドの変更内容
・DBモデル変更: [変更内容、無ければ「なし」]
・マイグレーション: [追加・変更した内容、無ければ「なし」]
・APIルーティング: [変更・追加したエンドポイントと処理概要]

■ フロントエンド側への要望・確認事項
・[必要なら記載]
・[特になし]