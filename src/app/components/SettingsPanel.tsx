"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import TargetShiftPopover from "./TargetShiftPopover";
import { useCustomHolidays } from "../hooks/useCustomHolidays";
import { useHolidays } from "../hooks/useHolidays";
import type {
  FixedUnavailableWeekdayMap,
  HardConstraints,
  ObjectiveWeights,
  ShiftType,
  TargetShift,
  UnavailableDateMap,
} from "../types/dashboard";
import { getFixedWeekdayTargetShift, getUnavailableDateTargetShift } from "../utils/unavailableSettings";

type DashboardDoctor = {
  id: string;
  name: string;
  is_active?: boolean;
};

type WeightChangeSummary = {
  isDefault: boolean;
  changedCount: number;
  top: string[];
};

type HolidayMeta = {
  ymd: string;
  isSun: boolean;
  isAutoHoliday: boolean;
  isManualHoliday: boolean;
  isHolidayLike: boolean;
};

type GenerationSettingsPanelProps = {
  isLoading: boolean;
  isLoadingCustom: boolean;
  customError: string;
  isSavingCustom: boolean;
  customSaveMessage: string;
  hasUnsavedCustomChanges: boolean;
  scoreMin: number;
  scoreMax: number;
  objectiveWeights: ObjectiveWeights;
  hardConstraints: HardConstraints;
  weightChanges: WeightChangeSummary;
  isWeightsOpen: boolean;
  isHardConstraintsOpen: boolean;
  isPreviousMonthShiftsOpen: boolean;
  year: number;
  month: number;
  doctorUnavailableMonth: Date;
  numDoctors: number;
  activeDoctors: DashboardDoctor[];
  holidayWorkdayOverrides: Set<string>;
  daysInMonth: number;
  selectedDoctorId: string;
  unavailableMap: UnavailableDateMap;
  fixedUnavailableWeekdaysMap: FixedUnavailableWeekdayMap;
  pyWeekdays: number[];
  pyWeekdaysJp: string[];
  prevMonthLastDay: number;
  prevMonthTailDays: number[];
  getPreviousMonthShiftDoctorId: (prevDay: number, shiftType: ShiftType) => string;
  onScoreMinChange: (value: number) => void;
  onScoreMaxChange: (value: number) => void;
  onToggleWeights: () => void;
  onResetWeights: () => void;
  onCloseWeights: () => void;
  onToggleHardConstraints: () => void;
  onResetHardConstraints: () => void;
  onCloseHardConstraints: () => void;
  onTogglePreviousMonthShifts: () => void;
  onClosePreviousMonthShifts: () => void;
  onWeightChange: (key: keyof ObjectiveWeights, value: number) => void;
  onHardConstraintChange: (key: keyof HardConstraints, value: number | boolean) => void;
  onYearChange: (value: number) => void;
  onMonthChange: (value: number) => void;
  isHolidayLikeDay: (day: number) => HolidayMeta;
  onToggleHoliday: (day: number) => void;
  onToggleHolidayOverride: (ymd: string) => void;
  onSaveCustomHolidays: () => void;
  onSelectedDoctorChange: (doctorId: string) => void;
  onDoctorUnavailableMonthChange: (value: Date) => void;
  onToggleAllUnavailable: () => void;
  onToggleUnavailable: (doctorId: string, ymd: string, targetShift?: TargetShift | null) => void;
  onToggleFixedWeekday: (doctorId: string, weekdayPy: number, targetShift?: TargetShift | null) => void;
  onPrevMonthLastDayChange: (value: number) => void;
  onSetPreviousMonthShift: (prevDay: number, shiftType: ShiftType, doctorId: string) => void;
  onGenerate: () => void;
  isGenerateDisabled?: boolean;
};

type DoctorSettingsPanelProps = {
  isBulkSavingDoctors: boolean;
  activeDoctors: DashboardDoctor[];
  minScoreMap: Record<string, number>;
  maxScoreMap: Record<string, number>;
  targetScoreMap: Record<string, number>;
  scoreMin: number;
  scoreMax: number;
  onSaveAllDoctorsSettings: () => void;
  onMinScoreChange: (doctorId: string, value: number) => void;
  onMaxScoreChange: (doctorId: string, value: number) => void;
  onTargetScoreChange: (doctorId: string, value: number) => void;
};

const weightInputs = [
  { key: "gap5", label: "5日間隔", min: 0, max: 200, step: 5, hint: "勤務間隔" },
  { key: "soft_unavailable", label: "忌避日のソフト回避", min: 0, max: 200, step: 5, hint: "希望日の尊重" },
  { key: "sat_consec", label: "2か月連続土曜回避", min: 0, max: 200, step: 5, hint: "連続土曜抑制" },
  { key: "weekend_hol_3rd", label: "土日祝合算3回目ペナルティ", min: 0, max: 200, step: 5, hint: "土日祝回数抑制" },
  { key: "gap6", label: "6日間隔", min: 0, max: 200, step: 5, hint: "余裕を持つ" },
  { key: "month_fairness", label: "同月のスコア平準化", min: 0, max: 200, step: 5, hint: "同月の偏り抑制" },
  { key: "target", label: "目標スコアへの近似度", min: 0, max: 200, step: 5, hint: "個別目標寄せ" },
  { key: "score_balance", label: "過去数か月のスコア平準化", min: 0, max: 200, step: 5, hint: "負担バランス" },
  { key: "sunhol_fairness", label: "同月の日祝回数平準化", min: 0, max: 200, step: 5, hint: "日祝回数の均等化" },
  { key: "past_sat_gap", label: "過去数か月の土曜勤務平準化", min: 0, max: 200, step: 5, hint: "過去実績考慮" },
  { key: "past_sunhol_gap", label: "過去数か月の日祝勤務平準化", min: 0, max: 200, step: 5, hint: "過去実績考慮" },
] as const satisfies ReadonlyArray<{
  key: keyof ObjectiveWeights;
  label: string;
  min: number;
  max: number;
  step: number;
  hint: string;
}>;

const hardConstraintNumberInputs = [
  { key: "interval_days", label: "勤務間隔ルール", min: 0, max: 10, step: 1, unit: "日", hint: "0でOFF / 既定4" },
  {
    key: "max_weekend_holiday_works",
    label: "土日祝の合算勤務上限",
    min: 0,
    max: 10,
    step: 1,
    unit: "回",
    hint: "0でOFF / 既定3",
  },
  {
    key: "max_saturday_nights",
    label: "土曜当直上限",
    min: 0,
    max: 10,
    step: 1,
    unit: "回",
    hint: "0でOFF / 既定1",
  },
  {
    key: "max_sunhol_days",
    label: "日祝・日直上限",
    min: 0,
    max: 10,
    step: 1,
    unit: "回",
    hint: "0でOFF / 既定2",
  },
  {
    key: "max_sunhol_works",
    label: "日祝勤務上限",
    min: 0,
    max: 10,
    step: 1,
    unit: "回",
    hint: "0でOFF / 既定3",
  },
] as const satisfies ReadonlyArray<{
  key: keyof HardConstraints;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint: string;
}>;

const hardConstraintToggleInputs = [
  {
    key: "prevent_sunhol_consecutive",
    label: "日祝の昼夜連続勤務を禁止",
    hint: "ON で日祝の日直と当直の連続勤務をハード制約として禁止します。",
  },
  {
    key: "respect_unavailable_days",
    label: "医師の休み希望を絶対守る",
    hint: "ON で不可日・不可曜日を厳守し、OFF で optimizer 側の緩和余地を残します。",
  },
] as const satisfies ReadonlyArray<{
  key: keyof HardConstraints;
  label: string;
  hint: string;
}>;

const fixedWeekdayLabels = ["月", "火", "水", "木", "金", "土", "日", "祝"] as const;

const pad2 = (value: number) => String(value).padStart(2, "0");
const toDateKey = (date: Date) => format(date, "yyyy-MM-dd");
const parseDateKey = (value: string) => {
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const clampNumber = (value: number, min?: number, max?: number) => {
  let next = value;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
};

const getStepPrecision = (step: number) => {
  const stepText = String(step);
  const decimal = stepText.includes(".") ? stepText.split(".")[1]?.length ?? 0 : 0;
  return decimal;
};

const formatStepValue = (value: number, step: number) => {
  const precision = getStepPrecision(step);
  return Number(value.toFixed(precision)).toString();
};

type StepperNumberInputProps = {
  value: number;
  onCommit: (value: number) => void;
  fallbackValue: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
};

function StepperNumberInput({
  value,
  onCommit,
  fallbackValue,
  min,
  max,
  step = 1,
  disabled = false,
  placeholder,
  inputMode,
  className = "",
  inputClassName = "",
  buttonClassName = "",
}: StepperNumberInputProps) {
  const [draft, setDraft] = useState(() => formatStepValue(value, step));

  useEffect(() => {
    setDraft(formatStepValue(value, step));
  }, [step, value]);

  const commitDraft = (raw: string) => {
    const trimmed = raw.trim();
    const parsed = trimmed === "" ? fallbackValue : Number(trimmed);
    const nextValue = clampNumber(Number.isFinite(parsed) ? parsed : fallbackValue, min, max);
    const nextText = formatStepValue(nextValue, step);
    setDraft(nextText);
    onCommit(nextValue);
  };

  const handleStep = (direction: -1 | 1) => {
    const parsed = draft.trim() === "" ? fallbackValue : Number(draft);
    const baseValue = Number.isFinite(parsed) ? parsed : fallbackValue;
    const nextValue = clampNumber(baseValue + direction * step, min, max);
    const nextText = formatStepValue(nextValue, step);
    setDraft(nextText);
    onCommit(nextValue);
  };

  return (
    <div className={["flex w-full min-w-0 items-center gap-1", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        onClick={() => handleStep(-1)}
        disabled={disabled}
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-bold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40",
          buttonClassName,
        ].filter(Boolean).join(" ")}
      >
        -
      </button>
      <input
        type="text"
        inputMode={inputMode ?? (step % 1 === 0 ? "numeric" : "decimal")}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commitDraft(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitDraft(draft);
          }
        }}
        disabled={disabled}
        placeholder={placeholder}
        className={[
          "w-full min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-2 text-center text-sm font-semibold tabular-nums text-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100",
          inputClassName,
        ].filter(Boolean).join(" ")}
      />
      <button
        type="button"
        onClick={() => handleStep(1)}
        disabled={disabled}
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-bold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40",
          buttonClassName,
        ].filter(Boolean).join(" ")}
      >
        +
      </button>
    </div>
  );
}
const dayPickerBaseClassName = [
  "w-full",
  "[--rdp-day-width:2.35rem] [--rdp-day-height:2.35rem]",
  "[--rdp-day_button-width:2.35rem] [--rdp-day_button-height:2.35rem]",
  "[--rdp-months-gap:0px]",
  "sm:[--rdp-day-width:2.65rem] sm:[--rdp-day-height:2.65rem]",
  "sm:[--rdp-day_button-width:2.65rem] sm:[--rdp-day_button-height:2.65rem]",
].join(" ");

const dayPickerClassNames = {
  root: "w-full",
  months: "block w-full max-w-none",
  month: "w-full space-y-3",
  month_caption: "flex min-w-0 items-center justify-center text-center",
  caption_label: "truncate px-3 text-base font-bold tracking-tight text-slate-900",
  nav: "hidden",
  month_grid: "w-full table-fixed border-collapse",
  weekdays: "border-b border-slate-200/80",
  weekday: "pb-2 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400",
  week: "border-b border-slate-100 last:border-b-0",
  day: "p-0 text-center align-middle",
  day_button:
    "mx-auto my-1 flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-sm font-medium text-slate-700 transition hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
};

const baseCalendarModifierClasses = {
  saturday:
    "[&>button]:bg-blue-50/70 [&>button]:text-blue-600 hover:[&>button]:bg-blue-100/80",
  sunday:
    "[&>button]:bg-red-50/70 [&>button]:text-red-600 hover:[&>button]:bg-red-100/80",
  today:
    "[&>button]:ring-1 [&>button]:ring-indigo-200 [&>button]:font-semibold [&>button]:text-indigo-700",
  outside: "[&>button]:bg-transparent [&>button]:text-slate-300",
  disabled:
    "[&>button]:!bg-transparent [&>button]:!text-slate-300 [&>button]:opacity-45 [&>button]:hover:bg-transparent [&>button]:hover:shadow-none",
};

const unavailableAllModifierClass =
  "[&>button]:relative [&>button]:!border-red-400 [&>button]:!bg-red-300 [&>button]:!text-transparent [&>button]:shadow-sm hover:[&>button]:!bg-red-400 [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[11px] [&>button]:after:font-bold [&>button]:after:text-red-900 [&>button]:after:content-['[休]']";

const unavailableDayModifierClass =
  "[&>button]:relative [&>button]:border-red-300 [&>button]:text-transparent [&>button]:bg-[linear-gradient(135deg,#fecaca_0%,#fecaca_50%,transparent_50%,transparent_100%)] [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[11px] [&>button]:after:font-bold [&>button]:after:text-red-800 [&>button]:after:content-['[日]']";

const unavailableNightModifierClass =
  "[&>button]:relative [&>button]:border-red-300 [&>button]:text-transparent [&>button]:bg-[linear-gradient(135deg,transparent_0%,transparent_50%,#fecaca_50%,#fecaca_100%)] [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[11px] [&>button]:after:font-bold [&>button]:after:text-red-800 [&>button]:after:content-['[当]']";

const getTargetShiftSummaryLabel = (targetShift: TargetShift | null) => {
  if (targetShift === "all") return "終日休み";
  if (targetShift === "day") return "日直のみ休み";
  if (targetShift === "night") return "当直のみ休み";
  return "設定なし";
};

const getAnchorPosition = (target: HTMLElement, container: HTMLElement | null) => {
  const targetRect = target.getBoundingClientRect();
  const containerRect = container?.getBoundingClientRect();
  return {
    top: targetRect.bottom - (containerRect?.top ?? 0) + 8,
    left: targetRect.left - (containerRect?.left ?? 0) + targetRect.width / 2,
  };
};

const getFixedWeekdayButtonTone = (weekday: number, targetShift: TargetShift | null) => {
  const isSun = weekday === 6;
  const isHoliday = weekday === 7;
  const isSat = weekday === 5;
  const isHolidayLike = isSun || isHoliday;

  if (isHolidayLike) {
    if (targetShift === "all") return "border-red-400 bg-red-300 text-red-900";
    if (targetShift === "day") return "border-red-300 text-red-800 bg-[linear-gradient(135deg,#fecaca_0%,#fecaca_50%,transparent_50%,transparent_100%)]";
    if (targetShift === "night") return "border-red-300 text-red-800 bg-[linear-gradient(135deg,transparent_0%,transparent_50%,#fecaca_50%,#fecaca_100%)]";
    return "border-red-200 bg-red-50 text-red-400 hover:bg-red-100";
  }

  if (targetShift === "all") {
    if (isSat) return "border-blue-700 bg-blue-600 text-white";
    return "border-gray-900 bg-gray-900 text-white";
  }

  if (targetShift === "day") return "border-amber-300 bg-amber-50 text-amber-900";
  if (targetShift === "night") return "border-sky-300 bg-sky-50 text-sky-900";
  if (isSat) return "border-blue-200 bg-blue-50 text-blue-500 hover:bg-blue-100";
  return "border-gray-200 bg-white text-gray-500 hover:bg-gray-50";
};

const getFixedWeekdayButtonLabel = (targetShift: TargetShift | null) => {
  if (targetShift === "all") return "[休]";
  if (targetShift === "day") return "[日]";
  if (targetShift === "night") return "[当]";
  return "";
};

export function GenerationSettingsPanel({
  isLoading,
  isLoadingCustom,
  customError,
  isSavingCustom,
  customSaveMessage,
  hasUnsavedCustomChanges,
  scoreMin,
  scoreMax,
  objectiveWeights,
  hardConstraints,
  weightChanges,
  isWeightsOpen,
  isHardConstraintsOpen,
  isPreviousMonthShiftsOpen,
  year,
  month,
  doctorUnavailableMonth,
  numDoctors,
  activeDoctors,
  holidayWorkdayOverrides,
  daysInMonth,
  selectedDoctorId,
  unavailableMap,
  fixedUnavailableWeekdaysMap,
  pyWeekdays,
  prevMonthLastDay,
  prevMonthTailDays,
  getPreviousMonthShiftDoctorId,
  onScoreMinChange,
  onScoreMaxChange,
  onToggleWeights,
  onResetWeights,
  onCloseWeights,
  onToggleHardConstraints,
  onResetHardConstraints,
  onCloseHardConstraints,
  onTogglePreviousMonthShifts,
  onClosePreviousMonthShifts,
  onWeightChange,
  onHardConstraintChange,
  onYearChange,
  onMonthChange,
  isHolidayLikeDay,
  onToggleHoliday,
  onToggleHolidayOverride,
  onSaveCustomHolidays,
  onSelectedDoctorChange,
  onDoctorUnavailableMonthChange,
  onToggleAllUnavailable,
  onToggleUnavailable,
  onToggleFixedWeekday,
  onPrevMonthLastDayChange,
  onSetPreviousMonthShift,
  onGenerate,
  isGenerateDisabled = false,
}: GenerationSettingsPanelProps) {
  const displayMonth = useMemo(() => new Date(year, month - 1, 1), [year, month]);
  const doctorUnavailableYear = doctorUnavailableMonth.getFullYear();
  const doctorUnavailableMonthNumber = doctorUnavailableMonth.getMonth() + 1;
  const doctorUnavailableMonthPrefix = `${doctorUnavailableYear}-${pad2(doctorUnavailableMonthNumber)}-`;
  const selectedDoctor = activeDoctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;
  const unavailableSectionRef = useRef<HTMLDivElement | null>(null);
  const fixedWeekdaySectionRef = useRef<HTMLDivElement | null>(null);
  const [unavailablePopover, setUnavailablePopover] = useState<{
    dateKey: string;
    position: { top: number; left: number };
  } | null>(null);
  const [fixedWeekdayPopover, setFixedWeekdayPopover] = useState<{
    doctorId: string;
    weekday: number;
    position: { top: number; left: number };
  } | null>(null);
  const { holidaySet: doctorUnavailableStandardHolidaySet } = useHolidays(doctorUnavailableYear);
  const {
    manualSet: doctorUnavailableManualSet,
    disabledSet: doctorUnavailableDisabledSet,
    customError: doctorUnavailableCustomError,
  } = useCustomHolidays(doctorUnavailableYear);

  const doctorUnavailableHolidaySet = useMemo(() => {
    const next = new Set<string>(doctorUnavailableStandardHolidaySet);

    if (doctorUnavailableCustomError) {
      return next;
    }

    for (const date of doctorUnavailableDisabledSet) {
      next.delete(date);
    }

    for (const date of doctorUnavailableManualSet) {
      next.add(date);
    }

    return next;
  }, [doctorUnavailableCustomError, doctorUnavailableDisabledSet, doctorUnavailableManualSet, doctorUnavailableStandardHolidaySet]);

  const selectedUnavailableInMonth = useMemo(() => {
    const selectedDoctorUnavailable = unavailableMap[selectedDoctorId] ?? [];
    return selectedDoctorUnavailable
      .filter((entry) => entry.date.startsWith(doctorUnavailableMonthPrefix))
      .slice()
      .sort((left, right) => left.date.localeCompare(right.date));
  }, [doctorUnavailableMonthPrefix, selectedDoctorId, unavailableMap]);

  const selectedUnavailableDates = useMemo(
    () =>
      selectedUnavailableInMonth
        .map((entry) => parseDateKey(entry.date))
        .filter((value): value is Date => value instanceof Date),
    [selectedUnavailableInMonth]
  );

  const selectedFixedWeekdays = useMemo(
    () => (selectedDoctorId ? fixedUnavailableWeekdaysMap[selectedDoctorId] ?? [] : []),
    [fixedUnavailableWeekdaysMap, selectedDoctorId]
  );

  const previousMonthShiftCount = useMemo(
    () =>
      prevMonthTailDays.reduce((count, day) => {
        const dayDoctorId = getPreviousMonthShiftDoctorId(day, "day");
        const nightDoctorId = getPreviousMonthShiftDoctorId(day, "night");
        return count + (dayDoctorId ? 1 : 0) + (nightDoctorId ? 1 : 0);
      }, 0),
    [getPreviousMonthShiftDoctorId, prevMonthTailDays]
  );

  const unavailableCounts = useMemo(
    () =>
      selectedUnavailableInMonth.reduce(
        (acc, entry) => {
          acc.total += 1;
          acc[entry.target_shift] += 1;
          return acc;
        },
        { total: 0, all: 0, day: 0, night: 0 }
      ),
    [selectedUnavailableInMonth]
  );

  const holidayCounts = useMemo(() => {
    let autoCount = 0;
    let manualCount = 0;
    let overrideCount = 0;

    for (let day = 1; day <= daysInMonth; day += 1) {
      const info = isHolidayLikeDay(day);
      if (info.isAutoHoliday && holidayWorkdayOverrides.has(info.ymd)) overrideCount += 1;
      else if (info.isAutoHoliday) autoCount += 1;
      if (info.isManualHoliday) manualCount += 1;
    }

    return { autoCount, manualCount, overrideCount };
  }, [daysInMonth, holidayWorkdayOverrides, isHolidayLikeDay]);

  const holidaySelectedDates = useMemo(() => {
    const dates: Date[] = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const info = isHolidayLikeDay(day);
      if (info.isManualHoliday || (info.isAutoHoliday && !holidayWorkdayOverrides.has(info.ymd))) {
        dates.push(new Date(year, month - 1, day));
      }
    }
    return dates;
  }, [daysInMonth, holidayWorkdayOverrides, isHolidayLikeDay, month, year]);

  const holidayCalendarModifiers = useMemo(
    () => ({
      saturday: (date: Date) => date.getDay() === 6,
      sunday: (date: Date) => date.getDay() === 0,
      autoHoliday: (date: Date) => {
        if (date.getFullYear() !== year || date.getMonth() !== month - 1) return false;
        const info = isHolidayLikeDay(date.getDate());
        return info.isAutoHoliday && !holidayWorkdayOverrides.has(info.ymd);
      },
      manualHoliday: (date: Date) => {
        if (date.getFullYear() !== year || date.getMonth() !== month - 1) return false;
        return isHolidayLikeDay(date.getDate()).isManualHoliday;
      },
      overrideHoliday: (date: Date) => {
        if (date.getFullYear() !== year || date.getMonth() !== month - 1) return false;
        const info = isHolidayLikeDay(date.getDate());
        return info.isAutoHoliday && holidayWorkdayOverrides.has(info.ymd);
      },
    }),
    [holidayWorkdayOverrides, isHolidayLikeDay, month, year]
  );

  const unavailableCalendarModifiers = useMemo(
    () => ({
      saturday: (date: Date) => date.getDay() === 6,
      sunday: (date: Date) => date.getDay() === 0,
      holiday: (date: Date) =>
        date.getFullYear() === doctorUnavailableYear &&
        date.getMonth() === doctorUnavailableMonthNumber - 1 &&
        doctorUnavailableHolidaySet.has(toDateKey(date)),
      allUnavailable: (date: Date) =>
        getUnavailableDateTargetShift(selectedUnavailableInMonth, toDateKey(date)) === "all",
      dayUnavailable: (date: Date) =>
        getUnavailableDateTargetShift(selectedUnavailableInMonth, toDateKey(date)) === "day",
      nightUnavailable: (date: Date) =>
        getUnavailableDateTargetShift(selectedUnavailableInMonth, toDateKey(date)) === "night",
    }),
    [doctorUnavailableHolidaySet, doctorUnavailableMonthNumber, doctorUnavailableYear, selectedUnavailableInMonth]
  );

  const closePopovers = () => {
    setUnavailablePopover(null);
    setFixedWeekdayPopover(null);
  };

  const handleYearInputChange = (value: number) => {
    closePopovers();
    onYearChange(value);
  };

  const handleMonthInputChange = (value: number) => {
    closePopovers();
    onMonthChange(value);
  };

  const handleDoctorSelection = (doctorId: string) => {
    closePopovers();
    onSelectedDoctorChange(doctorId);
  };

  const handleDoctorUnavailableMonthChange = (nextMonth: Date) => {
    setUnavailablePopover(null);
    onDoctorUnavailableMonthChange(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
  };


  const handleHolidayDateClick = (date: Date) => {
    if (date.getFullYear() !== year || date.getMonth() !== month - 1) return;

    const day = date.getDate();
    const info = isHolidayLikeDay(day);
    if (info.isSun) return;

    if (info.isAutoHoliday) {
      onToggleHolidayOverride(info.ymd);
      return;
    }

    onToggleHoliday(day);
  };

  const handleUnavailableDayClick = (date: Date, _modifiers: unknown, event: ReactMouseEvent<Element>) => {
    if (!selectedDoctorId) return;
    if (date.getFullYear() !== doctorUnavailableYear || date.getMonth() !== doctorUnavailableMonthNumber - 1) return;

    const dateKey = toDateKey(date);
    const info = isHolidayLikeDay(date.getDate());
    if (info.isHolidayLike) {
      setUnavailablePopover({
        dateKey,
        position: getAnchorPosition(event.currentTarget as HTMLElement, unavailableSectionRef.current),
      });
      return;
    }

    onToggleUnavailable(selectedDoctorId, dateKey);
  };

  const handleFixedWeekdayClick = (
    doctorId: string,
    weekday: number,
    currentValue: TargetShift | null,
    event: ReactMouseEvent<HTMLButtonElement>
  ) => {
    closePopovers();

    if (weekday <= 5) {
      onToggleFixedWeekday(doctorId, weekday, currentValue ? null : "all");
      return;
    }

    setFixedWeekdayPopover({
      doctorId,
      weekday,
      position: getAnchorPosition(event.currentTarget, fixedWeekdaySectionRef.current),
    });
  };

  return (
    <div
      className={`relative h-fit min-w-0 rounded-xl border border-blue-100 bg-blue-50 p-4 transition md:p-5 lg:sticky lg:top-24 ${
        isLoading ? "opacity-80" : "opacity-100"
      }`}
    >
      {isLoading ? (
        <div className="pointer-events-auto absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-white/50 p-4 backdrop-blur-[1px]">
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>生成中は入力を一時ロックしています</span>
          </div>
        </div>
      ) : null}

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-900">生成条件と休日設定</h2>
          <p className="mt-1 text-sm text-blue-700">対象月と不可条件を整えてから未固定枠を再生成します。</p>
        </div>
        <div className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-700">
          {format(displayMonth, "yyyy年M月")}
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-gray-800">最適化サマリー</div>
            <div className="text-xs text-gray-500">スコア帯、重み、ハード制約の状態をここで確認できます。</div>
          </div>
          {weightChanges.isDefault ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
              既定値
            </span>
          ) : (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
              変更あり {weightChanges.changedCount}件
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 text-[11px] font-bold text-gray-700">score_min</div>
            <StepperNumberInput
              value={scoreMin}
              onCommit={onScoreMinChange}
              fallbackValue={0.5}
              step={0.5}
              inputMode="decimal"
            />
          </label>
          <label className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 text-[11px] font-bold text-gray-700">score_max</div>
            <StepperNumberInput
              value={scoreMax}
              onCommit={onScoreMaxChange}
              fallbackValue={4.5}
              step={0.5}
              inputMode="decimal"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          {weightChanges.top.length > 0 ? (
            weightChanges.top.map((item) => (
              <span key={item} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 font-bold text-gray-700">
                {item}
              </span>
            ))
          ) : (
            <span className="text-gray-500">重みは既定値のままです。</span>
          )}
        </div>

        <div className="mt-3 text-[11px] text-gray-500">
          人数が少ない月は score_max を少し広げると解なしを避けやすくなります。
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggleWeights}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
          >
            重み設定を開く
          </button>
          <button
            type="button"
            onClick={onToggleHardConstraints}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
          >
            ルール（ハード制約）設定を開く
          </button>
          <button
            type="button"
            onClick={onTogglePreviousMonthShifts}
            className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
          >
            前月末勤務を確認・修正する
          </button>
        </div>
      </div>


      {isWeightsOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
          <div className="flex max-h-[85dvh] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl sm:max-h-[90vh]">
            <div className="flex items-start justify-between gap-4 border-b border-blue-100 bg-blue-50 px-4 py-4 sm:px-5">
              <div>
                <h3 className="text-base font-bold text-gray-900">重み設定</h3>
                <p className="mt-1 text-xs text-gray-500">ペナルティ重みを調整し、optimizer の目的関数に反映します。</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onResetWeights}
                  className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50"
                >
                  既定値に戻す
                </button>
                <button
                  type="button"
                  onClick={onCloseWeights}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50"
                >
                  閉じる
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {weightInputs.map((weight) => (
                <div key={weight.key} className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-gray-800">{weight.label}</div>
                      <div className="text-[11px] text-gray-500">{weight.hint}</div>
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={objectiveWeights[weight.key]}
                      onChange={(event) => onWeightChange(weight.key, Number(event.target.value))}
                      className="w-20 rounded-lg border border-gray-200 bg-white p-2 text-center text-sm font-bold"
                      min={weight.min}
                      max={weight.max}
                      step={weight.step}
                    />
                  </div>
                  <input
                    type="range"
                    value={objectiveWeights[weight.key]}
                    onChange={(event) => onWeightChange(weight.key, Number(event.target.value))}
                    min={weight.min}
                    max={weight.max}
                    step={weight.step}
                    className="w-full accent-blue-600"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                    <span>{weight.min}</span>
                    <span>{weight.max}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {isHardConstraintsOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
          <div className="flex max-h-[85dvh] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-2xl sm:max-h-[90vh]">
            <div className="flex items-start justify-between gap-4 border-b border-indigo-100 bg-indigo-50 px-4 py-4 sm:px-5">
              <div>
                <h3 className="text-base font-bold text-gray-900">ルール（ハード制約）設定</h3>
                <p className="mt-1 text-xs text-gray-500">数値は 0 で OFF、トグルは hard constraint として optimize に送信します。</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onResetHardConstraints}
                  className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50"
                >
                  既定値に戻す
                </button>
                <button
                  type="button"
                  onClick={onCloseHardConstraints}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50"
                >
                  閉じる
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {hardConstraintNumberInputs.map((constraint) => {
                  const value = typeof hardConstraints[constraint.key] === "number" ? hardConstraints[constraint.key] : 0;
                  return (
                    <label key={constraint.key} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-1 text-[11px] font-bold text-gray-700">{constraint.label}</div>
                      <div className="mb-2 text-[11px] text-gray-500">{constraint.hint}</div>
                      <div className="flex items-center gap-2">
                        <StepperNumberInput
                          value={value}
                          onCommit={(nextValue) => onHardConstraintChange(constraint.key, nextValue)}
                          fallbackValue={value}
                          min={constraint.min}
                          max={constraint.max}
                          step={constraint.step}
                          inputMode="numeric"
                          inputClassName="text-sm font-bold"
                        />
                        <span className="shrink-0 text-xs font-bold text-gray-500">{constraint.unit}</span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="space-y-3">
                {hardConstraintToggleInputs.map((constraint) => {
                  const enabled = Boolean(hardConstraints[constraint.key]);
                  return (
                    <div
                      key={constraint.key}
                      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-gray-800">{constraint.label}</div>
                        <div className="mt-1 text-[11px] text-gray-500">{constraint.hint}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onHardConstraintChange(constraint.key, !enabled)}
                        className={`inline-flex h-10 min-w-28 items-center justify-center rounded-full border px-4 text-xs font-bold transition ${
                          enabled
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-gray-50 text-gray-500"
                        }`}
                      >
                        {enabled ? "ON" : "OFF"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:grid-cols-2">
        <label>
          <div className="mb-1 text-sm font-bold text-gray-700">年</div>
          <StepperNumberInput
            value={year}
            onCommit={handleYearInputChange}
            fallbackValue={year}
            step={1}
            inputMode="numeric"
          />
        </label>
        <label>
          <div className="mb-1 text-sm font-bold text-gray-700">月</div>
          <StepperNumberInput
            value={month}
            onCommit={handleMonthInputChange}
            fallbackValue={month}
            min={1}
            max={12}
            step={1}
            inputMode="numeric"
          />
        </label>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          稼働医師数: <span className="font-bold text-gray-800">{numDoctors}名</span>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          対象日数: <span className="font-bold text-gray-800">{daysInMonth}日</span>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-800">祝日・手動休日</h3>
            <p className="mt-1 text-[11px] text-gray-500">通常日を押すと追加休日、標準祝日を押すと通常出勤へ切り替えます。</p>
          </div>
          <button
            type="button"
            onClick={onSaveCustomHolidays}
            disabled={isSavingCustom || isLoadingCustom}
            className={`rounded-lg px-3 py-2 text-xs font-bold text-white transition ${
              isSavingCustom || isLoadingCustom
                ? "cursor-not-allowed bg-gray-400"
                : hasUnsavedCustomChanges
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-slate-600 hover:bg-slate-700"
            }`}
          >
            {isSavingCustom ? "保存中..." : "祝日設定を保存"}
          </button>
        </div>

        {(isLoadingCustom || customError || customSaveMessage) ? (
          <div
            className={`mb-3 rounded-xl border px-3 py-2 text-[12px] font-bold ${
              customError
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : customSaveMessage
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            {customError
              ? `祝日設定の保存に失敗しました: ${customError}`
              : customSaveMessage || "祝日設定を読み込み中です..."}
          </div>
        ) : null}

        <DayPicker
          mode="multiple"
          month={displayMonth}
          selected={holidaySelectedDates}
          onDayClick={handleHolidayDateClick}
          showOutsideDays
          className={dayPickerBaseClassName}
          classNames={dayPickerClassNames}
          modifiers={holidayCalendarModifiers}
          modifiersClassNames={{
            ...baseCalendarModifierClasses,
            autoHoliday:
              "[&>button]:bg-red-50/70 [&>button]:text-red-600 hover:[&>button]:bg-red-100/80",
            manualHoliday:
              "[&>button]:bg-rose-500 [&>button]:text-white hover:[&>button]:bg-rose-600",
            overrideHoliday:
              "[&>button]:border-emerald-300 [&>button]:bg-emerald-50 [&>button]:text-emerald-700 hover:[&>button]:bg-emerald-100/80",
          }}
        />

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-600">
            標準祝日 {holidayCounts.autoCount}
          </span>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">
            追加休日 {holidayCounts.manualCount}
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
            平日扱い {holidayCounts.overrideCount}
          </span>
          {hasUnsavedCustomChanges ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
              未保存の変更があります
            </span>
          ) : null}
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-800">医師別不可日設定</h3>
            <p className="mt-1 text-[11px] text-gray-500">
              平日・土曜は1タップで終日休み、日曜・祝日はポップアップで日直/当直別に設定できます。
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleAllUnavailable}
            disabled={!selectedDoctorId}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
          >
            対象月を一括トグル
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {activeDoctors.map((doctor) => (
            <button
              key={doctor.id}
              type="button"
              onClick={() => handleDoctorSelection(doctor.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                selectedDoctorId === doctor.id
                  ? "border-blue-700 bg-blue-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {doctor.name}
            </button>
          ))}
        </div>

        <div ref={unavailableSectionRef} className="relative">
          <DayPicker
            mode="multiple"
            month={doctorUnavailableMonth}
            onMonthChange={handleDoctorUnavailableMonthChange}
            selected={selectedUnavailableDates}
            onDayClick={handleUnavailableDayClick}
            showOutsideDays
            disabled={!selectedDoctorId}
            className={dayPickerBaseClassName}
            classNames={dayPickerClassNames}
            modifiers={unavailableCalendarModifiers}
            modifiersClassNames={{
              ...baseCalendarModifierClasses,
              holiday:
                "[&>button]:bg-red-50/70 [&>button]:text-red-600 hover:[&>button]:bg-red-100/80",
              allUnavailable:
                unavailableAllModifierClass,
              dayUnavailable:
                unavailableDayModifierClass,
              nightUnavailable:
                unavailableNightModifierClass,
            }}
          />
          <TargetShiftPopover
            open={Boolean(unavailablePopover)}
            position={unavailablePopover?.position ?? null}
            title={
              unavailablePopover
                ? `${doctorUnavailableMonthNumber}月${Number(unavailablePopover.dateKey.slice(-2))}日の不可設定`
                : "不可設定"
            }
            currentValue={
              unavailablePopover
                ? getUnavailableDateTargetShift(selectedUnavailableInMonth, unavailablePopover.dateKey)
                : null
            }
            onSelect={(value) => {
              if (!selectedDoctorId || !unavailablePopover) return;
              onToggleUnavailable(selectedDoctorId, unavailablePopover.dateKey, value);
            }}
            onClose={() => setUnavailablePopover(null)}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] text-gray-600">
          <span className="font-bold">{selectedDoctor?.name ?? "医師未選択"}</span>
          <span className="font-bold text-indigo-600">選択中: {unavailableCounts.total}件</span>
          <span className="text-gray-500">終日 {unavailableCounts.all}</span>
          <span className="text-amber-700">日直のみ {unavailableCounts.day}</span>
          <span className="text-sky-700">当直のみ {unavailableCounts.night}</span>
        </div>
      </div>

      <div
        ref={fixedWeekdaySectionRef}
        className="relative mb-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm"
      >
        <div className="mb-3">
          <h3 className="text-sm font-bold text-gray-800">固定不可曜日</h3>
          <p className="mt-1 text-[11px] text-gray-500">
            月〜土は1タップで終日不可、日曜と祝日はポップアップでシフト別に設定できます。
          </p>
        </div>

        <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-bold">
          <span className="rounded-full border border-gray-200 bg-white px-2 py-1 text-gray-600">[休] = 終日</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">[日] = 日直のみ</span>
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-sky-800">[当] = 当直のみ</span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[320px]">
            <div className="mb-2 grid grid-cols-[88px_repeat(8,1fr)] items-center gap-1">
              <div className="text-[11px] font-bold text-gray-600">医師</div>
              {pyWeekdays.map((weekday) => {
                const isSat = weekday === 5;
                const isSun = weekday === 6;
                const isHoliday = weekday === 7;
                return (
                  <div
                    key={weekday}
                    className={`rounded border py-1 text-center text-[11px] font-bold ${
                      isSun || isHoliday
                        ? "border-red-100 bg-red-50 text-red-500"
                        : isSat
                          ? "border-blue-100 bg-blue-50 text-blue-600"
                          : "border-gray-100 bg-gray-50 text-gray-700"
                    }`}
                  >
                    {fixedWeekdayLabels[weekday]}
                  </div>
                );
              })}
            </div>

            <div className="space-y-1">
              {activeDoctors.map((doctor) => (
                <div key={doctor.id} className="grid grid-cols-[88px_repeat(8,1fr)] items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDoctorSelection(doctor.id)}
                    className={`truncate rounded border px-2 py-2 text-left text-[11px] font-bold transition ${
                      selectedDoctorId === doctor.id
                        ? "border-blue-700 bg-blue-600 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {doctor.name}
                  </button>
                  {pyWeekdays.map((weekday) => {
                    const targetShift = getFixedWeekdayTargetShift(
                      fixedUnavailableWeekdaysMap[doctor.id] ?? [],
                      weekday
                    );
                    return (
                      <button
                        key={`${doctor.id}-${weekday}`}
                        type="button"
                        onClick={(event) => handleFixedWeekdayClick(doctor.id, weekday, targetShift, event)}
                        title={getTargetShiftSummaryLabel(targetShift)}
                        className={`h-9 rounded border text-[12px] font-bold transition ${getFixedWeekdayButtonTone(
                          weekday,
                          targetShift
                        )}`}
                      >
                        {getFixedWeekdayButtonLabel(targetShift)}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <TargetShiftPopover
          open={Boolean(fixedWeekdayPopover)}
          position={fixedWeekdayPopover?.position ?? null}
          title={
            fixedWeekdayPopover
              ? `${activeDoctors.find((doctor) => doctor.id === fixedWeekdayPopover.doctorId)?.name ?? ""} / ${fixedWeekdayLabels[fixedWeekdayPopover.weekday] ?? ""}`
              : "固定不可設定"
          }
          currentValue={
            fixedWeekdayPopover
              ? getFixedWeekdayTargetShift(
                  fixedUnavailableWeekdaysMap[fixedWeekdayPopover.doctorId] ?? [],
                  fixedWeekdayPopover.weekday
                )
              : null
          }
          onSelect={(value) => {
            if (!fixedWeekdayPopover) return;
            onToggleFixedWeekday(fixedWeekdayPopover.doctorId, fixedWeekdayPopover.weekday, value);
          }}
          onClose={() => setFixedWeekdayPopover(null)}
        />

        <div className="mt-3 text-[11px] text-gray-500">
          選択中:
          <span className="ml-1 font-bold text-gray-700">{selectedDoctor?.name ?? "未選択"}</span>
          <span className="ml-2">
            {selectedFixedWeekdays.length === 0
              ? "未設定"
              : selectedFixedWeekdays
                  .slice()
                  .sort((left, right) => left.day_of_week - right.day_of_week)
                  .map((entry) => `${fixedWeekdayLabels[entry.day_of_week]}(${getTargetShiftSummaryLabel(entry.target_shift)})`)
                  .join(" / ")}
          </span>
        </div>
      </div>

      {isPreviousMonthShiftsOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
          <div className="flex max-h-[85dvh] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-2xl sm:max-h-[90vh]">
            <div className="flex items-start justify-between gap-4 border-b border-violet-100 bg-violet-50 px-4 py-4 sm:px-5">
              <div>
                <h3 className="text-base font-bold text-gray-900">前月末勤務</h3>
                <p className="mt-1 text-xs text-gray-500">前月末の勤務を日付ごとに確認・修正します。</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-violet-200 bg-white px-2 py-1 text-[11px] font-bold text-violet-700">
                  入力済み {previousMonthShiftCount}枠
                </span>
                <button
                  type="button"
                  onClick={onClosePreviousMonthShifts}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50"
                >
                  閉じる
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-end">
                <label>
                  <div className="mb-1 text-[11px] font-bold text-gray-700">前月の最終日</div>
                  <StepperNumberInput
                    value={prevMonthLastDay}
                    onCommit={onPrevMonthLastDayChange}
                    fallbackValue={prevMonthLastDay}
                    min={1}
                    step={1}
                    inputMode="numeric"
                  />
                </label>
                <div className="text-[11px] text-gray-500">直近4日分を previous_month_shifts として optimize に送信します。</div>
              </div>

              <div className="space-y-2">
                {prevMonthTailDays.map((day) => (
                  <div
                    key={day}
                    className="grid grid-cols-1 gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)]"
                  >
                    <div className="flex items-center justify-center rounded-lg bg-white text-sm font-bold text-gray-700">
                      {format(new Date(year, month - 2, day), "M/d")}
                    </div>
                    <label className="min-w-0">
                      <div className="mb-1 text-[11px] font-bold text-amber-700">日直</div>
                      <select
                        value={getPreviousMonthShiftDoctorId(day, "day")}
                        onChange={(event) => onSetPreviousMonthShift(day, "day", event.target.value)}
                        className="w-full rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm text-gray-700"
                      >
                        <option value="">未設定</option>
                        {activeDoctors.map((doctor) => (
                          <option key={String(day) + "-day-" + doctor.id} value={doctor.id}>
                            {doctor.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-0">
                      <div className="mb-1 text-[11px] font-bold text-sky-700">当直</div>
                      <select
                        value={getPreviousMonthShiftDoctorId(day, "night")}
                        onChange={(event) => onSetPreviousMonthShift(day, "night", event.target.value)}
                        className="w-full rounded-lg border border-sky-200 bg-white px-2 py-2 text-sm text-gray-700"
                      >
                        <option value="">未設定</option>
                        {activeDoctors.map((doctor) => (
                          <option key={String(day) + "-night-" + doctor.id} value={doctor.id}>
                            {doctor.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onGenerate}
        disabled={isLoading || activeDoctors.length === 0 || isGenerateDisabled}
        className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold text-white shadow-md transition ${
          isLoading || isGenerateDisabled ? "cursor-not-allowed bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>生成中...</span>
          </>
        ) : (
          <span>シフトを自動生成</span>
        )}
      </button>
    </div>
  );
}

export function DoctorSettingsPanel({
  isBulkSavingDoctors,
  activeDoctors,
  minScoreMap,
  maxScoreMap,
  targetScoreMap,
  scoreMin,
  scoreMax,
  onSaveAllDoctorsSettings,
  onMinScoreChange,
  onMaxScoreChange,
  onTargetScoreChange,
}: DoctorSettingsPanelProps) {
  return (
    <>
      <div className="mb-4 md:mb-6">
        <button
          type="button"
          onClick={onSaveAllDoctorsSettings}
          disabled={isBulkSavingDoctors || activeDoctors.length === 0}
          className={`w-full rounded-xl py-3 font-bold text-white shadow-lg transition ${
            isBulkSavingDoctors ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
          title="全医師の Min / Max / 目標値と不可設定を保存します。"
        >
          {isBulkSavingDoctors ? "保存中..." : "全員の設定を保存"}
        </button>
        <div className="mt-2 text-[11px] text-gray-500">
          各医師の Min / Max / 目標値をまとめて調整し、そのまま保存できます。
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-orange-100 bg-orange-50 p-3 shadow-sm md:mb-5 md:p-4">
        <h3 className="mb-3 flex flex-wrap items-center gap-2 text-md font-bold text-orange-800">
          <span>医師別スコア設定</span>
          <span className="rounded bg-orange-100 px-2 py-1 text-xs font-normal text-orange-600">
            個別 min / max / target
          </span>
        </h3>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-center text-[12px]">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="border-b px-2 py-2 text-left">医師</th>
                <th className="border-b px-2 py-2">Min</th>
                <th className="border-b px-2 py-2">Max</th>
                <th className="border-b px-2 py-2">目標</th>
              </tr>
            </thead>
            <tbody>
              {activeDoctors.map((doctor) => (
                <tr key={doctor.id} className="border-b hover:bg-gray-50">
                  <td className="whitespace-nowrap px-2 py-2 text-left font-bold text-gray-700">{doctor.name}</td>
                  <td className="px-2 py-2">
                    <StepperNumberInput
                      value={minScoreMap[doctor.id] ?? scoreMin}
                      onCommit={(value) => onMinScoreChange(doctor.id, value)}
                      fallbackValue={scoreMin}
                      step={0.5}
                      inputMode="decimal"
                      className="justify-center"
                      inputClassName="w-14 min-w-[3.5rem] px-1 py-1 text-[12px]"
                      buttonClassName="h-8 w-8 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <StepperNumberInput
                      value={maxScoreMap[doctor.id] ?? scoreMax}
                      onCommit={(value) => onMaxScoreChange(doctor.id, value)}
                      fallbackValue={scoreMax}
                      step={0.5}
                      inputMode="decimal"
                      className="justify-center"
                      inputClassName="w-14 min-w-[3.5rem] px-1 py-1 text-[12px]"
                      buttonClassName="h-8 w-8 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <StepperNumberInput
                      value={targetScoreMap[doctor.id] ?? 0}
                      onCommit={(value) => onTargetScoreChange(doctor.id, value)}
                      fallbackValue={0}
                      step={0.5}
                      inputMode="decimal"
                      className="justify-center"
                      inputClassName="w-16 min-w-[4rem] bg-blue-50 px-1 py-1 text-[12px]"
                      buttonClassName="h-8 w-8 text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
