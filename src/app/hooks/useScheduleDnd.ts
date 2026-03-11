import { useEffect, useRef, useState, type DragEvent, type TouchEvent } from "react";
import type {
  DragPayload,
  FixedUnavailableWeekdayEntry,
  FixedUnavailableWeekdayMap,
  HardConstraints,
  HolidayLikeDayInfo,
  LockedShiftPayload,
  ScheduleRow,
  ShiftType,
  SwapSource,
  UnavailableDateEntry,
  UnavailableDateMap,
} from "../types/dashboard";
import { matchesTargetShift } from "../utils/unavailableSettings";

type DragSourceType = "calendar" | "list" | null;
type DraggingListMode = "doctor" | "erase" | null;
type ListSelection = { mode: "doctor"; doctorId: string } | { mode: "erase" } | null;
type ActiveDragSource =
  | { sourceType: "calendar"; day: number; shiftType: ShiftType; doctorId: string | null }
  | { sourceType: "list"; mode: "doctor"; doctorId: string }
  | { sourceType: "list"; mode: "erase" };
type TouchDropTarget =
  | { kind: "shift"; day: number; shiftType: ShiftType; locked: boolean; isHolidayLike: boolean }
  | { kind: "trash" }
  | null;
type TouchPoint = {
  clientX: number;
  clientY: number;
};
type TouchDragState = {
  source: ActiveDragSource;
  startX: number;
  startY: number;
  moved: boolean;
};

type UseScheduleDndParams = {
  schedule: ScheduleRow[];
  commitSchedule: (nextSchedule: ScheduleRow[]) => void;
  year: number;
  month: number;
  prevMonthLastDay: number;
  hardConstraints: HardConstraints;
  isOverrideMode: boolean;
  unavailableMap: UnavailableDateMap;
  fixedUnavailableWeekdaysMap: FixedUnavailableWeekdayMap;
  prevMonthWorkedDaysMap: Record<string, number[]>;
  getDoctorName: (doctorId: string | null | undefined) => string;
  isHolidayLikeDay: (day: number) => HolidayLikeDayInfo;
  isActiveDoctorId: (doctorId: string | null | undefined) => boolean;
};

type ScheduleMutationResult = {
  nextSchedule: ScheduleRow[] | null;
  errorMessage: string | null;
};

type DropFeedback = {
  message: string | null;
  dropEffect: "none" | "copy" | "move";
};

const cloneSchedule = (rows: ScheduleRow[]) => rows.map((row) => ({ ...row }));
const pad2 = (value: number) => String(value).padStart(2, "0");
const weekdayLabelsPy = ["\u6708", "\u706b", "\u6c34", "\u6728", "\u91d1", "\u571f", "\u65e5"];

export function useScheduleDnd({
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
}: UseScheduleDndParams) {
  const [lockedShiftKeys, setLockedShiftKeys] = useState<Set<string>>(() => new Set());
  const [dragSourceKey, setDragSourceKey] = useState<string | null>(null);
  const [dragSourceType, setDragSourceType] = useState<DragSourceType>(null);
  const [draggingDoctorId, setDraggingDoctorId] = useState<string | null>(null);
  const [draggingListMode, setDraggingListMode] = useState<DraggingListMode>(null);
  const [highlightedDoctorId, setHighlightedDoctorId] = useState<string | null>(null);
  const [invalidHoverShiftKey, setInvalidHoverShiftKey] = useState<string | null>(null);
  const [touchHoverShiftKey, setTouchHoverShiftKey] = useState<string | null>(null);
  const [hoverErrorMessage, setHoverErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [swapSource, setSwapSource] = useState<SwapSource | null>(null);
  const [selectedListSelection, setSelectedListSelection] = useState<ListSelection>(null);

  const touchDragRef = useRef<TouchDragState | null>(null);
  const touchDropTargetRef = useRef<TouchDropTarget>(null);

  const getShiftKey = (day: number, shiftType: ShiftType) => `${day}_${shiftType}`;
  const getWeekdayPy = (y: number, m: number, d: number) => (new Date(y, m - 1, d).getDay() + 6) % 7;
  const getSelectedManualDoctorId = () =>
    selectedListSelection?.mode === "doctor" ? selectedListSelection.doctorId : null;
  const isEraseSelectionActive = selectedListSelection?.mode === "erase";

  const getScheduleDoctorId = (day: number, shiftType: ShiftType) => {
    const row = schedule.find((entry) => entry.day === day);
    if (!row) return null;
    return shiftType === "day" ? row.day_shift ?? null : row.night_shift ?? null;
  };

  const getShiftDoctorIdFromRow = (row: ScheduleRow, shiftType: ShiftType) =>
    shiftType === "day" ? row.day_shift ?? null : row.night_shift ?? null;

  const getPositiveConstraintValue = (value: number | null | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    const rounded = Math.max(0, Math.round(value));
    return rounded > 0 ? rounded : null;
  };

  const countDoctorAssignments = (
    doctorId: string,
    scheduleRows: ScheduleRow[],
    predicate: (row: ScheduleRow) => boolean,
    shiftTypes: ShiftType[],
    ignoreShiftKeys: Set<string>
  ) =>
    scheduleRows.reduce((count, row) => {
      if (!predicate(row)) return count;

      let nextCount = count;
      shiftTypes.forEach((candidateShiftType) => {
        const shiftKey = getShiftKey(row.day, candidateShiftType);
        if (ignoreShiftKeys.has(shiftKey)) return;
        if (getShiftDoctorIdFromRow(row, candidateShiftType) === doctorId) nextCount += 1;
      });
      return nextCount;
    }, 0);

  const getSpacingConstraintDays = () => getPositiveConstraintValue(hardConstraints.interval_days);
  const getMaxSaturdayNights = () => getPositiveConstraintValue(hardConstraints.max_saturday_nights);
  const getMaxSunholDays = () => getPositiveConstraintValue(hardConstraints.max_sunhol_days);
  const getMaxSunholWorks = () => getPositiveConstraintValue(hardConstraints.max_sunhol_works);
  const getMaxWeekendHolidayWorks = () => getPositiveConstraintValue(hardConstraints.max_weekend_holiday_works);
  const isSaturday = (day: number) => new Date(year, month - 1, day).getDay() === 6;

  const getPlacementIgnoreShiftKeys = (
    doctorId: string | null | undefined,
    day: number,
    shiftType: ShiftType,
    scheduleRows?: ScheduleRow[]
  ) => {
    if (!doctorId) return new Set<string>();

    const row = (scheduleRows ?? schedule).find((entry) => entry.day === day);
    if (!row) return new Set<string>();

    return getShiftDoctorIdFromRow(row, shiftType) === doctorId ? new Set<string>([getShiftKey(day, shiftType)]) : new Set<string>();
  };

  const isShiftLocked = (day: number, shiftType: ShiftType) => lockedShiftKeys.has(getShiftKey(day, shiftType));
  const isSwapSourceSelected = (day: number, shiftType: ShiftType) =>
    swapSource?.day === day && swapSource?.shiftType === shiftType;

  const showToast = (message: string | null) => {
    if (!message) return;
    setToastMessage(message);
  };

  const toggleHighlightedDoctor = (doctorId: string | null | undefined) => {
    if (!doctorId) return;
    setHighlightedDoctorId((prev) => (prev === doctorId ? null : doctorId));
  };

  const matchesManualUnavailableEntry = (
    entry: UnavailableDateEntry,
    day: number,
    shiftType: ShiftType
  ) => {
    const ymd = `${year}-${pad2(month)}-${pad2(day)}`;
    return entry.date === ymd && matchesTargetShift(entry.target_shift, shiftType);
  };

  const matchesFixedUnavailableWeekdayEntry = (
    entry: FixedUnavailableWeekdayEntry,
    day: number,
    shiftType: ShiftType
  ) => {
    const weekdayPy = getWeekdayPy(year, month, day);
    const holidayInfo = isHolidayLikeDay(day);

    if (!matchesTargetShift(entry.target_shift, shiftType)) return false;
    if (entry.day_of_week === 7) return holidayInfo.isHolidayLike && !holidayInfo.isSun;
    return entry.day_of_week === weekdayPy;
  };

  const getManualUnavailableEntry = (
    doctorId: string | null | undefined,
    day: number,
    shiftType: ShiftType
  ): UnavailableDateEntry | null => {
    if (!doctorId) return null;
    return (unavailableMap[doctorId] || []).find((entry) => matchesManualUnavailableEntry(entry, day, shiftType)) ?? null;
  };

  const getFixedUnavailableEntry = (
    doctorId: string | null | undefined,
    day: number,
    shiftType: ShiftType
  ): FixedUnavailableWeekdayEntry | null => {
    if (!doctorId) return null;
    return (
      (fixedUnavailableWeekdaysMap[doctorId] || []).find((entry) => matchesFixedUnavailableWeekdayEntry(entry, day, shiftType)) ?? null
    );
  };

  const hasAnyManualUnavailableEntry = (
    doctorId: string | null | undefined,
    day: number,
    shiftType?: ShiftType
  ) => {
    if (!doctorId) return false;
    const ymd = `${year}-${pad2(month)}-${pad2(day)}`;
    return (unavailableMap[doctorId] || []).some((entry) =>
      shiftType ? matchesManualUnavailableEntry(entry, day, shiftType) : entry.date === ymd
    );
  };

  const hasAnyFixedUnavailableEntry = (
    doctorId: string | null | undefined,
    day: number,
    shiftType?: ShiftType
  ) => {
    if (!doctorId) return false;
    const weekdayPy = getWeekdayPy(year, month, day);
    const holidayInfo = isHolidayLikeDay(day);
    return (fixedUnavailableWeekdaysMap[doctorId] || []).some((entry) => {
      if (shiftType && !matchesFixedUnavailableWeekdayEntry(entry, day, shiftType)) {
        return false;
      }
      if (entry.day_of_week === 7) return holidayInfo.isHolidayLike && !holidayInfo.isSun;
      return entry.day_of_week === weekdayPy;
    });
  };

  const getConstraintScopeLabel = (targetShift: "all" | "day" | "night") => {
    if (targetShift === "day") return "\u65e5\u76f4\u306e\u307f";
    if (targetShift === "night") return "\u5f53\u76f4\u306e\u307f";
    return "\u7d42\u65e5";
  };

  const getFixedWeekdayLabel = (dayOfWeek: number) => {
    if (dayOfWeek === 7) return "\u795d\u65e5";
    return `${weekdayLabelsPy[dayOfWeek] ?? "?"}\u66dc\u65e5`;
  };

  const isDoctorBlockedByManualConstraints = (
    doctorId: string | null | undefined,
    day: number,
    shiftType?: ShiftType
  ) => hasAnyManualUnavailableEntry(doctorId, day, shiftType) || hasAnyFixedUnavailableEntry(doctorId, day, shiftType);

  const isHighlightedDoctorBlockedDay = (day: number) => isDoctorBlockedByManualConstraints(highlightedDoctorId, day);

  const parseDragPayload = (raw: string | null): DragPayload | null => {
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<DragPayload>;
      if (typeof parsed.day !== "number") return null;
      if (parsed.shiftType !== "day" && parsed.shiftType !== "night") return null;
      return { day: parsed.day, shiftType: parsed.shiftType };
    } catch {
      return null;
    }
  };

  const getPlacementConstraintMessage = (
    doctorId: string | null | undefined,
    day: number,
    shiftType: ShiftType,
    options?: {
      scheduleRows?: ScheduleRow[];
      ignoreShiftKeys?: Set<string>;
      respectOverrideMode?: boolean;
    }
  ) => {
    if (!doctorId) return null;

    const scheduleRows = options?.scheduleRows ?? schedule;
    const ignoreShiftKeys = options?.ignoreShiftKeys ?? new Set<string>();
    const respectOverrideMode = options?.respectOverrideMode !== false;
    const holidayInfo = isHolidayLikeDay(day);
    const doctorName = getDoctorName(doctorId);
    const spacingDays = getSpacingConstraintDays();
    const maxSaturdayNights = getMaxSaturdayNights();
    const maxSunholDays = getMaxSunholDays();
    const maxSunholWorks = getMaxSunholWorks();
    const maxWeekendHolidayWorks = getMaxWeekendHolidayWorks();
    const preventSunholConsecutive = Boolean(hardConstraints.prevent_sunhol_consecutive);
    const respectUnavailableDays = Boolean(hardConstraints.respect_unavailable_days);

    if (shiftType === "day" && !holidayInfo.isHolidayLike) {
      return "\u5e73\u65e5\u306e\u65e5\u76f4\u306b\u306f\u914d\u7f6e\u3067\u304d\u307e\u305b\u3093";
    }

    if (respectOverrideMode && isOverrideMode) {
      return null;
    }

    if (respectUnavailableDays) {
      const manualUnavailableEntry = getManualUnavailableEntry(doctorId, day, shiftType);
      if (manualUnavailableEntry) {
        return `${doctorName}\u5148\u751f\u306f${month}\u6708${day}\u65e5\u306b${getConstraintScopeLabel(manualUnavailableEntry.target_shift)}\u306e\u4f11\u307f\u5e0c\u671b\u3067\u3059`;
      }

      const fixedUnavailableEntry = getFixedUnavailableEntry(doctorId, day, shiftType);
      if (fixedUnavailableEntry) {
        return `${doctorName}\u5148\u751f\u306f${getFixedWeekdayLabel(fixedUnavailableEntry.day_of_week)}\u306b${getConstraintScopeLabel(fixedUnavailableEntry.target_shift)}\u306e\u56fa\u5b9a\u4e0d\u53ef\u3067\u3059`;
      }
    }

    if (spacingDays !== null) {
      const prevMonthWorkedDays = prevMonthWorkedDaysMap[doctorId] || [];
      const hasBlockedPrevMonthGap = prevMonthWorkedDays.some((workedDay) => {
        const gapFromPrevMonth = day + (prevMonthLastDay - workedDay);
        return gapFromPrevMonth <= spacingDays;
      });
      if (hasBlockedPrevMonthGap) {
        return `${doctorName}\u5148\u751f\u306f\u52e4\u52d9\u9593\u9694\u30a8\u30e9\u30fc\uff08\u8a2d\u5b9a: ${spacingDays}\u65e5\uff09\u3067\u3059`;
      }
    }

    const row = scheduleRows.find((entry) => entry.day === day);
    const oppositeShiftType: ShiftType = shiftType === "day" ? "night" : "day";
    const oppositeShiftKey = getShiftKey(day, oppositeShiftType);
    const oppositeDoctorId = row && !ignoreShiftKeys.has(oppositeShiftKey) ? getShiftDoctorIdFromRow(row, oppositeShiftType) : null;
    if (preventSunholConsecutive && oppositeDoctorId && oppositeDoctorId === doctorId) {
      return "\u540c\u4e00\u65e5\u306e\u65e5\u76f4\u3068\u5f53\u76f4\u306b\u540c\u3058\u533b\u5e2b\u306f\u914d\u7f6e\u3067\u304d\u307e\u305b\u3093";
    }

    if (spacingDays !== null) {
      for (const rowEntry of scheduleRows) {
        if (rowEntry.day === day) continue;

        for (const candidateShiftType of ["day", "night"] as const) {
          const shiftKey = getShiftKey(rowEntry.day, candidateShiftType);
          if (ignoreShiftKeys.has(shiftKey)) continue;

          const assignedDoctorId = getShiftDoctorIdFromRow(rowEntry, candidateShiftType);
          if (assignedDoctorId !== doctorId) continue;

          if (Math.abs(rowEntry.day - day) <= spacingDays) {
            return `${doctorName}\u5148\u751f\u306f\u52e4\u52d9\u9593\u9694\u30a8\u30e9\u30fc\uff08\u8a2d\u5b9a: ${spacingDays}\u65e5\uff09\u3067\u3059`;
          }
        }
      }
    }

    if (maxSaturdayNights !== null && shiftType === "night" && isSaturday(day)) {
      const saturdayNightCount = countDoctorAssignments(doctorId, scheduleRows, (rowEntry) => isSaturday(rowEntry.day), ["night"], ignoreShiftKeys) + 1;
      if (saturdayNightCount > maxSaturdayNights) {
        return `${doctorName}\u5148\u751f\u306f\u571f\u66dc\u5f53\u76f4\u306e\u4e0a\u9650\uff08${maxSaturdayNights}\u56de\uff09\u3092\u8d85\u3048\u307e\u3059`;
      }
    }

    if (maxSunholDays !== null && shiftType === "day" && holidayInfo.isHolidayLike) {
      const sunholDayCount =
        countDoctorAssignments(
          doctorId,
          scheduleRows,
          (rowEntry) => isHolidayLikeDay(rowEntry.day).isHolidayLike,
          ["day"],
          ignoreShiftKeys
        ) + 1;
      if (sunholDayCount > maxSunholDays) {
        return `${doctorName}\u5148\u751f\u306f\u65e5\u795d\u65e5\u76f4\u306e\u4e0a\u9650\uff08${maxSunholDays}\u56de\uff09\u3092\u8d85\u3048\u307e\u3059`;
      }
    }

    if (maxSunholWorks !== null && holidayInfo.isHolidayLike) {
      const sunholWorkCount =
        countDoctorAssignments(
          doctorId,
          scheduleRows,
          (rowEntry) => isHolidayLikeDay(rowEntry.day).isHolidayLike,
          ["day", "night"],
          ignoreShiftKeys
        ) + 1;
      if (sunholWorkCount > maxSunholWorks) {
        return `${doctorName}\u5148\u751f\u306f\u65e5\u795d\u52e4\u52d9\u306e\u4e0a\u9650\uff08${maxSunholWorks}\u56de\uff09\u3092\u8d85\u3048\u307e\u3059`;
      }
    }

    if (maxWeekendHolidayWorks !== null && ((shiftType === "night" && isSaturday(day)) || holidayInfo.isHolidayLike)) {
      const weekendHolidayWorkCount =
        scheduleRows.reduce((count, rowEntry) => {
          const rowHolidayLike = isHolidayLikeDay(rowEntry.day).isHolidayLike;
          if (rowHolidayLike) {
            let nextCount = count;
            (["day", "night"] as const).forEach((candidateShiftType) => {
              const shiftKey = getShiftKey(rowEntry.day, candidateShiftType);
              if (ignoreShiftKeys.has(shiftKey)) return;
              if (getShiftDoctorIdFromRow(rowEntry, candidateShiftType) === doctorId) nextCount += 1;
            });
            return nextCount;
          }

          if (isSaturday(rowEntry.day)) {
            const shiftKey = getShiftKey(rowEntry.day, "night");
            if (!ignoreShiftKeys.has(shiftKey) && getShiftDoctorIdFromRow(rowEntry, "night") === doctorId) {
              return count + 1;
            }
          }

          return count;
        }, 0) + 1;

      if (weekendHolidayWorkCount > maxWeekendHolidayWorks) {
        return `${doctorName}\u5148\u751f\u306f\u571f\u65e5\u795d\u52e4\u52d9\u306e\u4e0a\u9650\uff08${maxWeekendHolidayWorks}\u56de\uff09\u3092\u8d85\u3048\u307e\u3059`;
      }
    }

    return null;
  };

  const formatConstraintForToast = (doctorId: string, message: string) => {
    const doctorName = getDoctorName(doctorId);
    return message.startsWith(`${doctorName}\u5148\u751f`) ? message : `${doctorName}\u5148\u751f: ${message}`;
  };

  const getSwapConstraintMessage = (
    sourceDoctorId: string | null | undefined,
    fromDay: number,
    fromType: ShiftType,
    toDay: number,
    toType: ShiftType,
    options?: {
      scheduleRows?: ScheduleRow[];
    }
  ) => {
    if (!sourceDoctorId) return null;

    const scheduleRows = options?.scheduleRows ?? schedule;
    const simulatedRows = cloneSchedule(scheduleRows);
    const fromRow = simulatedRows.find((row) => row.day === fromDay);
    const toRow = simulatedRows.find((row) => row.day === toDay);
    if (!fromRow || !toRow) {
      return "対象日のシフトが見つかりません";
    }

    const fromField = fromType === "day" ? "day_shift" : "night_shift";
    const toField = toType === "day" ? "day_shift" : "night_shift";
    const targetDoctorId = getShiftDoctorIdFromRow(toRow, toType);

    fromRow[fromField] = targetDoctorId;
    toRow[toField] = sourceDoctorId;

    const messages: string[] = [];
    const sourceMessage = getPlacementConstraintMessage(sourceDoctorId, toDay, toType, {
      scheduleRows: simulatedRows,
      ignoreShiftKeys: new Set<string>([getShiftKey(toDay, toType)]),
    });

    if (sourceMessage) {
      messages.push(formatConstraintForToast(sourceDoctorId, sourceMessage));
    }

    if (targetDoctorId && targetDoctorId !== sourceDoctorId) {
      const targetMessage = getPlacementConstraintMessage(targetDoctorId, fromDay, fromType, {
        scheduleRows: simulatedRows,
        ignoreShiftKeys: new Set<string>([getShiftKey(fromDay, fromType)]),
      });

      if (targetMessage) {
        messages.push(formatConstraintForToast(targetDoctorId, targetMessage));
      }
    }

    if (messages.length === 0) return null;
    return Array.from(new Set(messages)).join("\n");
  };

  const validateScheduleViolations = (scheduleRows: ScheduleRow[] = schedule) => {
    const messages = new Set<string>();

    scheduleRows.forEach((row) => {
      (["day", "night"] as const).forEach((shiftType) => {
        const doctorId = getShiftDoctorIdFromRow(row, shiftType);
        if (!doctorId) return;

        const constraintMessage = getPlacementConstraintMessage(doctorId, row.day, shiftType, {
          scheduleRows,
          ignoreShiftKeys: new Set<string>([getShiftKey(row.day, shiftType)]),
          respectOverrideMode: false,
        });

        if (!constraintMessage) return;
        messages.add(formatConstraintForToast(doctorId, constraintMessage));
      });
    });

    return Array.from(messages);
  };

  const buildAssignSchedule = (day: number, shiftType: ShiftType, doctorId: string): ScheduleMutationResult => {
    const next = cloneSchedule(schedule);
    const targetRow = next.find((row) => row.day === day);
    if (!targetRow) {
      return { nextSchedule: null, errorMessage: "\u5bfe\u8c61\u65e5\u306e\u30b7\u30d5\u30c8\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093" };
    }

    const targetField = shiftType === "day" ? "day_shift" : "night_shift";
    const currentDoctorId = targetRow[targetField] ?? null;
    if (currentDoctorId === doctorId) {
      return { nextSchedule: null, errorMessage: null };
    }

    const ignoreShiftKeys = getPlacementIgnoreShiftKeys(doctorId, day, shiftType, next);
    const constraintMessage = getPlacementConstraintMessage(doctorId, day, shiftType, {
      scheduleRows: next,
      ignoreShiftKeys,
    });

    if (constraintMessage) {
      return { nextSchedule: null, errorMessage: formatConstraintForToast(doctorId, constraintMessage) };
    }

    targetRow[targetField] = doctorId;
    return { nextSchedule: next, errorMessage: null };
  };

  const buildSwapSchedule = (fromDay: number, fromType: ShiftType, toDay: number, toType: ShiftType): ScheduleMutationResult => {
    if (fromDay === toDay && fromType === toType) {
      return { nextSchedule: null, errorMessage: null };
    }

    if (isShiftLocked(fromDay, fromType) || isShiftLocked(toDay, toType)) {
      return { nextSchedule: null, errorMessage: "\u30ed\u30c3\u30af\u6e08\u307f\u306e\u67a0\u306f\u79fb\u52d5\u3067\u304d\u307e\u305b\u3093" };
    }

    const next = cloneSchedule(schedule);
    const fromRow = next.find((row) => row.day === fromDay);
    const toRow = next.find((row) => row.day === toDay);
    if (!fromRow || !toRow) {
      return { nextSchedule: null, errorMessage: "\u5bfe\u8c61\u65e5\u306e\u30b7\u30d5\u30c8\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093" };
    }

    const fromField = fromType === "day" ? "day_shift" : "night_shift";
    const toField = toType === "day" ? "day_shift" : "night_shift";
    const fromDoctorId = fromRow[fromField] ?? null;
    const toDoctorId = toRow[toField] ?? null;
    if (!fromDoctorId) {
      return { nextSchedule: null, errorMessage: "\u5165\u308c\u66ff\u3048\u5143\u306b\u533b\u5e2b\u304c\u5165\u3063\u3066\u3044\u307e\u305b\u3093" };
    }

    const moveTargetConflict = getSwapConstraintMessage(fromDoctorId, fromDay, fromType, toDay, toType, {
      scheduleRows: next,
    });
    if (moveTargetConflict) {
      return { nextSchedule: null, errorMessage: moveTargetConflict };
    }

    fromRow[fromField] = toDoctorId;
    toRow[toField] = fromDoctorId;
    return { nextSchedule: next, errorMessage: null };
  };

  const buildClearSchedule = (day: number, shiftType: ShiftType): ScheduleMutationResult => {
    if (isShiftLocked(day, shiftType)) {
      return { nextSchedule: null, errorMessage: "\u30ed\u30c3\u30af\u6e08\u307f\u306e\u67a0\u306f\u89e3\u9664\u3067\u304d\u307e\u305b\u3093" };
    }

    const next = cloneSchedule(schedule);
    const row = next.find((entry) => entry.day === day);
    if (!row) {
      return { nextSchedule: null, errorMessage: "\u5bfe\u8c61\u65e5\u306e\u30b7\u30d5\u30c8\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093" };
    }

    const currentDoctorId = shiftType === "day" ? row.day_shift ?? null : row.night_shift ?? null;
    if (!currentDoctorId) {
      return { nextSchedule: null, errorMessage: null };
    }

    if (shiftType === "day") row.day_shift = null;
    else row.night_shift = null;

    return { nextSchedule: next, errorMessage: null };
  };

  const clearHoverState = () => {
    setInvalidHoverShiftKey(null);
    setTouchHoverShiftKey(null);
    setHoverErrorMessage(null);
    touchDropTargetRef.current = null;
  };

  const clearDragState = () => {
    setDragSourceKey(null);
    setDragSourceType(null);
    setDraggingDoctorId(null);
    setDraggingListMode(null);
    clearHoverState();
    touchDragRef.current = null;
  };

  const applyActiveDragSource = (source: ActiveDragSource) => {
    if (source.sourceType === "calendar") {
      setDragSourceKey(JSON.stringify({ day: source.day, shiftType: source.shiftType }));
      setDragSourceType("calendar");
      setDraggingDoctorId(source.doctorId ?? null);
      setDraggingListMode(null);
      return;
    }

    setDragSourceKey(null);
    setDragSourceType("list");
    setDraggingDoctorId(source.mode === "doctor" ? source.doctorId : null);
    setDraggingListMode(source.mode);
  };

  const getStateActiveDragSource = (): ActiveDragSource | null => {
    if (dragSourceType === "calendar") {
      const payload = parseDragPayload(dragSourceKey);
      if (!payload) return null;
      return {
        sourceType: "calendar",
        day: payload.day,
        shiftType: payload.shiftType,
        doctorId: draggingDoctorId,
      };
    }

    if (dragSourceType === "list") {
      if (draggingListMode === "erase") {
        return { sourceType: "list", mode: "erase" };
      }
      if (draggingListMode === "doctor" && draggingDoctorId) {
        return { sourceType: "list", mode: "doctor", doctorId: draggingDoctorId };
      }
    }

    return null;
  };

  const getActiveDragSource = () => touchDragRef.current?.source ?? getStateActiveDragSource();

  const getDropFeedback = (
    source: ActiveDragSource,
    day: number,
    shiftType: ShiftType,
    locked: boolean,
    isHolidayLike: boolean
  ): DropFeedback => {
    if (locked) {
      return { message: "\u30ed\u30c3\u30af\u6e08\u307f\u306e\u67a0\u306b\u306f\u914d\u7f6e\u3067\u304d\u307e\u305b\u3093", dropEffect: "none" };
    }

    if (shiftType === "day" && !isHolidayLike) {
      return { message: "\u5e73\u65e5\u306e\u65e5\u76f4\u306b\u306f\u914d\u7f6e\u3067\u304d\u307e\u305b\u3093", dropEffect: "none" };
    }

    if (source.sourceType === "list") {
      if (source.mode === "erase") {
        return { message: null, dropEffect: "move" };
      }

      const message = getPlacementConstraintMessage(source.doctorId, day, shiftType, {
        ignoreShiftKeys: getPlacementIgnoreShiftKeys(source.doctorId, day, shiftType),
      });
      return { message, dropEffect: message ? "none" : "copy" };
    }

    const message = getSwapConstraintMessage(source.doctorId, source.day, source.shiftType, day, shiftType);
    return { message, dropEffect: message ? "none" : "move" };
  };

  const beginTouchDrag = (source: ActiveDragSource, touch: TouchPoint) => {
    touchDragRef.current = {
      source,
      startX: touch.clientX,
      startY: touch.clientY,
      moved: false,
    };
    applyActiveDragSource(source);
    clearHoverState();
    setSwapSource(null);
  };

  const getHeaderOffset = () => {
    if (typeof document === "undefined") return 0;
    return document.querySelector("header")?.clientHeight ?? 0;
  };

  const getTouchDropTarget = (touch: TouchPoint): TouchDropTarget => {
    if (typeof document === "undefined") return null;

    const adjustedX = touch.clientX;
    const adjustedY = Math.max(0, touch.clientY - getHeaderOffset());
    const element = document.elementFromPoint(adjustedX, adjustedY);
    const container = element?.closest<HTMLElement>("[data-touch-drop-target]");
    if (!container) return null;

    const targetKind = container.dataset.touchDropTarget;
    if (targetKind === "trash") {
      return { kind: "trash" };
    }

    if (targetKind !== "shift") return null;

    const day = Number(container.dataset.day);
    const shiftType = container.dataset.shiftType === "day" || container.dataset.shiftType === "night" ? container.dataset.shiftType : null;
    if (!Number.isFinite(day) || !shiftType) return null;

    return {
      kind: "shift",
      day,
      shiftType,
      locked: container.dataset.locked === "true",
      isHolidayLike: container.dataset.holidayLike === "true",
    };
  };

  const updateTouchTargetState = (target: TouchDropTarget, source: ActiveDragSource) => {
    touchDropTargetRef.current = target;

    if (!target) {
      clearHoverState();
      return;
    }

    if (target.kind === "trash") {
      setTouchHoverShiftKey(null);
      setInvalidHoverShiftKey(null);
      setHoverErrorMessage(null);
      return;
    }

    const shiftKey = getShiftKey(target.day, target.shiftType);
    const feedback = getDropFeedback(source, target.day, target.shiftType, target.locked, target.isHolidayLike);

    setTouchHoverShiftKey(shiftKey);
    if (feedback.message) {
      setInvalidHoverShiftKey(shiftKey);
      setHoverErrorMessage(feedback.message);
      return;
    }

    setInvalidHoverShiftKey(null);
    setHoverErrorMessage(null);
  };

  const selectManualDoctor = (doctorId: string) => {
    clearDragState();
    setSwapSource(null);

    const isSameSelection = selectedListSelection?.mode === "doctor" && selectedListSelection.doctorId === doctorId;
    setSelectedListSelection(isSameSelection ? null : { mode: "doctor", doctorId });
    if (!isSameSelection) {
      setHighlightedDoctorId(doctorId);
    }
  };

  const toggleEraseSelection = () => {
    clearDragState();
    setSwapSource(null);
    setSelectedListSelection(isEraseSelectionActive ? null : { mode: "erase" });
  };

  const cancelSwapSelection = () => {
    setSwapSource(null);
    setInvalidHoverShiftKey(null);
    setTouchHoverShiftKey(null);
    setHoverErrorMessage(null);
  };

  const toggleSwapMode = () => {
    clearDragState();
    const nextMode = !isSwapMode;
    setIsSwapMode(nextMode);
    cancelSwapSelection();
    setSelectedListSelection(null);
  };

  const handleDisabledDayDragOver = (event: DragEvent<HTMLDivElement>, day: number) => {
    const activeSource = getActiveDragSource();
    if (!activeSource) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "none";
    setInvalidHoverShiftKey(getShiftKey(day, "day"));
    setHoverErrorMessage("\u5e73\u65e5\u306e\u65e5\u76f4\u306b\u306f\u914d\u7f6e\u3067\u304d\u307e\u305b\u3093");
  };

  const handleDisabledDayDragLeave = (day: number) => {
    const shiftKey = getShiftKey(day, "day");
    if (invalidHoverShiftKey === shiftKey) {
      setInvalidHoverShiftKey(null);
      setHoverErrorMessage(null);
    }
  };

  const handleShiftDragOver = (
    event: DragEvent<HTMLDivElement>,
    day: number,
    shiftType: ShiftType,
    locked: boolean,
    isHolidayLike: boolean
  ) => {
    const activeSource = getActiveDragSource();
    if (!activeSource) return;

    const shiftKey = getShiftKey(day, shiftType);
    const feedback = getDropFeedback(activeSource, day, shiftType, locked, isHolidayLike);

    event.preventDefault();
    event.dataTransfer.dropEffect = feedback.dropEffect;

    if (feedback.message) {
      setInvalidHoverShiftKey(shiftKey);
      setHoverErrorMessage(feedback.message);
      return;
    }

    setInvalidHoverShiftKey(null);
    setHoverErrorMessage(null);
  };

  const handleShiftDragLeave = (day: number, shiftType: ShiftType) => {
    const shiftKey = getShiftKey(day, shiftType);
    if (invalidHoverShiftKey === shiftKey) {
      setInvalidHoverShiftKey(null);
      setHoverErrorMessage(null);
    }
  };

  const handleShiftDrop = (
    event: DragEvent<HTMLDivElement>,
    toDay: number,
    toType: ShiftType,
    locked: boolean,
    isHolidayLike: boolean
  ) => {
    event.preventDefault();

    const activeSource = getActiveDragSource();
    if (!activeSource) {
      clearDragState();
      return;
    }

    const feedback = getDropFeedback(activeSource, toDay, toType, locked, isHolidayLike);
    if (feedback.message) {
      showToast(feedback.message);
      clearDragState();
      return;
    }

    try {
      if (activeSource.sourceType === "list") {
        const result =
          activeSource.mode === "erase"
            ? buildClearSchedule(toDay, toType)
            : buildAssignSchedule(toDay, toType, activeSource.doctorId);

        if (result.errorMessage) {
          showToast(result.errorMessage);
          return;
        }
        if (result.nextSchedule) {
          commitSchedule(result.nextSchedule);
        }
        return;
      }

      const result = buildSwapSchedule(activeSource.day, activeSource.shiftType, toDay, toType);
      if (result.errorMessage) {
        showToast(result.errorMessage);
        return;
      }
      if (result.nextSchedule) {
        commitSchedule(result.nextSchedule);
      }
    } finally {
      clearDragState();
    }
  };

  const handleShiftTap = (day: number, shiftType: ShiftType, locked: boolean, isHolidayLike: boolean) => {
    if (!isSwapMode) return;

    if (selectedListSelection) {
      const source: ActiveDragSource =
        selectedListSelection.mode === "erase"
          ? { sourceType: "list", mode: "erase" }
          : { sourceType: "list", mode: "doctor", doctorId: selectedListSelection.doctorId };
      const feedback = getDropFeedback(source, day, shiftType, locked, isHolidayLike);

      if (feedback.message) {
        showToast(feedback.message);
        return;
      }

      const result =
        selectedListSelection.mode === "erase"
          ? buildClearSchedule(day, shiftType)
          : buildAssignSchedule(day, shiftType, selectedListSelection.doctorId);

      if (result.errorMessage) {
        showToast(result.errorMessage);
        return;
      }

      if (result.nextSchedule) {
        commitSchedule(result.nextSchedule);
      }
      return;
    }

    if (!swapSource) {
      if (locked) {
        showToast("\u30ed\u30c3\u30af\u6e08\u307f\u306e\u67a0\u306f\u5165\u308c\u66ff\u3048\u5143\u306b\u3067\u304d\u307e\u305b\u3093");
        return;
      }

      const doctorId = getScheduleDoctorId(day, shiftType);
      if (!doctorId) {
        showToast("\u5165\u308c\u66ff\u3048\u5143\u306b\u3059\u308b\u67a0\u3092\u5148\u306b\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044");
        return;
      }

      setSwapSource({ day, shiftType, doctorId });
      return;
    }

    if (swapSource.day === day && swapSource.shiftType === shiftType) {
      setSwapSource(null);
      return;
    }

    const feedback = getDropFeedback(
      {
        sourceType: "calendar",
        day: swapSource.day,
        shiftType: swapSource.shiftType,
        doctorId: swapSource.doctorId,
      },
      day,
      shiftType,
      locked,
      isHolidayLike
    );
    if (feedback.message) {
      showToast(feedback.message);
      return;
    }

    const result = buildSwapSchedule(swapSource.day, swapSource.shiftType, day, shiftType);
    if (result.errorMessage) {
      showToast(result.errorMessage);
      return;
    }

    if (result.nextSchedule) {
      commitSchedule(result.nextSchedule);
    }
    cancelSwapSelection();
  };

  const handleSwapButtonPress = (day: number, shiftType: ShiftType, locked: boolean, isHolidayLike: boolean) => {
    clearDragState();
    setSelectedListSelection(null);

    if (!swapSource) {
      if (locked) {
        showToast("\u30ed\u30c3\u30af\u6e08\u307f\u306e\u67a0\u306f\u5165\u308c\u66ff\u3048\u5143\u306b\u3067\u304d\u307e\u305b\u3093");
        return;
      }

      const doctorId = getScheduleDoctorId(day, shiftType);
      if (!doctorId) {
        showToast("\u5165\u308c\u66ff\u3048\u5143\u306b\u3067\u304d\u308b\u533b\u5e2b\u5165\u308a\u67a0\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044");
        return;
      }

      setSwapSource({ day, shiftType, doctorId });
      return;
    }

    if (swapSource.day === day && swapSource.shiftType === shiftType) {
      cancelSwapSelection();
      return;
    }

    const feedback = getDropFeedback(
      {
        sourceType: "calendar",
        day: swapSource.day,
        shiftType: swapSource.shiftType,
        doctorId: swapSource.doctorId,
      },
      day,
      shiftType,
      locked,
      isHolidayLike
    );
    if (feedback.message) {
      showToast(feedback.message);
      return;
    }

    const result = buildSwapSchedule(swapSource.day, swapSource.shiftType, day, shiftType);
    if (result.errorMessage) {
      showToast(result.errorMessage);
      return;
    }

    if (result.nextSchedule) {
      commitSchedule(result.nextSchedule);
    }
    cancelSwapSelection();
  };

  const handleShiftDragStart = (
    event: DragEvent<HTMLElement>,
    day: number,
    shiftType: ShiftType,
    doctorId: string | null | undefined
  ) => {
    const source: ActiveDragSource = {
      sourceType: "calendar",
      day,
      shiftType,
      doctorId: doctorId ?? null,
    };
    event.dataTransfer.setData("text/plain", JSON.stringify({ day, shiftType }));
    event.dataTransfer.effectAllowed = "move";
    applyActiveDragSource(source);
    clearHoverState();
    setSwapSource(null);
  };

  const handleDoctorListDragStart = (event: DragEvent<HTMLElement>, doctorId: string | null) => {
    const source: ActiveDragSource = doctorId
      ? { sourceType: "list", mode: "doctor", doctorId }
      : { sourceType: "list", mode: "erase" };

    event.dataTransfer.setData("text/plain", doctorId ? `doctor:${doctorId}` : "doctor:erase");
    event.dataTransfer.effectAllowed = doctorId ? "copy" : "move";
    applyActiveDragSource(source);
    clearHoverState();
    setSwapSource(null);
  };

  const handleShiftTouchStart = (
    event: TouchEvent<HTMLElement>,
    day: number,
    shiftType: ShiftType,
    doctorId: string | null | undefined
  ) => {
    const touch = event.touches[0];
    if (!touch || !doctorId) return;

    beginTouchDrag(
      {
        sourceType: "calendar",
        day,
        shiftType,
        doctorId,
      },
      touch
    );
  };

  const handleDoctorListTouchStart = (event: TouchEvent<HTMLElement>, doctorId: string | null) => {
    const touch = event.touches[0];
    if (!touch) return;

    beginTouchDrag(
      doctorId ? { sourceType: "list", mode: "doctor", doctorId } : { sourceType: "list", mode: "erase" },
      touch
    );
  };

  const handleTouchDragMove = (event: TouchEvent<HTMLElement>) => {
    const activeTouch = touchDragRef.current;
    const touch = event.touches[0];
    if (!activeTouch || !touch) return;

    if (!activeTouch.moved) {
      const deltaX = touch.clientX - activeTouch.startX;
      const deltaY = touch.clientY - activeTouch.startY;
      if (Math.hypot(deltaX, deltaY) < 6) return;
      activeTouch.moved = true;
    }

    event.preventDefault();
    updateTouchTargetState(getTouchDropTarget(touch), activeTouch.source);
  };

  const handleTouchDragEnd = (event: TouchEvent<HTMLElement>) => {
    const activeTouch = touchDragRef.current;
    const changedTouch = event.changedTouches[0];
    if (!activeTouch) return;

    const fallbackTarget = changedTouch ? getTouchDropTarget(changedTouch) : null;
    const target = touchDropTargetRef.current ?? fallbackTarget;
    const wasMoved = activeTouch.moved;
    const source = activeTouch.source;

    touchDragRef.current = null;

    if (!wasMoved) {
      clearDragState();
      return;
    }

    event.preventDefault();

    try {
      if (!target) return;

      if (target.kind === "trash") {
        if (source.sourceType !== "calendar") return;

        const result = buildClearSchedule(source.day, source.shiftType);
        if (result.errorMessage) {
          showToast(result.errorMessage);
          return;
        }
        if (result.nextSchedule) {
          commitSchedule(result.nextSchedule);
          setLockedShiftKeys((prev) => {
            const next = new Set(prev);
            next.delete(getShiftKey(source.day, source.shiftType));
            return next;
          });
        }
        return;
      }

      const feedback = getDropFeedback(source, target.day, target.shiftType, target.locked, target.isHolidayLike);
      if (feedback.message) {
        showToast(feedback.message);
        return;
      }

      const result =
        source.sourceType === "list"
          ? source.mode === "erase"
            ? buildClearSchedule(target.day, target.shiftType)
            : buildAssignSchedule(target.day, target.shiftType, source.doctorId)
          : buildSwapSchedule(source.day, source.shiftType, target.day, target.shiftType);

      if (result.errorMessage) {
        showToast(result.errorMessage);
        return;
      }
      if (result.nextSchedule) {
        commitSchedule(result.nextSchedule);
      }
    } finally {
      clearDragState();
    }
  };

  const handleTouchDragCancel = () => {
    clearDragState();
  };

  const handleTrashDragOver = (event: DragEvent<HTMLDivElement>) => {
    const activeSource = getActiveDragSource();
    if (activeSource?.sourceType !== "calendar") return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearHoverState();
  };

  const handleTrashDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const activeSource = getActiveDragSource();
    if (activeSource?.sourceType !== "calendar") {
      clearDragState();
      return;
    }

    try {
      const result = buildClearSchedule(activeSource.day, activeSource.shiftType);
      if (result.errorMessage) {
        showToast(result.errorMessage);
        return;
      }

      if (result.nextSchedule) {
        commitSchedule(result.nextSchedule);
        setLockedShiftKeys((prev) => {
          const next = new Set(prev);
          next.delete(getShiftKey(activeSource.day, activeSource.shiftType));
          return next;
        });
      }
    } finally {
      clearDragState();
    }
  };

  const toggleShiftLock = (day: number, shiftType: ShiftType) => {
    const doctorId = getScheduleDoctorId(day, shiftType);
    if (!doctorId) return;

    const key = getShiftKey(day, shiftType);
    setLockedShiftKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleLockAll = () => {
    const next = new Set<string>();

    schedule.forEach((row) => {
      if (row.day_shift) next.add(getShiftKey(row.day, "day"));
      if (row.night_shift) next.add(getShiftKey(row.day, "night"));
    });

    setLockedShiftKeys(next);
  };

  const handleUnlockAll = () => {
    setLockedShiftKeys(new Set());
  };

  const buildLockedShiftsPayload = (): LockedShiftPayload[] =>
    Array.from(lockedShiftKeys)
      .map((key) => {
        const [dayStr, shiftTypeRaw] = key.split("_");
        const day = Number(dayStr);
        const shiftType = shiftTypeRaw === "day" || shiftTypeRaw === "night" ? shiftTypeRaw : null;
        if (!shiftType || !Number.isFinite(day)) return null;

        const doctorId = getScheduleDoctorId(day, shiftType);
        if (!isActiveDoctorId(doctorId)) return null;

        return {
          date: `${year}-${pad2(month)}-${pad2(day)}`,
          shift_type: shiftType,
          doctor_id: doctorId,
        };
      })
      .filter((item): item is LockedShiftPayload => item !== null);

  useEffect(() => {
    setLockedShiftKeys(new Set());
    setDragSourceKey(null);
    setDragSourceType(null);
    setDraggingDoctorId(null);
    setDraggingListMode(null);
    setInvalidHoverShiftKey(null);
    setTouchHoverShiftKey(null);
    setHoverErrorMessage(null);
    touchDropTargetRef.current = null;
    touchDragRef.current = null;
    setSwapSource(null);
    setSelectedListSelection(null);
    setIsSwapMode(false);
    setHighlightedDoctorId(null);
    setToastMessage(null);
  }, [year, month]);

  useEffect(() => {
    setLockedShiftKeys((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();

      prev.forEach((key) => {
        const [dayStr, shiftTypeRaw] = key.split("_");
        const day = Number(dayStr);
        const shiftType = shiftTypeRaw === "day" || shiftTypeRaw === "night" ? shiftTypeRaw : null;
        if (!shiftType || !Number.isFinite(day)) return;

        const row = schedule.find((entry) => entry.day === day);
        if (!row) return;
        const doctorId = shiftType === "day" ? row.day_shift ?? null : row.night_shift ?? null;
        if (doctorId) next.add(key);
      });

      if (next.size === prev.size && Array.from(next).every((key) => prev.has(key))) {
        return prev;
      }
      return next;
    });
  }, [schedule]);

  useEffect(() => {
    if (!toastMessage) return;

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null);
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  return {
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
    selectedManualDoctorId: getSelectedManualDoctorId(),
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
  };
}













