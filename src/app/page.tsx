// src/app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { GenerationSettingsPanel, DoctorSettingsPanel } from "./components/SettingsPanel";
import ScheduleBoard from "./components/ScheduleBoard";
import { useCustomHolidays } from "./hooks/useCustomHolidays";
import useDashboardState from "./hooks/useDashboardState";
import { useHolidays } from "./hooks/useHolidays";
import { useScheduleApi } from "./hooks/useScheduleApi";
import { useScheduleDnd } from "./hooks/useScheduleDnd";
import { useScheduleHistory } from "./hooks/useScheduleHistory";
import { useRealtimeScores } from "./hooks/useRealtimeScores";
import { useOptimizerConfig } from "./hooks/useOptimizerConfig";
import { useNavigationGuard, getScheduleSignature } from "./hooks/useNavigationGuard";
import { DEFAULT_HARD_CONSTRAINTS, DEFAULT_OBJECTIVE_WEIGHTS, type ObjectiveWeights, type PreviousMonthShift, type ScheduleRow } from "./types/dashboard";

export default function DashboardPage() {
  const { schedule, setSchedule, commitSchedule, commitScheduleFrom, clearHistory, undo, redo, canUndo, canRedo } = useScheduleHistory();
  const [, setScores] = useState<Record<string, number | string>>({});
  const savedScheduleSignatureRef = useRef<string>(getScheduleSignature([]));
  const latestScheduleRef = useRef<ScheduleRow[]>([]);
  const dirtyRef = useRef(false);
  const {
    year,
    month,
    setYear,
    setMonth,
    doctorUnavailableMonth,
    setDoctorUnavailableMonth,
    setDoctors,
    holidays,
    setHolidays,
    holidayWorkdayOverrides,
    setHolidayWorkdayOverrides,
    scoreMin,
    setScoreMin,
    scoreMax,
    setScoreMax,
    objectiveWeights,
    setObjectiveWeights,
    setWeight,
    isWeightsOpen,
    setIsWeightsOpen,
    isHardConstraintsOpen,
    setIsHardConstraintsOpen,
    isPreviousMonthShiftsOpen,
    setIsPreviousMonthShiftsOpen,
    isDirty,
    setIsDirty,
    isOverrideMode,
    setIsOverrideMode,
    saveValidationMessages,
    setSaveValidationMessages,
    selectedDoctorId,
    setSelectedDoctorId,
    unavailableMap,
    setUnavailableMap,
    fixedUnavailableWeekdaysMap,
    setFixedUnavailableWeekdaysMap,
    hardConstraints,
    setHardConstraints,
    previousMonthShifts,
    setPreviousMonthShifts,
    minScoreMap,
    setMinScoreMap,
    maxScoreMap,
    setMaxScoreMap,
    targetScoreMap,
    setTargetScoreMap,
    prevMonthLastDay,
    setPrevMonthLastDay,
    pyWeekdaysJp,
    pyWeekdays,
    pad2,
    toYmd,
    getWeekday,
    getDaysInMonth,
    calcPrevMonthLastDay,
    handleToggleWeightsPanel,
    handleToggleHardConstraintsPanel,
    handleTogglePreviousMonthShiftsPanel,
    getDoctorName,
    activeDoctors,
    activeDoctorIds,
    numDoctors,
    prevMonthWorkedDaysMap,
    filterRecordByActiveDoctors,
    isActiveDoctorId,
    toggleUnavailable,
    toggleAllUnavailable,
    toggleFixedWeekday,
    handleHardConstraintChange,
    handlePrevMonthLastDayChange,
    getPreviousMonthShiftDoctorId,
    setPreviousMonthShift,
    handleMinScoreChange,
    handleMaxScoreChange,
    handleTargetScoreChange,
    prevMonthTailDays,
  } = useDashboardState();

  const { isSavingOptimizerConfig, optimizerSaveMessage, saveOptimizerConfig } = useOptimizerConfig({
    scoreMin,
    scoreMax,
    objectiveWeights,
    hardConstraints,
    setScoreMin,
    setScoreMax,
    setObjectiveWeights,
    setHardConstraints,
  });

  const markScheduleClean = (rows: ScheduleRow[] = latestScheduleRef.current) => {
    savedScheduleSignatureRef.current = getScheduleSignature(rows);
    dirtyRef.current = false;
    setIsDirty(false);
  };

  const confirmMoveWithUnsavedChanges = () => {
    if (typeof window === "undefined") return true;

    const lines: string[] = [];
    if (dirtyRef.current) lines.push("シフトが保存されていません。");
    const unsavedDoctors = getUnsavedDoctorNames();
    if (unsavedDoctors.length > 0) lines.push(`${unsavedDoctors.join("、")}先生の設定が未登録です。`);
    if (hasUnsavedCustomChanges) lines.push("祝日設定が保存されていません。");

    if (lines.length === 0) return true;

    lines.push("そのまま移動してよいですか？");
    const confirmed = window.confirm(lines.join("\n"));
    if (confirmed) markScheduleClean(latestScheduleRef.current);
    return confirmed;
  };

  const handleYearChange = (value: number) => {
    if (!Number.isFinite(value) || value === year) return;
    if (!confirmMoveWithUnsavedChanges()) return;
    setYear(value);
  };

  const handleMonthChange = (value: number) => {
    if (!Number.isFinite(value) || value === month) return;
    if (!confirmMoveWithUnsavedChanges()) return;
    setMonth(value);
  };

  const { holidaySet } = useHolidays(year);
  const {
    manualSet: manualHolidaySetYear,
    setManualSet: setManualHolidaySetYear,
    disabledSet: disabledHolidaySetYear,
    setDisabledSet: setDisabledHolidaySetYear,
    isLoadingCustom,
    isSavingCustom,
    customError,
    customSaveMessage,
    hasUnsavedCustomChanges,
    saveCustomHolidays,
  } = useCustomHolidays(year);

  useEffect(() => {
    setHolidayWorkdayOverrides(new Set(disabledHolidaySetYear));
  }, [disabledHolidaySetYear]);

  useEffect(() => {
    latestScheduleRef.current = schedule;
    const nextDirty = getScheduleSignature(schedule) !== savedScheduleSignatureRef.current;
    dirtyRef.current = nextDirty;
    setIsDirty(nextDirty);
  }, [schedule]);

  useEffect(() => {
    if (!isDirty || typeof window === "undefined") return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const prefix = `${year}-${pad2(month)}-`;
    const nextDays = Array.from(
      new Set(
        Array.from(manualHolidaySetYear)
          .filter((ymd) => ymd.startsWith(prefix))
          .map((ymd) => Number(ymd.slice(-2)))
          .filter((day) => Number.isFinite(day))
      )
    ).sort((a, b) => a - b);

    setHolidays((prev) => {
      if (prev.length === nextDays.length && prev.every((value, index) => value === nextDays[index])) {
        return prev;
      }
      return nextDays;
    });
  }, [manualHolidaySetYear, year, month]);

  const autoHolidayDaysInMonth = useMemo(() => {
    const prefix = `${year}-${pad2(month)}-`;
    const days: number[] = [];

    for (const ymd of holidaySet) {
      if (!ymd.startsWith(prefix)) continue;
      const day = Number(ymd.slice(-2));
      if (Number.isFinite(day)) days.push(day);
    }

    return Array.from(new Set(days)).sort((a, b) => a - b);
  }, [holidaySet, year, month, pad2]);

  const manualHolidaySetInMonth = useMemo(() => {
    const set = new Set<string>();
    holidays.forEach((day) => {
      set.add(toYmd(year, month, day));
    });
    return set;
  }, [holidays, year, month]);

  const isHolidayLikeDay = (day: number) => {
    const ymd = toYmd(year, month, day);
    const wd = getWeekday(year, month, day);
    const isSun = wd === "日";
    const isAutoHoliday = holidaySet.has(ymd);
    const isManualHoliday = manualHolidaySetInMonth.has(ymd);
    return { ymd, wd, isSun, isAutoHoliday, isManualHoliday, isHolidayLike: isSun || isAutoHoliday || isManualHoliday };
  };

  const { scoreEntries } = useRealtimeScores({
    activeDoctors,
    schedule,
    year,
    month,
    holidaySet,
    manualHolidaySetInMonth,
    holidayWorkdayOverrides,
    scoreMin,
    scoreMax,
    minScoreMap,
    maxScoreMap,
    targetScoreMap,
  });


  const {
    toastMessage,
    hoverErrorMessage,
    dragSourceType,
    highlightedDoctorId,
    invalidHoverShiftKey,
    touchHoverShiftKey,
    lockedShiftKeys,
    isShiftLocked,
    isSwapMode,
    swapSource,
    selectedManualDoctorId,
    isEraseSelectionActive,
    isSwapSourceSelected,
    isHighlightedDoctorBlockedDay,
    toggleHighlightedDoctor,
    selectManualDoctor,
    toggleEraseSelection,
    clearDragState,
    cancelSwapSelection,
    toggleSwapMode,
    handleShiftTap,
    handleSwapButtonPress,
    handleDisabledDayDragOver,
    handleDisabledDayDragLeave,
    handleShiftDragOver,
    handleShiftDragLeave,
    handleShiftDrop,
    handleShiftDragStart,
    handleDoctorListDragStart,
    handleShiftTouchStart,
    handleDoctorListTouchStart,
    handleTouchDragMove,
    handleTouchDragEnd,
    handleTouchDragCancel,
    handleTrashDragOver,
    handleTrashDrop,
    toggleShiftLock,
    handleLockAll,
    handleUnlockAll,
    buildLockedShiftsPayload,
    validateScheduleViolations,
  } = useScheduleDnd({
    schedule,
    commitSchedule,
    year,
    month,
    prevMonthLastDay,
    hardConstraints,
    isOverrideMode,
    unavailableMap,
    fixedUnavailableWeekdaysMap,
    prevMonthWorkedDaysMap,
    getDoctorName,
    isHolidayLikeDay,
    isActiveDoctorId,
  });

  const {
    error,
    isLoading,
    isSaving,
    isDeletingMonthSchedule,
    isBulkSavingDoctors,
    saveMessage,
    saveAllDoctorsSettings,
    handleDeleteMonthSchedule,
    handleGenerate,
    handleSaveToDB,
    getUnsavedDoctorNames,
  } = useScheduleApi({
    year,
    month,
    activeDoctors,
    holidays,
    autoHolidayDaysInMonth,
    holidayWorkdayOverrides,
    prevMonthLastDay,
    scoreMin,
    scoreMax,
    objectiveWeights,
    hardConstraints,
    unavailableMap,
    fixedUnavailableWeekdaysMap,
    doctorUnavailableYear: doctorUnavailableMonth.getFullYear(),
    doctorUnavailableMonth: doctorUnavailableMonth.getMonth() + 1,
    previousMonthShifts,
    minScoreMap,
    maxScoreMap,
    targetScoreMap,
    schedule,
    setSchedule,
    commitSchedule,
    commitScheduleFrom,
    setScores,
    setDoctors,
    setSelectedDoctorId,
    setUnavailableMap,
    setFixedUnavailableWeekdaysMap,
    setMinScoreMap,
    setMaxScoreMap,
    setTargetScoreMap,
    toYmd,
    getWeekday,
    isHolidayLikeDay,
    filterRecordByActiveDoctors,
    buildLockedShiftsPayload,
    lockedShiftKeys,
    markScheduleClean,
  });

  useNavigationGuard({
    dirtyRef,
    savedScheduleSignatureRef,
    latestScheduleRef,
    setIsDirty,
    getUnsavedDoctorNames,
    hasUnsavedCustomChanges,
    objectiveWeights,
    hardConstraints,
  });

  useEffect(() => {
    if (activeDoctors.length === 0) {
      setSelectedDoctorId("");
      return;
    }
    if (!selectedDoctorId || !activeDoctors.some((doctor) => doctor.id === selectedDoctorId)) {
      setSelectedDoctorId(activeDoctors[0]?.id || "");
    }
  }, [activeDoctors, selectedDoctorId]);

  useEffect(() => {
    setPrevMonthLastDay(calcPrevMonthLastDay(year, month));
    setPreviousMonthShifts([]);
    clearHistory();
  }, [year, month, clearHistory]);

  useEffect(() => {
    const controller = new AbortController();
    const activeDoctorIdSet = new Set(activeDoctorIds);

    const fetchPreviousMonthShifts = async () => {
      if (activeDoctorIdSet.size === 0) {
        setPreviousMonthShifts([]);
        return;
      }

      const previousMonthDate = new Date(year, month - 2, 1);
      const previousYear = previousMonthDate.getFullYear();
      const previousMonth = previousMonthDate.getMonth() + 1;
      const previousMonthLastDay = new Date(previousYear, previousMonth, 0).getDate();
      const formatDate = (value: number) => `${previousYear}-${String(previousMonth).padStart(2, "0")}-${String(value).padStart(2, "0")}`;
      const startDate = formatDate(Math.max(1, previousMonthLastDay - 3));
      const endDate = formatDate(previousMonthLastDay);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(
          `${apiUrl}/api/schedule/range?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          setPreviousMonthShifts([]);
          return;
        }

        const data: unknown = await res.json();
        if (!Array.isArray(data)) {
          setPreviousMonthShifts([]);
          return;
        }

        const next: PreviousMonthShift[] = [];

        data.forEach((item) => {
          if (!item || typeof item !== "object") return;

          const entry = item as Record<string, unknown>;
          const date = typeof entry.date === "string" ? entry.date : "";
          const shiftType = entry.shift_type;
          const doctorId =
            typeof entry.doctor_id === "string"
              ? entry.doctor_id
              : typeof entry.doctorId === "string"
                ? entry.doctorId
                : "";

          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
          if (shiftType !== "day" && shiftType !== "night") return;
          if (!activeDoctorIdSet.has(doctorId)) return;

          next.push({
            date,
            shift_type: shiftType,
            doctor_id: doctorId,
          });
        });

        next.sort((left, right) => {
          if (left.date !== right.date) return left.date.localeCompare(right.date);
          if (left.shift_type !== right.shift_type) return left.shift_type === "day" ? -1 : 1;
          return left.doctor_id.localeCompare(right.doctor_id);
        });

        setPreviousMonthShifts(next);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("Failed to fetch previous month shifts.", error);
        setPreviousMonthShifts([]);
      }
    };

    void fetchPreviousMonthShifts();
    return () => controller.abort();
  }, [activeDoctorIds, month, year]);


  const handleToggleOverrideMode = () => {
    setIsOverrideMode((prev) => !prev);
  };

  const handleDismissSaveValidation = () => {
    setSaveValidationMessages([]);
  };

  const handleGenerateWithGuard = () => {
    if (isOverrideMode) return;
    void handleGenerate();
  };

  const handleSaveWithValidation = () => {
    const violations = validateScheduleViolations();
    if (violations.length > 0) {
      setSaveValidationMessages(violations);
      return;
    }

    setSaveValidationMessages([]);
    void handleSaveToDB();
  };

  const handleForceSaveToDB = () => {
    const violations = validateScheduleViolations();
    if (violations.length > 0) {
      const confirmed = typeof window !== "undefined" ? window.confirm("ルール違反がありますが、このまま確定しますか？") : false;
      if (!confirmed) return;
    }

    setSaveValidationMessages([]);
    void handleSaveToDB();
  };

  const toggleHoliday = (day: number) => {
    const ymd = toYmd(year, month, day);
    if (getWeekday(year, month, day) === "日") return;

    setManualHolidaySetYear((prev) => {
      const next = new Set(prev);
      if (next.has(ymd)) next.delete(ymd);
      else next.add(ymd);
      return next;
    });
  };

  const weightChanges = useMemo(() => {
    const keys = Object.keys(DEFAULT_OBJECTIVE_WEIGHTS) as (keyof ObjectiveWeights)[];
    const changed = keys
      .map((key) => ({ key, base: DEFAULT_OBJECTIVE_WEIGHTS[key], now: objectiveWeights[key] }))
      .filter((item) => item.base !== item.now);

    return {
      isDefault: changed.length === 0,
      changedCount: changed.length,
      top: changed.slice(0, 3).map((item) => `${String(item.key)}:${item.now}`),
    };
  }, [objectiveWeights]);

  const daysInMonth = getDaysInMonth(year, month);

  const handleHolidayOverrideToggle = (ymd: string) => {
    setDisabledHolidaySetYear((prev) => {
      const next = new Set(prev);
      if (next.has(ymd)) next.delete(ymd);
      else next.add(ymd);
      return next;
    });
  };

  const scheduleColumns = useMemo(() => {
    if (schedule.length === 0) return [];
    const splitIndex = Math.ceil(schedule.length / 2);
    return [schedule.slice(0, splitIndex), schedule.slice(splitIndex)].filter((rows) => rows.length > 0);
  }, [schedule]);

  return (
    <div className="min-h-screen bg-gray-50 p-2 md:p-8 font-sans">
      <main className="mx-auto w-full max-w-7xl rounded-xl bg-white p-3 shadow-lg md:p-6 xl:p-8">
        <h1 className="mb-4 border-b pb-4 text-xl font-bold text-gray-800 md:mb-8 md:text-3xl">当直表 自動生成ダッシュボード</h1>

        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(340px,0.98fr)_minmax(0,1.32fr)] lg:items-start md:mb-6">
          <GenerationSettingsPanel
            isLoading={isLoading}
            isLoadingCustom={isLoadingCustom}
            customError={customError}
            isSavingCustom={isSavingCustom}
            customSaveMessage={customSaveMessage}
            hasUnsavedCustomChanges={hasUnsavedCustomChanges}
            scoreMin={scoreMin}
            scoreMax={scoreMax}
            objectiveWeights={objectiveWeights}
            hardConstraints={hardConstraints}
            weightChanges={weightChanges}
            isWeightsOpen={isWeightsOpen}
            isHardConstraintsOpen={isHardConstraintsOpen}
            year={year}
            month={month}
            doctorUnavailableMonth={doctorUnavailableMonth}
            numDoctors={numDoctors}
            activeDoctors={activeDoctors}
            holidayWorkdayOverrides={holidayWorkdayOverrides}
            daysInMonth={daysInMonth}
            selectedDoctorId={selectedDoctorId}
            unavailableMap={unavailableMap}
            fixedUnavailableWeekdaysMap={fixedUnavailableWeekdaysMap}
            pyWeekdays={pyWeekdays}
            pyWeekdaysJp={pyWeekdaysJp}
            prevMonthLastDay={prevMonthLastDay}
            prevMonthTailDays={prevMonthTailDays}
            getPreviousMonthShiftDoctorId={getPreviousMonthShiftDoctorId}
            onScoreMinChange={setScoreMin}
            onScoreMaxChange={setScoreMax}
            isSavingOptimizerConfig={isSavingOptimizerConfig}
            optimizerSaveMessage={optimizerSaveMessage}
            onSaveOptimizerConfig={() => { void saveOptimizerConfig(); }}
            onToggleWeights={handleToggleWeightsPanel}
            onResetWeights={() => setObjectiveWeights(DEFAULT_OBJECTIVE_WEIGHTS)}
            onCloseWeights={() => setIsWeightsOpen(false)}
            onToggleHardConstraints={handleToggleHardConstraintsPanel}
            onResetHardConstraints={() => setHardConstraints(DEFAULT_HARD_CONSTRAINTS)}
            onCloseHardConstraints={() => setIsHardConstraintsOpen(false)}
            isPreviousMonthShiftsOpen={isPreviousMonthShiftsOpen}
            onTogglePreviousMonthShifts={handleTogglePreviousMonthShiftsPanel}
            onClosePreviousMonthShifts={() => setIsPreviousMonthShiftsOpen(false)}
            onWeightChange={setWeight}
            onHardConstraintChange={handleHardConstraintChange}
            onYearChange={handleYearChange}
            onMonthChange={handleMonthChange}
            isHolidayLikeDay={isHolidayLikeDay}
            onToggleHoliday={toggleHoliday}
            onToggleHolidayOverride={handleHolidayOverrideToggle}
            onSaveCustomHolidays={() => {
              void saveCustomHolidays();
            }}
            onSelectedDoctorChange={setSelectedDoctorId}
            onDoctorUnavailableMonthChange={setDoctorUnavailableMonth}
            onToggleAllUnavailable={toggleAllUnavailable}
            onToggleUnavailable={toggleUnavailable}
            onToggleFixedWeekday={toggleFixedWeekday}
            onPrevMonthLastDayChange={handlePrevMonthLastDayChange}
            onSetPreviousMonthShift={setPreviousMonthShift}
            onGenerate={handleGenerateWithGuard}
            isGenerateDisabled={isOverrideMode}
          />

          <div className="relative min-w-0">
            {isLoading && (
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
              isBulkSavingDoctors={isBulkSavingDoctors}
              activeDoctors={activeDoctors}
              minScoreMap={minScoreMap}
              maxScoreMap={maxScoreMap}
              targetScoreMap={targetScoreMap}
              scoreMin={scoreMin}
              scoreMax={scoreMax}
              onSaveAllDoctorsSettings={saveAllDoctorsSettings}
              onMinScoreChange={handleMinScoreChange}
              onMaxScoreChange={handleMaxScoreChange}
              onTargetScoreChange={handleTargetScoreChange}
            />

            <ScheduleBoard
              isLoading={isLoading}
              toastMessage={toastMessage}
              hoverErrorMessage={hoverErrorMessage}
              dragSourceType={dragSourceType}
              error={error}
              schedule={schedule}
              scheduleColumns={scheduleColumns}
              scoreEntries={scoreEntries}
              getDoctorName={getDoctorName}
              highlightedDoctorId={highlightedDoctorId}
              selectedManualDoctorId={selectedManualDoctorId}
              isEraseSelectionActive={isEraseSelectionActive}
              year={year}
              month={month}
              holidaySet={holidaySet}
              manualHolidaySetInMonth={manualHolidaySetInMonth}
              toYmd={toYmd}
              getWeekday={getWeekday}
              isHighlightedDoctorBlockedDay={isHighlightedDoctorBlockedDay}
              isShiftLocked={isShiftLocked}
              invalidHoverShiftKey={invalidHoverShiftKey}
              touchHoverShiftKey={touchHoverShiftKey}
              isSwapMode={isSwapMode}
              swapSource={swapSource}
              isSwapSourceSelected={isSwapSourceSelected}
              onHandleShiftDragOver={handleShiftDragOver}
              onHandleShiftDragLeave={handleShiftDragLeave}
              onHandleShiftDrop={handleShiftDrop}
              onHandleDisabledDayDragOver={handleDisabledDayDragOver}
              onHandleDisabledDayDragLeave={handleDisabledDayDragLeave}
              onShiftDragStart={handleShiftDragStart}
              onDoctorListDragStart={handleDoctorListDragStart}
              onShiftTouchStart={handleShiftTouchStart}
              onDoctorListTouchStart={handleDoctorListTouchStart}
              onTouchDragMove={handleTouchDragMove}
              onTouchDragEnd={handleTouchDragEnd}
              onTouchDragCancel={handleTouchDragCancel}
              onShiftTap={handleShiftTap}
              onSwapButtonPress={handleSwapButtonPress}
              onCancelSwapSelection={cancelSwapSelection}
              onToggleHighlightedDoctor={toggleHighlightedDoctor}
              onSelectManualDoctor={selectManualDoctor}
              onToggleEraseSelection={toggleEraseSelection}
              onClearDragState={clearDragState}
              onToggleShiftLock={toggleShiftLock}
              onToggleSwapMode={toggleSwapMode}
              onLockAll={handleLockAll}
              onUnlockAll={handleUnlockAll}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              onRegenerateUnlocked={handleGenerateWithGuard}
              onTrashDragOver={handleTrashDragOver}
              onTrashDrop={handleTrashDrop}
              lockedShiftCount={lockedShiftKeys.size}
              onDeleteMonthSchedule={handleDeleteMonthSchedule}
              isDeletingMonthSchedule={isDeletingMonthSchedule}
              onSaveToDB={handleSaveWithValidation}
              isSaving={isSaving}
              isOverrideMode={isOverrideMode}
              onToggleOverrideMode={handleToggleOverrideMode}
              saveValidationMessages={saveValidationMessages}
              onDismissSaveValidation={handleDismissSaveValidation}
              onForceSaveToDB={handleForceSaveToDB}
              saveMessage={saveMessage}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
