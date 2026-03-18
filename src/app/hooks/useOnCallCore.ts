// src/app/hooks/useOnCallCore.ts
// 全状態を束ねる統合フック — /app と /dashboard の両方で使用
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCustomHolidays } from "./useCustomHolidays";
import useDashboardState from "./useDashboardState";
import { useHolidays } from "./useHolidays";
import { useScheduleApi } from "./useScheduleApi";
import { useScheduleDnd } from "./useScheduleDnd";
import { useScheduleHistory } from "./useScheduleHistory";
import { useRealtimeScores } from "./useRealtimeScores";
import { useOptimizerConfig } from "./useOptimizerConfig";
import { useNavigationGuard, getScheduleSignature } from "./useNavigationGuard";
import { useAuth, getAuthHeaders } from "./useAuth";
import { DEFAULT_HARD_CONSTRAINTS, DEFAULT_OBJECTIVE_WEIGHTS, type ObjectiveWeights, type PreviousMonthShift, type ScheduleRow } from "../types/dashboard";

export function useOnCallCore() {
  // ── 履歴管理 ──
  const { schedule, setSchedule, commitSchedule, commitScheduleFrom, clearHistory, undo, redo, canUndo, canRedo } = useScheduleHistory();
  const [, setScores] = useState<Record<string, number | string>>({});
  const savedScheduleSignatureRef = useRef<string>(getScheduleSignature([]));
  const latestScheduleRef = useRef<ScheduleRow[]>([]);
  const dirtyRef = useRef(false);

  // ── ダッシュボード状態 ──
  const dashboardState = useDashboardState();
  const {
    year, month, setYear, setMonth,
    doctorUnavailableMonth, setDoctorUnavailableMonth,
    setDoctors, holidays, setHolidays,
    holidayWorkdayOverrides, setHolidayWorkdayOverrides,
    scoreMin, setScoreMin, scoreMax, setScoreMax,
    objectiveWeights, setObjectiveWeights, setWeight,
    isWeightsOpen, setIsWeightsOpen,
    isHardConstraintsOpen, setIsHardConstraintsOpen,
    isPreviousMonthShiftsOpen, setIsPreviousMonthShiftsOpen,
    isDirty, setIsDirty,
    isOverrideMode, setIsOverrideMode,
    saveValidationMessages, setSaveValidationMessages,
    selectedDoctorId, setSelectedDoctorId,
    unavailableMap, setUnavailableMap,
    fixedUnavailableWeekdaysMap, setFixedUnavailableWeekdaysMap,
    hardConstraints, setHardConstraints,
    previousMonthShifts, setPreviousMonthShifts,
    minScoreMap, setMinScoreMap, maxScoreMap, setMaxScoreMap,
    targetScoreMap, setTargetScoreMap,
    prevMonthLastDay, setPrevMonthLastDay,
    pyWeekdaysJp, pyWeekdays, pad2, toYmd, getWeekday,
    getDaysInMonth, calcPrevMonthLastDay,
    handleToggleWeightsPanel, handleToggleHardConstraintsPanel,
    handleTogglePreviousMonthShiftsPanel,
    getDoctorName, activeDoctors, activeDoctorIds, numDoctors,
    prevMonthWorkedDaysMap, filterRecordByActiveDoctors,
    isActiveDoctorId, toggleUnavailable, toggleAllUnavailable,
    toggleFixedWeekday, handleHardConstraintChange,
    handlePrevMonthLastDayChange, getPreviousMonthShiftDoctorId,
    setPreviousMonthShift,
    handleMinScoreChange, handleMaxScoreChange, handleTargetScoreChange,
    prevMonthTailDays,
  } = dashboardState;

  // ── 最適化設定 ──
  const { isSavingOptimizerConfig, optimizerSaveMessage, saveOptimizerConfig } = useOptimizerConfig({
    scoreMin, scoreMax, objectiveWeights, hardConstraints,
    setScoreMin, setScoreMax, setObjectiveWeights, setHardConstraints,
  });

  // ── 祝日 ──
  const { holidaySet } = useHolidays(year);
  const {
    manualSet: manualHolidaySetYear,
    setManualSet: setManualHolidaySetYear,
    disabledSet: disabledHolidaySetYear,
    setDisabledSet: setDisabledHolidaySetYear,
    isLoadingCustom, isSavingCustom, customError,
    customSaveMessage, hasUnsavedCustomChanges, saveCustomHolidays,
  } = useCustomHolidays(year);

  // ── 祝日の派生値 ──
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
    holidays.forEach((day) => set.add(toYmd(year, month, day)));
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

  // ── リアルタイムスコア ──
  const { scoreEntries } = useRealtimeScores({
    activeDoctors, schedule, year, month,
    holidaySet, manualHolidaySetInMonth, holidayWorkdayOverrides,
    scoreMin, scoreMax, minScoreMap, maxScoreMap, targetScoreMap,
  });

  // ── ドラッグ&ドロップ ──
  const dndState = useScheduleDnd({
    schedule, commitSchedule, year, month, prevMonthLastDay,
    hardConstraints, isOverrideMode, unavailableMap,
    fixedUnavailableWeekdaysMap, prevMonthWorkedDaysMap,
    getDoctorName, isHolidayLikeDay, isActiveDoctorId,
  });

  const { buildLockedShiftsPayload, lockedShiftKeys, validateScheduleViolations } = dndState;

  // ── markScheduleClean ──
  const markScheduleClean = (rows: ScheduleRow[] = latestScheduleRef.current) => {
    savedScheduleSignatureRef.current = getScheduleSignature(rows);
    dirtyRef.current = false;
    setIsDirty(false);
  };

  // ── API通信 ──
  const apiState = useScheduleApi({
    year, month, activeDoctors, holidays, autoHolidayDaysInMonth,
    holidayWorkdayOverrides, prevMonthLastDay, scoreMin, scoreMax,
    objectiveWeights, hardConstraints, unavailableMap,
    fixedUnavailableWeekdaysMap,
    doctorUnavailableYear: doctorUnavailableMonth.getFullYear(),
    doctorUnavailableMonth: doctorUnavailableMonth.getMonth() + 1,
    previousMonthShifts, minScoreMap, maxScoreMap, targetScoreMap,
    schedule, setSchedule, commitSchedule, commitScheduleFrom,
    setScores, setDoctors, setSelectedDoctorId,
    setUnavailableMap, setFixedUnavailableWeekdaysMap,
    setMinScoreMap, setMaxScoreMap, setTargetScoreMap,
    toYmd, getWeekday, isHolidayLikeDay, filterRecordByActiveDoctors,
    buildLockedShiftsPayload, lockedShiftKeys, markScheduleClean,
  });

  const { getUnsavedDoctorNames, handleGenerate, handleSaveToDB } = apiState;

  // ── ナビゲーションガード ──
  useNavigationGuard({
    dirtyRef, savedScheduleSignatureRef, latestScheduleRef,
    setIsDirty, getUnsavedDoctorNames, hasUnsavedCustomChanges,
    objectiveWeights, hardConstraints,
  });

  // ── 認証 ──
  const { auth, isLoading: isAuthLoading, logout } = useAuth();

  // ── Effects ──
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
      if (prev.length === nextDays.length && prev.every((value, index) => value === nextDays[index])) return prev;
      return nextDays;
    });
  }, [manualHolidaySetYear, year, month]);

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
          { signal: controller.signal, headers: getAuthHeaders() }
        );
        if (!res.ok) { setPreviousMonthShifts([]); return; }
        const data: unknown = await res.json();
        if (!Array.isArray(data)) { setPreviousMonthShifts([]); return; }
        const next: PreviousMonthShift[] = [];
        data.forEach((item) => {
          if (!item || typeof item !== "object") return;
          const entry = item as Record<string, unknown>;
          const date = typeof entry.date === "string" ? entry.date : "";
          const shiftType = entry.shift_type;
          const doctorId = typeof entry.doctor_id === "string" ? entry.doctor_id : typeof entry.doctorId === "string" ? entry.doctorId : "";
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
          if (shiftType !== "day" && shiftType !== "night") return;
          if (!activeDoctorIdSet.has(doctorId)) return;
          next.push({ date, shift_type: shiftType, doctor_id: doctorId });
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

  // ── ハンドラ ──
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

  const handleToggleOverrideMode = () => setIsOverrideMode((prev) => !prev);
  const handleDismissSaveValidation = () => setSaveValidationMessages([]);

  const handleGenerateWithGuard = () => {
    if (isOverrideMode) return;
    void handleGenerate();
  };

  const handleSaveWithValidation = () => {
    const violations = validateScheduleViolations();
    if (violations.length > 0) { setSaveValidationMessages(violations); return; }
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
      if (next.has(ymd)) next.delete(ymd); else next.add(ymd);
      return next;
    });
  };

  const handleHolidayOverrideToggle = (ymd: string) => {
    setDisabledHolidaySetYear((prev) => {
      const next = new Set(prev);
      if (next.has(ymd)) next.delete(ymd); else next.add(ymd);
      return next;
    });
  };

  // ── 派生値 ──
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

  const scheduleColumns = useMemo(() => {
    if (schedule.length === 0) return [];
    const splitIndex = Math.ceil(schedule.length / 2);
    return [schedule.slice(0, splitIndex), schedule.slice(splitIndex)].filter((rows) => rows.length > 0);
  }, [schedule]);

  // ── 戻り値 ──
  return {
    // 認証
    auth, isAuthLoading, logout,

    // スケジュール
    schedule, scheduleColumns, scoreEntries,
    undo, redo, canUndo, canRedo,

    // ダッシュボード状態
    year, month, handleYearChange, handleMonthChange,
    doctorUnavailableMonth, setDoctorUnavailableMonth,
    holidays, holidaySet, holidayWorkdayOverrides,
    manualHolidaySetInMonth, autoHolidayDaysInMonth,
    isHolidayLikeDay,
    scoreMin, setScoreMin, scoreMax, setScoreMax,
    objectiveWeights, setObjectiveWeights, setWeight,
    isWeightsOpen, setIsWeightsOpen,
    isHardConstraintsOpen, setIsHardConstraintsOpen,
    isPreviousMonthShiftsOpen, setIsPreviousMonthShiftsOpen,
    isDirty, isOverrideMode,
    saveValidationMessages,
    selectedDoctorId, setSelectedDoctorId,
    unavailableMap, fixedUnavailableWeekdaysMap,
    hardConstraints, setHardConstraints,
    previousMonthShifts,
    minScoreMap, maxScoreMap, targetScoreMap,
    prevMonthLastDay, prevMonthTailDays,
    pyWeekdaysJp, pyWeekdays, toYmd, getWeekday,
    daysInMonth, numDoctors, activeDoctors,
    getDoctorName,

    // 設定パネルトグル
    handleToggleWeightsPanel, handleToggleHardConstraintsPanel,
    handleTogglePreviousMonthShiftsPanel,
    weightChanges,

    // 最適化設定
    isSavingOptimizerConfig, optimizerSaveMessage, saveOptimizerConfig,

    // ルール・医師設定
    handleHardConstraintChange,
    getPreviousMonthShiftDoctorId, setPreviousMonthShift,
    handlePrevMonthLastDayChange,
    toggleUnavailable, toggleAllUnavailable, toggleFixedWeekday,
    handleMinScoreChange, handleMaxScoreChange, handleTargetScoreChange,

    // 祝日
    isLoadingCustom, isSavingCustom, customError,
    customSaveMessage, hasUnsavedCustomChanges,
    saveCustomHolidays, toggleHoliday, handleHolidayOverrideToggle,

    // D&D
    ...dndState,

    // API
    ...apiState,

    // ハンドラ
    handleToggleOverrideMode,
    handleDismissSaveValidation,
    handleGenerateWithGuard,
    handleSaveWithValidation,
    handleForceSaveToDB,

    // デフォルト値リセット
    DEFAULT_HARD_CONSTRAINTS,
    DEFAULT_OBJECTIVE_WEIGHTS,
  };
}
