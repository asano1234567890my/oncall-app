// src/app/dashboard/page.tsx — 管理者ダッシュボード
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Settings, X } from "lucide-react";
import AppHeader from "../components/AppHeader";
import { GenerationSettingsPanel, DoctorSettingsPanel } from "../components/SettingsPanel";
import ScheduleBoard from "../components/ScheduleBoard";
import ShiftScoresConfig from "../components/settings/ShiftScoresConfig";
import PasswordChangeForm from "../components/settings/PasswordChangeForm";
import DefaultPageSetting from "../components/settings/DefaultPageSetting";
import { DEFAULT_SHIFT_SCORES } from "../types/dashboard";
import { useOnCallCore } from "../hooks/useOnCallCore";

export default function DashboardPage() {
  const core = useOnCallCore();
  const router = useRouter();

  // ── シフトスコア設定 ──
  const [isShiftScoresOpen, setIsShiftScoresOpen] = useState(false);
  const [isLoadingConfirmed, setIsLoadingConfirmed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleLoadConfirmedForEdit = async () => {
    setIsLoadingConfirmed(true);
    try {
      await core.handleCopyConfirmedToDraft();
    } finally {
      setIsLoadingConfirmed(false);
    }
  };

  // ── 認証ガード ──
  useEffect(() => {
    if (!core.isAuthLoading && !core.auth.isAuthenticated) {
      router.push("/login");
    }
  }, [core.auth.isAuthenticated, core.isAuthLoading, router]);

  if (core.isAuthLoading || !core.auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <AppHeader
        hospitalName={core.auth.hospitalName}
        onLogout={core.logout}
        rightExtra={
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            設定
          </button>
        }
      />
      <main className="mx-auto w-full max-w-7xl p-3 md:p-6 xl:p-8">

        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(340px,0.98fr)_minmax(0,1.32fr)] lg:items-start md:mb-6">
          <GenerationSettingsPanel
            isLoading={core.isLoading}
            isLoadingCustom={core.isLoadingCustom}
            customError={core.customError}
            isSavingCustom={core.isSavingCustom}
            customSaveMessage={core.customSaveMessage}
            hasUnsavedCustomChanges={core.hasUnsavedCustomChanges}
            scoreMin={core.scoreMin}
            scoreMax={core.scoreMax}
            objectiveWeights={core.objectiveWeights}
            hardConstraints={core.hardConstraints}
            weightChanges={core.weightChanges}
            isWeightsOpen={core.isWeightsOpen}
            isHardConstraintsOpen={core.isHardConstraintsOpen}
            year={core.year}
            month={core.month}
            doctorUnavailableMonth={core.doctorUnavailableMonth}
            numDoctors={core.numDoctors}
            activeDoctors={core.activeDoctors}
            holidayWorkdayOverrides={core.holidayWorkdayOverrides}
            daysInMonth={core.daysInMonth}
            selectedDoctorId={core.selectedDoctorId}
            unavailableMap={core.unavailableMap}
            fixedUnavailableWeekdaysMap={core.fixedUnavailableWeekdaysMap}
            pyWeekdays={core.pyWeekdays}
            pyWeekdaysJp={core.pyWeekdaysJp}
            prevMonthLastDay={core.prevMonthLastDay}
            prevMonthTailDays={core.prevMonthTailDays}
            getPreviousMonthShiftDoctorId={core.getPreviousMonthShiftDoctorId}
            onScoreMinChange={core.setScoreMin}
            onScoreMaxChange={core.setScoreMax}
            isSavingOptimizerConfig={core.isSavingOptimizerConfig}
            optimizerSaveMessage={core.optimizerSaveMessage}
            onSaveOptimizerConfig={() => { void core.saveOptimizerConfig(); }}
            onToggleShiftScores={() => setIsShiftScoresOpen(true)}
            onToggleWeights={core.handleToggleWeightsPanel}
            onResetWeights={() => core.setObjectiveWeights(core.DEFAULT_OBJECTIVE_WEIGHTS)}
            onCloseWeights={() => core.setIsWeightsOpen(false)}
            onToggleHardConstraints={core.handleToggleHardConstraintsPanel}
            onResetHardConstraints={() => core.setHardConstraints(core.DEFAULT_HARD_CONSTRAINTS)}
            onCloseHardConstraints={() => core.setIsHardConstraintsOpen(false)}
            isPreviousMonthShiftsOpen={core.isPreviousMonthShiftsOpen}
            onTogglePreviousMonthShifts={core.handleTogglePreviousMonthShiftsPanel}
            onClosePreviousMonthShifts={() => core.setIsPreviousMonthShiftsOpen(false)}
            onWeightChange={core.setWeight}
            onHardConstraintChange={core.handleHardConstraintChange}
            onYearChange={core.handleYearChange}
            onMonthChange={core.handleMonthChange}
            isHolidayLikeDay={core.isHolidayLikeDay}
            onToggleHoliday={core.toggleHoliday}
            onToggleHolidayOverride={core.handleHolidayOverrideToggle}
            onSaveCustomHolidays={() => { void core.saveCustomHolidays(); }}
            onSelectedDoctorChange={core.setSelectedDoctorId}
            onDoctorUnavailableMonthChange={core.setDoctorUnavailableMonth}
            onToggleAllUnavailable={core.toggleAllUnavailable}
            onToggleUnavailable={core.toggleUnavailable}
            onToggleFixedWeekday={core.toggleFixedWeekday}
            onPrevMonthLastDayChange={core.handlePrevMonthLastDayChange}
            onSetPreviousMonthShift={core.setPreviousMonthShift}
            onSaveAllDoctorsSettings={() => { void core.saveAllDoctorsSettings(); }}
            isBulkSavingDoctors={core.isBulkSavingDoctors}
          />

          <div className="relative min-w-0">
            {core.isLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-white/70 p-4 backdrop-blur-[1px]">
                <div className="w-full max-w-md rounded-2xl border border-blue-100 bg-white px-4 py-6 shadow-xl md:px-6">
                  <div className="flex flex-col items-center text-center">
                    <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-600" />
                    <div className="text-base font-bold text-gray-800 md:text-lg">当直表を自動生成しています</div>
                    <div className="mt-2 text-sm text-gray-500">未確定の枠を計算中です。完了までそのままお待ちください。</div>
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DoctorSettingsPanel
              isBulkSavingDoctors={core.isBulkSavingDoctors}
              activeDoctors={core.activeDoctors}
              minScoreMap={core.minScoreMap}
              maxScoreMap={core.maxScoreMap}
              targetScoreMap={core.targetScoreMap}
              scoreMin={core.scoreMin}
              scoreMax={core.scoreMax}
              onSaveAllDoctorsSettings={core.saveAllDoctorsSettings}
              onMinScoreChange={core.handleMinScoreChange}
              onMaxScoreChange={core.handleMaxScoreChange}
              onTargetScoreChange={core.handleTargetScoreChange}
            />

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={core.handleGenerateWithGuard}
                disabled={core.isLoading || core.activeDoctors.length === 0 || core.isOverrideMode}
                className={`w-full rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg transition ${
                  core.isLoading || core.activeDoctors.length === 0 || core.isOverrideMode ? "cursor-not-allowed bg-gray-400" : "bg-blue-700 hover:bg-blue-800"
                }`}
              >
                {core.isLoading ? "生成中..." : core.activeDoctors.length === 0 ? "有効な医師がいません" : core.isOverrideMode ? "強制配置モード中は生成できません" : "上記設定で当直表を自動生成"}
              </button>
              <button
                type="button"
                onClick={handleLoadConfirmedForEdit}
                disabled={core.isLoading || isLoadingConfirmed}
                className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-sm font-bold text-gray-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoadingConfirmed ? "読み込み中..." : "確定済みシフトを修正する"}
              </button>
            </div>

            <ScheduleBoard
              isLoading={core.isLoading}
              toastMessage={core.toastMessage}
              hoverErrorMessage={core.hoverErrorMessage}
              dragSourceType={core.dragSourceType}
              error={core.error}
              schedule={core.schedule}
              scheduleColumns={core.scheduleColumns}
              scoreEntries={core.scoreEntries}
              getDoctorName={core.getDoctorName}
              highlightedDoctorId={core.highlightedDoctorId}
              selectedManualDoctorId={core.selectedManualDoctorId}
              isEraseSelectionActive={core.isEraseSelectionActive}
              year={core.year}
              month={core.month}
              holidaySet={core.holidaySet}
              manualHolidaySetInMonth={core.manualHolidaySetInMonth}
              toYmd={core.toYmd}
              getWeekday={core.getWeekday}
              isHighlightedDoctorBlockedDay={core.isHighlightedDoctorBlockedDay}
              isHighlightedDoctorBlockedShift={core.isHighlightedDoctorBlockedShift}
              isShiftLocked={core.isShiftLocked}
              invalidHoverShiftKey={core.invalidHoverShiftKey}
              touchHoverShiftKey={core.touchHoverShiftKey}
              isSwapMode={core.isSwapMode}
              swapSource={core.swapSource}
              isSwapSourceSelected={core.isSwapSourceSelected}
              getSwapViolation={core.getSwapViolation}
              onHandleShiftDragOver={core.handleShiftDragOver}
              onHandleShiftDragLeave={core.handleShiftDragLeave}
              onHandleShiftDrop={core.handleShiftDrop}
              onHandleDisabledDayDragOver={core.handleDisabledDayDragOver}
              onHandleDisabledDayDragLeave={core.handleDisabledDayDragLeave}
              onShiftDragStart={core.handleShiftDragStart}
              onDoctorListDragStart={core.handleDoctorListDragStart}
              onShiftTouchStart={core.handleShiftTouchStart}
              onDoctorListTouchStart={core.handleDoctorListTouchStart}
              onTouchDragMove={core.handleTouchDragMove}
              onTouchDragEnd={core.handleTouchDragEnd}
              onTouchDragCancel={core.handleTouchDragCancel}
              onShiftTap={core.handleShiftTap}
              onSwapButtonPress={core.handleSwapButtonPress}
              onCancelSwapSelection={core.cancelSwapSelection}
              onToggleHighlightedDoctor={core.toggleHighlightedDoctor}
              onSelectManualDoctor={core.selectManualDoctor}
              onToggleEraseSelection={core.toggleEraseSelection}
              onClearDragState={core.clearDragState}
              onToggleShiftLock={core.toggleShiftLock}
              onToggleSwapMode={core.toggleSwapMode}
              onLockAll={core.handleLockAll}
              onUnlockAll={core.handleUnlockAll}
              onUndo={core.undo}
              onRedo={core.redo}
              canUndo={core.canUndo}
              canRedo={core.canRedo}
              onRegenerateUnlocked={core.handleGenerateWithGuard}
              onTrashDragOver={core.handleTrashDragOver}
              onTrashDrop={core.handleTrashDrop}
              lockedShiftCount={core.lockedShiftKeys.size}
              onDeleteMonthSchedule={core.handleDeleteMonthSchedule}
              isDeletingMonthSchedule={core.isDeletingMonthSchedule}
              onSaveToDB={core.handleSaveWithValidation}
              isSaving={core.isSaving}
              isOverrideMode={core.isOverrideMode}
              onToggleOverrideMode={core.handleToggleOverrideMode}
              saveValidationMessages={core.saveValidationMessages}
              onDismissSaveValidation={core.handleDismissSaveValidation}
              onForceSaveToDB={core.handleForceSaveToDB}
              saveMessage={core.saveMessage}
              isDraftSaving={core.isDraftSaving}
              isDraftLoading={core.isDraftLoading}
              draftSavedAt={core.draftSavedAt}
              draftMessage={core.draftMessage}
              onSaveDraft={() => { void core.handleSaveDraft(); }}
              onLoadDraft={() => { void core.handleLoadDraft(); }}
            />
          </div>
        </div>
      </main>

      {/* ── シフトスコア設定 ── */}
      <ShiftScoresConfig
        isOpen={isShiftScoresOpen}
        shiftScores={core.shiftScores}
        isSaving={core.isSavingOptimizerConfig}
        saveMessage={core.optimizerSaveMessage}
        onClose={() => setIsShiftScoresOpen(false)}
        onReset={() => core.setShiftScores(DEFAULT_SHIFT_SCORES)}
        onSave={() => { void core.saveOptimizerConfig(); }}
        onShiftScoreChange={(key, value) => core.setShiftScores({ ...core.shiftScores, [key]: value })}
      />

      {/* ── 設定モーダル ── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
            <h2 className="text-lg font-bold text-gray-800">設定</h2>
            <button onClick={() => setIsSettingsOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors">
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
          </div>
        </div>
      )}
    </div>
  );
}
