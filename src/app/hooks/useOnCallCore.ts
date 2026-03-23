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
import { useDraftSchedule } from "./useDraftSchedule";
import { DEFAULT_HARD_CONSTRAINTS, DEFAULT_OBJECTIVE_WEIGHTS, type ObjectiveWeights, type PreviousMonthShift, type ScheduleRow } from "../types/dashboard";
import { weightGroups } from "../components/settings/shared";

export function useOnCallCore() {
  const autoLoadDraftRef = useRef<string | null>(null);

  // ── 履歴管理 ──
  const { schedule, setSchedule, commitSchedule, commitScheduleFrom, clearHistory, undo, redo, canUndo, canRedo, changedShiftKeys } = useScheduleHistory();
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
    scoreTargetDefault, setScoreTargetDefault,
    shiftScores, setShiftScores,
    objectiveWeights, setObjectiveWeights, setWeight,
    weightRatioOverrides, setWeightRatioOverrides,
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
    resetDoctorScores,
    prevMonthTailDays,
  } = dashboardState;

  // ── 最適化設定 ──
  const { isSavingOptimizerConfig, optimizerSaveMessage, saveOptimizerConfig, hasUnsavedWeights, hasUnsavedHardConstraints } = useOptimizerConfig({
    scoreMin, scoreMax, scoreTargetDefault, shiftScores, objectiveWeights, hardConstraints, weightRatioOverrides,
    setScoreMin, setScoreMax, setScoreTargetDefault, setShiftScores, setObjectiveWeights, setHardConstraints, setWeightRatioOverrides,
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
    scoreMin, scoreMax, shiftScores, minScoreMap, maxScoreMap, targetScoreMap,
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
    hasUnsavedWeights, hasUnsavedHardConstraints,
  });

  // ── 認証 ──
  const { auth, isLoading: isAuthLoading, logout } = useAuth();

  // ── 仮保存 ──
  const draft = useDraftSchedule(year, month, auth.isAuthenticated);

  // ── URL ?edit=YYYY-MM から確定済みスケジュールを直接展開 ──
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const editParam = params.get("edit") || params.get("draft");
    if (!editParam) return;
    if (autoLoadDraftRef.current === editParam) return;
    autoLoadDraftRef.current = editParam;

    const [editYear, editMonth] = editParam.split("-").map(Number);
    if (editYear && editMonth) {
      if (editYear !== year) setYear(editYear);
      if (editMonth !== month) setMonth(editMonth);

      const isDraft = params.has("draft");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      setTimeout(async () => {
        try {
          if (isDraft) {
            const loaded = await draft.loadDraft();
            if (loaded) commitSchedule(loaded);
          } else {
            const res = await fetch(`${apiUrl}/api/schedule/${editYear}/${editMonth}`, {
              headers: getAuthHeaders(),
            });
            if (res.ok) {
              const data = (await res.json()) as Array<Record<string, unknown>>;
              const rows = data.map((r) => ({
                day: r.day as number,
                day_shift: (r.day_shift as string) ?? null,
                night_shift: (r.night_shift as string) ?? null,
              })) as ScheduleRow[];
              commitSchedule(rows);
            }
          }
        } catch { /* ignore */ }
        window.history.replaceState({}, "", window.location.pathname);
      }, 500);
    }
  }, [auth.isAuthenticated]);

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
      const spacingDays = Math.max(1, Number(hardConstraints.interval_days) || 4);
      const startDate = formatDate(Math.max(1, previousMonthLastDay - spacingDays + 1));
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
  }, [activeDoctorIds, month, year, hardConstraints.interval_days]);

  // ── ハンドラ ──
  const confirmMoveWithUnsavedChanges = () => {
    if (typeof window === "undefined") return true;
    const lines: string[] = [];
    if (dirtyRef.current) lines.push("シフトが保存されていません。");
    const unsavedDoctors = getUnsavedDoctorNames();
    if (unsavedDoctors.length > 0) lines.push(`${unsavedDoctors.join("、")}先生の設定が未登録です。`);
    if (hasUnsavedCustomChanges) lines.push("祝日設定が保存されていません。");
    if (hasUnsavedWeights) lines.push("重みづけ設定が保存されていません。");
    if (hasUnsavedHardConstraints) lines.push("ハード制約設定が保存されていません。");
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

  const toggleHoliday = (ymdOrDay: string | number) => {
    const ymd = typeof ymdOrDay === "number" ? toYmd(year, month, ymdOrDay) : ymdOrDay;
    // 日曜チェック
    const d = new Date(ymd);
    if (d.getDay() === 0) return;
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

  // ── 仮保存ハンドラ ──
  const handleSaveDraft = async () => {
    if (schedule.length === 0) return;
    if (draft.draftSavedAt) {
      const ts = new Date(draft.draftSavedAt).toLocaleString("ja-JP");
      const ok = typeof window !== "undefined"
        ? window.confirm(`${ts} の仮保存を上書きしますか？`)
        : false;
      if (!ok) return;
    }
    await draft.saveDraft(schedule);
  };

  const handleLoadDraft = async () => {
    if (dirtyRef.current) {
      const ok = typeof window !== "undefined" ? window.confirm("現在の編集を破棄して仮保存を読み込みますか？") : false;
      if (!ok) return;
    }
    const loaded = await draft.loadDraft();
    if (loaded) {
      commitSchedule(loaded);
    }
  };

  const handleCopyConfirmedToDraft = async () => {
    if (schedule.some((r) => r.day_shift || r.night_shift)) {
      if (!window.confirm("現在のシフトを破棄して確定済みシフトを読み込みますか？")) return;
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    try {
      const res = await fetch(`${apiUrl}/api/schedule/${year}/${month}`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = (await res.json()) as ScheduleRow[];
      if (!data || data.length === 0) return;
      await draft.saveDraft(data);
      commitSchedule(data);
    } catch { /* ignore */ }
  };

  // ── 派生値 ──
  const weightChanges = useMemo(() => {
    // グループの primaryKey だけを比較（内部連動値や不活化ウェイトは無視）
    const primaryKeys = weightGroups.map((g) => g.primaryKey);
    const changed = primaryKeys
      .map((key) => ({ key, base: DEFAULT_OBJECTIVE_WEIGHTS[key], now: objectiveWeights[key] }))
      .filter((item) => item.base !== item.now);
    return {
      isDefault: changed.length === 0,
      changedCount: changed.length,
      top: changed.slice(0, 3).map((item) => `${String(item.key)}:${item.now}`),
    };
  }, [objectiveWeights]);

  const daysInMonth = getDaysInMonth(year, month);

  // ── 白紙作成 ──
  const handleCreateBlankSchedule = () => {
    if (schedule.some((r) => r.day_shift || r.night_shift)) {
      if (!window.confirm("現在のシフトを破棄して白紙にしますか？")) return;
    }
    const blank: ScheduleRow[] = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const { isHolidayLike } = isHolidayLikeDay(day);
      return { day, day_shift: null, night_shift: null, is_sunhol: isHolidayLike };
    });
    dndState.handleUnlockAll();
    commitSchedule(blank);
  };

  // ── 未固定枠クリア ──
  const handleClearUnlocked = () => {
    if (!window.confirm("未固定枠をクリアしますか？固定枠はそのまま残ります。")) return;
    const cleared: ScheduleRow[] = schedule.map((row) => ({
      ...row,
      day_shift: dndState.lockedShiftKeys.has(`${row.day}_day`) ? row.day_shift : null,
      night_shift: dndState.lockedShiftKeys.has(`${row.day}_night`) ? row.night_shift : null,
    }));
    commitSchedule(cleared);
  };

  const scheduleColumns = useMemo(() => {
    if (schedule.length === 0) return [];
    const splitIndex = schedule.length <= 28 ? 14 : 15;
    return [schedule.slice(0, splitIndex), schedule.slice(splitIndex)].filter((rows) => rows.length > 0);
  }, [schedule]);

  // ── 戻り値 ──
  return {
    // 認証
    auth, isAuthLoading, logout,

    // スケジュール
    schedule, scheduleColumns, scoreEntries,
    undo, redo, canUndo, canRedo, changedShiftKeys,

    // ダッシュボード状態
    year, month, handleYearChange, handleMonthChange,
    doctorUnavailableMonth, setDoctorUnavailableMonth,
    holidays, holidaySet, holidayWorkdayOverrides,
    manualHolidaySetYear, manualHolidaySetInMonth, autoHolidayDaysInMonth,
    isHolidayLikeDay,
    scoreMin, setScoreMin, scoreMax, setScoreMax,
    scoreTargetDefault, setScoreTargetDefault,
    shiftScores, setShiftScores,
    objectiveWeights, setObjectiveWeights, setWeight,
    weightRatioOverrides, setWeightRatioOverrides,
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
    handleMinScoreChange, handleMaxScoreChange, handleTargetScoreChange, resetDoctorScores,

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
    handleCreateBlankSchedule,
    handleClearUnlocked,

    // ナビゲーションガード
    confirmMoveWithUnsavedChanges,

    // 仮保存
    isDraftSaving: draft.isDraftSaving,
    isDraftLoading: draft.isDraftLoading,
    draftSavedAt: draft.draftSavedAt,
    draftMessage: draft.draftMessage,
    handleSaveDraft,
    handleLoadDraft,
    handleCopyConfirmedToDraft,

    // デフォルト値リセット
    DEFAULT_HARD_CONSTRAINTS,
    DEFAULT_OBJECTIVE_WEIGHTS,
  };
}
