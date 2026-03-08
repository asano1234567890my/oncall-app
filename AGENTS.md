1. AGENTS.md（root / 全体共通）
# oncall-app 共通実装憲法

このリポジトリは、内科医約15名の当直表を半自動作成する Web アプリ `oncall-app` である。  
フロントエンドは Next.js、バックエンドは FastAPI、DB は PostgreSQL、最適化エンジンは Google OR-Tools CP-SAT を使用する。

## 1. 基本原則

- 未記載仕様は勝手に推測実装しない。必要なら TODO として保留し、破壊的変更を避ける。
- 既存実装を活かし、破壊的変更は最小化する。
- 新機能や修正では、まず影響範囲を `frontend / backend / optimizer` に切り分けて考える。
- API の JSON 構造は、担当都合で勝手に変更しない。
- API 変更が必要な場合は、変更点・影響範囲・他レイヤー確認事項を明示する。
- 仕様の source of truth は、会話履歴ではなく現在のコードとこの AGENTS 群である。

## 2. 技術スタック

- Frontend: Next.js 16.1.6, React 19, Tailwind CSS v4
- Backend: FastAPI, Python 3.10+, Uvicorn
- DB: PostgreSQL (Neon), SQLAlchemy 2.x Async, Alembic
- Optimizer: Google OR-Tools (CP-SAT)
- Infra:
  - Frontend deploy: Vercel
  - Backend deploy: Render

## 3. プロジェクト構造

```text
ONCALL-APP/
├─ migrations/
│  └─ versions/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx
│  │  ├─ admin/doctors/page.tsx
│  │  ├─ entry/[token]/page.tsx
│  │  ├─ components/
│  │  ├─ hooks/
│  │  └─ view/page.tsx
│  └─ utils/
│     └─ dateUtils.ts
└─ backend/
   ├─ core/
   ├─ models/
   ├─ routers/
   ├─ schemas/
   ├─ services/
   └─ tests/

.next, node_modules, backend/.venv, __pycache__ などは構造把握の対象外とする。

4. ドメインルール

対象は内科医約15名。勤務枠は以下。

平日: 当直 1名

土曜: 当直 1名

日祝: 日直 1名 + 当直 1名

日祝の同日兼務は禁止

勤務の統一定義:

work(d,t) = night(d,t) + day(d,t)

5. 壊してはいけない全体仕様
5-1. 医師ID

外部I/O と DB の主キーは UUID ベースで扱う。

フロントエンドの医師関連 State も UUID ベースを維持する。

配列インデックス前提の管理へ戻さない。

5-2. 論理削除

医師の物理削除は行わない。

過去シフトとの整合維持のため、Doctor.is_active = False による論理削除を前提とする。

5-3. 当直表の上書き保存

既存シフトの上書きは、先に DELETE /api/schedule/{year}/{month} を実行し、該当月データを全削除した後、POST /api/schedule で再保存する。

既存の保存導線を勝手に別方式へ変えない。

5-4. 対象月ルール

カレンダー対象月は 「○月1日から次月を参照するシステム」 である。

旧来の「月の途中で切り替える」運用に戻さない。

year / month / prevMonthLastDay / hydration の整合を壊さない。

5-5. 祝日・休日の扱い

祝日は jpholiday とフロントの祝日取得 hook を利用する。

手動休日・無効化祝日は DB 永続化する。

/api/optimize に渡す休日ロジックは以下を維持する。

自動祝日 + 手動休日 - 無効化祝日
5-6. Keep-alive

Render / Neon のコールドスタート対策として、フロント layout.tsx 起点の keep-alive / health monitor を維持する。

この責務を各ページへ分散させない。

6. 現在の主要 TODO 方針
フェーズ2

医師マスタの論理削除運用 (is_active トグル、UI フィルター含む)

ドラッグ＆ドロップ調整・確定画面

一部ロック済み勤務を optimizer のハード制約として扱う

フェーズ3

過去2〜3ヶ月の実績自動集計

履歴ゼロ医師への平均スコア補正

休日勤務ルール改修（土日祝合算ペナルティ）

フェーズ4

忌避日の重み

日直/当直 分離入力 UI

希望日システム

トークン再発行

重みプリセット保存

7. 各担当の責務

Frontend:

UI/UX

State 管理

API 通信

祝日表示

モバイル崩れ防止

Backend:

FastAPI ルーティング

DB モデル

AsyncSession による永続化

Alembic

JSON スキーマ整合

Optimizer:

OR-Tools 数理モデル

制約

目的関数

最適化ロジック

OptimizeRequest 整合

8. 実装時の共通ルール

担当外の責務を勝手に抱え込まない。

近い層で解決できる問題は近い層で直す。

不明点がある場合、破壊的な仮定で進めない。

仕様変更ではなく実装バグ修正で済むなら、まず既存仕様維持で解決する。

完了時は、変更内容・影響範囲・他担当への確認事項を簡潔に要約する。

9. 完了時の報告フォーマット
【変更報告】
■ 対象レイヤー
・frontend / backend / optimizer

■ 対象ファイル
・[変更ファイル]

■ 実施内容
・[何をどう変えたか]

■ 影響範囲
・[他レイヤーへの影響の有無]

■ 確認事項
・[必要なら記載]
・[特になし]