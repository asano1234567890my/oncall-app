// src/app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { GenerationSettingsPanel, DoctorSettingsPanel } from "./components/SettingsPanel";
import ScheduleBoard from "./components/ScheduleBoard";
import { useCustomHolidays } from "./hooks/useCustomHolidays";
import { useHolidays } from "./hooks/useHolidays";
import { useScheduleApi } from "./hooks/useScheduleApi";
import { useScheduleDnd } from "./hooks/useScheduleDnd";
import { useScheduleHistory } from "./hooks/useScheduleHistory";
import { useRealtimeScores } from "./hooks/useRealtimeScores";
import {
  DEFAULT_HARD_CONSTRAINTS,
  DEFAULT_OBJECTIVE_WEIGHTS,
  type Doctor,
  type FixedUnavailableWeekdayMap,
  type HardConstraints,
  type ObjectiveWeights,
  type PreviousMonthShift,
  type ScheduleRow,
  type ShiftType,
  type TargetShift,
  type UnavailableDateMap,
} from "./types/dashboard";
import { getDefaultTargetMonth } from "./utils/dateUtils";
import {
  getFixedWeekdayTargetShift,
  getUnavailableDateTargetShift,
  setFixedWeekdayTargetShift,
  setUnavailableDateTargetShift,
} from "./utils/unavailableSettings";

const getScheduleSignature = (rows: ScheduleRow[]) =>
  JSON.stringify(
    rows.map((row) => ({
      day: row.day,
      day_shift: row.day_shift ?? null,
      night_shift: row.night_shift ?? null,
      is_holiday: Boolean(row.is_holiday),
      is_sunhol: Boolean(row.is_sunhol),
    }))
  );

export default function DashboardPage() {
  const defaultTargetMonth = getDefaultTargetMonth();
  const [year, setYear] = useState<number>(defaultTargetMonth.year);
  const [month, setMonth] = useState<number>(defaultTargetMonth.month);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [holidays, setHolidays] = useState<number[]>([]);
  const [holidayWorkdayOverrides, setHolidayWorkdayOverrides] = useState<Set<string>>(() => new Set());
  const [scoreMin, setScoreMin] = useState<number>(0.5);
  const [scoreMax, setScoreMax] = useState<number>(4.5);
  const [objectiveWeights, setObjectiveWeights] = useState<ObjectiveWeights>(DEFAULT_OBJECTIVE_WEIGHTS);
  const { schedule, setSchedule, commitSchedule, commitScheduleFrom, clearHistory, undo, redo, canUndo, canRedo } = useScheduleHistory();
  const [, setScores] = useState<Record<string, number | string>>({});
  const savedScheduleSignatureRef = useRef<string>(getScheduleSignature([]));
  const [isWeightsOpen, setIsWeightsOpen] = useState(false);
  const [isHardConstraintsOpen, setIsHardConstraintsOpen] = useState(false);
  const [isPreviousMonthShiftsOpen, setIsPreviousMonthShiftsOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [saveValidationMessages, setSaveValidationMessages] = useState<string[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [unavailableMap, setUnavailableMap] = useState<UnavailableDateMap>({});
  const [fixedUnavailableWeekdaysMap, setFixedUnavailableWeekdaysMap] = useState<FixedUnavailableWeekdayMap>({});
  const [hardConstraints, setHardConstraints] = useState<HardConstraints>(DEFAULT_HARD_CONSTRAINTS);
  const [previousMonthShifts, setPreviousMonthShifts] = useState<PreviousMonthShift[]>([]);
  const [minScoreMap, setMinScoreMap] = useState<Record<string, number>>({});
  const [maxScoreMap, setMaxScoreMap] = useState<Record<string, number>>({});
  const [targetScoreMap, setTargetScoreMap] = useState<Record<string, number>>({});

  const calcPrevMonthLastDay = (y: number, m: number) => new Date(y, m - 1, 0).getDate();
  const [prevMonthLastDay, setPrevMonthLastDay] = useState<number>(() => calcPrevMonthLastDay(year, month));

  const setWeight = (key: keyof ObjectiveWeights, value: number) => {
    const nextValue = Number.isFinite(value) ? Math.round(value) : 0;
    setObjectiveWeights((prev) => ({ ...prev, [key]: nextValue }));
  };

  const handleToggleWeightsPanel = () => {
    setIsHardConstraintsOpen(false);
    setIsPreviousMonthShiftsOpen(false);
    setIsWeightsOpen((prev) => !prev);
  };

  const handleToggleHardConstraintsPanel = () => {
    setIsWeightsOpen(false);
    setIsPreviousMonthShiftsOpen(false);
    setIsHardConstraintsOpen((prev) => !prev);
  };

  const handleTogglePreviousMonthShiftsPanel = () => {
    setIsWeightsOpen(false);
    setIsHardConstraintsOpen(false);
    setIsPreviousMonthShiftsOpen((prev) => !prev);
  };

  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const weekdaysJp = ["日", "月", "火", "水", "木", "金", "土"];
  const pyWeekdaysJp = ["月", "火", "水", "木", "金", "土", "日", "祝"];
  const pyWeekdays = [0, 1, 2, 3, 4, 5, 6, 7];
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const toYmd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
  const getWeekday = (y: number, m: number, day: number) => weekdaysJp[new Date(y, m - 1, day).getDay()];
  const getPreviousMonthDateKey = (day: number) => {
    const previousDate = new Date(year, month - 2, day);
    return toYmd(previousDate.getFullYear(), previousDate.getMonth() + 1, previousDate.getDate());
  };

  const manualHolidayStorageKey = (y: number, m: number) => `oncall.holidays.manual.${y}-${pad2(m)}`;
  const overrideHolidayStorageKey = (y: number) => `oncall.holidays.override.${y}`;

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(manualHolidayStorageKey(year, month));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setHolidays(parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value)));
        }
      } else {
        setHolidays([]);
      }
    } catch {
      // no-op
    }

    try {
      const raw = window.localStorage.getItem(overrideHolidayStorageKey(year));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const prefix = `${year}-`;
          setHolidayWorkdayOverrides(new Set(parsed.map(String).filter((value) => value.startsWith(prefix))));
        }
      } else {
        setHolidayWorkdayOverrides(new Set());
      }
    } catch {
      // no-op
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(manualHolidayStorageKey(year, month), JSON.stringify(holidays));
    } catch {
      // no-op
    }
  }, [holidays, year, month]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(overrideHolidayStorageKey(year), JSON.stringify(Array.from(holidayWorkdayOverrides)));
    } catch {
      // no-op
    }
  }, [holidayWorkdayOverrides, year]);

  const doctorNameById = useMemo(() => {
    const map: Record<string, string> = {};
    doctors.forEach((doctor) => {
      map[doctor.id] = doctor.name;
    });
    return map;
  }, [doctors]);

  const getDoctorName = (doctorId: string | null | undefined) => {
    if (!doctorId) return "-";
    return doctorNameById[doctorId] ?? "不明";
  };

  const activeDoctors = useMemo(() => doctors.filter((doctor) => doctor.is_active !== false), [doctors]);
  const activeDoctorIds = useMemo(() => activeDoctors.map((doctor) => doctor.id), [activeDoctors]);
  const numDoctors = activeDoctors.length;

  const previousMonthShiftDoctorIdByKey = useMemo(() => {
    const next: Record<string, string> = {};
    previousMonthShifts.forEach((entry) => {
      const day = Number(entry.date.slice(-2));
      if (!Number.isFinite(day)) return;
      next[String(day) + "_" + entry.shift_type] = entry.doctor_id;
    });
    return next;
  }, [previousMonthShifts]);

  const prevMonthWorkedDaysMap = useMemo(() => {
    const next: Record<string, number[]> = {};

    previousMonthShifts.forEach((entry) => {
      const day = Number(entry.date.slice(-2));
      if (!Number.isFinite(day)) return;
      next[entry.doctor_id] = next[entry.doctor_id] ?? [];
      if (!next[entry.doctor_id].includes(day)) next[entry.doctor_id].push(day);
    });

    Object.values(next).forEach((days) => days.sort((left, right) => left - right));
    return next;
  }, [previousMonthShifts]);

  const filterRecordByActiveDoctors = <T,>(input: Record<string, T>) => {
    const next: Record<string, T> = {};
    activeDoctorIds.forEach((id) => {
      if (Object.prototype.hasOwnProperty.call(input, id)) {
        next[id] = input[id];
      }
    });
    return next;
  };

  const isActiveDoctorId = (doctorId: string | null | undefined) => {
    if (!doctorId) return false;
    return activeDoctorIds.includes(doctorId);
  };

  const markScheduleClean = (rows: ScheduleRow[] = schedule) => {
    savedScheduleSignatureRef.current = getScheduleSignature(rows);
    setIsDirty(false);
  };

  const confirmMoveWithUnsavedChanges = () => {
    if (!isDirty || typeof window === "undefined") return true;
    const confirmed = window.confirm("保存されていませんが移動しますか？");
    if (confirmed) markScheduleClean();
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
    setIsDirty(getScheduleSignature(schedule) !== savedScheduleSignatureRef.current);
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
    toggleSwapMode,
    handleShiftTap,
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

  const toggleUnavailable = (doctorId: string, ymd: string, targetShift?: TargetShift | null) => {
    if (!doctorId) return;
    setUnavailableMap((prev) => {
      const currentEntries = prev[doctorId] || [];
      const currentTargetShift = getUnavailableDateTargetShift(currentEntries, ymd);
      const nextEntries = setUnavailableDateTargetShift(
        currentEntries,
        ymd,
        targetShift === undefined ? (currentTargetShift ? null : "all") : targetShift
      );
      return { ...prev, [doctorId]: nextEntries };
    });
  };

  const toggleAllUnavailable = () => {
    if (!selectedDoctorId) return;

    const currentMonthPrefix = `${year}-${pad2(month)}-`;
    setUnavailableMap((prev) => {
      const currentEntries = prev[selectedDoctorId] || [];
      const otherMonthEntries = currentEntries.filter((entry) => !entry.date.startsWith(currentMonthPrefix));
      const currentMonthEntries = currentEntries.filter((entry) => entry.date.startsWith(currentMonthPrefix));
      const nextCurrentMonthEntries =
        currentMonthEntries.length > 0
          ? []
          : Array.from({ length: getDaysInMonth(year, month) }, (_, index) => ({
              date: toYmd(year, month, index + 1),
              target_shift: "all" as const,
            }));

      return {
        ...prev,
        [selectedDoctorId]: [...otherMonthEntries, ...nextCurrentMonthEntries],
      };
    });
  };

  const toggleFixedWeekday = (doctorId: string, weekdayPy: number, targetShift?: TargetShift | null) => {
    if (!doctorId) return;
    setFixedUnavailableWeekdaysMap((prev) => {
      const current = prev[doctorId] || [];
      const currentTargetShift = getFixedWeekdayTargetShift(current, weekdayPy);
      const next = setFixedWeekdayTargetShift(
        current,
        weekdayPy,
        targetShift === undefined ? (currentTargetShift ? null : "all") : targetShift
      );
      return { ...prev, [doctorId]: next };
    });
  };

  const handleHardConstraintChange = (key: keyof HardConstraints, value: number | boolean) => {
    setHardConstraints((prev) => {
      const currentValue = prev[key];
      if (typeof currentValue === "boolean") {
        return { ...prev, [key]: Boolean(value) };
      }

      const numericValue = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
      return { ...prev, [key]: numericValue };
    });
  };

  const handlePrevMonthLastDayChange = (value: number) => {
    const actualLastDay = calcPrevMonthLastDay(year, month);
    const nextValue = Number.isFinite(value) ? Math.max(1, Math.min(actualLastDay, Math.round(value))) : actualLastDay;
    setPrevMonthLastDay(nextValue);
    setPreviousMonthShifts((prev) => prev.filter((entry) => Number(entry.date.slice(-2)) <= nextValue));
  };

  const getPreviousMonthShiftDoctorId = (prevDay: number, shiftType: ShiftType) =>
    previousMonthShiftDoctorIdByKey[String(prevDay) + "_" + shiftType] ?? "";

  const setPreviousMonthShift = (prevDay: number, shiftType: ShiftType, doctorId: string) => {
    const dateKey = getPreviousMonthDateKey(prevDay);

    setPreviousMonthShifts((prev) => {
      const next = prev.filter((entry) => !(entry.date === dateKey && entry.shift_type === shiftType));
      if (!doctorId) return next;
      return [...next, { date: dateKey, shift_type: shiftType, doctor_id: doctorId }].sort((left, right) => {
        if (left.date !== right.date) return left.date.localeCompare(right.date);
        if (left.shift_type === right.shift_type) return left.doctor_id.localeCompare(right.doctor_id);
        return left.shift_type === "day" ? -1 : 1;
      });
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
  const prevMonthTailDays = useMemo(() => {
    const start = Math.max(1, prevMonthLastDay - 3);
    const days: number[] = [];
    for (let day = start; day <= prevMonthLastDay; day++) days.push(day);
    return days;
  }, [prevMonthLastDay]);

  const handleHolidayOverrideToggle = (ymd: string) => {
    setDisabledHolidaySetYear((prev) => {
      const next = new Set(prev);
      if (next.has(ymd)) next.delete(ymd);
      else next.add(ymd);
      return next;
    });
  };

  const handleMinScoreChange = (doctorId: string, value: number) => {
    const nextValue = Number.isFinite(value) ? value : scoreMin;
    setMinScoreMap((prev) => ({ ...prev, [doctorId]: nextValue }));
  };

  const handleMaxScoreChange = (doctorId: string, value: number) => {
    const nextValue = Number.isFinite(value) ? value : scoreMax;
    setMaxScoreMap((prev) => ({ ...prev, [doctorId]: nextValue }));
  };

  const handleTargetScoreChange = (doctorId: string, value: number) => {
    const nextValue = Number.isFinite(value) ? value : 0;
    setTargetScoreMap((prev) => ({ ...prev, [doctorId]: nextValue }));
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
                    <div className="mt-2 text-sm text-gray-500">未固定枠を白紙化しつつ、条件をもとに再計算しています。</div>
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






