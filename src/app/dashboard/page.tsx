// src/app/dashboard/page.tsx — V2.1 管理者ダッシュボード（D&D特化リデザイン）
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Settings, X, ImagePlus } from "lucide-react";
import AppHeader from "../components/AppHeader";
import DashboardScheduleTable from "../components/DashboardScheduleTable";
import DashboardToolbar from "../components/DashboardToolbar";
import DoctorPalette from "../components/DoctorPalette";
import SettingsSlidePanel from "../components/SettingsSlidePanel";
import DashboardSettingsPanel from "../components/DashboardSettingsPanel";
import PasswordChangeForm from "../components/settings/PasswordChangeForm";
import DefaultPageSetting from "../components/settings/DefaultPageSetting";
import AccountActions from "../components/settings/AccountActions";
import DoctorManageDrawer from "../components/settings/DoctorManageDrawer";
import ImageImportModal from "../components/ImageImportModal";
import { useOnCallCore } from "../hooks/useOnCallCore";

export default function DashboardPage() {
  const core = useOnCallCore();
  const router = useRouter();

  const [isLoadingConfirmed, setIsLoadingConfirmed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGenerationSettingsOpen, setIsGenerationSettingsOpen] = useState(false);
  const [isDoctorDrawerOpen, setIsDoctorDrawerOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [showMobileBanner, setShowMobileBanner] = useState(false);

  // ── ビューポートに合わせて縮小 ──
  const MIN_WIDTH = 1280;
  const [viewportZoom, setViewportZoom] = useState(1);
  useEffect(() => {
    const update = () => setViewportZoom(Math.min(1, window.innerWidth / MIN_WIDTH));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── モバイル検知バナー ──
  useEffect(() => {
    const isMobile = window.innerWidth < 768 || "ontouchstart" in window;
    setShowMobileBanner(isMobile);
  }, []);

  const handleLoadConfirmedForEdit = async () => {
    setIsLoadingConfirmed(true);
    try {
      await core.handleCopyConfirmedToDraft();
    } finally {
      setIsLoadingConfirmed(false);
    }
  };

  // ── 全固定解除（個別ロックがある場合は警告） ──
  const handleUnlockAllWithConfirm = () => {
    if (core.lockedShiftKeys.size > 0) {
      const ok = window.confirm(`${core.lockedShiftKeys.size}件の固定をすべて解除しますか？`);
      if (!ok) return;
    }
    core.handleUnlockAll();
  };

  // ── 全体を自動生成（ロック枠がある場合は警告→全解除→生成） ──
  const handleGenerateAll = () => {
    if (core.lockedShiftKeys.size > 0) {
      const ok = window.confirm(
        "固定した枠も含めて全体を作り直します。\n固定はすべて解除されます。\n\nシフトは「元に戻す」で復元できますが、固定の状態は戻りません。\n保存しておきたい場合は先に仮保存をご利用ください。"
      );
      if (!ok) return;
      core.handleUnlockAll();
    }
    core.handleGenerateWithGuard();
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

  const PALETTE_WIDTH = 288; // w-72 = 18rem = 288px

  return (
    <>
    <div
      className="min-h-screen min-w-[1280px] bg-gray-50 font-sans"
      style={{ zoom: viewportZoom, paddingRight: isPaletteOpen ? PALETTE_WIDTH + 20 : 0 }}
    >
      <AppHeader
        hospitalName={core.auth.hospitalName}
        hideLogout
        rightExtra={
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-1.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors sm:px-2.5"
            title="アカウント"
          >
            <Settings className="h-3.5 w-3.5 sm:hidden" />
            <span className="hidden sm:inline">アカウント</span>
          </button>
        }
      />

      {/* Mobile banner placeholder removed — see bottom sheet outside zoom container */}

      {/* Schedule area */}
      <main className="p-4">
          {/* Loading overlay */}
          {core.isLoading && <DashboardLoadingOverlay viewportZoom={viewportZoom} />}

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
            onGenerate={handleGenerateAll}
            onRegenerateUnlocked={core.handleGenerateWithGuard}
            lockedShiftCount={core.lockedShiftKeys.size}
            activeDoctorsCount={core.activeDoctors.length}
            onLockAll={core.handleLockAll}
            onUnlockAll={handleUnlockAllWithConfirm}
            hasShifts={core.schedule.length > 0}
            onSaveToDB={core.handleSaveWithValidation}
            isSaving={core.isSaving}
            onSaveDraft={() => { void core.handleSaveDraft(); }}
            isDraftSaving={core.isDraftSaving}
            onLoadDraft={() => { void core.handleLoadDraft(); }}
            isDraftLoading={core.isDraftLoading}
            draftSavedAt={core.draftSavedAt}
            onLoadConfirmedForEdit={() => { void handleLoadConfirmedForEdit(); }}
            isLoadingConfirmed={isLoadingConfirmed}
            onClearUnlocked={core.handleClearUnlocked}
            onCreateBlank={core.handleCreateBlankSchedule}
            hasSchedule={core.schedule.length > 0}
            onOpenImport={() => setShowImportModal(true)}
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
              getHighlightedViolation={core.getHighlightedViolation}
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
              swapSource={core.swapSource}
              onStartSwapFrom={core.startSwapFrom}
              onExecuteSwapTo={core.executeSwapTo}
              onCancelSwap={core.cancelSwapSelection}
              toastMessage={core.toastMessage}
              error={core.error}
              diagnostics={core.diagnostics}
              saveMessage={core.saveMessage}
              isLoading={core.isLoading}
              saveValidationMessages={core.saveValidationMessages}
              onDismissSaveValidation={core.handleDismissSaveValidation}
              onForceSaveToDB={core.handleForceSaveToDB}
              draftMessage={core.draftMessage}
              isOverrideMode={core.isOverrideMode}
              changedShiftKeys={core.changedShiftKeys}
              viewportZoom={viewportZoom}
            />
          </div>
        </main>

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
          ratioOverrides={core.weightRatioOverrides}
          onRatioOverridesChange={core.setWeightRatioOverrides}
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
            <h2 className="text-lg font-bold text-gray-800">アカウント</h2>
            <button onClick={() => setIsSettingsOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mx-auto max-w-md p-4 space-y-6">
            <button
              onClick={() => { setIsSettingsOpen(false); setIsDoctorDrawerOpen(true); }}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors text-left"
            >
              医師管理（追加・編集・共有・ロック）
            </button>
            <hr className="border-gray-200" />
            <DefaultPageSetting />
            <hr className="border-gray-200" />
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-3">パスワード変更</h3>
              <PasswordChangeForm />
            </div>
            <hr className="border-gray-200" />
            <button
              onClick={() => { if (window.confirm("ログアウトしますか？")) { setIsSettingsOpen(false); core.logout(); } }}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ログアウト
            </button>
            <details className="group">
              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 transition-colors select-none">
                上級設定
              </summary>
              <div className="mt-4 space-y-4">
                <AccountActions />
              </div>
            </details>
          </div>
        </div>
      )}

      {/* Doctor manage drawer */}
      <DoctorManageDrawer
        isOpen={isDoctorDrawerOpen}
        onClose={() => setIsDoctorDrawerOpen(false)}
        onDoctorsChanged={() => { void core.refetchDoctors(); }}
      />

      {/* 画像取込モーダル */}
      <ImageImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        doctors={core.activeDoctors}
        defaultYear={core.year}
        defaultMonth={core.month}
        hasExistingSchedule={core.schedule.length > 0}
        onImported={() => { void core.refetchDoctors(); window.location.reload(); }}
      />
    </div>

    {/* Palette toggle tab (viewport-fixed) */}
    <button
      type="button"
      onClick={() => setIsPaletteOpen(!isPaletteOpen)}
      className="fixed top-1/2 -translate-y-1/2 z-30 flex items-center justify-center rounded-l-md border border-r-0 border-gray-300 bg-white px-1.5 py-3 text-sm text-gray-500 shadow-sm hover:bg-gray-50"
      style={{
        right: isPaletteOpen ? PALETTE_WIDTH : 0,
        zoom: viewportZoom,
      }}
      title={isPaletteOpen ? "医師一覧を閉じる" : "医師一覧を開く"}
    >
      {isPaletteOpen ? "▶" : "◀"}
    </button>

    {/* Right sidebar: Doctor Palette (viewport-fixed, zoom-scaled) */}
    <aside
      className={`fixed right-0 top-0 border-l border-gray-200 bg-gray-50 z-20 ${isPaletteOpen ? "" : "pointer-events-none opacity-0"}`}
      style={{
        width: PALETTE_WIDTH,
        height: `${100 / viewportZoom}dvh`,
        zoom: viewportZoom,
      }}
    >
      <div className="flex h-full flex-col pt-16">
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
          onOpenDoctorManage={() => setIsDoctorDrawerOpen(true)}
        />
      </div>
    </aside>

    {/* Mobile bottom sheet — outside zoom container so it renders at native device size */}
    {showMobileBanner && (
      <div className="fixed inset-0 z-[9999] flex items-end bg-black/40">
        <div className="w-full animate-slide-up rounded-t-2xl bg-white px-6 pb-8 pt-6 shadow-2xl">
          <h2 className="text-lg font-bold text-gray-800">スマートフォンでお使いですか？</h2>
          <p className="mt-2 text-sm text-gray-500">
            PC版はパソコン向けに設計されています。スマートフォンではモバイル版が快適です。
          </p>
          <a
            href="/app"
            className="mt-5 block w-full rounded-xl bg-blue-600 py-4 text-center text-base font-bold text-white shadow-lg active:bg-blue-700"
          >
            モバイル版へ移動
          </a>
          <button
            type="button"
            onClick={() => setShowMobileBanner(false)}
            className="mt-3 block w-full py-3 text-center text-sm text-gray-400 active:text-gray-600"
          >
            このままPC版で作業する
          </button>
        </div>
      </div>
    )}
    </>
  );
}

function DashboardLoadingOverlay({ viewportZoom = 1 }: { viewportZoom?: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setProgress(30), 500);
    const t2 = setTimeout(() => setProgress(60), 3000);
    const t3 = setTimeout(() => setProgress(85), 8000);
    const t4 = setTimeout(() => setProgress(90), 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-[1px]" style={{ zoom: 1 / viewportZoom }}>
      <div className="w-full max-w-md rounded-2xl border border-blue-100 bg-white px-6 py-6 shadow-xl">
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
