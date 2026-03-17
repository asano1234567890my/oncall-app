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
| `dashboard.ts` | `Doctor`, `ScheduleRow`, `UnavailableDay`, `HardConstraints`, `ObjectiveWeights` 等 |

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
