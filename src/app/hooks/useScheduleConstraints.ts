import type {
  FixedUnavailableWeekdayEntry,
  FixedUnavailableWeekdayMap,
  HardConstraints,
  HolidayLikeDayInfo,
  ScheduleRow,
  ShiftType,
  UnavailableDateEntry,
  UnavailableDateMap,
} from "../types/dashboard";
import { matchesTargetShift } from "../utils/unavailableSettings";

// --- モジュールレベルユーティリティ（useScheduleDnd からも import 可能）---

export const getShiftKey = (day: number, shiftType: ShiftType) => `${day}_${shiftType}`;

export const getShiftDoctorIdFromRow = (row: ScheduleRow, shiftType: ShiftType) =>
  shiftType === "day" ? row.day_shift ?? null : row.night_shift ?? null;

const pad2 = (value: number) => String(value).padStart(2, "0");
const weekdayLabelsPy = ["月", "火", "水", "木", "金", "土", "日"];

// --- Hook ---

export type UseScheduleConstraintsParams = {
  schedule: ScheduleRow[];
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
  highlightedDoctorId: string | null;
};

export function useScheduleConstraints({
  schedule,
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
  highlightedDoctorId,
}: UseScheduleConstraintsParams) {
  const getWeekdayPy = (y: number, m: number, d: number) => (new Date(y, m - 1, d).getDay() + 6) % 7;

  const getScheduleDoctorId = (day: number, shiftType: ShiftType) => {
    const row = schedule.find((entry) => entry.day === day);
    if (!row) return null;
    return shiftType === "day" ? row.day_shift ?? null : row.night_shift ?? null;
  };

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
    return getShiftDoctorIdFromRow(row, shiftType) === doctorId
      ? new Set<string>([getShiftKey(day, shiftType)])
      : new Set<string>();
  };

  const matchesManualUnavailableEntry = (entry: UnavailableDateEntry, day: number, shiftType: ShiftType) => {
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
      (fixedUnavailableWeekdaysMap[doctorId] || []).find((entry) =>
        matchesFixedUnavailableWeekdayEntry(entry, day, shiftType)
      ) ?? null
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
      if (shiftType && !matchesFixedUnavailableWeekdayEntry(entry, day, shiftType)) return false;
      if (entry.day_of_week === 7) return holidayInfo.isHolidayLike && !holidayInfo.isSun;
      return entry.day_of_week === weekdayPy;
    });
  };

  const getConstraintScopeLabel = (targetShift: "all" | "day" | "night") => {
    if (targetShift === "day") return "日直のみ";
    if (targetShift === "night") return "当直のみ";
    return "終日";
  };

  const getFixedWeekdayLabel = (dayOfWeek: number) => {
    if (dayOfWeek === 7) return "祝日";
    return `${weekdayLabelsPy[dayOfWeek] ?? "?"}曜日`;
  };

  const isDoctorBlockedByManualConstraints = (
    doctorId: string | null | undefined,
    day: number,
    shiftType?: ShiftType
  ) => hasAnyManualUnavailableEntry(doctorId, day, shiftType) || hasAnyFixedUnavailableEntry(doctorId, day, shiftType);

  const isHighlightedDoctorBlockedDay = (day: number) => isDoctorBlockedByManualConstraints(highlightedDoctorId, day);

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
      return "平日の日直には配置できません";
    }

    if (respectOverrideMode && isOverrideMode) {
      return null;
    }

    if (respectUnavailableDays) {
      const manualUnavailableEntry = getManualUnavailableEntry(doctorId, day, shiftType);
      if (manualUnavailableEntry) {
        return `${doctorName}先生は${month}月${day}日に${getConstraintScopeLabel(manualUnavailableEntry.target_shift)}の休み希望です`;
      }

      const fixedUnavailableEntry = getFixedUnavailableEntry(doctorId, day, shiftType);
      if (fixedUnavailableEntry) {
        return `${doctorName}先生は${getFixedWeekdayLabel(fixedUnavailableEntry.day_of_week)}に${getConstraintScopeLabel(fixedUnavailableEntry.target_shift)}の固定不可です`;
      }
    }

    if (spacingDays !== null) {
      const prevMonthWorkedDays = prevMonthWorkedDaysMap[doctorId] || [];
      const hasBlockedPrevMonthGap = prevMonthWorkedDays.some((workedDay) => {
        const gapFromPrevMonth = day + (prevMonthLastDay - workedDay);
        return gapFromPrevMonth <= spacingDays;
      });
      if (hasBlockedPrevMonthGap) {
        return `${doctorName}先生は勤務間隔エラー（設定: ${spacingDays}日）です`;
      }
    }

    const row = scheduleRows.find((entry) => entry.day === day);
    const oppositeShiftType: ShiftType = shiftType === "day" ? "night" : "day";
    const oppositeShiftKey = getShiftKey(day, oppositeShiftType);
    const oppositeDoctorId =
      row && !ignoreShiftKeys.has(oppositeShiftKey) ? getShiftDoctorIdFromRow(row, oppositeShiftType) : null;
    if (preventSunholConsecutive && oppositeDoctorId && oppositeDoctorId === doctorId) {
      return "同一日の日直と当直に同じ医師は配置できません";
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
            return `${doctorName}先生は勤務間隔エラー（設定: ${spacingDays}日）です`;
          }
        }
      }
    }

    if (maxSaturdayNights !== null && shiftType === "night" && isSaturday(day)) {
      const saturdayNightCount =
        countDoctorAssignments(
          doctorId,
          scheduleRows,
          (rowEntry) => isSaturday(rowEntry.day),
          ["night"],
          ignoreShiftKeys
        ) + 1;
      if (saturdayNightCount > maxSaturdayNights) {
        return `${doctorName}先生は土曜当直の上限（${maxSaturdayNights}回）を超えます`;
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
        return `${doctorName}先生は日祝日直の上限（${maxSunholDays}回）を超えます`;
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
        return `${doctorName}先生は日祝勤務の上限（${maxSunholWorks}回）を超えます`;
      }
    }

    if (
      maxWeekendHolidayWorks !== null &&
      ((shiftType === "night" && isSaturday(day)) || holidayInfo.isHolidayLike)
    ) {
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
        return `${doctorName}先生は土日祝勤務の上限（${maxWeekendHolidayWorks}回）を超えます`;
      }
    }

    return null;
  };

  const formatConstraintForToast = (doctorId: string, message: string) => {
    const doctorName = getDoctorName(doctorId);
    return message.startsWith(`${doctorName}先生`) ? message : `${doctorName}先生: ${message}`;
  };

  const getSwapConstraintMessage = (
    sourceDoctorId: string | null | undefined,
    fromDay: number,
    fromType: ShiftType,
    toDay: number,
    toType: ShiftType,
    options?: { scheduleRows?: ScheduleRow[] }
  ) => {
    if (!sourceDoctorId) return null;

    const scheduleRows = options?.scheduleRows ?? schedule;
    const simulatedRows = scheduleRows.map((row) => ({ ...row }));
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
    if (sourceMessage) messages.push(formatConstraintForToast(sourceDoctorId, sourceMessage));

    if (targetDoctorId && targetDoctorId !== sourceDoctorId) {
      const targetMessage = getPlacementConstraintMessage(targetDoctorId, fromDay, fromType, {
        scheduleRows: simulatedRows,
        ignoreShiftKeys: new Set<string>([getShiftKey(fromDay, fromType)]),
      });
      if (targetMessage) messages.push(formatConstraintForToast(targetDoctorId, targetMessage));
    }

    if (messages.length === 0) return null;
    return Array.from(new Set(messages)).join("\n");
  };

  const validateScheduleViolations = (scheduleRows: ScheduleRow[] = schedule) => {
    const messages = new Set<string>();

    const emptyNightDays: number[] = [];
    const emptyDayDays: number[] = [];
    scheduleRows.forEach((row) => {
      if (!row.night_shift) emptyNightDays.push(row.day);
      if (!row.day_shift && row.is_sunhol) emptyDayDays.push(row.day);
    });
    if (emptyNightDays.length > 0) {
      messages.add(`当直が未定の日があります: ${emptyNightDays.map((d) => `${d}日`).join("、")}`);
    }
    if (emptyDayDays.length > 0) {
      messages.add(`日直が未定の日（日曜・祝日）があります: ${emptyDayDays.map((d) => `${d}日`).join("、")}`);
    }

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

  return {
    getScheduleDoctorId,
    getPlacementIgnoreShiftKeys,
    getPlacementConstraintMessage,
    formatConstraintForToast,
    getSwapConstraintMessage,
    validateScheduleViolations,
    isDoctorBlockedByManualConstraints,
    isHighlightedDoctorBlockedDay,
    hasAnyManualUnavailableEntry,
    hasAnyFixedUnavailableEntry,
  };
}
