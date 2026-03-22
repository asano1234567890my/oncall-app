// src/app/app/page.tsx — モバイル版（モバイル特化）
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Loader2, Settings, ChevronRight, ChevronDown, X, UserCog, BarChart3, Calendar, Scale, CalendarDays, Ban } from "lucide-react";
// Shared
import AppHeader from "../components/AppHeader";
import OnboardingModal from "../components/OnboardingModal";
import SetupWizard from "../components/SetupWizard";
// Mobile
import MobileScheduleBoard from "../components/MobileScheduleBoard";
import DoctorUnavailableDetail from "../components/DoctorUnavailableDetail";
// Settings modals
import RulesConfig from "../components/settings/RulesConfig";
import WeightsConfig from "../components/settings/WeightsConfig";
import DoctorManageDrawer from "../components/settings/DoctorManageDrawer";
import HolidaySettingsDrawer from "../components/settings/HolidaySettingsDrawer";
import UnavailableDaysInput from "../components/settings/UnavailableDaysInput";
import PreviousMonthShiftsConfig from "../components/settings/PreviousMonthShiftsConfig";
import ShiftScoresConfig from "../components/settings/ShiftScoresConfig";
import SettingsModalPortal from "../components/settings/SettingsModalPortal";
import PasswordChangeForm from "../components/settings/PasswordChangeForm";
import DefaultPageSetting from "../components/settings/DefaultPageSetting";
import StepperNumberInput from "../components/inputs/StepperNumberInput";
import { DEFAULT_SHIFT_SCORES } from "../types/dashboard";
import type { HardConstraints, ShiftScores } from "../types/dashboard";
import { getAuthHeaders } from "../hooks/useAuth";
import { useOnboarding } from "../hooks/useOnboarding";
import { useOnCallCore } from "../hooks/useOnCallCore";

type SettingsDrawer = "shift-scores" | "rules" | "weights" | "doctor-manage" | "doctor-scores" | "doctors" | "holidays" | "previous" | null;


export default function AppPage() {
  const core = useOnCallCore();
  const router = useRouter();

  // ── 設定状態 ──
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<SettingsDrawer>(null);

  // ── セットアップ ──
  const [setupStatus, setSetupStatus] = useState<"loading" | "needed" | "done">("loading");
  const [isSetupRedo, setIsSetupRedo] = useState(false);
  const onboarding = useOnboarding(core.auth.isAuthenticated);
  const prevHadSchedule = useRef(false);

  // ── 認証ガード ──
  useEffect(() => {
    if (!core.isAuthLoading && !core.auth.isAuthenticated) {
      router.push("/login");
    }
  }, [core.auth.isAuthenticated, core.isAuthLoading, router]);

  // ── セットアップ完了チェック ──
  useEffect(() => {
    if (!core.auth.isAuthenticated) return;
    if (localStorage.getItem("setup_completed")) { setSetupStatus("done"); return; }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    fetch(`${apiUrl}/api/settings/kv/setup_completed`, { headers: getAuthHeaders() })
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data: unknown) => {
        const value = (data as Record<string, unknown>)?.value;
        if (value) localStorage.setItem("setup_completed", "1");
        setSetupStatus(value ? "done" : "needed");
      })
      .catch(() => setSetupStatus("done"));
  }, [core.auth.isAuthenticated]);

  const handleWizardComplete = useCallback((options?: { openDoctorManage?: boolean; openUnavailable?: boolean }) => {
    localStorage.setItem("setup_completed", "1");
    setSetupStatus("done");
    if (options?.openDoctorManage) sessionStorage.setItem("open_doctor_manage", "1");
    if (options?.openUnavailable) sessionStorage.setItem("open_unavailable", "1");
    window.location.reload();
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("open_unavailable")) {
      sessionStorage.removeItem("open_unavailable");
      setActiveDrawer("doctors");
    } else if (sessionStorage.getItem("open_doctor_manage")) {
      sessionStorage.removeItem("open_doctor_manage");
      setActiveDrawer("doctor-manage");
    }
  }, []);

  // ── オンボーディング ──
  const hasSchedule = core.schedule.length > 0;

  useEffect(() => {
    if (hasSchedule && !prevHadSchedule.current) onboarding.triggerOnboarding("generate");
    prevHadSchedule.current = hasSchedule;
  }, [hasSchedule, onboarding.triggerOnboarding]);

  useEffect(() => {
    if (hasSchedule && onboarding.hasSeen("generate") && !onboarding.pendingSection) {
      onboarding.triggerOnboarding("dnd");
    }
  }, [hasSchedule, onboarding.hasSeen, onboarding.pendingSection, onboarding.triggerOnboarding]);

  const previousMonthShiftCount = useMemo(() =>
    core.prevMonthTailDays.reduce((count, day) => {
      const d = core.getPreviousMonthShiftDoctorId(day, "day");
      const n = core.getPreviousMonthShiftDoctorId(day, "night");
      return count + (d ? 1 : 0) + (n ? 1 : 0);
    }, 0),
    [core.prevMonthTailDays, core.getPreviousMonthShiftDoctorId],
  );

  // ── ハンドラ ──
  const openSettings = useCallback(() => { setIsSettingsOpen(true); setActiveDrawer(null); }, []);
  const openAccountSettings = useCallback(() => { setIsAccountSettingsOpen(true); setActiveDrawer(null); }, []);
  const openDrawer = useCallback((drawer: SettingsDrawer) => {
    setActiveDrawer(drawer);
    if (drawer === "shift-scores") onboarding.triggerOnboarding("shift-scores");
    if (drawer === "rules") onboarding.triggerOnboarding("rules");
    if (drawer === "weights") onboarding.triggerOnboarding("weights");
    if (drawer === "doctor-manage") onboarding.triggerOnboarding("doctor-manage");
    if (drawer === "doctors") onboarding.triggerOnboarding("doctors");
    if (drawer === "doctor-scores") onboarding.triggerOnboarding("doctor-scores");
    if (drawer === "holidays") onboarding.triggerOnboarding("holidays");
    if (drawer === "previous") onboarding.triggerOnboarding("previous");
  }, [onboarding]);
  const closeDrawer = useCallback(() => setActiveDrawer(null), []);

  const handleRedoSetup = useCallback(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    void fetch(`${apiUrl}/api/settings/kv/setup_completed`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ value: false }),
    }).then(() => {
      localStorage.removeItem("setup_completed");
      setIsSetupRedo(true);
      setSetupStatus("needed");
      setIsSettingsOpen(false);
      setIsAccountSettingsOpen(false);
    });
  }, []);

  // ── ローディング ──
  if (core.isAuthLoading || !core.auth.isAuthenticated || setupStatus === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (setupStatus === "needed") {
    return <SetupWizard onComplete={handleWizardComplete} isRedo={isSetupRedo} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <AppHeader
        hospitalName={core.auth.hospitalName}
        onBeforeNavigate={() => core.confirmMoveWithUnsavedChanges()}
        hideLogout
        rightExtra={
          <button
            onClick={openAccountSettings}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-1.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors sm:px-2.5"
            title="アカウント"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">アカウント</span>
          </button>
        }
      />

      {/* ━━━━━━━━━━ メインレイアウト ━━━━━━━━━━ */}
      {/* 年月バー */}
          <div className="flex items-center justify-between border-b bg-white px-4 py-2">
            <div className="flex items-center gap-2">
              <select
                value={core.year}
                onChange={(e) => core.handleYearChange(Number(e.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm font-bold text-gray-800"
              >
                {[core.year - 1, core.year, core.year + 1].map((y) => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
              <select
                value={core.month}
                onChange={(e) => core.handleMonthChange(Number(e.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm font-bold text-gray-800"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            </div>
            {!hasSchedule && (
              <button
                onClick={openSettings}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
              >
                <Settings className="h-3.5 w-3.5" /> 設定
              </button>
            )}
          </div>

          <main className="mx-auto w-full max-w-5xl px-4 py-4">
            {core.isLoading && <LoadingOverlay />}

            {hasSchedule ? (
              <MobileScheduleBoard
                core={core}
                onOpenSettings={openSettings}
                onShowGuide={() => onboarding.showGuide("dnd")}
              />
            ) : (
              <CompactGenerateCard core={core} onOpenSettings={openSettings} onOpenDoctorManage={() => openDrawer("doctor-manage")} />
            )}
          </main>

      {/* ━━━━━━ 設定画面（1画面スクロール） ━━━━━━ */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
            <h2 className="text-lg font-bold text-gray-800">設定</h2>
            <button onClick={() => { setIsSettingsOpen(false); setActiveDrawer(null); }} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mx-auto max-w-lg px-4 py-4 space-y-5">
            {/* ── ルール ── */}
            <MobileRulesSection
              hardConstraints={core.hardConstraints}
              shiftScores={core.shiftScores}
              onHardConstraintChange={core.handleHardConstraintChange}
              onShiftScoreChange={(key, value) => core.setShiftScores({ ...core.shiftScores, [key]: value })}
              onResetRules={() => core.setHardConstraints(core.DEFAULT_HARD_CONSTRAINTS)}
              onResetScores={() => core.setShiftScores(DEFAULT_SHIFT_SCORES)}
              onSave={() => { void core.saveOptimizerConfig(); }}
              isSaving={core.isSavingOptimizerConfig}
              saveMessage={core.optimizerSaveMessage}

            />

            {/* ── 医師 ── */}
            <SettingsSection title="医師">
              <SettingsMenuItem
                icon={UserCog} title="医師の管理"
                detail={core.numDoctors > 0 ? `${core.numDoctors}名` : undefined}
                onClick={() => openDrawer("doctor-manage")}
              />
              <SettingsMenuItem icon={BarChart3} title="スコア設定" onClick={() => openDrawer("doctor-scores")} />
              <MobileUnavailableMenuItem
                activeDoctors={core.activeDoctors}
                unavailableMap={core.unavailableMap}
                fixedUnavailableWeekdaysMap={core.fixedUnavailableWeekdaysMap}
                onClick={() => openDrawer("doctors")}
              />
            </SettingsSection>

            {/* ── カレンダー ── */}
            <SettingsSection title="カレンダー">
              <SettingsMenuItem icon={Calendar} title="祝日・休日設定" onClick={() => openDrawer("holidays")} />
            </SettingsSection>

            {/* ── 上級設定 ── */}
            <SettingsSection title="上級設定" collapsible>
              <SettingsMenuItem icon={Scale} title="優先度の調整" onClick={() => openDrawer("weights")} />
              <SettingsMenuItem
                icon={CalendarDays} title="前月の勤務実績"
                detail={previousMonthShiftCount > 0 ? `${previousMonthShiftCount}枠入力済み` : undefined}
                onClick={() => openDrawer("previous")}
              />
            </SettingsSection>

          </div>
        </div>
      )}

      {/* ━━━━━━ アカウント設定モーダル（PC/モバイル共通） ━━━━━━ */}
      {isAccountSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
            <h2 className="text-lg font-bold text-gray-800">アカウント設定</h2>
            <button onClick={() => setIsAccountSettingsOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mx-auto max-w-md p-4 space-y-6">
            <DefaultPageSetting />
            <hr className="border-gray-200" />
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-3">パスワード変更</h3>
              <PasswordChangeForm />
            </div>
            <hr className="border-gray-200" />
            <button
              onClick={() => { setIsAccountSettingsOpen(false); handleRedoSetup(); }}
              className="w-full rounded-lg border border-gray-200 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              初期設定からやり直す
            </button>
            <button
              onClick={() => { setIsAccountSettingsOpen(false); core.logout(); }}
              className="w-full py-2.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      )}

      {/* ━━━━━━ 共通: 各設定モーダル ━━━━━━ */}
      <DoctorManageDrawer
        isOpen={activeDrawer === "doctor-manage"}
        onClose={closeDrawer}
        onDoctorsChanged={() => { void core.refetchDoctors(); }}
        onShowGuide={() => onboarding.showGuide("doctor-manage")}
      />

      <ShiftScoresConfig
        isOpen={activeDrawer === "shift-scores"}
        shiftScores={core.shiftScores}
        isSaving={core.isSavingOptimizerConfig}
        saveMessage={core.optimizerSaveMessage}
        onClose={closeDrawer}
        onReset={() => core.setShiftScores(DEFAULT_SHIFT_SCORES)}
        onSave={() => { void core.saveOptimizerConfig(); }}
        onShiftScoreChange={(key, value) => core.setShiftScores({ ...core.shiftScores, [key]: value })}
        onShowGuide={() => onboarding.showGuide("shift-scores")}
      />

      <RulesConfig
        isOpen={activeDrawer === "rules"}
        hardConstraints={core.hardConstraints}
        isSaving={core.isSavingOptimizerConfig}
        saveMessage={core.optimizerSaveMessage}
        onClose={closeDrawer}
        onReset={() => core.setHardConstraints(core.DEFAULT_HARD_CONSTRAINTS)}
        onSave={() => { void core.saveOptimizerConfig(); }}
        onHardConstraintChange={core.handleHardConstraintChange}
        onShowGuide={() => onboarding.showGuide("rules")}
      />

      <WeightsConfig
        isOpen={activeDrawer === "weights"}
        objectiveWeights={core.objectiveWeights}
        hardConstraints={core.hardConstraints}
        isSaving={core.isSavingOptimizerConfig}
        saveMessage={core.optimizerSaveMessage}
        onClose={closeDrawer}
        onReset={() => core.setObjectiveWeights(core.DEFAULT_OBJECTIVE_WEIGHTS)}
        onSave={() => { void core.saveOptimizerConfig(); }}
        onSetWeights={core.setObjectiveWeights}
        onShowGuide={() => onboarding.showGuide("weights")}
        ratioOverrides={core.weightRatioOverrides}
        onRatioOverridesChange={core.setWeightRatioOverrides}
        grouped
      />

      <SettingsModalPortal isOpen={activeDrawer === "doctors"}>
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
          <div className="flex max-h-[85dvh] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl sm:max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-4 py-4 sm:px-5">
              <h3 className="text-base font-bold text-gray-900">不可日設定</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onboarding.showGuide("doctors")} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">?</button>
                <button type="button" onClick={() => { void core.saveAllDoctorsSettings(); }} disabled={core.isBulkSavingDoctors} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                  {core.isBulkSavingDoctors ? "保存中..." : "保存"}
                </button>
                <button type="button" onClick={closeDrawer} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50">閉じる</button>
              </div>
            </div>
            <div className="overflow-y-auto p-4 sm:p-5">
              <UnavailableDaysInput
                doctorUnavailableMonth={core.doctorUnavailableMonth}
                activeDoctors={core.activeDoctors}
                selectedDoctorId={core.selectedDoctorId}
                unavailableMap={core.unavailableMap}
                fixedUnavailableWeekdaysMap={core.fixedUnavailableWeekdaysMap}
                pyWeekdays={core.pyWeekdays}
                onSelectedDoctorChange={core.setSelectedDoctorId}
                onDoctorUnavailableMonthChange={core.setDoctorUnavailableMonth}
                onToggleAllUnavailable={core.toggleAllUnavailable}
                onToggleUnavailable={core.toggleUnavailable}
                onToggleFixedWeekday={core.toggleFixedWeekday}
              />
            </div>
          </div>
        </div>
      </SettingsModalPortal>

      <SettingsModalPortal isOpen={activeDrawer === "doctor-scores"}>
        <MobileDoctorScoresPanel core={core} onClose={closeDrawer} onShowGuide={() => onboarding.showGuide("doctor-scores")} />
      </SettingsModalPortal>

      <HolidaySettingsDrawer
        isOpen={activeDrawer === "holidays"}
        onClose={closeDrawer}
        year={core.year} month={core.month} daysInMonth={core.daysInMonth}
        holidayWorkdayOverrides={core.holidayWorkdayOverrides}
        isHolidayLikeDay={core.isHolidayLikeDay}
        onToggleHoliday={core.toggleHoliday}
        onToggleHolidayOverride={core.handleHolidayOverrideToggle}
        onSaveCustomHolidays={() => { void core.saveCustomHolidays(); }}
        isLoadingCustom={core.isLoadingCustom} isSavingCustom={core.isSavingCustom}
        customError={core.customError} customSaveMessage={core.customSaveMessage}
        hasUnsavedCustomChanges={core.hasUnsavedCustomChanges}
        onShowGuide={() => onboarding.showGuide("holidays")}
      />

      <PreviousMonthShiftsConfig
        isOpen={activeDrawer === "previous"}
        year={core.year} month={core.month}
        activeDoctors={core.activeDoctors}
        prevMonthLastDay={core.prevMonthLastDay}
        prevMonthTailDays={core.prevMonthTailDays}
        previousMonthShiftCount={previousMonthShiftCount}
        getPreviousMonthShiftDoctorId={core.getPreviousMonthShiftDoctorId}
        onClose={closeDrawer}
        onPrevMonthLastDayChange={core.handlePrevMonthLastDayChange}
        onSetPreviousMonthShift={core.setPreviousMonthShift}
        onShowGuide={() => onboarding.showGuide("previous")}
      />


      <OnboardingModal section={onboarding.pendingSection} onDismiss={onboarding.dismissOnboarding} />
    </div>
  );
}

/* ━━━━━━ セクション・インラインUI ━━━━━━ */

/* ━━━━━━ 共通コンポーネント ━━━━━━ */

function LoadingOverlay() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // 段階的にプログレスを進める（フェイク）
    // 0→30%: 0.5秒, 30→60%: 2.5秒, 60→85%: 5秒, 85→90%: じわじわ
    const t1 = setTimeout(() => setProgress(30), 500);
    const t2 = setTimeout(() => setProgress(60), 3000);
    const t3 = setTimeout(() => setProgress(85), 8000);
    const t4 = setTimeout(() => setProgress(90), 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  return (
    <div className="fixed inset-x-0 top-[57px] bottom-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
      <div className="w-full max-w-md rounded-2xl border border-blue-100 bg-white px-4 py-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-600" />
          <div className="text-base font-bold text-gray-800">当直表を自動生成しています</div>
          <div className="mt-2 text-sm text-gray-500">完了までそのままお待ちください。</div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactGenerateCard({ core, onOpenSettings, onOpenDoctorManage }: { core: ReturnType<typeof useOnCallCore>; onOpenSettings: () => void; onOpenDoctorManage: () => void }) {
  const hasDoctors = core.numDoctors > 0;
  const [detailDoctorId, setDetailDoctorId] = useState<string | null>(null);

  const monthPrefix = `${core.year}-${String(core.month).padStart(2, "0")}-`;
  const hasMonthEntry = useCallback((doctorId: string) => {
    const entries = core.unavailableMap[doctorId];
    if (!entries || entries.length === 0) return false;
    return entries.some((e) => typeof e.date === "string" && e.date.startsWith(monthPrefix));
  }, [core.unavailableMap, monthPrefix]);
  const enteredCount = core.activeDoctors.filter((d) => hasMonthEntry(d.id)).length;

  const hc = core.hardConstraints;
  const modeLabel = hc.holiday_shift_mode === "combined" ? "日当直" : "日直+当直";

  const detailDoctor = detailDoctorId ? core.activeDoctors.find((d) => d.id === detailDoctorId) ?? null : null;

  return (
    <div className="mx-auto max-w-md py-6">
      <h2 className="text-center text-lg font-bold text-gray-800 mb-5">
        {core.year}年{core.month}月のシフトを作成
      </h2>

      {/* 医師 */}
      <button
        onClick={onOpenDoctorManage}
        className="mb-4 w-full rounded-xl border border-gray-100 bg-white p-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-800">医師</span>
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-bold ${hasDoctors ? "text-blue-600" : "text-yellow-600"}`}>
              {hasDoctors ? `${core.numDoctors}名` : "未登録"}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
          </div>
        </div>
      </button>

      {/* ルール設定 */}
      <div className="mb-4 rounded-xl border border-gray-100 bg-white p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-800">ルール設定</span>
          <button onClick={onOpenSettings} className="text-[11px] text-blue-500 hover:text-blue-700">変更</button>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
          <div className="flex justify-between min-w-0">
            <span className="text-gray-400 shrink-0">間隔</span>
            <span className="font-medium shrink-0">{hc.interval_days}日以上</span>
          </div>
          <div className="flex justify-between min-w-0">
            <span className="text-gray-400 shrink-0">モード</span>
            <span className="font-medium truncate ml-1">{modeLabel}</span>
          </div>
          <div className="flex justify-between min-w-0">
            <span className="text-gray-400 shrink-0">土日祝</span>
            <span className="font-medium shrink-0">{hc.max_weekend_holiday_works}回/月</span>
          </div>
          <div className="flex justify-between min-w-0">
            <span className="text-gray-400 shrink-0">土曜</span>
            <span className="font-medium shrink-0">{hc.max_saturday_nights}回/月</span>
          </div>
        </div>
      </div>

      {/* 不可日 — 全医師チップ */}
      <div className="mb-6 rounded-xl border border-gray-100 bg-white p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-800">不可日</span>
          <span className="text-xs text-gray-400">{enteredCount}/{core.numDoctors}名入力済み</span>
        </div>
        {hasDoctors ? (
          <div className="flex flex-wrap gap-1.5">
            {core.activeDoctors.map((d) => {
              const hasEntry = hasMonthEntry(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => setDetailDoctorId(d.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    hasEntry
                      ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                      : "border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100"
                  }`}
                >
                  {hasEntry ? "✓ " : ""}{d.name}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-gray-400">医師を登録してください</div>
        )}
      </div>

      <button
        onClick={core.handleGenerateWithGuard}
        disabled={!hasDoctors || core.isLoading}
        className="w-full rounded-xl bg-blue-600 py-4 text-base font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {core.isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> 生成中...
          </span>
        ) : "シフトを生成する"}
      </button>

      <button
        onClick={onOpenSettings}
        className="mt-3 w-full rounded-xl border border-gray-200 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <Settings className="mr-1.5 inline h-4 w-4" />
        設定を変更
      </button>

      {/* 医師不可日詳細モーダル */}
      {detailDoctor && (
        <DoctorUnavailableDetail
          doctor={detailDoctor}
          year={core.year}
          month={core.month}
          onClose={() => setDetailDoctorId(null)}
          unavailableEntries={core.unavailableMap[detailDoctor.id] ?? []}
          fixedEntries={core.fixedUnavailableWeekdaysMap[detailDoctor.id] ?? []}
          pyWeekdays={core.pyWeekdays}
          onToggleUnavailable={core.toggleUnavailable}
          onToggleFixedWeekday={core.toggleFixedWeekday}
        />
      )}
    </div>
  );
}

function SettingsSection({ title, children, collapsible = false }: { title: string; children: React.ReactNode; collapsible?: boolean }) {
  const [open, setOpen] = useState(!collapsible);
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={collapsible ? () => setOpen((p) => !p) : undefined}
        className={`w-full border-b border-gray-100 bg-gray-50 px-4 py-2 flex items-center justify-between ${collapsible ? "cursor-pointer" : "cursor-default"}`}
      >
        <h3 className="text-xs font-bold text-gray-500 tracking-wide">{title}</h3>
        {collapsible && <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && <div className="divide-y divide-gray-100">{children}</div>}
    </div>
  );
}

function SettingsMenuItem({ icon: Icon, title, detail, onClick }: { icon: LucideIcon; title: string; detail?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
      <Icon className="h-5 w-5 text-gray-500" />
      <div className="flex-1 min-w-0 text-sm font-medium text-gray-800">{title}</div>
      {detail && <span className="text-xs text-gray-400">{detail}</span>}
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300" />
    </button>
  );
}

function MobileUnavailableMenuItem({ activeDoctors, unavailableMap, fixedUnavailableWeekdaysMap, onClick }: {
  activeDoctors: { id: string; name: string; access_token?: string }[];
  unavailableMap: Record<string, unknown[]>;
  fixedUnavailableWeekdaysMap: Record<string, unknown[]>;
  onClick: () => void;
}) {
  const enteredCount = activeDoctors.filter((d) => (unavailableMap[d.id]?.length ?? 0) > 0).length;

  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
      <Ban className="h-5 w-5 text-gray-500" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800">不可日設定</div>
        <div className={`text-[11px] font-medium ${enteredCount === activeDoctors.length && activeDoctors.length > 0 ? "text-green-600" : "text-gray-400"}`}>
          {activeDoctors.length > 0 ? `${enteredCount}/${activeDoctors.length}名入力済み` : "医師未登録"}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300" />
    </button>
  );
}

function MobileRulesSection({ hardConstraints, shiftScores, onHardConstraintChange, onShiftScoreChange, onResetRules, onResetScores, onSave, isSaving, saveMessage }: {
  hardConstraints: HardConstraints;
  shiftScores: ShiftScores;
  onHardConstraintChange: (key: keyof HardConstraints, value: number | boolean | string) => void;
  onShiftScoreChange: (key: keyof ShiftScores, value: number) => void;
  onResetRules: () => void;
  onResetScores: () => void;
  onSave: () => void;
  isSaving: boolean;
  saveMessage: string;
}) {
  const hc = hardConstraints;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-500 tracking-wide">ルール</h3>
        <div className="flex items-center gap-2">
          {saveMessage && <span className="text-[11px] font-bold text-emerald-600">{saveMessage}</span>}
          <button onClick={onSave} disabled={isSaving} className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {isSaving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* シフトモード */}
        <div>
          <div className="text-xs font-bold text-gray-700 mb-2">シフトモード</div>
          <div className="flex gap-2">
            {(["split", "combined"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onHardConstraintChange("holiday_shift_mode", mode)}
                className={`flex-1 rounded-lg border-2 py-2 text-xs font-bold transition-colors ${
                  hc.holiday_shift_mode === mode
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:border-blue-200"
                }`}
              >
                {mode === "split" ? "日直+当直（別々）" : "日当直（まとめて）"}
              </button>
            ))}
          </div>
        </div>

        {/* 勤務間隔・回数制限 */}
        <div>
          <div className="text-xs font-bold text-gray-700 mb-2">勤務間隔・回数制限</div>
          <div className="grid grid-cols-2 gap-2">
            <InlineNumberSetting label="当直間隔" unit="日" value={hc.interval_days} min={0} max={10} onChange={(v) => onHardConstraintChange("interval_days", v)} />
            <InlineNumberSetting label="土日祝上限" unit="回" value={hc.max_weekend_holiday_works} min={1} max={10} onChange={(v) => onHardConstraintChange("max_weekend_holiday_works", v)} />
            <InlineNumberSetting label="土曜上限" unit="回" value={hc.max_saturday_nights} min={1} max={10} onChange={(v) => onHardConstraintChange("max_saturday_nights", v)} />
          </div>
        </div>

        {/* シフトスコア */}
        <div>
          <div className="text-xs font-bold text-gray-700 mb-2">シフトスコア</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="text-[11px] text-gray-400 mb-1">平日当直</div>
              <div className="text-sm font-bold text-gray-500">1.0（基準）</div>
            </div>
            <InlineScoreSetting label="土曜当直" value={shiftScores.saturday_night} onChange={(v) => onShiftScoreChange("saturday_night", v)} />
            <InlineScoreSetting label="日祝日直" value={shiftScores.holiday_day} onChange={(v) => onShiftScoreChange("holiday_day", v)} />
            <InlineScoreSetting label="日祝当直" value={shiftScores.holiday_night} onChange={(v) => onShiftScoreChange("holiday_night", v)} />
          </div>
        </div>

        {/* リセット */}
        <div className="flex gap-2 border-t border-gray-100 pt-3">
          <button onClick={onResetRules} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors">
            ルールを既定値に戻す
          </button>
          <button onClick={onResetScores} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors">
            スコアを既定値に戻す
          </button>
        </div>
      </div>
    </div>
  );
}

function InlineNumberSetting({ label, unit, value, min, max, onChange }: {
  label: string; unit: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="text-[11px] text-gray-400 mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <StepperNumberInput
          value={value} onCommit={onChange} fallbackValue={value}
          min={min} max={max} step={1} inputMode="numeric"
          inputClassName="text-sm font-bold !py-1 !px-1"
          buttonClassName="!h-7 !w-7 text-sm"
          className="max-w-[140px]"
        />
        <span className="text-[11px] text-gray-400 shrink-0">{unit}</span>
      </div>
    </div>
  );
}

type ScoreField = "min" | "target" | "max";
type ScoreSelection = { doctorId: string; field: ScoreField } | null;

function MobileDoctorScoresPanel({ core, onClose, onShowGuide }: { core: ReturnType<typeof useOnCallCore>; onClose: () => void; onShowGuide?: () => void }) {
  const [sel, setSel] = useState<ScoreSelection>(null);
  const globalTarget = core.scoreTargetDefault;

  const getVal = (doctorId: string, field: ScoreField): number | null => {
    if (field === "min") return core.minScoreMap[doctorId] ?? core.scoreMin;
    if (field === "max") return core.maxScoreMap[doctorId] ?? core.scoreMax;
    return doctorId in core.targetScoreMap ? core.targetScoreMap[doctorId] : core.scoreTargetDefault;
  };

  const isDefaultField = (doctorId: string, field: ScoreField): boolean => {
    if (field === "min") return !(doctorId in core.minScoreMap);
    if (field === "max") return !(doctorId in core.maxScoreMap);
    return !(doctorId in core.targetScoreMap);
  };

  const isDefaultDoctor = (doctorId: string): boolean => {
    return isDefaultField(doctorId, "min") && isDefaultField(doctorId, "max") && isDefaultField(doctorId, "target");
  };

  const setVal = (doctorId: string, field: ScoreField, v: number | null) => {
    if (field === "min" && v != null) core.handleMinScoreChange(doctorId, v);
    if (field === "max" && v != null) core.handleMaxScoreChange(doctorId, v);
    if (field === "target") core.handleTargetScoreChange(doctorId, v);
  };

  const isGlobalSel = sel?.doctorId === "__default__";

  const handleStep = (delta: number) => {
    if (!sel) return;
    if (isGlobalSel) {
      if (sel.field === "min") { const next = core.scoreMin + delta * 0.5; if (next >= 0) core.setScoreMin(next); }
      if (sel.field === "max") { const next = core.scoreMax + delta * 0.5; if (next >= 0) core.setScoreMax(next); }
      if (sel.field === "target") {
        if (globalTarget == null) { if (delta > 0) core.setScoreTargetDefault(0.5); return; }
        const next = globalTarget + delta * 0.5;
        core.setScoreTargetDefault(next <= 0 ? null : next);
      }
      return;
    }
    const cur = getVal(sel.doctorId, sel.field);
    if (sel.field === "target") {
      if (cur == null) { if (delta > 0) setVal(sel.doctorId, "target", 0.5); return; }
      const next = cur + delta * 0.5;
      setVal(sel.doctorId, "target", next <= 0 ? null : next);
    } else {
      const next = (cur ?? 0) + delta * 0.5;
      if (next >= 0) setVal(sel.doctorId, sel.field, next);
    }
  };

  const handleReset = () => {
    if (!sel || isGlobalSel) return;
    core.resetDoctorScores(sel.doctorId);
  };

  const handleCellTap = (doctorId: string, field: ScoreField) => {
    if (sel?.doctorId === doctorId && sel?.field === field) {
      setSel(null);
    } else {
      setSel({ doctorId, field });
    }
  };

  const selVal = sel
    ? isGlobalSel
      ? (sel.field === "min" ? core.scoreMin : sel.field === "max" ? core.scoreMax : globalTarget)
      : getVal(sel.doctorId, sel.field)
    : null;
  const selDoctor = sel && !isGlobalSel ? core.activeDoctors.find((d) => d.id === sel.doctorId) : null;
  const selLabel = isGlobalSel ? "既定値" : selDoctor?.name ?? "";
  const fieldLabel = sel?.field === "min" ? "下限" : sel?.field === "target" ? "目標" : "上限";
  const selIsDefault = sel ? (isGlobalSel || isDefaultDoctor(sel.doctorId)) : true;

  const cellCn = (doctorId: string, field: ScoreField) => {
    const active = sel?.doctorId === doctorId && sel?.field === field;
    if (active) return "rounded-md bg-blue-600 text-white font-bold";
    const isDef = isDefaultField(doctorId, field);
    if (isDef) return "text-gray-400";
    if (field === "target") return "rounded-md bg-blue-100 font-bold text-blue-800";
    return "font-bold text-gray-800";
  };

  const fmtVal = (doctorId: string, field: ScoreField): string => {
    const v = getVal(doctorId, field);
    return v != null ? String(v) : "--";
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 backdrop-blur-sm sm:items-center sm:py-6">
      <div className="flex max-h-[90dvh] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl animate-slide-up sm:animate-none">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b bg-orange-50 px-4 py-3">
          <h3 className="text-base font-bold text-gray-900">スコア設定</h3>
          <div className="flex items-center gap-1.5">
            {onShowGuide && (
              <button type="button" onClick={onShowGuide} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">?</button>
            )}
            <button type="button" onClick={() => { void core.saveAllDoctorsSettings(); }} disabled={core.isBulkSavingDoctors} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
              {core.isBulkSavingDoctors ? "保存中..." : "保存"}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* リスト */}
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 border-b bg-gray-50 px-4">
            {/* ラベル行 */}
            <div className="grid grid-cols-[0.5fr_2.5rem_0.5fr_0.5fr_0.5fr] items-center py-1.5">
              <div className="text-[10px] font-bold text-gray-500 text-center">医師</div>
              <div />
              <div className="text-[10px] font-bold text-gray-500 text-center">下限</div>
              <div className="text-[10px] font-bold text-blue-600 text-center">目標</div>
              <div className="text-[10px] font-bold text-gray-500 text-center">上限</div>
            </div>
            {/* 既定値行 */}
            <div className="grid grid-cols-[0.5fr_2.5rem_0.5fr_0.5fr_0.5fr] items-center border-t border-gray-200 py-1.5">
              <div className="text-[11px] font-bold text-orange-600 text-center">既定値</div>
              <div />
              {(["min", "target", "max"] as ScoreField[]).map((f) => {
                const active = isGlobalSel && sel?.field === f;
                const val = f === "min" ? core.scoreMin : f === "max" ? core.scoreMax : globalTarget;
                return (
                  <button key={f} type="button" onClick={() => handleCellTap("__default__", f)}
                    className={`py-1 text-center text-[13px] font-bold transition-colors ${
                      active ? "rounded-md bg-blue-600 text-white" : "text-orange-600 hover:bg-orange-50"
                    }`}
                  >
                    {val != null ? val : "--"}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="divide-y">
            {core.activeDoctors.map((doctor) => (
                <div key={doctor.id} className="grid grid-cols-[0.5fr_2.5rem_0.5fr_0.5fr_0.5fr] items-center px-4 py-2">
                  <div className="truncate text-[13px] font-bold text-gray-800 text-center">{doctor.name}</div>
                  {isDefaultDoctor(doctor.id) ? (
                    <div className="-ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[13px] font-bold text-gray-400 text-center">既定</div>
                  ) : (
                    <button type="button" onClick={() => core.resetDoctorScores(doctor.id)}
                      className="-ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[13px] font-bold text-orange-600 text-center active:bg-orange-200 transition-colors">
                      戻す
                    </button>
                  )}
                  {(["min", "target", "max"] as ScoreField[]).map((f) => (
                    <button key={f} type="button" onClick={() => handleCellTap(doctor.id, f)}
                      className={`py-1 text-center text-[13px] transition-colors ${cellCn(doctor.id, f)}`}
                    >
                      {fmtVal(doctor.id, f)}
                    </button>
                  ))}
                </div>
            ))}
          </div>
          {core.activeDoctors.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">医師が登録されていません</div>
          )}
        </div>

        {/* 固定 ±バー */}
        <div className="border-t bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => handleStep(-1)} disabled={!sel}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-gray-300 text-lg font-bold text-gray-700 active:bg-gray-200 transition disabled:opacity-30">−</button>
              <div className="text-center min-w-[5rem]">
                {sel ? (<>
                  <div className="text-[11px] text-gray-500 font-bold">{selLabel} — {fieldLabel}</div>
                  <div className="text-xl font-bold text-gray-900">{selVal != null ? selVal : "--"}</div>
                </>) : (
                  <div className="text-xs text-gray-400">タップで選択</div>
                )}
              </div>
              <button type="button" onClick={() => handleStep(1)} disabled={!sel}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-gray-300 text-lg font-bold text-gray-700 active:bg-gray-200 transition disabled:opacity-30">+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineScoreSetting({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="text-[11px] text-gray-400 mb-1">{label}</div>
      <StepperNumberInput
        value={value} onCommit={onChange} fallbackValue={value}
        min={0.1} max={2.0} step={0.1} inputMode="decimal"
        inputClassName="text-sm font-bold !py-1 !px-1"
        buttonClassName="!h-7 !w-7 text-sm"
        className="max-w-[140px]"
      />
    </div>
  );
}
