# CURRENT_STATE.md — 現在の状態

> このファイルは会話をまたいだコンテキスト共有用。
> 作業開始時にAIに読ませる。変更があるたびに更新する。

---

## 現在のフェーズ

**V2.1完了 → Phase1「売り物にする」進行中（P1-1/P1-2/P1-3/P1-5/P1-7/P1-7b/P1-9/P1-11/P1-12/P1-13完了）**

---

## ロードマップ（優先順）

### 【完了】Step0：環境分離（インフラ）

| # | 内容 | 状態 |
|---|------|------|
| 0-1 | ローカルPostgreSQL18 + `oncall_dev` DB作成（両PC） | ✅ 完了 |
| 0-2 | `feature/v1.1` ブランチを切る | ✅ 完了 |

---

### 【完了】Task1：リファクタリングPhase1（契約の安定化）

| # | 内容 | 状態 |
|---|------|------|
| 1-1 | `GET /api/schedule/{year}/{month}` レスポンスを `doctor_id` に統一 | ✅ 完了 |
| 1-2 | `DELETE /api/schedule/{year}/{month}` エンドポイントを新設 | ✅ 完了 |
| 1-3 | `page.tsx` の localStorage（祝日・休日設定）を撤去 | ✅ 完了 |
| 1-4 | スケジュール「月削除」を DELETE API呼び出しに変更 | ✅ 完了 |

---

### 【完了】Task2：警告UXの強化

**目的：** 意図しないデータ破壊・設定の取りこぼしを防ぐ。

| # | 内容 | スコープ | 状態 |
|---|------|---------|------|
| 2-1 | シフト保存時に「登録済みシフトを上書きします」確認ポップアップを表示 | `src/app/hooks/useScheduleApi.ts` | ✅ 完了 |
| 2-2 | シフト保存時に「スコア計算に影響が出る」旨の警告を表示 | `src/app/hooks/useScheduleApi.ts` | ✅ 完了 |
| 2-3 | 医師の個別不可日・固定不可曜日を変更したのに未登録のままページ離脱しようとした際に警告を表示 | `src/app/page.tsx` | ✅ 完了 |
| 2-4 | 空シフト（未定）のまま保存しようとした際に警告を表示（日直は日曜・祝日のみ対象） | `src/app/hooks/useScheduleDnd.ts` | ✅ 完了 |
| 2-5 | `GET /api/schedule/{year}/{month}` が全日を返すよう修正（空スロットも `null` で返却） | `backend/routers/schedule.py` | ✅ 完了 |

---

### 【完了】Task2.5：optimizer config（スコア・重み・ハード設定）のDB永続化

**目的：** スコア範囲・重みづけ・ハード制約をDBに保存し、リロード後も設定が復元されるようにする。

| # | 内容 | スコープ | 状態 |
|---|------|---------|------|
| 2.5-1 | `system_settings` テーブルに `optimizer_config` キーで保存する backend 実装 | `backend/schemas/settings.py`, `backend/services/settings_service.py`, `backend/routers/settings.py` | ✅ 完了 |
| 2.5-2 | `useOptimizerConfig` フックを新設（マウント時にロード・PUT保存） | `src/app/hooks/useOptimizerConfig.ts` | ✅ 完了 |
| 2.5-3 | score_min/max エリアに「スコア・重み・ルールを保存」ボタンを追加 | `src/app/components/SettingsPanel.tsx` | ✅ 完了 |
| 2.5-4 | WeightsConfig・RulesConfig ヘッダーに「保存」ボタンを追加 | `src/app/components/settings/WeightsConfig.tsx`, `RulesConfig.tsx` | ✅ 完了 |
| 2.5-5 | `DoctorListManager` の説明文に重み・ルール設定の案内を追記 | `src/app/components/settings/DoctorListManager.tsx` | ✅ 完了 |

---

### 【次】Task5: ファイル整理・UI統合・バックエンド大改修

3つのサブタスクで構成。順番に実施。

---

#### Task5-1: デッドコード削除（✅ 完了）

| ファイル | 行数 | 理由 |
|---------|------|------|
| `ScheduleBoard.tsx` | 500行 | import 0件。DashboardScheduleTable + MobileScheduleBoard で完全置換済み |
| `schedule/ScheduleCell.tsx` | 331行 | ScheduleBoard専用。ScheduleBoard削除に伴い不要 |
| `test/page.tsx` | 65行 | デバッグページ。本番不要 |
| **合計削除** | **896行** | |

---

#### Task5-2: モバイルUI全面刷新 + PC/モバイル分離（✅ 完了）

**方針（確定）:**
- `/app` = **モバイル版（モバイル特化）** — CompactGenerateCard + MobileScheduleBoard + セットアップウィザード + オンボーディング
- `/dashboard` = **PC版（PC特化）** — DashboardScheduleTable + DoctorPalette + DashboardToolbar + SettingsSlidePanel + 警告ダイアログ + スマホ検知バナー
- PC/モバイル自動切替（matchMedia）は廃止 — ヘッダーのタブ切替で明示的に遷移

##### 実装ステップ

| # | 内容 | 状態 |
|---|------|------|
| 5-2a | `MobileActionSheet.tsx` 新規作成（ボトムシートUI） | ✅ 完了 |
| 5-2b | `MobileScheduleBoard.tsx` 全面書き換え（タップ→シート方式） | ✅ 完了 |
| 5-2c | `/app/page.tsx` からPC用レイアウト（matchMedia/isDesktop/DashboardScheduleTable等）を完全削除・モバイル特化 | ✅ 完了 |
| 5-2d | `/dashboard/page.tsx` にPC専用警告ダイアログ実装（全体生成時ロック警告・全解除確認・仮保存上書き確認・ツールバーロックトグル） | ✅ 完了 |
| 5-2e | 不要ファイル削除（SettingsPanel.tsx） | ✅ 完了（useDashboardState.tsはuseOnCallCoreが依存しているため削除不可） |
| 5-2f | ~~AppHeader簡素化（タブ切替廃止検討）~~ | ✅ 不要 — モバイル版/PC版/当直表のタブ構成で確定 |

##### 残すもの（PC用: /dashboard）
- `DashboardScheduleTable.tsx` / `DashboardToolbar.tsx` / `DoctorPalette.tsx` / `DashboardSettingsPanel.tsx` / `SettingsSlidePanel.tsx`

##### 残すもの（モバイル用: /app）
- `MobileScheduleBoard.tsx` / `MobileActionSheet.tsx` / `CompactGenerateCard` / セットアップウィザード・オンボーディング

---

#### Task5-3: V3 Optimizer バックエンド大改修（未着手・後回し）

**目的:** 不活化ウェイト・非公開設定のコード完全削除 + 新アルゴリズム実装

**削除対象（コードごと消す）:**
- 不活化ウェイト: `gap5`, `gap6`, `sat_consec`, `sunhol_3rd`, `weekend_hol_3rd`, `month_fairness`, `soft_unavailable`
- 非公開ハード設定: `prevent_sunhol_consecutive`, `respect_unavailable_days`, `max_sunhol_days`, `max_sunhol_works`

**新規実装（docs/optimizer.md 参照）:**
- 加重累積均等化（土日祝均等化の置き換え）
- 理想間隔方式（gap5/gap6の置き換え）
- 累積目標乖離（score_balance/month_fairnessの置き換え）
- optimizer.py mixin分割（旧Task 2.6-5）も同時実施

> 詳細設計は `docs/optimizer.md` の「将来の再設計計画（V3 Optimizer）」セクション参照

---

#### 【旧Task2.6 フロントエンド分割 — 全完了】

| # | 内容 | 状態 |
|---|------|------|
| 2.6-1 | useScheduleConstraints.ts 分離 | ✅ 完了 |
| 2.6-2 | スケジュールミューテーション分離（2.6-1に統合） | ✅ 完了 |
| 2.6-3 | useNavigationGuard.ts 分離 | ✅ 完了 |
| 2.6-4 | useDoctorSettings.ts 分離 | ✅ 完了 |

---

### 【完了】Task3：マルチテナント認証（病院ごとのデータ分離）

**目的：** 複数病院が同一サーバーを安全に使えるよう、JWT認証＋hospital_id行レベル分離を導入する。

| # | 内容 | スコープ | 状態 |
|---|------|---------|------|
| 3-1 | `hospitals` テーブル新設・Alembicマイグレーション | `backend/models/hospital.py`, `migrations/` | ✅ 完了 |
| 3-2 | JWT認証（python-jose HS256）`/api/auth/login` `/api/auth/register` | `backend/core/auth.py`, `backend/services/auth_service.py`, `backend/routers/auth.py` | ✅ 完了 |
| 3-3 | 全APIエンドポイントに `hospital_id = Depends(get_current_hospital)` を追加 | `backend/routers/doctor.py`, `schedule.py`, `optimize.py`, `settings.py` | ✅ 完了 |
| 3-4 | `useAuth.ts` 新設（JWT localStorage管理）・`login/page.tsx` 新設 | `src/app/hooks/useAuth.ts`, `src/app/login/page.tsx` | ✅ 完了 |
| 3-5 | `page.tsx` に認証ガード（未認証→/loginリダイレクト）・ログアウトボタン追加 | `src/app/page.tsx` | ✅ 完了 |
| 3-6 | 全APIフックに `getAuthHeaders()` (Authorization: Bearer) を追加 | `useScheduleApi.ts`, `useDoctorSettings.ts`, `useOptimizerConfig.ts`, `useCustomHolidays.ts` | ✅ 完了 |

### 【完了】Task4（旧Task3）：仮保存機能

**目的：** 作業中シフトを下書きとしてDBに保存し、別デバイス・別日でも続きから作業できるようにする。
**方式：** `system_settings` KVストア利用（キー: `draft_schedule_YYYY_MM`、値: JSONB）— テーブル新設不要

| # | 内容 | 状態 |
|---|------|------|
| 4-1 | `settings_service.py` に `get/upsert/delete_draft_schedule` 追加 | ✅ 完了 |
| 4-2 | `GET/PUT/DELETE /api/schedule/draft/{year}/{month}` API | ✅ 完了 |
| 4-3 | `useDraftSchedule.ts` フック新設 + `useOnCallCore` 統合 | ✅ 完了 |
| 4-4 | `/app` `/dashboard` 両方に仮保存/確定保存ボタン・読み込み・確定→仮保存コピー | ✅ 完了 |

---

### 【次】Phase1: 売り物にする（プロダクト戦略 `docs/product_strategy.md` 参照）

**テーマ：「自分の病院以外にも使える状態にする」**

| # | 内容 | 優先度 | 状態 |
|---|------|--------|------|
| P1-1 | PDF/Excel出力（`reportlab`/`openpyxl`） | P0 | ✅ 完了 |
| P1-2 | 制約矛盾の診断（CP-SAT AddAssumptions活用） | P0 | 🔄 Phase1完了（事前算術チェック7項目+FE表示）/ Phase2未着手（複合制約の原因特定） |
| P1-3 | プライバシーポリシー・利用規約ページ | P0 | ✅ 完了 |
| P1-4 | 不可日ソフト化UI（is_soft_penaltyのUI公開） | P1 | 未着手 |
| P1-5 | マジックリンク共有機能（URLコピー/LINE/メール/QRコード・一括共有） | P1 | ✅ 完了 |
| P1-6 | 自院での実運用（2ヶ月以上） | P0 | 🔄 準備中 |
| P1-7 | ICSフィード（Googleカレンダー同期） | P1 | ✅ 完了 |
| P1-7b | レポートページ（スコア乖離・累積推移・回数マトリクス・各医師カレンダー・期間選択） | P1 | ✅ 完了 |
| P1-8 | Stripe決済 + プラン別機能制限 | P0 | 未着手 |
| P1-9 | データ引き継ぎコード（12文字・24h有効）+ アカウント完全削除（パスワード確認） | P1 | ✅ 完了 |
| P1-10 | 外部医師（ダミー医師方式）— 全スロットを常勤で埋めない現場向け。既存ロック機能活用 | P1 | 未着手 |
| P1-11 | AI当直表画像取込（Gemini Vision API → スケジュールJSON → 医師名マッピング → DB保存）— /app・/dashboard両対応・カメラ撮影対応 | P1 | ✅ 完了 |
| P1-12 | AI医師名一括取込（画像・Excel・Word・PDF・テキスト → Gemini API → 医師名抽出・登録）— DoctorManageDrawer・SetupWizard Step2両対応 | P1 | ✅ 完了 |
| P1-13 | 取込UX改善・データ整合性保護（年月警告・祝日表示・モード切替・祝日不整合バナー・combinedスコア統一） | P1 | ✅ 完了 |

---

### 【後】Phase2: 定着させる（3〜6ヶ月目）

| 内容 | 状態 |
|------|------|
| カスタムシフト種別 + 日別シフト属性（広域当番など）— `shift_types`テーブル・optimizer汎用化・日にタグをつけてタグ別スコア・医師別上限 | 未着手 |
| 2人体制スロット — 日別required_count・スケジュール表の複数医師表示対応 | 未着手 |
| LINE連携（確定通知プッシュ） | 未着手 |
| Googleカレンダー同期（ICSフィード） | 未着手 |
| シフト交換リクエスト | 未着手 |
| 複数月一括最適化（逐次carry-forward） | 未着手 |

---

### 【将来】Phase3: 拡大する（6〜12ヶ月目）

| 内容 | 状態 |
|------|------|
| 複数診療科対応（`department_id`追加） | 未着手 |
| HIS連携API | 未着手 |
| ISMS/セキュリティ文書 | 未着手 |

---

### 【完了済み】V2 UXリデザイン

✅ LP / ✅ /app / ✅ /dashboard / ✅ セットアップウィザード / ✅ オンボーディング / ✅ 初期画面設定 / ✅ 公開デモ / ✅ ヘッダー統一 / ✅ 仮保存機能

---

### 【保留】技術的負債

| 内容 | 状態 |
|------|------|
| optimizer.py mixin分割 + V3大改修 | Task5-3で実施予定 |
| pytest修復 | 未着手（Phase1中に実施） |
| CORS本番設定（`*` → ドメイン限定） | 未着手 |
| 医師更新ロジック重複排除（Admin/Public） | 未着手 |

---

## ビジネストラック

| タスク | 内容 | 状態 |
|--------|------|------|
| タスクA | 自院でのV1.1実戦投入・実績獲得 | 🔄 進行中 |
| タスクB | 他院へのヒアリング（V2要件定義） | タスクA完了後 |
| タスクC | UXリデザイン（LP・/app・オンボーディング・公開デモ） | ✅ 全フェーズ完了 |

---

## 全体目標

- **短期（今月〜来月）**: Renderデプロイ安定化 + 自院での実運用開始
- **中期（2〜3ヶ月）**: 他院3〜5施設を開発パートナーとして巻き込む
- **長期（半年〜1年）**: マルチテナント型SaaSとしてV2ローンチ

---

## 直近の変更履歴

| 日付 | 内容 |
|------|------|
| 2026-03-24 | モバイル版UI小修正: 強制モードボタンをスティッキーツールバー（生成ボタン横）に追加・スコア一覧の医師名タップでハイライト切替（青枠+背景） |
| 2026-03-24 | P1-13完了: 取込UX改善・データ整合性保護 — ①parse-imageのExcel等受付バグ修正（ACCEPTED_EXTENSIONS定義順）②レポート月別詳細タブ文言短縮（スマホはみ出し防止）③回数サマリーヘッダー横スクロール固定④目標スコア初期値0.5刻み丸め⑤取込時の年月読取失敗警告UI⑥取込マッピング画面に祝日一覧表示⑦取込時のsplit/combinedモード不一致検知+その場切替UI⑧スケジュール編集時の祝日不整合バナー（day_shiftあり+祝日未設定→ワンクリック祝日追加）⑨combinedモード日祝スコア1.5点統一（データ駆動判定: 同日同医師dayなし→combined、バックエンド/ダッシュボード/レポート3箇所統一） |
| 2026-03-24 | ウィザードUX改善: タイトルバー（「シフらく — 初期設定」）+ログアウトボタン追加。setup_completedをhospital_id別localStorage管理（別アカウントでウィザード再表示）。ChoiceButtonはみ出し修正（whitespace-normal+break-words） |
| 2026-03-24 | 初期値調整: SetupWizard（score_min=0.5固定保存・maxShiftsスライダー上限10・intervalDays=3）、InlineDemo（score_min=0.5・score_max=10で幅広く）— 少人数でも生成エラー回避 |
| 2026-03-24 | レポート医師名の自然順ソート（localeCompare numeric）— 「医師2」<「医師10」の正しい数値順 |
| 2026-03-24 | 当直表取込をExcel/Word/PDF/テキストにも対応（parse-imageエンドポイント拡張・フロントUIのファイル選択/プレビュー対応・ボタン名「取込」に統一） |
| 2026-03-24 | P1-11/P1-12完了: AI連携（Google Gemini `gemini-3-flash-preview`・`google-genai` SDK）— 当直表取込（/app・/dashboard・カメラ対応・4ステップモーダル: アップロード→AI解析→医師名マッピング→確認保存・画像/Excel/Word/PDF/テキスト全対応）・医師名一括取込（DoctorManageDrawer+SetupWizard Step2） |
| 2026-03-24 | P1-9完了: データ引き継ぎコード発行/取込（12文字・24h有効・医師/シフト/設定を丸ごとコピー）+ アカウント完全削除（パスワード確認必須）— AccountActionsコンポーネント・/app・/dashboard設定モーダル |
| 2026-03-24 | import機能配置見直し: /viewから削除→/app・/dashboardの編集ページに移動。取込ボタンをDashboardToolbar・CompactGenerateCardに配置 |
| 2026-03-23 | Excel出力改善: 曜日・土曜・日祝列を削除（集計用は非表示ヘルパー列L/Mに移動）。表示列はA(日付)/B(日直)/C(当直)のみ、E-J列に医師別集計 |
| 2026-03-23 | 2カラム分割修正: 全表示箇所(view/dashboard/mobile/PDF)で左列=1-15日・右列=16-末日に固定（2月のみ14/14-15）。31日目が消える問題を解消 |
| 2026-03-23 | 前月参照日数の動的化: 前月シフト取得を4日固定→hardConstraints.interval_days（当直間隔）に連動。間隔5日なら5日分取得 |
| 2026-03-22 | C-3完了: プライバシーポリシー（/privacy）・利用規約（/terms）ページ追加。LPフッター・新規登録ページにリンク追加 |
| 2026-03-22 | C-7完了: ICSフィード（Googleカレンダー同期）— GET /api/schedule/ical/{doctor_token}で医師個人のシフトを.ics形式で返却。/entry/[token]にカレンダー登録ボタン追加 |
| 2026-03-22 | C-1 pre_validate強化: 4→7チェックに拡張。新規追加: ⑤前月クロス間隔→月初人手不足検知 ⑥土日祝勤務回数上限vs必要枠数 ⑦土曜当直上限vs土曜数。モバイル版CompactGenerateCard（スケジュール未生成画面）にもdiagnostics表示パネル追加 |
| 2026-03-22 | C-1 Phase1+3簡易版完了: 解なし対策 — pre_validate()で4つの事前算術チェック（医師数vsスロット/日祝人数不足/スコア範囲矛盾/ロックvs不可日衝突）をソルバー実行前に実施。HTTP 400→200+success=false化。FE全3画面（モバイル/PC/デモ）にdiagnostics表示パネル追加。ConstraintDiagnostic/DiagnosticInfo型をBE/FE両方に新設 |
| 2026-03-22 | B-3完了: 絵文字削減 — 全7ファイル22箇所の絵文字をLucideアイコンに置き換え（🏥→Hospital, ⚖️→Scale, 📅→Calendar, 🔄→RefreshCw, 👨‍⚕️→UserCog, 📊→BarChart3, 🗓️→CalendarDays, 🚫→Ban, ⚠️→AlertTriangle, ✅→CheckCircle, 💡→Lightbulb）。ServerStatusBannerは接続中アニメーション付き。PainCard/SettingsMenuItemのpropsをemoji:string→icon:LucideIconに型変更 |
| 2026-03-22 | モバイル版に青ハイライトフェード追加: MobileScheduleBoard.tsxにundoFlashアニメーション実装（PC版DashboardScheduleTableと同等のchangedShiftKeys連携・1.5秒フェードアウト） |
| 2026-03-22 | /dashboardスマホ検知バナー改善: zoom内の小さいテキストバナー→zoom外のフルスクリーンボトムシートに変更（下からスライドイン・「モバイル版へ移動」大ボタン・「このままPC版で作業する」薄めテキスト） |
| 2026-03-22 | B-2完了: オンボーディング文章統一 — dnd説明をモバイル操作に合わせて全面書き換え（1タップ=ハイライト、2タップ=操作メニュー）・不可日設定の保存ボタン説明を具体化・スコア設定パネルに?ガイドボタン追加（全10セクションで統一） |
| 2026-03-22 | Task5-2e完了: SettingsPanel.tsx削除（490行・どこからもimportなし）。useDashboardState.tsはuseOnCallCoreが依存しているため残留 |
| 2026-03-22 | 小修正バッチ(A1-A5): ウィザード初期値修正（minShifts 3→1、下限max=4、上限max=8）・確定保存の誤警告修正（全スロットnull=未作成扱い）・スコア一覧4列化・ルール表示崩れ修正（ラベル短縮+unit短縮）・フェイクプログレスバー段階的進行（0→30→60→85→90%、モバイル/PC両対応） |
| 2026-03-22 | モバイルタップUX刷新(B-1): 1タップ=医師ハイライト（全配置日+制約違反色分け、PC版と同等のgetHighlightedViolation利用）・2タップ=ボトムシート表示・モザイク廃止（backdrop blur削除→薄い暗転のみ）・「解除」→「外す」文言変更 |
| 2026-03-22 | docs/optimizer.md追記: 符号付き累積の原則（加重累積・累積目標乖離）・新規赴任医師の過去スコア補正ロジック再設計注記 |
| 2026-03-21 | 上級設定: 「土日祝の均等化」グループに子要素の比率調整UI追加（?ボタン→説明パネル→0.0〜1.0比率スライダー）。比率はoptimizer_configのweight_ratiosとしてDB永続化。shared.tsにWeightChildMeta/WeightRatioOverrides型追加、expandWeightGroupsが動的比率対応、WeightsConfig/DashboardSettingsPanel/useOptimizerConfig/useDashboardState/useOnCallCoreに比率の状態管理追加 |
| 2026-03-21 | ページ名変更: 「かんたん」→「モバイル版」・「一覧」→「PC版」（AppHeader/DefaultPageSetting/OnboardingModal）・ダッシュボード設定ボタン「設定」→「アカウント」 |
| 2026-03-21 | スマホ検知バナー: /dashboardにモバイル検知（768px未満 or タッチデバイス）→「モバイル版が快適です」バナー表示（×で閉じれる） |
| 2026-03-21 | 入れ替えボタン（⇄）: 各セルのロックボタン左に追加・タップで入れ替え元選択→別セル⇄タップで入れ替え実行・選択元は濃い紫塗りつぶし・入れ替え中に医師名クリックでキャンセル+新医師ハイライト |
| 2026-03-21 | ハイライト違反マップ改善: テーブルクリック=swap simulation（クリックしたセルからの入れ替え可否）・パレットクリック=placement check（配置可否）・間隔/土曜上限/日祝上限/不可日等すべての制約を反映・赤セルホバーでフローティングツールチップ（医師ごとに改行表示） |
| 2026-03-21 | 配色リデザイン: 曜日ベース（土曜=青/日祝=アンバー/平日=グレー）・制約違反=赤統一・ロックボタン明確化（ロック=アンバー塗り/未ロック=グレー枠線）・ハイライト=青太字+ring |
| 2026-03-21 | パレットUI改善: ロック/解除ボタン削除（ツールバーに統合済み）・ゴミ箱を下部sticky固定・ハイライト時のカード目立ち強化 |
| 2026-03-21 | ドラッグ中フローティングツールチップ: マウス追従で制約違反理由を表示（医師ごとに改行） |
| 2026-03-21 | /dashboard固定レイアウト: min-w-1280px固定+自動zoom縮小（window.innerWidth/1280）・DoctorPaletteをposition:fixedで画面右端固定+トグル開閉ボタン（▶/◀）・paddingRightでメイン領域との重なり防止 |
| 2026-03-21 | /dashboardツールバー再構築: 生成スプリットボタン（固定なし→「▶ 生成」全体生成、固定あり→「▶ 再生成」未固定枠のみ）・ドロップダウンに仮保存読込/確定済み読込/未固定枠クリアを統合・「白紙作成」独立ボタン追加・確定済み読込時に確認ダイアログ追加 |
| 2026-03-21 | Undo/Redo強化: 最大15スナップショット保持（生成でもリセットされない）・生成時の中間状態（未固定枠クリア）をスキップ・変更セルに青ハイライト1.5秒フェード（undoFlashアニメーション）・D&D入替え時も同じハイライト |
| 2026-03-21 | /app→モバイル専用: PC用レイアウト完全削除（matchMedia/isDesktop/DashboardScheduleTable/DoctorPalette/SettingsSlidePanel/DashboardSettingsPanel）・/dashboardはPC専用として独立維持 |
| 2026-03-21 | /dashboard警告UX: 全体生成時ロック存在警告・ツールバーロックトグル・全解除確認ダイアログ・仮保存上書き確認（タイムスタンプ表示） |
| 2026-03-21 | LP改善: InlineDemo初期値変更（医師12/間隔4/当直3/土曜1/日祝3）・月セレクタ追加・LP文言全面リライト（モバイル+PC訴求・専門用語排除） |
| 2026-03-20 | Task5-2c/d: /app/page.tsxにPC/モバイル統合レイアウト実装（後に/appからPC部分削除） |
| 2026-03-20 | Task5-2a/b完了: MobileActionSheet新規作成（タップ→ボトムシートUI・変更/入替え/解除/ロック・医師選択リスト+スコア+制約表示）・MobileScheduleBoard全面書き換え（3列テーブル・13-14pxフォント・セル内ボタン廃止・ツールバー4ボタン化）・useScheduleDndにモバイル用命令的API追加（placeDoctorInShift/removeDoctorFromShift/startSwapFrom/executeSwapTo） |
| 2026-03-20 | Task5-1完了: デッドコード削除 — ScheduleBoard.tsx(500行)+ScheduleCell.tsx(331行)+test/page.tsx(65行)=896行削除。Task5ロードマップ策定（UI統合・V3 Optimizer計画） |
| 2026-03-20 | ダッシュボードUI改善: スケジュール表2カラム化（前半/後半横並び）・医師名中央配置・行高さ固定（h-8+overflow-hidden+td overflow-hidden）・全設定モーダルヘッダー統一リデザイン（閉じる→×アイコン・保存/リセットをタイトル下コンパクトボタン化・モバイルでの全幅ブロック崩壊を解消） |
| 2026-03-20 | 設定UI/制約ルール大整理: 基本ルール統合（勤務間隔・土日祝上限・土曜当直上限・シフトモード・スコア設定を1セクションに）、優先度13個→2軸グループスライダー化（目標スコア近似・土日祝均等化）、不要ウェイト7個不活化（gap5/gap6/sat_consec/sunhol_3rd/weekend_hol_3rd/month_fairness/soft_unavailable）、不可日は常にハード制約、prevent_sunhol_consecutive/respect_unavailable_days/max_sunhol_days/max_sunhol_worksをUI非公開化、FE/BEデフォルト値統一、回数上限の最小値を1に修正（0=配置不可の罠を解消）、V3 Optimizer再設計計画をdocs/optimizer.mdに記載（加重累積均等化・理想間隔方式・累積目標乖離） |
| 2026-03-20 | V2.1 ダッシュボードD&D特化リデザイン: レイアウト反転（左=スケジュール全幅+右=医師パレット200px）・設定を右スライドインオーバーレイ化・1カラム全幅テーブル（14pxフォント）・ドラッグ中全セル緑/グレー色分け（cellValidityMap）・ツールバー整理（生成ドロップダウン）・ゴミ箱をパレット内統合・スワップボタン削除（セル→セルD&Dで自動スワップ）・新規4コンポーネント（DashboardScheduleTable/DashboardToolbar/DoctorPalette/SettingsSlidePanel） |
| 2026-03-20 | ヘッダー統一リデザイン: AppHeader をタブナビゲーション方式に全面刷新（かんたん/一覧/当直表）・全認証ページで共通使用・/view は公開ページ化（未認証時はシンプルヘッダー） |
| 2026-03-20 | 設定UI整理: パスワード変更・初期画面設定を共通コンポーネント化（PasswordChangeForm/DefaultPageSetting）・/app と /dashboard の設定モーダルに統合 |
| 2026-03-20 | ナビゲーションガード修正: デフォルト値との比較→保存済み値との比較に変更（savedWeightsRef/savedHardRef）・誤警告の解消 |
| 2026-03-20 | 確定シフト閲覧: /app ヘッダーに「確定シフト」ボタン追加・確定済みスケジュールの読み取り専用テーブル表示・「仮保存にコピーして編集」ボタン |
| 2026-03-19 | 仮保存機能: system_settings KVストアで仮保存CRUD（GET/PUT/DELETE /api/schedule/draft/{year}/{month}）・useDraftScheduleフック・/app＋/dashboard両対応・確定→仮保存コピー |
| 2026-03-19 | シフト表UX強化: 医師タップハイライト（青）・不可日/不可曜日per-shift赤ハイライト・スワップ時フラッシュアニメーション・ステータスバー固定高さ |
| 2026-03-19 | ガイドボタン: 全ドロワー＋MobileScheduleBoard toolbar に「?」ボタン追加（per-section onShowGuide）・DoctorManageDrawerにマジックリンクコピー＋ロック機能追加 |
| 2026-03-19 | MobileScheduleBoard新設: /app専用モバイルスケジュール表（タップ操作・coreプロップ1つ・スティッキーツールバー・DoctorSettingsPanel分離） |
| 2026-03-19 | UI改善: ラベル統一（一覧モード/かんたんモード）・オンボーディング全セクション対応・シフトスコア設定UI・優先度説明文修正 |
| 2026-03-18 | UX改善: SetupGuideの各ステップが対応するドロワーに直接遷移・SetupWizard間隔スライダー0-7日対応・/app↔/dashboardナビ追加・初期設定やり直しボタン・ブラウザ戻りAuth修正・InlineDemoタップ入替/年次モード/combined対応 |
| 2026-03-18 | V2 UX Phase6完了: 初期画面設定（/app vs /dashboard トグル・ログイン後リダイレクト分岐） |
| 2026-03-18 | V2 UX Phase5完了: 公開デモ（POST /api/demo/optimize + LP埋め込みInlineDemo） |
| 2026-03-18 | V2 UX Phase4完了: オンボーディング（useOnboarding + OnboardingModal + DB永続化） |
| 2026-03-18 | V2 UX Phase3完了: セットアップウィザード（5ステップ質問→仮医師生成→設定保存）実装 |
| 2026-03-18 | V2 UX Phase2b完了: `/app`初心者向けメイン画面（ステップガイド+設定フルスクリーンモーダル+ドロワー）実装 |
| 2026-03-18 | V2 UX Phase2a完了: `useOnCallCore`統合フック抽出・`/dashboard`簡素化 |
| 2026-03-18 | V2 UX Phase1a-1b完了: `/dashboard`分離・LP作成・ログイン後遷移先を`/app`に変更 |
| 2026-03-18 | Renderデプロイ修正: requirements.txt最小化・.python-version追加（Python 3.12.9固定） |
| 2026-03-18 | 同月土曜回数平準化（sat_month_fairness: 100）追加・ソフト制約の自動無効化UI実装 |
| 2026-03-18 | V1.1バグ修正3件: gap重み動的化・土曜上限ソフトペナルティ・unavailableゲート分離（respect=OFF時にソフト化） |
| 2026-03-18 | 用語統一: 「忌避日」→「不可日」、`soft_unavailable`ラベル/`respect_unavailable_days`ラベル更新 |
| 2026-03-18 | 日当直モード実装（`holiday_shift_mode: "combined"\|"split"`）— optimizer/スキーマ/型/UI/表示すべて対応 |
| 2026-03-17 | Task3完了（マルチテナント認証・JWT・hospital_id分離・フロント認証ガード・全APIにBearer付与） |
| 2026-03-17 | Task2.6フロント完了（2.6-1〜4: useScheduleConstraints / useNavigationGuard / useDoctorSettings の分離） |
| 2026-03-17 | Task2.6を新設（巨大ファイル分割リファクタリング・Task3前に実施予定） |
| 2026-03-17 | Task2.5完了（optimizer config DB永続化・スコア/重み/ルール保存ボタン追加） |
| 2026-03-17 | Task2完了（保存時警告・離脱警告・空シフト警告・全日返却） |
| 2026-03-17 | Task1完了（doctor_id統一・DELETE API・localStorage撤去） |
| 2026-03-17 | Step0完了（ローカルDB・ブランチ・両PC同期） |
| 2026-03-17 | ロードマップ・開発体制・ファイル管理ルール整備完了 |

---

## 開発環境メモ

- フロント: `npm run dev` → `http://localhost:3000`
- バックエンド: `cd backend && uvicorn main:app --reload` → `http://localhost:8000`
- 本番DB: Neon（クラウドPostgreSQL）/ `.env` に `DATABASE_URL` を設定
- 開発DB: Neon devブランチ（取得後 `.env` の `DATABASE_URL` に設定）
- マイグレーション: `$env:DATABASE_URL="<dev_branch_url>"; alembic upgrade head`
- AI連携: Google Gemini API / `GEMINI_API_KEY` を `.env` に設定 / モデル: `gemini-3-flash-preview`（無料枠）
- 認証: JWT HS256 / 30日有効 / `JWT_SECRET_KEY` を `.env` に設定必須
- パスワードハッシュ: `bcrypt` 直接使用（passlib 非対応のため）
- 既存Ebina HospitalデータはID `a0000000-0000-4000-8000-000000000001`、初期PW: `EbinaHospital2024!`
