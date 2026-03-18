---
name: フロントエンド構成
description: Next.js フロントエンドのページ・コンポーネント・フック・ユーティリティの詳細
---

# フロントエンド構成

## 技術スタック
- **Next.js** 16.1.6（App Router）
- **React** 19.2.3
- **TypeScript** 5
- **Tailwind CSS** 4
- **React Hot Toast**（通知）
- **Lucide React**（アイコン）
- **date-fns**（日付処理）

---

## ページ構成

| パス | ファイル | 役割 | 認証 |
|------|---------|------|------|
| `/` | `src/app/page.tsx` | メインダッシュボード（スケジュール生成・編集） | 必要 |
| `/login` | `src/app/login/page.tsx` | ログイン画面 | 不要 |
| `/register` | `src/app/register/page.tsx` | 新規病院登録画面 | 不要 |
| `/view` | `src/app/view/page.tsx` | スケジュール表示専用ページ | 必要 |
| `/admin/doctors` | `src/app/admin/doctors/page.tsx` | 医師管理ページ | 必要 |
| `/entry/[token]` | `src/app/entry/[token]/page.tsx` | マジックリンク（医師が個別に不可日入力） | 不要 |

### 次期V2予定のページ構成（`docs/ux_redesign.md` 参照）

| パス | 役割 | 状態 |
|------|------|------|
| `/` | ランディングページ（LP）— 未認証ユーザー向け | ✅ 完了 |
| `/app` | 初心者向けメイン（生成+D&D+設定フルスクリーンモーダル） | ✅ 完了 |
| `/dashboard` | 管理者ダッシュボード（既存UIをuseOnCallCoreで共通化） | ✅ 完了 |
| `/demo` | 公開デモ（ログイン不要・DB書き込みなし） | 未着手 |

---

## コンポーネント

### 主要コンポーネント

| ファイル | 役割 |
|---------|------|
| `components/AppHeader.tsx` | ヘッダー・ナビゲーション |
| `components/ScheduleBoard.tsx` | スケジュール表の表示とドラッグ&ドロップ編集 |
| `components/ScheduleCell.tsx` | スケジュール行の1セル |
| `components/ScheduleValidationAlert.tsx` | バリデーションエラー表示 |
| `components/TargetShiftPopover.tsx` | シフト種別選択ポップオーバー |
| `components/SettingsPanel.tsx` | 設定パネル（`GenerationSettingsPanel` / `DoctorSettingsPanel`） |
| `components/ServerStatusBanner.tsx` | バックエンドサーバーの接続状態バナー |

### 設定系コンポーネント（`components/settings/`）

| ファイル | 役割 |
|---------|------|
| `DoctorListManager.tsx` | 医師一覧の管理UI |
| `PreviousMonthShiftsConfig.tsx` | 前月シフトの設定 |
| `RulesConfig.tsx` | ハード制約・ルール設定 |
| `SettingsModalPortal.tsx` | 設定モーダル（Portalで描画） |
| `UnavailableDaysInput.tsx` | 医師ごとの不可日・固定不可曜日の入力 |
| `WeightsConfig.tsx` | ソフト制約の重み設定 |

### 入力コンポーネント（`components/inputs/`）

| ファイル | 役割 |
|---------|------|
| `StepperNumberInput.tsx` | 数値のステッパー入力 |

---

## カスタムフック（`src/app/hooks/`）

| ファイル | 役割 |
|---------|------|
| `useAuth.ts` | JWT認証管理（localStorage・login/logout・`getAuthHeaders()`） |
| `useDashboardState.ts` | ダッシュボード全体の状態管理（医師・スコア・ルール・重み等） |
| `useScheduleApi.ts` | バックエンドAPI通信（最適化・保存・ロード） |
| `useDoctorSettings.ts` | 医師設定の取得・保存（useScheduleApiから分離） |
| `useScheduleDnd.ts` | ドラッグ&ドロップによるシフト編集ロジック |
| `useScheduleConstraints.ts` | シフト配置の制約チェックロジック（useScheduleDndから分離） |
| `useNavigationGuard.ts` | 未保存変更がある場合のページ離脱ガード |
| `useScheduleHistory.ts` | Undo/Redo 履歴管理 |
| `useRealtimeScores.ts` | リアルタイムスコア計算 |
| `useOptimizerConfig.ts` | 最適化設定のロード・保存 |
| `useHolidays.ts` | 祝日データ取得 |
| `useCustomHolidays.ts` | カスタム祝日の管理 |
| `useServerHealthMonitor.ts` | バックエンドのヘルスチェック |

---

## ユーティリティ（`src/app/utils/`）

| ファイル | 役割 |
|---------|------|
| `dateUtils.ts` | 日付変換・フォーマットのユーティリティ |
| `unavailableSettings.ts` | 不可日設定のノーマライズ処理 |

---

## 型定義（`src/app/types/`）

| ファイル | 主な型 |
|---------|------|
| `dashboard.ts` | `Doctor`, `ScheduleRow`, `UnavailableDay`, `HardConstraints`（`holiday_shift_mode: "combined"\|"split"` 含む）, `ObjectiveWeights`（`sat_month_fairness` 含む）等 |

### `ObjectiveWeights` 主要フィールド

| フィールド | デフォルト | 説明 |
|-----------|-----------|------|
| `gap5` | 50 | 勤務間隔ルール+1日違反ペナルティ（`interval_days+1`日間隔を動的参照） |
| `gap6` | 30 | 勤務間隔ルール+2日違反ペナルティ（`interval_days+2`日間隔を動的参照） |
| `soft_unavailable` | 500 | 不可日の回避優先度（`respect_unavailable_days=false`時に機能） |
| `sat_month_fairness` | 100 | 同月土曜当直回数の平準化（土曜上限1回固定時は自動無効） |
| `weekend_hol_3rd` | 200 | 土日祝3回目以降のペナルティ（上限が2以下の場合は自動無効） |

---

## 設定系ユーティリティ（`components/settings/shared.ts`）

- `hardConstraintToggleInputs` — RulesConfigのトグルUI定義（`respect_unavailable_days` / `prevent_consecutive_days` 等）
- `weightInputs` — WeightsConfigの重み項目定義（ラベル・ヒント・範囲）
- `getWeightMeta(key, base, hardConstraints)` — ハード制約に応じて重み項目の動的ラベル・非活性状態を返す
  - `gap5`/`gap6`: `interval_days` を参照して「N日間隔」を動的表示
  - `soft_unavailable`: `respect_unavailable_days !== false` のとき非活性
  - `weekend_hol_3rd`: `max_weekend_holiday_works <= 2` のとき非活性
  - `sat_month_fairness`: `max_saturday_nights === 1` のとき非活性

---

## 認証フロー

```
未認証 → /login にリダイレクト
/login → POST /api/auth/login → JWT取得 → localStorage保存 → / にリダイレクト
全APIフック → getAuthHeaders() → Authorization: Bearer <token>
ログアウト → localStorage削除 → /login にリダイレクト
```

## メインフロー

```
1. useAuth で認証確認 → 未認証なら /login へ
2. page.tsx でダッシュボード表示
3. useDashboardState で医師・ルール・重み・不可日を管理
4. useScheduleApi.optimize() → POST /api/optimize/ → 最適化実行
5. ScheduleBoard でスケジュール結果を表示
6. useScheduleDnd でドラッグ&ドロップ編集
7. useScheduleHistory で Undo/Redo
8. useScheduleApi.save() → POST /api/schedule/save → DB保存
```
