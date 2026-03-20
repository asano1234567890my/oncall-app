// src/app/dashboard/page.tsx — V2.1 管理者ダッシュボード（D&D特化リデザイン）
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import AppHeader from "../components/AppHeader";
import DashboardScheduleTable from "../components/DashboardScheduleTable";
import DashboardToolbar from "../components/DashboardToolbar";
import DoctorPalette from "../components/DoctorPalette";
import SettingsSlidePanel from "../components/SettingsSlidePanel";
import DashboardSettingsPanel from "../components/DashboardSettingsPanel";
import PasswordChangeForm from "../components/settings/PasswordChangeForm";
import DefaultPageSetting from "../components/settings/DefaultPageSetting";
import { useOnCallCore } from "../hooks/useOnCallCore";

export default function DashboardPage() {
  const core = useOnCallCore();
  const router = useRouter();

  const [isLoadingConfirmed, setIsLoadingConfirmed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGenerationSettingsOpen, setIsGenerationSettingsOpen] = useState(false);

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
            設定
          </button>
        }
      />

      {/* Main layout: schedule (left) + palette (right) */}
      <div className="flex">
        {/* Schedule area */}
        <main className="flex-1 min-w-0 p-3 md:p-4 xl:p-6">
          {/* Loading overlay */}
          {core.isLoading && (
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
              <div className="w-full max-w-md rounded-2xl border border-blue-100 bg-white px-4 py-6 shadow-xl md:px-6">
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

          {/* Toolbar */}
          <DashboardToolbar
            year={core.year}
            month={core.month}
            onYearChange={core.handleYearChange}
            onMonthChange={core.handleMonthChange}
            isLoading={core.isLoading}
            isOverrideMode={core.isOverrideMode}
            onToggleOverrideMode={core.handleToggleOverrideMode}
            canUndo={core.canUndo}
            canRedo={core.canRedo}
            onUndo={core.undo}
            onRedo={core.redo}
            onOpenSettings={() => setIsGenerationSettingsOpen(true)}
            onGenerate={core.handleGenerateWithGuard}
            onRegenerateUnlocked={core.handleGenerateWithGuard}
            onDeleteMonthSchedule={core.handleDeleteMonthSchedule}
            isDeletingMonthSchedule={core.isDeletingMonthSchedule}
            lockedShiftCount={core.lockedShiftKeys.size}
            activeDoctorsCount={core.activeDoctors.length}
            onSaveToDB={core.handleSaveWithValidation}
            isSaving={core.isSaving}
            onSaveDraft={() => { void core.handleSaveDraft(); }}
            isDraftSaving={core.isDraftSaving}
            onLoadDraft={() => { void core.handleLoadDraft(); }}
            isDraftLoading={core.isDraftLoading}
            draftSavedAt={core.draftSavedAt}
            onLoadConfirmedForEdit={() => { void handleLoadConfirmedForEdit(); }}
            isLoadingConfirmed={isLoadingConfirmed}
            hasSchedule={core.schedule.length > 0}
          />

          {/* Schedule table */}
          <div className="mt-3">
            <DashboardScheduleTable
              schedule={core.schedule}
              year={core.year}
              month={core.month}
              holidaySet={core.holidaySet}
              manualHolidaySetInMonth={core.manualHolidaySetInMonth}
              toYmd={core.toYmd}
              getWeekday={core.getWeekday}
              getDoctorName={core.getDoctorName}
              highlightedDoctorId={core.highlightedDoctorId}
              hoverErrorMessage={core.hoverErrorMessage}
              isHighlightedDoctorBlockedDay={core.isHighlightedDoctorBlockedDay}
              isHighlightedDoctorBlockedShift={core.isHighlightedDoctorBlockedShift}
              isShiftLocked={core.isShiftLocked}
              invalidHoverShiftKey={core.invalidHoverShiftKey}
              touchHoverShiftKey={core.touchHoverShiftKey}
              draggingDoctorId={core.draggingDoctorId}
              cellValidityMap={core.cellValidityMap}
              onHandleShiftDragOver={core.handleShiftDragOver}
              onHandleShiftDragLeave={core.handleShiftDragLeave}
              onHandleShiftDrop={core.handleShiftDrop}
              onHandleDisabledDayDragOver={core.handleDisabledDayDragOver}
              onHandleDisabledDayDragLeave={core.handleDisabledDayDragLeave}
              onShiftDragStart={core.handleShiftDragStart}
              onClearDragState={core.clearDragState}
              onToggleShiftLock={core.toggleShiftLock}
              onToggleHighlightedDoctor={core.toggleHighlightedDoctor}
              toastMessage={core.toastMessage}
              error={core.error}
              saveMessage={core.saveMessage}
              isLoading={core.isLoading}
              saveValidationMessages={core.saveValidationMessages}
              onDismissSaveValidation={core.handleDismissSaveValidation}
              onForceSaveToDB={core.handleForceSaveToDB}
              draftMessage={core.draftMessage}
              isOverrideMode={core.isOverrideMode}
            />
          </div>
        </main>

        {/* Right sidebar: Doctor Palette */}
        <aside className="hidden w-72 shrink-0 border-l border-gray-200 bg-gray-50 lg:block sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto">
          <DoctorPalette
            scoreEntries={core.scoreEntries}
            getDoctorName={core.getDoctorName}
            highlightedDoctorId={core.highlightedDoctorId}
            dragSourceType={core.dragSourceType}
            scoreMin={core.scoreMin}
            scoreMax={core.scoreMax}
            onDoctorListDragStart={core.handleDoctorListDragStart}
            onClearDragState={core.clearDragState}
            onToggleHighlightedDoctor={core.toggleHighlightedDoctor}
            onTrashDragOver={core.handleTrashDragOver}
            onTrashDrop={core.handleTrashDrop}
            onLockAll={core.handleLockAll}
            onUnlockAll={core.handleUnlockAll}
            lockedShiftCount={core.lockedShiftKeys.size}
            hasShifts={core.schedule.some((row) => row.day_shift || row.night_shift)}
          />
        </aside>
      </div>

      {/* Generation Settings Slide Panel */}
      <SettingsSlidePanel isOpen={isGenerationSettingsOpen} onClose={() => setIsGenerationSettingsOpen(false)}>
        <DashboardSettingsPanel
          year={core.year}
          month={core.month}
          daysInMonth={core.daysInMonth}
          numDoctors={core.numDoctors}
          activeDoctors={core.activeDoctors}
          scoreMin={core.scoreMin}
          scoreMax={core.scoreMax}
          onScoreMinChange={core.setScoreMin}
          onScoreMaxChange={core.setScoreMax}
          hardConstraints={core.hardConstraints}
          onHardConstraintChange={core.handleHardConstraintChange}
          isSavingOptimizerConfig={core.isSavingOptimizerConfig}
          optimizerSaveMessage={core.optimizerSaveMessage}
          onSaveOptimizerConfig={() => { void core.saveOptimizerConfig(); }}
          isLoadingCustom={core.isLoadingCustom}
          isSavingCustom={core.isSavingCustom}
          customError={core.customError}
          customSaveMessage={core.customSaveMessage}
          hasUnsavedCustomChanges={core.hasUnsavedCustomChanges}
          holidayWorkdayOverrides={core.holidayWorkdayOverrides}
          isHolidayLikeDay={core.isHolidayLikeDay}
          onToggleHoliday={core.toggleHoliday}
          onToggleHolidayOverride={core.handleHolidayOverrideToggle}
          onSaveCustomHolidays={() => { void core.saveCustomHolidays(); }}
          doctorUnavailableMonth={core.doctorUnavailableMonth}
          selectedDoctorId={core.selectedDoctorId}
          unavailableMap={core.unavailableMap}
          fixedUnavailableWeekdaysMap={core.fixedUnavailableWeekdaysMap}
          pyWeekdays={core.pyWeekdays}
          onSelectedDoctorChange={core.setSelectedDoctorId}
          onDoctorUnavailableMonthChange={core.setDoctorUnavailableMonth}
          onToggleAllUnavailable={core.toggleAllUnavailable}
          onToggleUnavailable={core.toggleUnavailable}
          onToggleFixedWeekday={core.toggleFixedWeekday}
          minScoreMap={core.minScoreMap}
          maxScoreMap={core.maxScoreMap}
          targetScoreMap={core.targetScoreMap}
          onMinScoreChange={core.handleMinScoreChange}
          onMaxScoreChange={core.handleMaxScoreChange}
          onTargetScoreChange={core.handleTargetScoreChange}
          onSaveAllDoctorsSettings={() => { void core.saveAllDoctorsSettings(); }}
          isBulkSavingDoctors={core.isBulkSavingDoctors}
          objectiveWeights={core.objectiveWeights}
          weightChanges={core.weightChanges}
          isWeightsOpen={core.isWeightsOpen}
          isHardConstraintsOpen={core.isHardConstraintsOpen}
          onToggleWeights={core.handleToggleWeightsPanel}
          onResetWeights={() => core.setObjectiveWeights(core.DEFAULT_OBJECTIVE_WEIGHTS)}
          onCloseWeights={() => core.setIsWeightsOpen(false)}
          onWeightChange={core.setWeight}
          onSetWeights={core.setObjectiveWeights}
          onToggleHardConstraints={core.handleToggleHardConstraintsPanel}
          onResetHardConstraints={() => core.setHardConstraints(core.DEFAULT_HARD_CONSTRAINTS)}
          onCloseHardConstraints={() => core.setIsHardConstraintsOpen(false)}
          shiftScores={core.shiftScores}
          setShiftScores={core.setShiftScores}
          isPreviousMonthShiftsOpen={core.isPreviousMonthShiftsOpen}
          onTogglePreviousMonthShifts={core.handleTogglePreviousMonthShiftsPanel}
          onClosePreviousMonthShifts={() => core.setIsPreviousMonthShiftsOpen(false)}
          prevMonthLastDay={core.prevMonthLastDay}
          prevMonthTailDays={core.prevMonthTailDays}
          getPreviousMonthShiftDoctorId={core.getPreviousMonthShiftDoctorId}
          onPrevMonthLastDayChange={core.handlePrevMonthLastDayChange}
          onSetPreviousMonthShift={core.setPreviousMonthShift}
        />
      </SettingsSlidePanel>

      {/* Account settings modal */}
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
