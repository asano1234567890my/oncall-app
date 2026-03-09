import { useEffect, useState, type DragEvent } from "react";
import type {
  DragPayload,
  HolidayLikeDayInfo,
  LockedShiftPayload,
  ScheduleRow,
  ShiftType,
  SwapSource,
} from "../types/dashboard";

type DragSourceType = "calendar" | "list" | null;

type UseScheduleDndParams = {
  schedule: ScheduleRow[];
  commitSchedule: (nextSchedule: ScheduleRow[]) => void;
  year: number;
  month: number;
  prevMonthLastDay: number;
  unavailableMap: Record<string, number[]>;
  fixedUnavailableWeekdaysMap: Record<string, number[]>;
  prevMonthWorkedDaysMap: Record<string, number[]>;
  getDoctorName: (doctorId: string | null | undefined) => string;
  getWeekday: (year: number, month: number, day: number) => string;
  isHolidayLikeDay: (day: number) => HolidayLikeDayInfo;
  isActiveDoctorId: (doctorId: string | null | undefined) => boolean;
};

type ScheduleMutationResult = {
  nextSchedule: ScheduleRow[] | null;
  errorMessage: string | null;
};

const cloneSchedule = (rows: ScheduleRow[]) => rows.map((row) => ({ ...row }));

export function useScheduleDnd({
  schedule,
  commitSchedule,
  year,
  month,
  prevMonthLastDay,
  unavailableMap,
  fixedUnavailableWeekdaysMap,
  prevMonthWorkedDaysMap,
  getDoctorName,
  getWeekday,
  isHolidayLikeDay,
  isActiveDoctorId,
}: UseScheduleDndParams) {
  const [lockedShiftKeys, setLockedShiftKeys] = useState<Set<string>>(() => new Set());
  const [dragSourceKey, setDragSourceKey] = useState<string | null>(null);
  const [dragSourceType, setDragSourceType] = useState<DragSourceType>(null);
  const [draggingDoctorId, setDraggingDoctorId] = useState<string | null>(null);
  const [highlightedDoctorId, setHighlightedDoctorId] = useState<string | null>(null);
  const [invalidHoverShiftKey, setInvalidHoverShiftKey] = useState<string | null>(null);
  const [hoverErrorMessage, setHoverErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [swapSource, setSwapSource] = useState<SwapSource | null>(null);

  const getShiftKey = (day: number, shiftType: ShiftType) => `${day}_${shiftType}`;
  const getWeekdayPy = (y: number, m: number, d: number) => (new Date(y, m - 1, d).getDay() + 6) % 7;

  const getScheduleDoctorId = (day: number, shiftType: ShiftType) => {
    const row = schedule.find((entry) => entry.day === day);
    if (!row) return null;
    return shiftType === "day" ? row.day_shift ?? null : row.night_shift ?? null;
  };

  const getShiftDoctorIdFromRow = (row: ScheduleRow, shiftType: ShiftType) =>
    shiftType === "day" ? row.day_shift ?? null : row.night_shift ?? null;

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

  const isDoctorManuallyUnavailableOnDay = (doctorId: string | null | undefined, day: number) => {
    if (!doctorId) return false;
    return (unavailableMap[doctorId] || []).includes(day);
  };

  const isDoctorFixedUnavailableOnDay = (doctorId: string | null | undefined, day: number) => {
    if (!doctorId) return false;
    const weekdayPy = getWeekdayPy(year, month, day);
    return (fixedUnavailableWeekdaysMap[doctorId] || []).includes(weekdayPy);
  };

  const isDoctorBlockedByManualConstraints = (doctorId: string | null | undefined, day: number) =>
    isDoctorManuallyUnavailableOnDay(doctorId, day) || isDoctorFixedUnavailableOnDay(doctorId, day);

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
    }
  ) => {
    if (!doctorId) return null;

    const scheduleRows = options?.scheduleRows ?? schedule;
    const ignoreShiftKeys = options?.ignoreShiftKeys ?? new Set<string>();
    const doctorName = getDoctorName(doctorId);

    if (shiftType === "day" && !isHolidayLikeDay(day).isHolidayLike) {
      return "平日の日直には配置できません";
    }

    if (isDoctorManuallyUnavailableOnDay(doctorId, day)) {
      return `${doctorName}先生は${month}月${day}日を個別不可申請しています`;
    }

    if (isDoctorFixedUnavailableOnDay(doctorId, day)) {
      const weekdayPy = getWeekdayPy(year, month, day);
      return `${doctorName}先生は${["月", "火", "水", "木", "金", "土", "日"][weekdayPy]}曜日を固定不可に設定しています`;
    }

    const prevMonthWorkedDays = prevMonthWorkedDaysMap[doctorId] || [];
    const hasBlockedPrevMonthGap = prevMonthWorkedDays.some((workedDay) => {
      const gapFromPrevMonth = day + (prevMonthLastDay - workedDay);
      return gapFromPrevMonth <= 3;
    });
    if (hasBlockedPrevMonthGap) {
      return `${doctorName}先生は4日間隔が空いていません`;
    }

    const row = scheduleRows.find((entry) => entry.day === day);
    const oppositeShiftType: ShiftType = shiftType === "day" ? "night" : "day";
    const oppositeShiftKey = getShiftKey(day, oppositeShiftType);
    const oppositeDoctorId = row && !ignoreShiftKeys.has(oppositeShiftKey) ? getShiftDoctorIdFromRow(row, oppositeShiftType) : null;
    if (oppositeDoctorId && oppositeDoctorId === doctorId) {
      return "同じ日に日直と当直へ同じ医師は配置できません";
    }

    for (const rowEntry of scheduleRows) {
      for (const candidateShiftType of ["day", "night"] as const) {
        const shiftKey = getShiftKey(rowEntry.day, candidateShiftType);
        if (ignoreShiftKeys.has(shiftKey)) continue;

        const assignedDoctorId = getShiftDoctorIdFromRow(rowEntry, candidateShiftType);
        if (assignedDoctorId !== doctorId) continue;

        if (Math.abs(rowEntry.day - day) <= 3) {
          return `${doctorName}先生は4日間隔が空いていません`;
        }
      }
    }

    if (shiftType === "night" && getWeekday(year, month, day) === "土") {
      const alreadyHasSaturdayNight = scheduleRows.some((rowEntry) => {
        const shiftKey = getShiftKey(rowEntry.day, "night");
        if (ignoreShiftKeys.has(shiftKey)) return false;
        return getWeekday(year, month, rowEntry.day) === "土" && (rowEntry.night_shift ?? null) === doctorId;
      });

      if (alreadyHasSaturdayNight) {
        return `${doctorName}先生の土曜当直は月1回までです`;
      }
    }

    return null;
  };

  const formatConstraintForToast = (doctorId: string, message: string) => {
    const doctorName = getDoctorName(doctorId);
    const prefixWithHa = `${doctorName}先生は`;
    const prefixWithNo = `${doctorName}先生の`;

    if (message.startsWith(prefixWithHa)) {
      return `【${doctorName}先生】${message.slice(prefixWithHa.length)}`;
    }
    if (message.startsWith(prefixWithNo)) {
      return `【${doctorName}先生】${message.slice(prefixWithNo.length)}`;
    }
    return `【${doctorName}先生】${message}`;
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
    const messages: string[] = [];
    const sourceIgnoreShiftKeys = new Set<string>([getShiftKey(fromDay, fromType)]);
    const sourceMessage = getPlacementConstraintMessage(sourceDoctorId, toDay, toType, {
      scheduleRows,
      ignoreShiftKeys: sourceIgnoreShiftKeys,
    });

    if (sourceMessage) {
      messages.push(formatConstraintForToast(sourceDoctorId, sourceMessage));
    }

    const targetRow = scheduleRows.find((row) => row.day === toDay);
    const targetDoctorId = targetRow ? getShiftDoctorIdFromRow(targetRow, toType) : null;

    if (targetDoctorId && targetDoctorId !== sourceDoctorId) {
      const targetIgnoreShiftKeys = new Set<string>([getShiftKey(toDay, toType)]);
      const targetMessage = getPlacementConstraintMessage(targetDoctorId, fromDay, fromType, {
        scheduleRows,
        ignoreShiftKeys: targetIgnoreShiftKeys,
      });

      if (targetMessage) {
        messages.push(formatConstraintForToast(targetDoctorId, targetMessage));
      }
    }

    if (messages.length === 0) return null;
    return Array.from(new Set(messages)).join("\n");
  };

  const clearDragState = () => {
    setDragSourceKey(null);
    setDragSourceType(null);
    setDraggingDoctorId(null);
    setInvalidHoverShiftKey(null);
    setHoverErrorMessage(null);
  };

  const clearSwapState = () => {
    setSwapSource(null);
    setIsSwapMode(false);
    setInvalidHoverShiftKey(null);
    setHoverErrorMessage(null);
  };

  const toggleSwapMode = () => {
    clearDragState();
    setSwapSource(null);
    setIsSwapMode((prev) => !prev);
  };

  const buildAssignSchedule = (day: number, shiftType: ShiftType, doctorId: string): ScheduleMutationResult => {
    const next = cloneSchedule(schedule);
    const targetRow = next.find((row) => row.day === day);
    if (!targetRow) {
      return { nextSchedule: null, errorMessage: "対象のシフト枠が見つかりません" };
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
      return { nextSchedule: null, errorMessage: "ロック済みのため移動できません" };
    }

    const next = cloneSchedule(schedule);
    const fromRow = next.find((row) => row.day === fromDay);
    const toRow = next.find((row) => row.day === toDay);
    if (!fromRow || !toRow) {
      return { nextSchedule: null, errorMessage: "対象のシフト枠が見つかりません" };
    }

    const fromField = fromType === "day" ? "day_shift" : "night_shift";
    const toField = toType === "day" ? "day_shift" : "night_shift";
    const fromDoctorId = fromRow[fromField] ?? null;
    const toDoctorId = toRow[toField] ?? null;
    if (!fromDoctorId) {
      return { nextSchedule: null, errorMessage: "入れ替え元に担当医がいません" };
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
      return { nextSchedule: null, errorMessage: "ロック済みのため解除できません" };
    }

    const next = cloneSchedule(schedule);
    const row = next.find((entry) => entry.day === day);
    if (!row) {
      return { nextSchedule: null, errorMessage: "対象のシフト枠が見つかりません" };
    }

    if (shiftType === "day") row.day_shift = null;
    else row.night_shift = null;

    return { nextSchedule: next, errorMessage: null };
  };

  const handleDisabledDayDragOver = (event: DragEvent<HTMLDivElement>, day: number) => {
    if (!draggingDoctorId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "none";
    setInvalidHoverShiftKey(getShiftKey(day, "day"));
    setHoverErrorMessage("平日の日直には配置できません");
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
    if (!draggingDoctorId || !dragSourceType) return;

    const shiftKey = getShiftKey(day, shiftType);
    if (locked) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "none";
      setInvalidHoverShiftKey(shiftKey);
      setHoverErrorMessage("ロック済みのため移動できません");
      return;
    }

    if (shiftType === "day" && !isHolidayLike) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "none";
      setInvalidHoverShiftKey(shiftKey);
      setHoverErrorMessage("平日の日直には配置できません");
      return;
    }

    let constraintMessage: string | null = null;

    if (dragSourceType === "calendar") {
      const sourcePayload = parseDragPayload(dragSourceKey);
      constraintMessage = sourcePayload
        ? getSwapConstraintMessage(draggingDoctorId, sourcePayload.day, sourcePayload.shiftType, day, shiftType)
        : getPlacementConstraintMessage(draggingDoctorId, day, shiftType, {
            ignoreShiftKeys: getPlacementIgnoreShiftKeys(draggingDoctorId, day, shiftType),
          });
    }

    if (dragSourceType === "list") {
      constraintMessage = getPlacementConstraintMessage(draggingDoctorId, day, shiftType, {
        ignoreShiftKeys: getPlacementIgnoreShiftKeys(draggingDoctorId, day, shiftType),
      });
    }

    event.preventDefault();
    if (constraintMessage) {
      event.dataTransfer.dropEffect = "none";
      setInvalidHoverShiftKey(shiftKey);
      setHoverErrorMessage(constraintMessage);
      return;
    }

    event.dataTransfer.dropEffect = dragSourceType === "list" ? "copy" : "move";
    setInvalidHoverShiftKey(null);
    setHoverErrorMessage(null);
  };

  const handleShiftDragLeave = (day: number, shiftType: ShiftType) => {
    const shiftKey = getShiftKey(day, shiftType);
    if (invalidHoverShiftKey === shiftKey) {
      setInvalidHoverShiftKey(null);
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

    if (locked) {
      showToast("ロック済みのため移動できません");
      clearDragState();
      return;
    }

    if (toType === "day" && !isHolidayLike) {
      showToast("平日の日直には配置できません");
      clearDragState();
      return;
    }

    try {
      if (dragSourceType === "list") {
        if (!draggingDoctorId) return;

        const result = buildAssignSchedule(toDay, toType, draggingDoctorId);
        if (result.errorMessage) {
          showToast(result.errorMessage);
          return;
        }
        if (result.nextSchedule) {
          commitSchedule(result.nextSchedule);
        }
        return;
      }

      const parsed = parseDragPayload(event.dataTransfer.getData("text/plain") || dragSourceKey);
      if (!parsed) {
        showToast("ドラッグ情報の読み取りに失敗しました。もう一度お試しください。");
        return;
      }

      const result = buildSwapSchedule(parsed.day, parsed.shiftType, toDay, toType);
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

    if (!swapSource) {
      if (locked) {
        showToast("ロック済みの枠は入れ替え元にできません");
        return;
      }

      const doctorId = getScheduleDoctorId(day, shiftType);
      if (!doctorId) {
        showToast("入れ替え元は担当医が入っている枠を選択してください");
        return;
      }

      setSwapSource({ day, shiftType, doctorId });
      setHighlightedDoctorId(doctorId);
      return;
    }

    if (swapSource.day === day && swapSource.shiftType === shiftType) {
      setSwapSource(null);
      return;
    }

    if (locked) {
      showToast("ロック済みの枠には移動できません");
      return;
    }

    if (shiftType === "day" && !isHolidayLike) {
      showToast("平日の日直には配置できません");
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
    clearSwapState();
  };

  const handleShiftDragStart = (
    event: DragEvent<HTMLElement>,
    day: number,
    shiftType: ShiftType,
    doctorId: string | null | undefined
  ) => {
    const payload = JSON.stringify({ day, shiftType });
    event.dataTransfer.setData("text/plain", payload);
    event.dataTransfer.effectAllowed = "move";
    setDragSourceKey(payload);
    setDragSourceType("calendar");
    setDraggingDoctorId(doctorId ?? null);
    setInvalidHoverShiftKey(null);
    setHoverErrorMessage(null);
    setIsSwapMode(false);
    setSwapSource(null);
  };

  const handleDoctorListDragStart = (event: DragEvent<HTMLElement>, doctorId: string) => {
    event.dataTransfer.setData("text/plain", `doctor:${doctorId}`);
    event.dataTransfer.effectAllowed = "copy";
    setDragSourceKey(null);
    setDragSourceType("list");
    setDraggingDoctorId(doctorId);
    setInvalidHoverShiftKey(null);
    setHoverErrorMessage(null);
    setIsSwapMode(false);
    setSwapSource(null);
  };

  const handleTrashDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (dragSourceType !== "calendar") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setInvalidHoverShiftKey(null);
  };

  const handleTrashDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    try {
      if (dragSourceType !== "calendar") return;

      const parsed = parseDragPayload(event.dataTransfer.getData("text/plain") || dragSourceKey);
      if (!parsed) {
        showToast("ドラッグ情報の読み取りに失敗しました。もう一度お試しください。");
        return;
      }

      const result = buildClearSchedule(parsed.day, parsed.shiftType);
      if (result.errorMessage) {
        showToast(result.errorMessage);
        return;
      }

      if (result.nextSchedule) {
        commitSchedule(result.nextSchedule);
        setLockedShiftKeys((prev) => {
          const next = new Set(prev);
          next.delete(getShiftKey(parsed.day, parsed.shiftType));
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
          date: day,
          shift_type: shiftType,
          doctor_id: doctorId,
        };
      })
      .filter((item): item is LockedShiftPayload => item !== null);

  useEffect(() => {
    setLockedShiftKeys(new Set());
    clearDragState();
    clearSwapState();
    setHoverErrorMessage(null);
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

      if (next.size === prev.size) return prev;
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
    lockedShiftKeys,
    isShiftLocked,
    isSwapMode,
    swapSource,
    isSwapSourceSelected,
    isHighlightedDoctorBlockedDay,
    toggleHighlightedDoctor,
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
    handleTrashDragOver,
    handleTrashDrop,
    toggleShiftLock,
    handleLockAll,
    handleUnlockAll,
    buildLockedShiftsPayload,
  };
}


