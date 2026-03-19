// src/app/app/page.tsx — 初心者向けメイン画面
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Settings, ChevronRight, X, ClipboardCheck } from "lucide-react";
import OnboardingModal from "../components/OnboardingModal";
import MobileScheduleBoard from "../components/MobileScheduleBoard";
import SetupWizard from "../components/SetupWizard";
import { DoctorSettingsPanel } from "../components/SettingsPanel";
import RulesConfig from "../components/settings/RulesConfig";
import WeightsConfig from "../components/settings/WeightsConfig";
import DoctorManageDrawer from "../components/settings/DoctorManageDrawer";
import HolidaySettingsDrawer from "../components/settings/HolidaySettingsDrawer";
import UnavailableDaysInput from "../components/settings/UnavailableDaysInput";
import PreviousMonthShiftsConfig from "../components/settings/PreviousMonthShiftsConfig";
import ShiftScoresConfig from "../components/settings/ShiftScoresConfig";
import SettingsModalPortal from "../components/settings/SettingsModalPortal";
import { DEFAULT_SHIFT_SCORES } from "../types/dashboard";
import { getAuthHeaders } from "../hooks/useAuth";
import { useOnboarding } from "../hooks/useOnboarding";
import { useOnCallCore } from "../hooks/useOnCallCore";

type SettingsDrawer = "shift-scores" | "rules" | "weights" | "doctor-manage" | "doctor-scores" | "doctors" | "holidays" | "previous" | "other" | null;

export default function AppPage() {
  const core = useOnCallCore();
  const router = useRouter();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<SettingsDrawer>(null);
  const [setupStatus, setSetupStatus] = useState<"loading" | "needed" | "done">("loading");
  const [isSetupRedo, setIsSetupRedo] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "confirmed">("edit");
  const [confirmedSchedule, setConfirmedSchedule] = useState<Array<{ day: number; day_shift: string | null; night_shift: string | null }>>([]);
  const [isLoadingConfirmed, setIsLoadingConfirmed] = useState(false);
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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    fetch(`${apiUrl}/api/settings/kv/setup_completed`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data: unknown) => {
        const value = (data as Record<string, unknown>)?.value;
        setSetupStatus(value ? "done" : "needed");
      })
      .catch(() => setSetupStatus("done")); // on error, skip wizard
  }, [core.auth.isAuthenticated]);

  const handleWizardComplete = useCallback((options?: { openDoctorManage?: boolean; openUnavailable?: boolean }) => {
    setSetupStatus("done");
    if (options?.openDoctorManage) {
      sessionStorage.setItem("open_doctor_manage", "1");
    }
    if (options?.openUnavailable) {
      sessionStorage.setItem("open_unavailable", "1");
    }
    // Reload to re-fetch doctors and settings created by wizard
    window.location.reload();
  }, []);

  // ウィザード完了後にドロワーを自動で開く
  useEffect(() => {
    if (sessionStorage.getItem("open_unavailable")) {
      sessionStorage.removeItem("open_unavailable");
      setActiveDrawer("doctors");
    } else if (sessionStorage.getItem("open_doctor_manage")) {
      sessionStorage.removeItem("open_doctor_manage");
      setActiveDrawer("doctor-manage");
    }
  }, []);

  const hasSchedule = core.schedule.length > 0;

  // ── 確定シフト読み込み ──
  const loadConfirmedSchedule = useCallback(async () => {
    setIsLoadingConfirmed(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/schedule/${core.year}/${core.month}`, { headers: getAuthHeaders() });
      if (!res.ok) { setConfirmedSchedule([]); return; }
      const data = (await res.json()) as Array<{ day: number; day_shift: string | null; night_shift: string | null }>;
      setConfirmedSchedule(data.filter((r) => r.day_shift || r.night_shift));
    } catch {
      setConfirmedSchedule([]);
    } finally {
      setIsLoadingConfirmed(false);
    }
  }, [core.year, core.month]);

  const handleShowConfirmed = useCallback(() => {
    setViewMode("confirmed");
    void loadConfirmedSchedule();
  }, [loadConfirmedSchedule]);

  const handleCopyToEditMode = useCallback(async () => {
    await core.handleCopyConfirmedToDraft();
    setViewMode("edit");
  }, [core.handleCopyConfirmedToDraft]);

  // Trigger onboarding when schedule first appears
  useEffect(() => {
    if (hasSchedule && !prevHadSchedule.current) {
      onboarding.triggerOnboarding("generate");
    }
    prevHadSchedule.current = hasSchedule;
  }, [hasSchedule, onboarding.triggerOnboarding]);

  // Trigger dnd onboarding after generate onboarding is dismissed
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

  const openDrawer = (drawer: SettingsDrawer, fromSettings = false) => {
    setActiveDrawer(drawer);
    if (!fromSettings) setIsSettingsOpen(false);
    if (drawer === "shift-scores") onboarding.triggerOnboarding("shift-scores");
    if (drawer === "rules") onboarding.triggerOnboarding("rules");
    if (drawer === "weights") onboarding.triggerOnboarding("weights");
    if (drawer === "doctor-manage") onboarding.triggerOnboarding("doctor-manage");
    if (drawer === "doctors") onboarding.triggerOnboarding("doctors");
    if (drawer === "doctor-scores") onboarding.triggerOnboarding("doctor-scores");
    if (drawer === "holidays") onboarding.triggerOnboarding("holidays");
    if (drawer === "previous") onboarding.triggerOnboarding("previous");
  };
  const closeDrawer = () => setActiveDrawer(null);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* ── ヘッダー ── */}
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-extrabold text-gray-800">シフらく</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setIsSettingsOpen(true); setActiveDrawer(null); }}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Settings className="h-4 w-4" />
              設定
            </button>
            <button
              onClick={handleShowConfirmed}
              className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                viewMode === "confirmed"
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <ClipboardCheck className="h-4 w-4" />
              確定シフト
            </button>
            <button
              onClick={() => { if (core.confirmMoveWithUnsavedChanges()) router.push("/dashboard"); }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              一覧モード
            </button>
            <span className="hidden text-sm text-gray-400 sm:inline">{core.auth.hospitalName}</span>
            <button
              onClick={() => { if (core.confirmMoveWithUnsavedChanges()) core.logout(); }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* ── メインコンテンツ ── */}
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        {viewMode === "confirmed" ? (
          /* ── 確定シフト表示 ── */
          <ConfirmedScheduleView
            year={core.year}
            month={core.month}
            schedule={confirmedSchedule}
            isLoading={isLoadingConfirmed}
            doctors={core.activeDoctors}
            isHolidayLikeDay={core.isHolidayLikeDay}
            onBack={() => setViewMode("edit")}
            onCopyToDraft={() => { void handleCopyToEditMode(); }}
            isDraftSaving={core.isDraftSaving}
          />
        ) : !hasSchedule && !core.isLoading ? (
          /* ── 生成前：ステップガイド ── */
          <SetupGuide core={core} onOpenDrawer={(drawer) => openDrawer(drawer)} />
        ) : (
          /* ── 生成後：スケジュール表（モバイル専用） ── */
          <div className="relative">
            {core.isLoading && (
              <div className="fixed inset-x-0 top-[57px] bottom-0 z-30 flex items-center justify-center bg-white/70 p-4 backdrop-blur-[1px]">
                <div className="w-full max-w-md rounded-2xl border border-blue-100 bg-white px-4 py-6 shadow-xl">
                  <div className="flex flex-col items-center text-center">
                    <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-600" />
                    <div className="text-base font-bold text-gray-800">当直表を自動生成しています</div>
                    <div className="mt-2 text-sm text-gray-500">完了までそのままお待ちください。</div>
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <MobileScheduleBoard core={core} onOpenSettings={() => { setIsSettingsOpen(true); setActiveDrawer(null); }} onShowGuide={() => onboarding.showGuide("dnd")} />
          </div>
        )}
      </main>

      {/* ── 設定フルスクリーンモーダル ── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
            <h2 className="text-lg font-bold text-gray-800">設定</h2>
            <button
              onClick={() => { setIsSettingsOpen(false); setActiveDrawer(null); }}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mx-auto max-w-lg divide-y">
            <SettingsMenuItem
              emoji="🎯"
              title="シフトスコア"
              subtitle="シフト種別ごとの負担度"
              onClick={() => openDrawer("shift-scores", true)}
            />
            <SettingsMenuItem
              emoji="📋"
              title="基本ルール"
              subtitle="当直間隔・上限回数など"
              onClick={() => openDrawer("rules", true)}
            />
            <SettingsMenuItem
              emoji="⚖️"
              title="優先度の調整"
              subtitle="できれば守りたいルールの強さ"
              onClick={() => openDrawer("weights", true)}
            />
            <SettingsMenuItem
              emoji="👨‍⚕️"
              title="医師の管理"
              subtitle="追加・名前変更・削除"
              onClick={() => openDrawer("doctor-manage", true)}
            />
            <SettingsMenuItem
              emoji="📊"
              title="スコア設定"
              subtitle="医師ごとの目標・上限・下限"
              onClick={() => openDrawer("doctor-scores", true)}
            />
            <SettingsMenuItem
              emoji="🚫"
              title="不可日設定"
              subtitle="医師ごとの不可日カレンダー"
              onClick={() => openDrawer("doctors", true)}
            />
            <SettingsMenuItem
              emoji="📅"
              title="祝日・休日設定"
              subtitle="カレンダーで休日を追加・変更"
              onClick={() => openDrawer("holidays", true)}
            />
            <SettingsMenuItem
              emoji="🗓️"
              title="前月の勤務実績"
              subtitle="先月末の当直データ入力"
              onClick={() => openDrawer("previous", true)}
            />
            <SettingsMenuItem
              emoji="⚙️"
              title="その他"
              subtitle="日当直モード・初期画面設定"
              onClick={() => openDrawer("other", true)}
            />

            <div className="px-6 py-4 space-y-2">
              <button
                onClick={() => {
                  // setup_completed をリセットして初期設定ウィザードを再表示
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
                  void fetch(`${apiUrl}/api/settings/kv/setup_completed`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                    body: JSON.stringify({ value: false }),
                  }).then(() => {
                    setIsSetupRedo(true);
                    setSetupStatus("needed");
                    setIsSettingsOpen(false);
                  });
                }}
                className="w-full rounded-lg border border-gray-200 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                初期設定からやり直す
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 医師管理ドロワー ── */}
      <DoctorManageDrawer
        isOpen={activeDrawer === "doctor-manage"}
        onClose={closeDrawer}
        onDoctorsChanged={() => { void core.refetchDoctors(); }}
        onShowGuide={() => onboarding.showGuide("doctor-manage")}
      />

      {/* ── シフトスコア設定ドロワー ── */}
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

      {/* ── 各設定ドロワー ── */}
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
        onWeightChange={core.setWeight}
        onShowGuide={() => onboarding.showGuide("weights")}
      />

      <SettingsModalPortal isOpen={activeDrawer === "doctors"}>
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
          <div className="flex max-h-[85dvh] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl sm:max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-4 py-4 sm:px-5">
              <h3 className="text-base font-bold text-gray-900">不可日設定</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onboarding.showGuide("doctors")} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">?</button>
                <button
                  type="button"
                  onClick={() => { void core.saveAllDoctorsSettings(); }}
                  disabled={core.isBulkSavingDoctors}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
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

      {/* ── スコア設定ドロワー ── */}
      <SettingsModalPortal isOpen={activeDrawer === "doctor-scores"}>
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
          <div className="flex max-h-[85dvh] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-2xl sm:max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-orange-100 bg-orange-50 px-4 py-4 sm:px-5">
              <h3 className="text-base font-bold text-gray-900">スコア設定</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onboarding.showGuide("doctor-scores")} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">?</button>
                <button
                  type="button"
                  onClick={() => { void core.saveAllDoctorsSettings(); }}
                  disabled={core.isBulkSavingDoctors}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {core.isBulkSavingDoctors ? "保存中..." : "保存"}
                </button>
                <button type="button" onClick={closeDrawer} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50">閉じる</button>
              </div>
            </div>
            <div className="overflow-y-auto p-4 sm:p-5">
              <DoctorSettingsPanel
                isBulkSavingDoctors={core.isBulkSavingDoctors}
                activeDoctors={core.activeDoctors}
                minScoreMap={core.minScoreMap}
                maxScoreMap={core.maxScoreMap}
                targetScoreMap={core.targetScoreMap}
                scoreMin={core.scoreMin}
                scoreMax={core.scoreMax}
                onSaveAllDoctorsSettings={() => { void core.saveAllDoctorsSettings(); }}
                onMinScoreChange={core.handleMinScoreChange}
                onMaxScoreChange={core.handleMaxScoreChange}
                onTargetScoreChange={core.handleTargetScoreChange}
                hideSaveButton
              />
            </div>
          </div>
        </div>
      </SettingsModalPortal>

      {/* ── 祝日・休日設定ドロワー ── */}
      <HolidaySettingsDrawer
        isOpen={activeDrawer === "holidays"}
        onClose={closeDrawer}
        year={core.year}
        month={core.month}
        daysInMonth={core.daysInMonth}
        holidayWorkdayOverrides={core.holidayWorkdayOverrides}
        isHolidayLikeDay={core.isHolidayLikeDay}
        onToggleHoliday={core.toggleHoliday}
        onToggleHolidayOverride={core.handleHolidayOverrideToggle}
        onSaveCustomHolidays={() => { void core.saveCustomHolidays(); }}
        isLoadingCustom={core.isLoadingCustom}
        isSavingCustom={core.isSavingCustom}
        customError={core.customError}
        customSaveMessage={core.customSaveMessage}
        hasUnsavedCustomChanges={core.hasUnsavedCustomChanges}
        onShowGuide={() => onboarding.showGuide("holidays")}
      />

      <PreviousMonthShiftsConfig
        isOpen={activeDrawer === "previous"}
        year={core.year}
        month={core.month}
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

      {/* ── その他設定ドロワー ── */}
      <SettingsModalPortal isOpen={activeDrawer === "other"}>
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
          <div className="flex max-h-[85dvh] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:max-h-[90vh]">
            <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-4 sm:px-5">
              <h3 className="text-base font-bold text-gray-900">その他</h3>
              <button type="button" onClick={closeDrawer} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50">閉じる</button>
            </div>
            <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
              <DefaultPageSetting />
            </div>
          </div>
        </div>
      </SettingsModalPortal>

      {/* ── オンボーディング ── */}
      <OnboardingModal section={onboarding.pendingSection} onDismiss={onboarding.dismissOnboarding} />
    </div>
  );
}

/* ── 設定メニュー項目 ── */
function SettingsMenuItem({ emoji, title, subtitle, onClick }: {
  emoji: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 px-6 py-5 text-left hover:bg-gray-50 transition-colors"
    >
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold text-gray-800">{title}</div>
        <div className="text-sm text-gray-500">{subtitle}</div>
      </div>
      <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
    </button>
  );
}

/* ── 生成前ステップガイド ── */
function SetupGuide({ core, onOpenDrawer }: {
  core: ReturnType<typeof useOnCallCore>;
  onOpenDrawer: (drawer: SettingsDrawer) => void;
}) {
  const doctorCount = core.numDoctors;
  const hasBasicSettings = core.hardConstraints.interval_days >= 1;
  const hasDoctors = doctorCount > 0;

  // 不可日が設定されている医師の数
  const unavailableDoctorCount = core.activeDoctors.filter(
    (d) => (core.unavailableMap[d.id]?.length ?? 0) > 0
  ).length;
  const hasUnavailableDays = unavailableDoctorCount > 0;

  return (
    <div className="mx-auto max-w-lg py-8">
      <h2 className="text-center text-xl font-bold text-gray-800 mb-2">
        {core.year}年{core.month}月のシフトを作成
      </h2>
      <p className="text-center text-sm text-gray-500 mb-8">
        設定を確認して、生成ボタンを押してください
      </p>

      <div className="space-y-3 mb-8">
        <StepItem
          done={hasBasicSettings}
          title="基本ルール"
          description={hasBasicSettings ? `当直間隔 ${core.hardConstraints.interval_days}日` : "未設定"}
          onAction={() => onOpenDrawer("rules")}
        />
        <StepItem
          done={hasDoctors}
          title="医師の管理"
          description={hasDoctors ? `${doctorCount}名 登録済み` : "未登録"}
          onAction={() => onOpenDrawer("doctor-manage")}
        />
        <StepItem
          done={hasUnavailableDays}
          title="不可日設定"
          description={
            hasUnavailableDays
              ? `${unavailableDoctorCount}/${doctorCount}名 入力済み`
              : "未設定（スキップ可）"
          }
          onAction={() => onOpenDrawer("doctors")}
          optional
        />
      </div>

      {/* 年月セレクタ */}
      <div className="mb-6 flex items-center justify-center gap-3">
        <select
          value={core.year}
          onChange={(e) => core.handleYearChange(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {[core.year - 1, core.year, core.year + 1].map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
        <select
          value={core.month}
          onChange={(e) => core.handleMonthChange(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m}月</option>
          ))}
        </select>
      </div>

      <button
        onClick={core.handleGenerateWithGuard}
        disabled={!hasDoctors || core.isLoading}
        className="w-full rounded-xl bg-blue-600 py-4 text-base font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {core.isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            生成中...
          </span>
        ) : (
          `${core.year}年${core.month}月のシフトを生成する`
        )}
      </button>
    </div>
  );
}

/* ── ステップ項目 ── */
function StepItem({ done, title, description, onAction, optional = false }: {
  done: boolean;
  title: string;
  description: string;
  onAction: () => void;
  optional?: boolean;
}) {
  return (
    <button
      onClick={onAction}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
    >
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        done ? "bg-green-100 text-green-600" : optional ? "bg-gray-100 text-gray-400" : "bg-yellow-100 text-yellow-600"
      }`}>
        {done ? "✓" : optional ? "−" : "!"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-gray-800">{title}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
    </button>
  );
}

/* ── 確定シフトビュー ── */
function ConfirmedScheduleView({ year, month, schedule, isLoading, doctors, isHolidayLikeDay, onBack, onCopyToDraft, isDraftSaving }: {
  year: number;
  month: number;
  schedule: Array<{ day: number; day_shift: string | null; night_shift: string | null }>;
  isLoading: boolean;
  doctors: Array<{ id: string; name: string }>;
  isHolidayLikeDay: (day: number) => { isSun: boolean; isHolidayLike: boolean };
  onBack: () => void;
  onCopyToDraft: () => void;
  isDraftSaving: boolean;
}) {
  const doctorMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of doctors) m[d.id] = d.name;
    return m;
  }, [doctors]);

  const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
  const getWeekday = (day: number) => new Date(year, month - 1, day).getDay();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (schedule.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <div className="mb-4 text-5xl">📋</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">{year}年{month}月の確定シフトはありません</h2>
        <p className="text-sm text-gray-500 mb-6">シフトを生成・保存すると、ここに表示されます。</p>
        <button onClick={onBack} className="rounded-xl border border-gray-300 px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
          編集に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-800">
          {year}年{month}月 確定シフト
        </h2>
        <button onClick={onBack} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
          編集に戻る
        </button>
      </div>

      {/* テーブル */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-3 py-2.5 text-left font-medium">日付</th>
              <th className="px-3 py-2.5 text-center font-medium">日直</th>
              <th className="px-3 py-2.5 text-center font-medium">当直</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schedule.map((row) => {
              const wd = getWeekday(row.day);
              const dayInfo = isHolidayLikeDay(row.day);
              const isSat = wd === 6;
              const isSun = wd === 0;
              const showDayShift = dayInfo.isHolidayLike || isSat;
              return (
                <tr key={row.day} className={dayInfo.isHolidayLike || isSun ? "bg-red-50/40" : isSat ? "bg-blue-50/40" : ""}>
                  <td className={`px-3 py-2.5 font-medium ${isSun || dayInfo.isHolidayLike ? "text-red-600" : isSat ? "text-blue-600" : "text-gray-800"}`}>
                    {row.day}({WEEKDAY_LABELS[wd]})
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-700">
                    {showDayShift ? (row.day_shift ? doctorMap[row.day_shift] || "−" : "−") : ""}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-700">
                    {row.night_shift ? doctorMap[row.night_shift] || "−" : "−"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 仮保存にコピーボタン */}
      <div className="mt-6 space-y-3">
        <button
          onClick={onCopyToDraft}
          disabled={isDraftSaving}
          className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isDraftSaving ? "コピー中..." : "仮保存にコピーして編集する"}
        </button>
        <p className="text-center text-xs text-gray-400">
          確定シフトを仮保存にコピーし、編集モードで調整できます
        </p>
      </div>
    </div>
  );
}

/* ── 初期画面設定 ── */
function DefaultPageSetting() {
  const [defaultPage, setDefaultPage] = useState<"/app" | "/dashboard">("/app");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    fetch(`${apiUrl}/api/settings/kv/default_page`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data: unknown) => {
        const value = (data as Record<string, unknown>)?.value;
        if (value === "/dashboard") setDefaultPage("/dashboard");
      })
      .catch(() => {});
  }, []);

  const handleToggle = async (page: "/app" | "/dashboard") => {
    setDefaultPage(page);
    setIsSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      await fetch(`${apiUrl}/api/settings/kv/default_page`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ value: page }),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h4 className="text-sm font-bold text-gray-800 mb-2">ログイン後の初期画面</h4>
      <p className="text-xs text-gray-500 mb-3">ログイン後に表示される画面を選択できます。</p>
      <div className="flex gap-2">
        <button
          onClick={() => { void handleToggle("/app"); }}
          disabled={isSaving}
          className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-bold transition-colors ${
            defaultPage === "/app"
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-gray-200 text-gray-600 hover:border-blue-200"
          }`}
        >
          かんたんモード
        </button>
        <button
          onClick={() => { void handleToggle("/dashboard"); }}
          disabled={isSaving}
          className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-bold transition-colors ${
            defaultPage === "/dashboard"
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-gray-200 text-gray-600 hover:border-blue-200"
          }`}
        >
          一覧モード
        </button>
      </div>
    </div>
  );
}
