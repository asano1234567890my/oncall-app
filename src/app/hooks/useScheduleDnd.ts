import { useEffect, useRef, useState, type DragEvent, type TouchEvent } from "react";
import type {
  DragPayload,
  FixedUnavailableWeekdayMap,
  HardConstraints,
  HolidayLikeDayInfo,
  LockedShiftPayload,
  ScheduleRow,
  ShiftType,
  SwapSource,
  UnavailableDateMap,
} from "../types/dashboard";
import { getShiftKey, getShiftDoctorIdFromRow, useScheduleConstraints } from "./useScheduleConstraints";

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

  const {
    getScheduleDoctorId,
    getPlacementIgnoreShiftKeys,
    getPlacementConstraintMessage,
    formatConstraintForToast,
    getSwapConstraintMessage,
    validateScheduleViolations,
    isHighlightedDoctorBlockedDay,
    isHighlightedDoctorBlockedShift,
  } = useScheduleConstraints({
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
  });

  const getSelectedManualDoctorId = () =>
    selectedListSelection?.mode === "doctor" ? selectedListSelection.doctorId : null;
  const isEraseSelectionActive = selectedListSelection?.mode === "erase";

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

  // --- スケジュールミューテーション ---

  const buildAssignSchedule = (day: number, shiftType: ShiftType, doctorId: string): ScheduleMutationResult => {
    const next = cloneSchedule(schedule);
    const targetRow = next.find((row) => row.day === day);
    if (!targetRow) {
      return { nextSchedule: null, errorMessage: "対象日のシフトが見つかりません" };
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
      return { nextSchedule: null, errorMessage: "ロック済みの枠は移動できません" };
    }

    const next = cloneSchedule(schedule);
    const fromRow = next.find((row) => row.day === fromDay);
    const toRow = next.find((row) => row.day === toDay);
    if (!fromRow || !toRow) {
      return { nextSchedule: null, errorMessage: "対象日のシフトが見つかりません" };
    }

    const fromField = fromType === "day" ? "day_shift" : "night_shift";
    const toField = toType === "day" ? "day_shift" : "night_shift";
    const fromDoctorId = fromRow[fromField] ?? null;
    const toDoctorId = toRow[toField] ?? null;
    if (!fromDoctorId) {
      return { nextSchedule: null, errorMessage: "入れ替え元に医師が入っていません" };
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
      return { nextSchedule: null, errorMessage: "ロック済みの枠は解除できません" };
    }

    const next = cloneSchedule(schedule);
    const row = next.find((entry) => entry.day === day);
    if (!row) {
      return { nextSchedule: null, errorMessage: "対象日のシフトが見つかりません" };
    }

    const currentDoctorId = shiftType === "day" ? row.day_shift ?? null : row.night_shift ?? null;
    if (!currentDoctorId) {
      return { nextSchedule: null, errorMessage: null };
    }

    if (shiftType === "day") row.day_shift = null;
    else row.night_shift = null;

    return { nextSchedule: next, errorMessage: null };
  };

  // --- ドラッグ状態管理 ---

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
      return { message: "ロック済みの枠には配置できません", dropEffect: "none" };
    }

    if (shiftType === "day" && !isHolidayLike) {
      return { message: "平日の日直には配置できません", dropEffect: "none" };
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

  // --- タッチドラッグ ---

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
    const shiftType =
      container.dataset.shiftType === "day" || container.dataset.shiftType === "night"
        ? container.dataset.shiftType
        : null;
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

  // --- 選択・スワップ操作 ---

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

  // --- イベントハンドラ ---

  const handleDisabledDayDragOver = (event: DragEvent<HTMLDivElement>, day: number) => {
    const activeSource = getActiveDragSource();
    if (!activeSource) return;

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
        showToast("ロック済みの枠は入れ替え元にできません");
        return;
      }

      const doctorId = getScheduleDoctorId(day, shiftType);
      if (!doctorId) {
        showToast("入れ替え元にする枠を先に選択してください");
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
        showToast("ロック済みの枠は入れ替え元にできません");
        return;
      }

      const doctorId = getScheduleDoctorId(day, shiftType);
      if (!doctorId) {
        showToast("入れ替えできる医師入り枠を選択してください");
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

  // --- ロック管理 ---

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

  // --- エフェクト ---

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
    isHighlightedDoctorBlockedShift,
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
