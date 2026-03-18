// src/app/dashboard/page.tsx — 管理者ダッシュボード
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { GenerationSettingsPanel, DoctorSettingsPanel } from "../components/SettingsPanel";
import ScheduleBoard from "../components/ScheduleBoard";
import { getAuthHeaders } from "../hooks/useAuth";
import { useOnCallCore } from "../hooks/useOnCallCore";

export default function DashboardPage() {
  const core = useOnCallCore();
  const router = useRouter();

  // ── パスワード変更（ダッシュボード固有UI） ──
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [isSavingPw, setIsSavingPw] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (pwNew !== pwConfirm) { setPwError("新しいパスワードが一致しません"); return; }
    if (pwNew.length < 8) { setPwError("8文字以上必要です"); return; }
    setIsSavingPw(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/auth/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = (data as Record<string, unknown>)?.detail;
        throw new Error(typeof detail === "string" ? detail : "変更に失敗しました");
      }
      setPwSuccess("パスワードを変更しました");
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "変更に失敗しました");
    } finally {
      setIsSavingPw(false);
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
    <div className="min-h-screen bg-gray-50 p-2 md:p-8 font-sans">
      <main className="mx-auto w-full max-w-7xl rounded-xl bg-white p-3 shadow-lg md:p-6 xl:p-8">
        <div className="mb-4 flex items-center justify-between border-b pb-4 md:mb-8">
          <h1 className="text-xl font-bold text-gray-800 md:text-3xl">丸投げ当直表</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{core.auth.hospitalName}</span>
            <button
              onClick={() => { setIsPasswordModalOpen(true); setPwError(""); setPwSuccess(""); }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              パスワード変更
            </button>
            <button
              onClick={core.logout}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>

        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">パスワード変更</h2>
              <form onSubmit={(e) => { void handleChangePassword(e); }} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">現在のパスワード</label>
                  <input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} required autoFocus
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
                  <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
                  <input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {pwError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{pwError}</p>}
                {pwSuccess && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{pwSuccess}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setIsPasswordModalOpen(false)}
                    className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                    キャンセル
                  </button>
                  <button type="submit" disabled={isSavingPw}
                    className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {isSavingPw ? "変更中..." : "変更する"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
            onGenerate={core.handleGenerateWithGuard}
            isGenerateDisabled={core.isOverrideMode}
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
              isShiftLocked={core.isShiftLocked}
              invalidHoverShiftKey={core.invalidHoverShiftKey}
              touchHoverShiftKey={core.touchHoverShiftKey}
              isSwapMode={core.isSwapMode}
              swapSource={core.swapSource}
              isSwapSourceSelected={core.isSwapSourceSelected}
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
            />
          </div>
        </div>
      </main>
    </div>
  );
}
