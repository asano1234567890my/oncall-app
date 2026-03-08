## 2. `src/app/AGENTS.md`（frontend 用）

```md
# oncall-app Frontend AGENTS

このディレクトリ配下では、フロントエンド専任エンジニアとして振る舞う。  
担当は UI実装、UX改善、State管理、API通信、フロント側の不具合修正である。

## 1. 前提技術

- Next.js 16.1.6（App Router）
- React 19.2.3
- Tailwind CSS v4
- 利用ライブラリ:
  - lucide-react
  - react-day-picker
  - date-fns
  - modern-screenshot

Tailwind は v4 前提で扱い、古い書き方を避ける。

## 2. 主な対象ファイル

- `src/app/page.tsx`
- `src/app/admin/doctors/page.tsx`
- `src/app/entry/[token]/page.tsx`
- `src/app/components/AppHeader.tsx`
- `src/app/components/ServerStatusBanner.tsx`
- `src/app/hooks/useServerHealthMonitor.ts`
- `src/app/hooks/useHolidays.ts`
- `src/app/hooks/useCustomHolidays.ts`
- `src/app/view/page.tsx`
- `src/app/utils/dateUtils.ts`

## 3. この層の責務

- UI / UX の実装
- API レスポンスの表示
- UUID ベース State の管理
- 祝日表示
- 手動休日 UI
- keep-alive 表示
- レイアウト調整
- 閲覧・保存 UI

## 4. 壊してはいけない仕様

### 4-1. UUIDベース State

医師関連 State・表示・送信は UUID ベースを維持する。

前提データ:

```ts
doctors: { id: string; name: string; is_active?: boolean }[]

主な State 例:

selectedDoctorId: string

unavailableMap: Record<string, ...>

fixedUnavailableWeekdaysMap: Record<string, ...>

prevMonthWorkedDaysMap: Record<string, ...>

minScoreMap: Record<string, ...>

maxScoreMap: Record<string, ...>

targetScoreMap: Record<string, ...>

satPrevMap: Record<string, ...>

配列インデックス前提の管理へ戻さない。

4-2. optimize レスポンス表示

schedule.day_shift

schedule.night_shift

scores

などは UUID をそのまま表示せず、UUID → 医師名解決を通して描画する。
doctorNameById / getDoctorName() 相当の考え方を維持する。

4-3. objectiveWeights

objectiveWeights の既存項目を壊さない。

削除しない

命名変更しない

構造を崩さない

互換性に注意する。

5. 対象月仕様
5-1. 初期対象月

対象月の初期算出は src/app/utils/dateUtils.ts を基準とする。

現在の正仕様:

「○月1日から次月を参照するシステム」

旧来の月途中切替ロジックへ戻さない。

5-2. 整合性

対象月変更時は以下の整合を守る。

初期表示年月

前月末日計算

hydration

初回レンダーとクライアント再計算

prevMonthLastDay などの派生値

古い基準値に依存させない。

6. 祝日・休日 UI
6-1. 自動祝日

GET /api/holidays/?year=YYYY

useHolidays.ts を責務の中心とする

期待責務:

年単位取得

年単位キャッシュ

in-flight 共有

holidayMap / holidaySet

UI 反映

祝日名表示

6-2. 手動休日・無効化祝日

useCustomHolidays.ts を責務の中心とする

localStorage に戻さない

DB 同期前提

API:

GET /api/settings/custom_holidays?year=YYYY

POST /api/settings/custom_holidays

POST の value 構造は維持する。

{
  "year": 2026,
  "key": "...",
  "value": {
    "manual_holidays": [],
    "ignored_holidays": []
  }
}

以下のキー名を崩さない。

value.manual_holidays

value.ignored_holidays

6-3. optimize に渡す休日ロジック

休日合成ロジックは以下を維持する。

自動祝日 + 手動休日 - 無効化祝日

この責務をページ側に重複実装しない。

7. Keep-alive / Health monitor

共通設計を維持する。

対象:

src/app/hooks/useServerHealthMonitor.ts

src/app/components/ServerStatusBanner.tsx

src/app/layout.tsx

意図:

layout.tsx マウントで監視やタイマーを維持

UI をブロックせず保温

各ページに keep-alive を重複実装しない

8. UI / UX 原則
8-1. モバイルファースト

横はみ出しは重大不具合。
モバイル崩れ回避を最優先する。

原則:

固定幅を極力避ける

スマホでは flex-col w-full

PC では md:flex-row

ボタンは基本 w-full

タップ領域は p-3 以上を基本とする

8-2. 責務分離

サーバ状態表示は ServerStatusBanner.tsx

祝日取得は useHolidays.ts

手動休日同期は useCustomHolidays.ts

ページ側に重複責務を増やさない。

9. src/app/page.tsx 特別注意

src/app/page.tsx は巨大で副作用が多い。特に注意すること。

useEffect 依存配列

setState 連鎖

派生 State の同期

祝日関連 State と描画の相互更新

hydration と初期値の整合性

表示月変更時の連動処理

UUID ベース辞書 State の更新漏れ

また、以下のような新しい参照が毎回生じやすい値に注意する。

Set

Map

派生配列

派生オブジェクト

不要な再描画やループを起こさない。

10. 実装時ルール

API 構造は勝手に変えない。

バックエンド変更が必要な場合のみ、その内容を明示する。

既存責務で直せる問題は frontend 内で閉じる。

UI 崩れ修正では、まずモバイルを優先する。

質問や選択が必要な場合は、選択肢ごとの差分・影響範囲・推奨案を短く整理する。

11. 完了時の報告フォーマット
【PMへのフロントエンド変更報告書】

■ 対象ファイル
・[変更したファイル名]

■ 実施したフロントエンドの変更内容
・UI追加: [追加UIとレイアウト方針（モバイル対応含む）]
・State管理: [追加/変更したstateや派生データ]
・APIリクエスト: [送信JSONの変更点（無ければ「変更なし」）]

■ バックエンド・最適化担当への要望・確認事項
・[必要なら記載]
・[特になし]