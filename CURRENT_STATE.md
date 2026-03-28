# CURRENT_STATE.md — 現在の状態

> このファイルは会話をまたいだコンテキスト共有用。
> 作業開始時にAIに読ませる。変更があるたびに更新する。

---

## 現在のフェーズ

**V2.1完了 → Phase1「売り物にする」進行中（P1-1〜P1-3/P1-5/P1-7/P1-7b/P1-9〜P1-21完了）**
<!-- P1-19: 開発者管理ページ(/admin/dev)+利用統計収集(usage_events)+is_superadmin+プライバシーポリシー更新 -->
<!-- P1-20: AIガイドチャットUI+設定アドバイス（Claude API連携・知識ベース注入・/appと/dashboardに配置） -->
<!-- P1-21: AIガイド質問インサイト収集・分析（自動分類・要望検出・開発者送信・admin分析セクション） -->

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
- 不活化ウェイト: `sat_consec`, `sunhol_3rd`, `weekend_hol_3rd`, `month_fairness`, `soft_unavailable`
- 非公開ハード設定: `prevent_sunhol_consecutive`, `respect_unavailable_days`, `max_sunhol_days`, `max_sunhol_works`
- ~~`gap5`, `gap6`~~ → ✅ `ideal_gap_weight` + `ideal_gap_extra`（グラデーション間隔ソフト制約）で置き換え済み

**新規実装（docs/optimizer.md 参照）:**
- 加重累積均等化（土日祝均等化の置き換え）
- ~~理想間隔方式（gap5/gap6の置き換え）~~ → ✅ 実装済み
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
| P1-2 | 制約矛盾の診断（CP-SAT AddAssumptions活用） | P0 | ✅ 完了（事前チェック+MUS+管理者設定探索(4設定+組み合わせ)+不可日最小解除セット+人手不足検出+案内モーダル+ソフト化+違反通知） |
| P1-3 | プライバシーポリシー・利用規約ページ | P0 | ✅ 完了 |
| P1-4 | ~~不可日ソフト化UI~~ → P1-16の不可日上限+一括ソフト化でカバー | P1 | ✅ 不要 |
| P1-5 | マジックリンク共有機能（URLコピー/LINE/メール/QRコード・一括共有） | P1 | ✅ 完了 |
| P1-6 | 自院での実運用（2ヶ月以上） | P0 | 🔄 進行中（2026-03-26〜） |
| P1-7 | ICSフィード（Googleカレンダー同期） | P1 | ✅ 完了 |
| P1-7b | レポートページ（スコア乖離・累積推移・回数マトリクス・各医師カレンダー・期間選択） | P1 | ✅ 完了 |
| P1-8 | Stripe決済 + プラン別機能制限 | P0 | 未着手 |
| P1-9 | データ引き継ぎコード（12文字・24h有効）+ アカウント完全削除（パスワード確認） | P1 | ✅ 完了 |
| P1-10 | 外部医師（ダミー医師方式） — is_external=true・31人再利用・AddExactlyOne・月最大1回勤務制約・パレット±・D&Dペア移動 | P1 | ✅ 完了 |
| P1-17 | 共有入力ページ（/entry/shared/[token]）— 1URLで全医師がドロップダウンから不可日入力 + DoctorEntryForm共通化 | P1 | ✅ 完了 |
| P1-18 | メアド必須化+CORS修正 — 新規登録メアド必須・ログインを施設名orメアド対応・既存ユーザー向け促進バナー・メアド確認/編集UI・病院名変更API・CORS本番ドメイン限定・DefaultPageSetting廃止（画面幅自動判定） | P0 | ✅ 完了 |
| P1-19 | 開発者管理ページ（/admin/dev）— アカウント一覧・利用統計（usage_events）・is_superadmin制御。課金プラン設計用データ収集 | P0 | ✅ 完了 |
| P1-20 | AIガイド Phase1 — 仕様整理（全制約一覧+逆引き辞書+暗黙挙動リスト）→ チャットUI + 設定ナビ | P0 | 未着手 |
| P1-21 | AIガイド Phase2 — 未対応要望の自動検出 → feature_requestsテーブル → LINE/ai-secretary通知 | P1 | 未着手 |
| P1-11 | AI当直表画像取込（Gemini Vision API → スケジュールJSON → 医師名マッピング → DB保存）— /app・/dashboard両対応・カメラ撮影対応 | P1 | ✅ 完了 |
| P1-12 | AI医師名一括取込（画像・Excel・Word・PDF・テキスト → Gemini API → 医師名抽出・登録）— DoctorManageDrawer・SetupWizard Step2両対応 | P1 | ✅ 完了 |
| P1-13 | 取込UX改善・データ整合性保護（年月警告・祝日表示・モード切替・祝日不整合バナー・combinedスコア統一） | P1 | ✅ 完了 |
| P1-14 | 当直表の公開/非公開管理（年月ごと・管理者用/viewトグル・公開月のみ医師に表示） | P1 | ✅ 完了 |
| P1-15 | 当直表ページ分離（管理者用/view + 医師公開用/view/[token]）+ 確定シフト表示 + Googleカレンダーワンクリック登録 | P1 | ✅ 完了 |
| P1-16 | 解なし対策Step1（管理者メッセージ・固定不可曜日自己申請・公開コメント・医師個別サマリー・不可日上限制御・AI診断バグ修正・ICS DL方式） | P1 | ✅ 完了 |

---

### 【後】Phase2: 定着させる（3〜6ヶ月目）

| 内容 | 状態 |
|------|------|
| カスタムシフト種別 + 日別シフト属性（広域当番など）— `shift_types`テーブル・optimizer汎用化・日にタグをつけてタグ別スコア・医師別上限 | 未着手 |
| 2人体制スロット — 日別required_count・スケジュール表の複数医師表示対応 | 未着手 |
| LINE連携（確定通知プッシュ） | 未着手 |
| シフト交換リクエスト | 未着手 |
| 複数月一括最適化（逐次carry-forward） | 未着手 |

---

### 【将来】Phase3: 拡大する（6〜12ヶ月目）— 医師版を日本のデファクトに

| 内容 | 状態 |
|------|------|
| 複数診療科対応（`department_id`追加） | 未着手 |
| HIS連携API | 未着手 |
| ISMS/セキュリティ文書 | 未着手 |

---

### 【長期構想】Phase4: ナース勤務表自動作成への展開

**ビジョン:** 「医療シフトづくりDXを個人で終わらせる」— 医師版で確立した CP-SAT 基盤をナース版に展開

**市場:**
- 看護師160万人 vs 医師34万人（市場4.7倍）
- 競合: お助けマン（MIP・月15,000円〜）、セルヴィスEX（遺伝的アルゴリズム・月6,000〜10,000円）、HRBEST（組合せ最適化・月10,000円前後）
- 競合はすべて病院契約型・導入支援込みで単価が高い

**技術的な追加要素:**
- 3交代制（日勤/準夜/深夜）or 2交代制（日勤/夜勤）
- スキルミックス（新人+ベテラン配置、リーダー必須）
- 病棟×シフト×スキルの3次元制約
- パート・時短・夜勤専従など多様な勤務形態
- 1病棟20〜40人、病院全体100人超の規模

**差別化:**
- CP-SATは競合のMIP/遺伝的アルゴリズムと同等以上の最適性
- 無料〜超低価格（競合の1/3以下）
- セルフサービス（導入支援不要のUI）
- 制約診断AI（「なぜ解なしか」の説明機能 — 競合にはない）

**前提条件:** 医師版Phase1〜2を完了し、自院実運用の実績を確立してから着手

---

### 【完了済み】V2 UXリデザイン

✅ LP / ✅ /app / ✅ /dashboard / ✅ セットアップウィザード / ✅ オンボーディング / ✅ 初期画面設定 / ✅ 公開デモ / ✅ ヘッダー統一 / ✅ 仮保存機能

---

### 【保留】技術的負債

| 内容 | 状態 |
|------|------|
| ~~CORS本番設定（`*` → ドメイン限定）~~ | ✅ P1-18で対応済み（カンマ区切りドメイン指定方式） |
| optimizer.py mixin分割 + V3大改修 | Task5-3で実施予定（要望駆動で判断） |
| pytest修復 | 未着手（Optimizer改修前にCI整備） |
| 医師更新ロジック重複排除（Admin/Public） | 未着手 |

---

## ビジネストラック

| タスク | 内容 | 状態 |
|--------|------|------|
| タスクA | 自院での実運用・実績獲得 | 🔄 進行中（2026-03-26〜） |
| タスクB | 知り合いベースで5〜10施設に個別展開 | 🔄 進行中 |
| タスクC | UXリデザイン（LP・/app・オンボーディング・公開デモ） | ✅ 全フェーズ完了 |
| タスクD | AIガイド完成後にNote記事+Twitter公開 | タスクE完了後 |
| タスクE | AIガイド実装（仕様整理→チャットUI→要望収集） | P1-20/P1-21 |
| タスクF | Stripe課金実装 → 正式公開 | P1-8 |

---

## 公開戦略（2026-03-27 確定）

| フェーズ | やること | やらないこと |
|---------|---------|------------|
| **今（0〜10施設）** | 知り合い+口コミで個別展開。メアド必須化+開発者管理ページ整備 | 不特定多数への公開 |
| **AIガイド完成後** | Note記事+Twitter。AIガイドがサポートを代替 | 課金なしでの大規模拡散 |
| **Stripe実装後** | 正式公開。無料枠（10人以下）は永久無料。β期間ユーザーに特典 | |

**価格戦略（2026-03-28 更新）:**
| プラン | 価格 | 内容 |
|--------|------|------|
| 無料 | ¥0 | 医師10人以下・月X回生成・DB 1個・AIガイド無制限 |
| Pro | 月500〜1,000円 | 医師30人・月Y回生成・DB 3個・AI取込 |
| Pro Max | 月3,000円 | 医師無制限・生成無制限・DB無制限・全機能 |
| 病院契約 | 月数万円 | 専用ルール開発・優先サポート（要望が来てから） |

**課金戦略の方針:**
- **AIガイドは全プランで無料・最強モデル使用** — 使いこなさせて生成回数上限に当てる導線
- **複数DB（当直表+オンコール、本院+分院、科別管理等）** — Pro以上の課金機能
- 生成回数の上限（X, Y）は利用統計の実データから決定する（P1-19で収集中）

---

## 全体目標

- **短期（今月〜来月）**: ~~CORS修正+メアド必須化~~ ✅完了 → ~~開発者管理ページ(P1-19)~~ ✅完了 → AIガイド(P1-20/21) → 自院実運用+知り合い5施設
- **中期（1〜3ヶ月）**: AIガイド実装 → Note公開 → 10〜20施設
- **長期（3〜6ヶ月）**: Stripe課金+正式公開 → 有料30〜50施設・MRR 10〜25万円
- **超長期（1年〜）**: ナース勤務表自動作成に展開（CP-SAT基盤を流用・3交代制/スキルミックス対応）

---

## 直近の変更履歴

| 日付 | 内容 |
|------|------|
| 2026-03-28 | P1-18完了: メアド必須化+CORS修正。hospitalsにemail列追加。新規登録メアド必須・ログインを施設名orメアド対応。GET /api/auth/me・PUT /api/auth/email・PUT /api/auth/name追加。既存アカウント向けメアド登録バナー（/app・/dashboard）。アカウント設定にメアド確認/編集UI。CORS: ワイルドカード廃止→ドメイン指定方式。ログイン後リダイレクトを画面幅自動判定に変更。DefaultPageSetting削除。docs/future_schedule_requirements.md新設（将来のシフト生成要件を3軸で体系化） |
| 2026-03-28 | 外部枠UIを「外部枠数/勤務日数」選択式に全面改善。カレンダーデータ完全分離(internal_fixed_dates+external_input_mode+internal_day_count DB永続)。セットアップウィザードにStep4「当直表タイプ」追加。確定画面/レポート/トークン画面/エクスポートの外部枠対応。共有入力から外部医師除外。AI診断のスコア下限試行+外部枠情報追加。pre_validateの容量・スコア計算を外部医師対応（枠数<人数チェック追加）。DELETE/bulk-lock保護。診断エンドポイントをダミー医師方式に統一。外部医師のwork制約を「ちょうど1回」に修正。一括ソフト化バグ修正（is_soft_penaltyがハードコードfalseだった）+警告文改善+ソフト化後リロード。Alembicマイグレーション本番適用済み |
| 2026-03-27 | 外部医師ダミー方式: 空欄方式→ダミー医師31人方式に全面刷新。DB is_external追加。オプティマイザAddExactlyOne統一。名称「外部」+ティール色。パレットに外部枠（自動集計）。日当直D&Dペア移動（buildAssign/buildSwap/buildClear全対応）。日当直モード制約不整合修正。バリデーションメッセージクリア。カレンダー月送りナビ修正 |
| 2026-03-27 | 公開戦略確定: 個別承認制→AIガイド後にNote公開→Stripe後に正式公開。価格戦略（無料/月3-5千円/病院契約）確定。メアド必須化+開発者管理ページ+AIガイドをP1-18〜P1-21として追加 |
| 2026-03-26 | 外部枠（外部医師スロット）: Optimizer AddExactlyOne→AddAtMostOne切替 → **ダミー医師方式で置換済** |
| 2026-03-26 | 固定不可曜日カレンダー反映（[固]マーク+タップ無効化）+ 祝日ボタン+日祝ポップオーバー追加 |
| 2026-03-26 | 共有入力ページ（/entry/shared/[token]）+ DoctorEntryForm共通化 + 編集ボタン削除（即入力可能に） |
| 2026-03-26 | Googleカレンダー連携ハイブリッド化（各シフト個別action=TEMPLATE + 一括ICSダウンロード）+ 確定シフト月フィルタ + 月切替左右配置 |
| 2026-03-26 | 管理者メッセージタイトル追加（全画面統一）+ 公開コメント説明追加 + 日付フォーマット日本式化 + 色コントラスト改善 |
| 2026-03-25 | 理想間隔グラデーションソフト制約: gap5/gap6（固定2段階）を廃止→ideal_gap_weight+ideal_gap_extra（線形減衰グラデーション）に置き換え。上級設定に3つ目のグループ「勤務間隔のゆとり」追加（スライダー+ステッパー+?説明パネル付きグラデーション可視化）。案内メッセージを医師リスト上部に移動+折りたたみUI。「マジックリンク」→「各医師の専用ページ」に用語統一 |
| 2026-03-25 | AI解なし診断の大幅改善: ①共通設定（土曜上限・日祝上限等）を種別ごとに1行集約（「8名が該当」形式）②Geminiプロンプトを「原因+対処案」フォーマット化・「相談してみてください」表現に統一③気づきの医師名羅列を削除（「10人が不可」のみ）④ソフト化案内メッセージ削除⑤soft_unavailable重みを設定UIから削除し内部固定1000に⑥ソフト不可日違反時のtoast通知追加（医師名・日付表示） |
| 2026-03-25 | モバイル医師不可日モーダル修正: ①不可日モディファイア追加（[休]/[日]/[当]赤背景表示）②祝日表示③日曜・祝日のTargetShiftPopover（日直/当直別設定）④保存ボタン追加 |
| 2026-03-25 | 細かい修正バッチ: ①AI解なし診断の冗長さ修正（閾値引き上げ・上位N件制限）②ソフト化ボタンをグレー控えめデザインに変更③PC不可日カレンダー修正（共通UnavailableDaysInputに置き換え）④ツールバー年月セレクタ小型化⑤トークン画面Excelオフセット修正（B2起点）⑥ICSダウンロード修正（Content-Disposition日本語ファイル名RFC5987エンコード）⑦モバイル医師詳細に共有ドロップダウン追加 |
| 2026-03-25 | 管理者メッセージ2種＋固定不可曜日の医師自己申請＋医師個別サマリー＋カレンダー修正: ①医師管理ドロワーに「医師への案内メッセージ」テキストエリア（KV doctor_message）②管理者当直表に公開コメント欄（KV publish_comment_{YYYY-MM}）③/entry/[token]に固定不可曜日ボタンUI（曜日タップで不可↔解除）④/view/[token]に公開コメント表示+医師個別サマリー（当直/日直回数・内訳・間隔）⑤Googleカレンダー連携をwebcal購読→ICSファイルDLに修正 |
| 2026-03-24 | レポートUI改善: ①期間セレクタを3ヶ月/1年トグルに簡素化（デフォルト3ヶ月）②医師ドロップダウンoverflow修正（max-w-[10rem]）③色統一（平日=green/土曜=blue/日祝日=orange/日祝夜=red — StatCard・積み上げバー・サマリー表で一貫）④管理者当直表の月選択をカスタムドロップダウン化（公開=緑●/非公開=琥珀○の色付きドット） |
| 2026-03-24 | ICSフィード改善: 終日イベント化（病院ごとに時間が異なるため）・月指定パラメータ追加（?year=&month=）・ボタンラベルに対象月明示 |
| 2026-03-24 | /viewを管理者専用と医師公開用に分離: /view→管理者専用（未認証→/loginリダイレクト）、/view/[token]→医師向け公開当直表（トークン認証・公開月のみ・医師名表示・画像DL）。GET /api/schedule/public/{token}/{year}/{month}新設 |
| 2026-03-24 | 当直表の公開/非公開管理: 年月ごとの公開状態をsystem_settings KVに保存・/viewに公開/非公開トグル（管理者のみ）・public-shifts/icalエンドポイントで公開月のみ返却・デフォルト非公開（確定保存だけでは医師に見えない安全設計） |
| 2026-03-24 | マジックリンク画面改善: 確定シフト一覧表示（公開月のみ）+Googleカレンダーワンクリック登録（URLコピー→calendar.google.com直接遷移に変更）+公開APIエンドポイント追加（GET /api/schedule/public-shifts/{token}） |
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
