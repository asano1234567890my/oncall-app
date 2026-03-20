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
| `/view` | `src/app/view/page.tsx` | 当直表閲覧ページ（公開・認証不要） | 不要（認証時はAppHeader表示） |
| `/admin/doctors` | `src/app/admin/doctors/page.tsx` | 医師管理ページ | 必要 |
| `/entry/[token]` | `src/app/entry/[token]/page.tsx` | マジックリンク（医師が個別に不可日入力） | 不要 |

### 現行ページ構成（V2.1統合後）

| パス | 役割 | 状態 |
|------|------|------|
| `/` | ランディングページ（LP）— 未認証ユーザー向け | ✅ 完了 |
| `/app` | **統合メインページ** — PC（≥1024px）=DashboardScheduleTable+DoctorPalette+SettingsSlidePanel / モバイル=CompactGenerateCard+MobileScheduleBoard — `matchMedia` で自動切替 | ✅ 完了 |
| `/dashboard` | `/app` に統合済み（削除予定） | ⚠️ 廃止予定 |
| `/view` | 当直表閲覧（公開ページ・認証時AppHeader表示・仮保存コピー対応） | ✅ 完了 |
| `/demo` | 公開デモ（ログイン不要・DB書き込みなし） | 未着手 |

---

## コンポーネント

### 主要コンポーネント

| ファイル | 役割 |
|---------|------|
| `components/AppHeader.tsx` | 共通タブナビゲーションヘッダー（かんたん/一覧/当直表・ロゴ・ログアウト・rightExtra対応・onBeforeNavigate未保存チェック） |
| `components/MobileScheduleBoard.tsx` | モバイル専用スケジュール表（タップ→ボトムシート方式・セル内ボタンなし・13-14pxフォント） |
| `components/MobileActionSheet.tsx` | モバイル用ボトムシート（セルタップで表示・変更/入替え/解除/ロック・医師選択リスト） |
| `components/DashboardScheduleTable.tsx` | **V2.1** 2カラム全幅スケジュール表（前半/後半横並び・14pxフォント・医師名中央配置・行高さ固定・ドラッグ中全セル色分け・`/dashboard`専用） |
| `components/DashboardToolbar.tsx` | **V2.1** ダッシュボードツールバー（年月・設定・生成ドロップダウン・Undo/Redo・保存） |
| `components/DoctorPalette.tsx` | **V2.1** 右サイドバー医師パレット（スコアバー付きカード・ゴミ箱統合・全ロック/解除） |
| `components/SettingsSlidePanel.tsx` | **V2.1** 右スライドイン設定オーバーレイ（380px幅・半透明バックドロップ） |
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
| `WeightsConfig.tsx` | ソフト制約の重み設定（2軸グループスライダー） |
| `ShiftScoresConfig.tsx` | シフトスコア設定 |
| `PasswordChangeForm.tsx` | パスワード変更フォーム（/app・/dashboard設定モーダル共通） |
| `DefaultPageSetting.tsx` | 初期画面設定トグル（かんたんモード/一覧モード・/app・/dashboard設定モーダル共通） |

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
| `useScheduleDnd.ts` | ドラッグ&ドロップによるシフト編集ロジック（V2.1: `draggingDoctorId`・`cellValidityMap`追加、モバイル用命令的API: `placeDoctorInShift`・`removeDoctorFromShift`・`startSwapFrom`・`executeSwapTo`） |
| `useScheduleConstraints.ts` | シフト配置の制約チェックロジック（useScheduleDndから分離） |
| `useNavigationGuard.ts` | 未保存変更がある場合のページ離脱ガード |
| `useScheduleHistory.ts` | Undo/Redo 履歴管理 |
| `useRealtimeScores.ts` | リアルタイムスコア計算 |
| `useOptimizerConfig.ts` | 最適化設定のロード・保存 |
| `useHolidays.ts` | 祝日データ取得 |
| `useCustomHolidays.ts` | カスタム祝日の管理 |
| `useDraftSchedule.ts` | 仮保存スケジュールのCRUD（saveDraft/loadDraft/deleteDraft・system_settings KV経由） |
| `useOnCallCore.ts` | `/app`と`/dashboard`共通の統合状態管理フック（医師・スケジュール・DnD・ドラフト等すべて統合） |
| `useOnboarding.ts` | オンボーディングモーダルの表示管理（セクションごとの初回表示・DB永続化） |
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

### `ObjectiveWeights` — 2軸グループスライダー構成

UIでは2軸のグループスライダーとして表示。各軸のprimaryKeyを動かすとchildMappingの比率でチャイルドも連動更新。

| 軸 | primaryKey | チャイルド（比率） | デフォルト |
|----|-----------|-------------------|-----------|
| 目標スコアへの近さ | `target` (100) | `score_balance` (0.3→30) | 100 |
| 土日祝の均等化 | `sunhol_fairness` (100) | `sat_month_fairness` (1.0→100), `past_sunhol_gap` (0.5→50), `past_sat_gap` (0.5→50) | 100 |

**不活化ウェイト**（デフォルト0・UIから非表示・将来V3で再設計予定）:
`gap5`, `gap6`, `sat_consec`, `weekend_hol_3rd`, `month_fairness`, `soft_unavailable`

---

## 設定系ユーティリティ（`components/settings/shared.ts`）

- `weightGroups` — 2軸グループスライダー定義（`WeightGroup[]`型: id/label/hint/primaryKey/childMapping/min/max/step）
- `expandWeightGroups(currentWeights, groupId, newValue)` — グループスライダー操作時にchildMappingの比率で全チャイルドウェイトを一括更新
- `weightInputs` — WeightsConfigの個別重み項目定義（`/app`用12スライダー表示）
- `getWeightMeta(key, base, hardConstraints)` — ハード制約に応じて重み項目の動的ラベル・非活性状態を返す
- `hardConstraintNumberInputs` — 数値入力のハード制約UI定義（min値は1=0の罠防止）
- `hardConstraintToggleInputs` — RulesConfigのトグルUI定義

### 設定モーダルの共通ヘッダーパターン

全モーダル（WeightsConfig/ShiftScoresConfig/RulesConfig/PreviousMonthShiftsConfig）で統一:
- 右上: ×アイコンボタン（`shrink-0`で崩れない）
- タイトル下: [保存] [既定値に戻す] のコンパクトインラインボタン（`flex-wrap`）
- モバイルでもボタンが全幅ブロック化しない設計

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
5. DashboardScheduleTable / MobileScheduleBoard でスケジュール結果を表示
6. useScheduleDnd でドラッグ&ドロップ編集
7. useScheduleHistory で Undo/Redo
8. useScheduleApi.save() → POST /api/schedule/save → DB保存
```
