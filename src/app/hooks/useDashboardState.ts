"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_HARD_CONSTRAINTS,
  DEFAULT_OBJECTIVE_WEIGHTS,
  DEFAULT_SHIFT_SCORES,
  type Doctor,
  type FixedUnavailableWeekdayMap,
  type HardConstraints,
  type ObjectiveWeights,
  type PreviousMonthShift,
  type ShiftScores,
  type ShiftType,
  type TargetShift,
  type UnavailableDateMap,
} from "../types/dashboard";
import {
  getFixedWeekdayTargetShift,
  getUnavailableDateTargetShift,
  setFixedWeekdayTargetShift,
  setUnavailableDateTargetShift,
} from "../utils/unavailableSettings";

const getDashboardInitialTargetMonth = (baseDate = new Date()) => {
  const dayOfMonth = baseDate.getDate();
  const targetDate =
    dayOfMonth <= 10
      ? new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
      : new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);

  return {
    year: targetDate.getFullYear(),
    month: targetDate.getMonth() + 1,
  };
};

const getDoctorPreferenceMonthDate = (baseDate = new Date()) => new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
const calcPrevMonthLastDay = (year: number, month: number) => new Date(year, month - 1, 0).getDate();
const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const pad2 = (value: number) => String(value).padStart(2, "0");

export default function useDashboardState() {
  const defaultTargetMonth = getDashboardInitialTargetMonth();
  const defaultDoctorPreferenceMonth = getDoctorPreferenceMonthDate();

  const [year, setYear] = useState<number>(defaultTargetMonth.year);
  const [month, setMonth] = useState<number>(defaultTargetMonth.month);
  const [doctorUnavailableMonth, setDoctorUnavailableMonth] = useState<Date>(defaultDoctorPreferenceMonth);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [holidays, setHolidays] = useState<number[]>([]);
  const [holidayWorkdayOverrides, setHolidayWorkdayOverrides] = useState<Set<string>>(() => new Set());
  const [scoreMin, setScoreMin] = useState<number>(0.5);
  const [scoreMax, setScoreMax] = useState<number>(4.5);
  const [scoreTargetDefault, setScoreTargetDefault] = useState<number | null>(null);
  const [shiftScores, setShiftScores] = useState<ShiftScores>(DEFAULT_SHIFT_SCORES);
  const [objectiveWeights, setObjectiveWeights] = useState<ObjectiveWeights>(DEFAULT_OBJECTIVE_WEIGHTS);
  const [weightRatioOverrides, setWeightRatioOverrides] = useState<import("../components/settings/shared").WeightRatioOverrides>({});
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
  const [targetScoreMap, setTargetScoreMap] = useState<Record<string, number | null>>({});
  const [prevMonthLastDay, setPrevMonthLastDay] = useState<number>(() => calcPrevMonthLastDay(defaultTargetMonth.year, defaultTargetMonth.month));

  const weekdaysJp = ["日", "月", "火", "水", "木", "金", "土"];
  const pyWeekdaysJp = ["月", "火", "水", "木", "金", "土", "日", "祝"];
  const pyWeekdays = [0, 1, 2, 3, 4, 5, 6, 7];

  const toYmd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
  const getWeekday = (y: number, m: number, day: number) => weekdaysJp[new Date(y, m - 1, day).getDay()];
  const getPreviousMonthDateKey = (day: number) => {
    const previousDate = new Date(year, month - 2, day);
    return toYmd(previousDate.getFullYear(), previousDate.getMonth() + 1, previousDate.getDate());
  };

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

  const doctorNameById = useMemo(() => {
    const map: Record<string, string> = {};
    doctors.forEach((doctor) => {
      map[doctor.id] = doctor.name;
    });
    return map;
  }, [doctors]);

  const getDoctorName = (doctorId: string | null | undefined) => {
    if (!doctorId) return "-";
    if (externalDoctorIds.has(doctorId)) return "外部医師";
    return doctorNameById[doctorId] ?? "不明";
  };

  const activeDoctors = useMemo(() =>
    doctors
      .filter((doctor) => doctor.is_active !== false && doctor.is_external !== true)
      .sort((a, b) => a.name.localeCompare(b.name, "ja", { numeric: true })),
    [doctors],
  );
  const activeDoctorIds = useMemo(() => activeDoctors.map((doctor) => doctor.id), [activeDoctors]);
  const numDoctors = activeDoctors.length;

  const externalDoctors = useMemo(() =>
    doctors.filter((doctor) => doctor.is_external === true && doctor.is_active !== false),
    [doctors],
  );
  const externalDoctorIds = useMemo(() => new Set(externalDoctors.map((d) => d.id)), [externalDoctors]);
  const isExternalDoctor = (doctorId: string | null | undefined) => Boolean(doctorId && externalDoctorIds.has(doctorId));

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

  const isActiveDoctorId = (doctorId: string | null | undefined) => Boolean(doctorId && activeDoctorIds.includes(doctorId));

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

  const handleHardConstraintChange = (key: keyof HardConstraints, value: number | boolean | string | unknown[]) => {
    setHardConstraints((prev) => {
      // 配列型（external_fixed_dates等）
      if (Array.isArray(value)) {
        return { ...prev, [key]: value };
      }
      const currentValue = prev[key];
      if (typeof currentValue === "boolean") {
        return { ...prev, [key]: Boolean(value) };
      }
      if (typeof currentValue === "string" || typeof value === "string") {
        return { ...prev, [key]: value };
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

  const getPreviousMonthShiftDoctorId = (prevDay: number, shiftType: ShiftType) => previousMonthShiftDoctorIdByKey[String(prevDay) + "_" + shiftType] ?? "";

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

  const handleMinScoreChange = (doctorId: string, value: number) => {
    const nextValue = Number.isFinite(value) ? value : scoreMin;
    setMinScoreMap((prev) => ({ ...prev, [doctorId]: nextValue }));
  };

  const handleMaxScoreChange = (doctorId: string, value: number) => {
    const nextValue = Number.isFinite(value) ? value : scoreMax;
    setMaxScoreMap((prev) => ({ ...prev, [doctorId]: nextValue }));
  };

  const handleTargetScoreChange = (doctorId: string, value: number | null) => {
    setTargetScoreMap((prev) => ({ ...prev, [doctorId]: value }));
  };

  const resetDoctorScores = (doctorId: string) => {
    setMinScoreMap((prev) => { const next = { ...prev }; delete next[doctorId]; return next; });
    setMaxScoreMap((prev) => { const next = { ...prev }; delete next[doctorId]; return next; });
    setTargetScoreMap((prev) => { const next = { ...prev }; delete next[doctorId]; return next; });
  };

  const prevMonthTailDays = useMemo(() => {
    const start = Math.max(1, prevMonthLastDay - 3);
    const days: number[] = [];
    for (let day = start; day <= prevMonthLastDay; day++) days.push(day);
    return days;
  }, [prevMonthLastDay]);

  return {
    year,
    month,
    setYear,
    setMonth,
    doctorUnavailableMonth,
    setDoctorUnavailableMonth,
    doctors,
    setDoctors,
    holidays,
    setHolidays,
    holidayWorkdayOverrides,
    setHolidayWorkdayOverrides,
    scoreMin,
    setScoreMin,
    scoreMax,
    setScoreMax,
    scoreTargetDefault,
    setScoreTargetDefault,
    shiftScores,
    setShiftScores,
    objectiveWeights,
    setObjectiveWeights,
    setWeight,
    weightRatioOverrides,
    setWeightRatioOverrides,
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
    weekdaysJp,
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
    doctorNameById,
    getDoctorName,
    activeDoctors,
    activeDoctorIds,
    numDoctors,
    externalDoctors,
    externalDoctorIds,
    isExternalDoctor,
    previousMonthShiftDoctorIdByKey,
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
    resetDoctorScores,
    prevMonthTailDays,
  };
}
