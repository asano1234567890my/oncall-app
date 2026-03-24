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
| `/view` | `src/app/view/page.tsx` | **管理者用**当直表ページ（ヘルプツールチップ付き・公開/非公開トグル・編集・保存ドロップダウン（PNG/PDF/Excel）・未認証→/loginリダイレクト） | 必要 |
| `/view/[token]` | `src/app/view/[token]/page.tsx` | **医師向け**公開当直表ページ（トークン認証・公開月のみ表示・画像/PDF/Excel DL・/entryへ戻るリンク） | 不要（トークン認証） |
| `/admin/doctors` | `src/app/admin/doctors/page.tsx` | 医師管理ページ | 必要 |
| `/entry/[token]` | `src/app/entry/[token]/page.tsx` | マジックリンク（医師が個別に不可日入力・確定シフト一覧（公開月のみ）・表示月のGoogleカレンダーワンクリック登録（終日イベント）） | 不要 |

### 現行ページ構成（V2.1統合後）

| パス | 役割 | 状態 |
|------|------|------|
| `/` | ランディングページ（LP）— 未認証ユーザー向け | ✅ 完了 |
| `/app` | **モバイル版（モバイル専用）** — CompactGenerateCard+MobileScheduleBoard・セットアップウィザード・オンボーディング。PC用レイアウト完全削除済み | ✅ 完了 |
| `/dashboard` | **PC版（PC専用・固定レイアウト）** — min-w-1280px固定+自動zoom縮小・DashboardScheduleTable+DoctorPalette（右端固定・トグル開閉）+DashboardToolbar（生成スプリットボタン・白紙作成・Undo/Redo変更ハイライト）+SettingsSlidePanel・D&D編集・確認ダイアログ・スマホ検知バナー（モバイル版へ誘導） | ✅ 完了 |
| `/view` | 当直表閲覧（管理者: ヘルプツールチップ+保存ドロップダウン（PNG/PDF/Excel）、医師: PNG/PDF/Excel DL対応） | ✅ 完了 |
| `/demo` | 公開デモ（ログイン不要・DB書き込みなし） | 未着手 |

---

## コンポーネント

### 主要コンポーネント

| ファイル | 役割 |
|---------|------|
| `components/AppHeader.tsx` | 共通タブナビゲーションヘッダー（モバイル版/PC版/当直表・ロゴ・ログアウト・rightExtra対応・onBeforeNavigate未保存チェック） |
| `components/MobileScheduleBoard.tsx` | モバイル専用スケジュール表（1タップ=医師ハイライト+制約可視化、2タップ=ボトムシート・スコア一覧4列・13-14pxフォント・強制モードボタン・スコア一覧医師名タップでハイライト） |
| `components/MobileActionSheet.tsx` | モバイル用ボトムシート（ハイライト中の同セル再タップで表示・変更/入替え/外す/ロック・医師選択リスト） |
| `components/DashboardScheduleTable.tsx` | **V2.1** 2カラム全幅スケジュール表（左=1-15日/右=16-末日固定分割・14pxフォント・医師名中央配置・行高さ固定・ドラッグ中全セル色分け・変更セルハイライト・入れ替えボタン（⇄）・制約違反ハイライト（swap simulation）・ドラッグ中フローティングツールチップ・`/dashboard`専用） |
| `components/DashboardToolbar.tsx` | **V2.1** ダッシュボードツールバー（年月・設定・生成スプリットボタン・白紙作成・強制モード・全固定/全解除トグル・Undo/Redo・仮保存/確定保存）— 生成ボタンは固定なし→「▶ 生成」（全体生成）、固定あり→「▶ 再生成」（未固定枠のみ）に動的切替。ドロップダウンに未固定枠再生成/全体生成/仮保存読込/確定済み読込/未固定枠クリアを統合 |
| `components/DoctorPalette.tsx` | **V2.1** 右サイドバー医師パレット（スコアバー付きカード・ゴミ箱統合）— `position: fixed`で画面右端に固定、トグルボタンで表示/非表示切替可。医師名クリックでハイライト+制約違反表示（配置チェック） |
| `components/SettingsSlidePanel.tsx` | **V2.1** 右スライドイン設定オーバーレイ（380px幅・半透明バックドロップ） |
| `components/ScheduleValidationAlert.tsx` | バリデーションエラー表示 |
| `components/TargetShiftPopover.tsx` | シフト種別選択ポップオーバー |
| `components/SettingsPanel.tsx` | ~~削除済み（5-2e）~~ — GenerationSettingsPanel/DoctorSettingsPanelはDashboardSettingsPanelに統合済み |
| `components/ServerStatusBanner.tsx` | バックエンドサーバーの接続状態バナー |
| `components/ImageImportModal.tsx` | ファイルから当直表を取り込むモーダル（画像/Excel/Word/PDF/テキスト→Gemini解析→医師名マッピング→確認保存。カメラ撮影/ファイル選択対応。年月読取失敗警告・祝日一覧表示・split/combinedモード切替UI付き） |
| `components/HolidayMismatchBanner.tsx` | 祝日不整合警告バナー（day_shiftがあるのに祝日未設定の日を検知→ワンクリックで祝日追加+保存） |

### 設定系コンポーネント（`components/settings/`）

| ファイル | 役割 |
|---------|------|
| `DoctorListManager.tsx` | 医師一覧の管理UI |
| `DoctorManageDrawer.tsx` | 医師管理ドロワー（追加・編集・削除・個別ロック・共有ドロップダウン・一括共有・一括ロック/解除・ファイルから医師名一括取込） |
| `PreviousMonthShiftsConfig.tsx` | 前月シフトの設定 |
| `RulesConfig.tsx` | ハード制約・ルール設定 |
| `SettingsModalPortal.tsx` | 設定モーダル（Portalで描画） |
| `UnavailableDaysInput.tsx` | 医師ごとの不可日・固定不可曜日の入力 |
| `WeightsConfig.tsx` | ソフト制約の重み設定（2軸グループスライダー） |
| `ShiftScoresConfig.tsx` | シフトスコア設定 |
| `PasswordChangeForm.tsx` | パスワード変更フォーム（/app・/dashboard設定モーダル共通） |
| `AccountActions.tsx` | アカウント上級設定（データ引き継ぎコード発行/取込・アカウント削除） |
| `DefaultPageSetting.tsx` | 初期画面設定トグル（モバイル版/PC版・/app・/dashboard設定モーダル共通） |

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
| `useScheduleDnd.ts` | ドラッグ&ドロップによるシフト編集ロジック（V2.1: `draggingDoctorId`・`cellValidityMap`追加、モバイル用命令的API: `placeDoctorInShift`・`removeDoctorFromShift`・`startSwapFrom`・`executeSwapTo`、ハイライト違反マップ: `highlightedViolationMap`（テーブルクリック=swap simulation / パレットクリック=placement check）） |
| `useScheduleConstraints.ts` | シフト配置の制約チェックロジック（useScheduleDndから分離）— `getPlacementConstraintMessage`（間隔・土曜上限・日祝上限・不可日等）・`getSwapConstraintMessage`（入れ替えシミュレーション・両医師の制約チェック） |
| `useNavigationGuard.ts` | 未保存変更がある場合のページ離脱ガード |
| `useScheduleHistory.ts` | Undo/Redo 履歴管理（最大15スナップショット保持・生成時の中間状態スキップ・変更セルハイライト1.5秒フェード） |
| `useRealtimeScores.ts` | リアルタイムスコア計算 |
| `useOptimizerConfig.ts` | 最適化設定のロード・保存 |
| `useHolidays.ts` | 祝日データ取得 |
| `useCustomHolidays.ts` | カスタム祝日の管理 |
| `useDraftSchedule.ts` | 仮保存スケジュールのCRUD（saveDraft/loadDraft/deleteDraft・system_settings KV経由）— 上書き時に既存の保存日時を表示して確認ダイアログ |
| `useOnCallCore.ts` | `/app`と`/dashboard`共通の統合状態管理フック（医師・スケジュール・DnD・ドラフト等すべて統合）。前月シフト取得はinterval_days（当直間隔）に連動。2カラム分割は15/16固定（2月のみ14） |
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

**子要素の比率調整（上級設定の深部）:**
「土日祝の均等化」グループは?ボタンから子要素の比率（0.0〜1.0）を個別調整可能。比率を変えると親スライダー値 × 比率 = 実効値として子ウェイトが計算される。比率は`optimizer_config`の`weight_ratios`キーにDB永続化。

| 子要素 | デフォルト比率 | 説明 |
|--------|-------------|------|
| 当月の日祝回数バランス (`sunhol_fairness`) | 1.0 | 今月の日祝シフト回数を均等化 |
| 当月の土曜回数バランス (`sat_month_fairness`) | 1.0 | 今月の土曜当直回数を均等化 |
| 過去の日祝実績バランス (`past_sunhol_gap`) | 0.5 | 過去数か月の日祝累積回数差を縮小 |
| 過去の土曜実績バランス (`past_sat_gap`) | 0.5 | 過去数か月の土曜累積回数差を縮小 |

**不活化ウェイト**（デフォルト0・UIから非表示・将来V3で再設計予定）:
`gap5`, `gap6`, `sat_consec`, `weekend_hol_3rd`, `month_fairness`, `soft_unavailable`

---

## 設定系ユーティリティ（`components/settings/shared.ts`）

- `weightGroups` — 2軸グループスライダー定義（`WeightGroup[]`型: id/label/hint/primaryKey/childMapping/children/min/max/step）
- `expandWeightGroups(currentWeights, groupId, newValue, ratioOverrides?)` — グループスライダー操作時にchildMappingの比率（またはratioOverridesの動的比率）で全チャイルドウェイトを一括更新
- `WeightRatioOverrides` — 子要素の比率オーバーライド型（グループID → キー → 比率）
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
