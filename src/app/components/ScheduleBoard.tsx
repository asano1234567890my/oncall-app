"use client";

import { Lock, Trash2, Unlock } from "lucide-react";
import type { DragEvent, TouchEvent } from "react";
import type { DoctorScoreEntry, ScheduleRow, ShiftType, SwapSource } from "../types/dashboard";

type ScheduleBoardProps = {
  isLoading: boolean;
  toastMessage: string | null;
  hoverErrorMessage: string | null;
  dragSourceType: "calendar" | "list" | null;
  error: string;
  schedule: ScheduleRow[];
  scheduleColumns: ScheduleRow[][];
  scoreEntries: DoctorScoreEntry[];
  getDoctorName: (doctorId: string | null | undefined) => string;
  highlightedDoctorId: string | null;
  selectedManualDoctorId: string | null;
  isEraseSelectionActive: boolean;
  year: number;
  month: number;
  holidaySet: Set<string>;
  manualHolidaySetInMonth: Set<string>;
  toYmd: (year: number, month: number, day: number) => string;
  getWeekday: (year: number, month: number, day: number) => string;
  isHighlightedDoctorBlockedDay: (day: number) => boolean;
  isShiftLocked: (day: number, shiftType: ShiftType) => boolean;
  invalidHoverShiftKey: string | null;
  touchHoverShiftKey: string | null;
  isSwapMode: boolean;
  isOverrideMode: boolean;
  swapSource: SwapSource | null;
  isSwapSourceSelected: (day: number, shiftType: ShiftType) => boolean;
  onHandleShiftDragOver: (
    event: DragEvent<HTMLDivElement>,
    day: number,
    shiftType: ShiftType,
    locked: boolean,
    isHolidayLike: boolean
  ) => void;
  onHandleShiftDragLeave: (day: number, shiftType: ShiftType) => void;
  onHandleShiftDrop: (
    event: DragEvent<HTMLDivElement>,
    day: number,
    shiftType: ShiftType,
    locked: boolean,
    isHolidayLike: boolean
  ) => void;
  onHandleDisabledDayDragOver: (event: DragEvent<HTMLDivElement>, day: number) => void;
  onHandleDisabledDayDragLeave: (day: number) => void;
  onShiftDragStart: (
    event: DragEvent<HTMLElement>,
    day: number,
    shiftType: ShiftType,
    doctorId: string | null | undefined
  ) => void;
  onDoctorListDragStart: (event: DragEvent<HTMLElement>, doctorId: string | null) => void;
  onShiftTouchStart: (
    event: TouchEvent<HTMLElement>,
    day: number,
    shiftType: ShiftType,
    doctorId: string | null | undefined
  ) => void;
  onDoctorListTouchStart: (event: TouchEvent<HTMLElement>, doctorId: string | null) => void;
  onTouchDragMove: (event: TouchEvent<HTMLElement>) => void;
  onTouchDragEnd: (event: TouchEvent<HTMLElement>) => void;
  onTouchDragCancel: () => void;
  onShiftTap: (day: number, shiftType: ShiftType, locked: boolean, isHolidayLike: boolean) => void;
  onSwapButtonPress: (day: number, shiftType: ShiftType, locked: boolean, isHolidayLike: boolean) => void;
  onCancelSwapSelection: () => void;
  onToggleHighlightedDoctor: (doctorId: string | null | undefined) => void;
  onSelectManualDoctor: (doctorId: string) => void;
  onToggleEraseSelection: () => void;
  onClearDragState: () => void;
  onToggleShiftLock: (day: number, shiftType: ShiftType) => void;
  onToggleSwapMode: () => void;
  onToggleOverrideMode: () => void;
  onLockAll: () => void;
  onUnlockAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onRegenerateUnlocked: () => void;
  onTrashDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onTrashDrop: (event: DragEvent<HTMLDivElement>) => void;
  lockedShiftCount: number;
  onDeleteMonthSchedule: () => void;
  isDeletingMonthSchedule: boolean;
  onSaveToDB: () => void;
  onForceSaveToDB: () => void;
  onDismissSaveValidation: () => void;
  isSaving: boolean;
  saveMessage: string;
  saveValidationMessages: string[];
};

export default function ScheduleBoard({
  isLoading,
  toastMessage,
  hoverErrorMessage,
  dragSourceType,
  error,
  schedule,
  scheduleColumns,
  scoreEntries,
  getDoctorName,
  highlightedDoctorId,
  selectedManualDoctorId,
  isEraseSelectionActive,
  year,
  month,
  holidaySet,
  manualHolidaySetInMonth,
  toYmd,
  getWeekday,
  isHighlightedDoctorBlockedDay,
  isShiftLocked,
  invalidHoverShiftKey,
  touchHoverShiftKey,
  isSwapMode,
  isOverrideMode,
  swapSource,
  isSwapSourceSelected,
  onHandleShiftDragOver,
  onHandleShiftDragLeave,
  onHandleShiftDrop,
  onHandleDisabledDayDragOver,
  onHandleDisabledDayDragLeave,
  onShiftDragStart,
  onDoctorListDragStart,
  onShiftTouchStart,
  onDoctorListTouchStart,
  onTouchDragMove,
  onTouchDragEnd,
  onTouchDragCancel,
  onShiftTap,
  onSwapButtonPress,
  onCancelSwapSelection,
  onToggleHighlightedDoctor,
  onSelectManualDoctor,
  onToggleEraseSelection,
  onClearDragState,
  onToggleShiftLock,
  onToggleSwapMode,
  onToggleOverrideMode,
  onLockAll,
  onUnlockAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRegenerateUnlocked,
  onTrashDragOver,
  onTrashDrop,
  lockedShiftCount,
  onDeleteMonthSchedule,
  isDeletingMonthSchedule,
  onSaveToDB,
  onForceSaveToDB,
  onDismissSaveValidation,
  isSaving,
  saveMessage,
  saveValidationMessages,
}: ScheduleBoardProps) {
  const highlightedDoctorName = highlightedDoctorId ? getDoctorName(highlightedDoctorId) : null;
  const manualSelectionLabel = selectedManualDoctorId ? getDoctorName(selectedManualDoctorId) : null;
  const swapSourceLabel = swapSource
    ? `${swapSource.day}日 ${swapSource.shiftType === "day" ? "日直" : "当直"} ${getDoctorName(swapSource.doctorId)}`
    : null;

  const getDoctorBadgeClass = (doctorId: string | null | undefined, shiftType: ShiftType, locked: boolean) => {
    const isHighlighted = doctorId != null && doctorId === highlightedDoctorId;
    const tone =
      shiftType === "day"
        ? locked
          ? "bg-amber-100 text-amber-900"
          : "bg-orange-100 text-orange-800"
        : locked
          ? "bg-amber-100 text-amber-900"
          : "bg-indigo-100 text-indigo-800";

    return `${tone} min-w-0 flex-1 truncate rounded-full px-0.5 py-[1px] text-left text-[8px] font-bold leading-tight whitespace-nowrap touch-none sm:px-1 sm:py-0.5 sm:text-[9px] ${
      locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
    } ${isHighlighted ? "ring-1 ring-sky-500 ring-offset-1" : ""}`;
  };

  const formatScore = (score: number | null) => (score === null ? "-" : score.toFixed(1));

  const getScoreTextClass = (tone: DoctorScoreEntry["tone"]) => {
    if (tone === "danger") return "text-red-600";
    if (tone === "warn") return "text-orange-500";
    if (tone === "good") return "text-green-600";
    return "text-gray-700";
  };

  const getScoreChipClass = (isSelected: boolean, variant: "doctor" | "erase" = "doctor") => {
    const base = isSelected
      ? "border-sky-300 bg-sky-50 ring-1 ring-sky-300"
      : variant === "erase"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-gray-200 bg-white text-gray-700";

    return `flex items-center gap-1 rounded border px-1 py-0.5 text-[9px] shadow-sm touch-none ${base}`;
  };

  const renderHoverTooltip = (isVisible: boolean) => {
    if (!isVisible || !hoverErrorMessage) return null;

    return (
      <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-44 -translate-x-1/2 rounded-md border border-red-200 bg-white/95 px-2 py-1 text-left text-[10px] font-semibold leading-tight whitespace-pre-line text-red-700 shadow-lg backdrop-blur md:block">
        {hoverErrorMessage}
      </div>
    );
  };

  const renderScheduleTable = (rows: ScheduleRow[], columnKey: string) => (
    <div key={columnKey} className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
      <table className="w-full table-fixed select-none bg-white text-center text-[7px] leading-tight sm:text-[9px] md:text-[10px]">
        <thead className="bg-gray-100 text-[7px] text-gray-600 sm:text-[8px]">
          <tr>
            <th className="w-5 border-b px-0 py-[2px] sm:w-7 sm:px-0.5 sm:py-0.5">日付</th>
            <th className="w-4 border-b px-0 py-[2px] sm:w-5 sm:px-0.5 sm:py-0.5">曜</th>
            <th className="border-b bg-orange-50 px-0 py-[2px] sm:px-0.5 sm:py-0.5">日直</th>
            <th className="border-b bg-indigo-50 px-0 py-[2px] sm:px-0.5 sm:py-0.5">当直</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const wd = getWeekday(year, month, row.day);
            const isSun = wd === "日";
            const isSat = wd === "土";
            const ymd = toYmd(year, month, row.day);
            const isAutoHoliday = holidaySet.has(ymd);
            const isManualHoliday = manualHolidaySetInMonth.has(ymd);
            const isHolidayLike = Boolean(row.is_sunhol ?? row.is_holiday) || isSun || isAutoHoliday || isManualHoliday;
            const isDayShiftEnabled = isHolidayLike;
            const dayLocked = isShiftLocked(row.day, "day");
            const nightLocked = isShiftLocked(row.day, "night");
            const dayShiftKey = `${row.day}_day`;
            const nightShiftKey = `${row.day}_night`;
            const dayHoverInvalid = invalidHoverShiftKey === dayShiftKey;
            const nightHoverInvalid = invalidHoverShiftKey === nightShiftKey;
            const dayTouchHovered = touchHoverShiftKey === dayShiftKey;
            const nightTouchHovered = touchHoverShiftKey === nightShiftKey;
            const daySwapSelected = isSwapSourceSelected(row.day, "day");
            const nightSwapSelected = isSwapSourceSelected(row.day, "night");
            const highlightBlocked = isHighlightedDoctorBlockedDay(row.day);
            const dateCellClass = isHolidayLike
              ? "border-red-100 bg-red-50 text-red-700"
              : isSat
                ? "border-blue-100 bg-blue-50 text-blue-700"
                : "text-gray-700";
            const weekdayCellClass = isHolidayLike
              ? "border-red-100 bg-red-50 text-red-600"
              : isSat
                ? "border-blue-100 bg-blue-50 text-blue-600"
                : "text-gray-500";
            const dayCellClass = daySwapSelected
              ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300"
              : dayHoverInvalid
                ? "cursor-not-allowed border-red-300 bg-red-200"
                : dayTouchHovered
                  ? "border-sky-300 bg-sky-50 ring-1 ring-sky-200"
                  : dayLocked
                    ? highlightBlocked
                      ? "border-amber-300 bg-red-100"
                      : "border-amber-300 bg-amber-50"
                    : highlightBlocked
                      ? "border-red-200 bg-red-100"
                      : "border-transparent bg-white hover:border-gray-200";
            const nightCellClass = nightSwapSelected
              ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300"
              : nightHoverInvalid
                ? "cursor-not-allowed border-red-300 bg-red-200"
                : nightTouchHovered
                  ? "border-sky-300 bg-sky-50 ring-1 ring-sky-200"
                  : nightLocked
                    ? highlightBlocked
                      ? "border-amber-300 bg-red-100"
                      : "border-amber-300 bg-amber-50"
                    : highlightBlocked
                      ? "border-red-200 bg-red-100"
                      : "border-transparent bg-white hover:border-gray-200";
            const disabledDayCellClass = daySwapSelected
              ? "border-sky-400 bg-sky-50 text-sky-700 ring-1 ring-sky-300"
              : dayHoverInvalid
                ? "cursor-not-allowed border-red-300 bg-red-200 text-red-700"
                : dayTouchHovered
                  ? "border-sky-300 bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                  : highlightBlocked
                    ? "cursor-not-allowed border-red-200 bg-red-100 text-red-500"
                    : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400";

            return (
              <tr key={`${columnKey}-${row.day}`} className={`border-b ${isHolidayLike ? "bg-red-50/30" : isSat ? "bg-blue-50/30" : "bg-white"}`}>
                <td className={`w-5 px-0 py-[2px] align-middle text-[7px] font-semibold sm:w-7 sm:px-0.5 sm:py-0.5 sm:text-[9px] ${dateCellClass}`}>
                  <span className="sm:hidden">{row.day}</span>
                  <span className="hidden sm:inline">{row.day}日</span>
                </td>
                <td className={`w-4 px-0 py-[2px] align-middle text-[7px] font-bold sm:w-5 sm:px-0.5 sm:py-0.5 sm:text-[9px] ${weekdayCellClass}`}>{wd}</td>
                <td className="px-0 py-[2px] align-middle sm:px-0.5 sm:py-0.5">
                  {isDayShiftEnabled ? (
                    <div
                      data-touch-drop-target="shift"
                      data-day={row.day}
                      data-shift-type="day"
                      data-locked={dayLocked ? "true" : "false"}
                      data-holiday-like={isHolidayLike ? "true" : "false"}
                      onClick={() => onShiftTap(row.day, "day", dayLocked, isHolidayLike)}
                      onDragEnter={(event) => onHandleShiftDragOver(event, row.day, "day", dayLocked, isHolidayLike)}
                      onDragOver={(event) => onHandleShiftDragOver(event, row.day, "day", dayLocked, isHolidayLike)}
                      onDragLeave={() => onHandleShiftDragLeave(row.day, "day")}
                      onDrop={(event) => onHandleShiftDrop(event, row.day, "day", dayLocked, isHolidayLike)}
                      className={`relative flex min-h-5 w-full items-center justify-between gap-0.5 rounded border px-[2px] py-[2px] sm:min-h-6 sm:gap-1 sm:px-0.5 sm:py-0.5 ${dayCellClass}`}
                    >
                      {row.day_shift ? (
                        <button
                          type="button"
                          draggable={!dayLocked}
                          onDragStart={(event) => onShiftDragStart(event, row.day, "day", row.day_shift)}
                          onDragEnd={onClearDragState}
                          onTouchStart={!dayLocked ? (event) => onShiftTouchStart(event, row.day, "day", row.day_shift) : undefined}
                          onTouchMove={!dayLocked ? onTouchDragMove : undefined}
                          onTouchEnd={!dayLocked ? onTouchDragEnd : undefined}
                          onTouchCancel={!dayLocked ? onTouchDragCancel : undefined}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (isSwapMode) {
                              onShiftTap(row.day, "day", dayLocked, isHolidayLike);
                              return;
                            }
                            onToggleHighlightedDoctor(row.day_shift);
                          }}
                          className={getDoctorBadgeClass(row.day_shift, "day", dayLocked)}
                          title="クリックでハイライト / ドラッグで移動"
                        >
                          {getDoctorName(row.day_shift)}
                        </button>
                      ) : (
                        <span className="min-w-0 flex-1 text-[7px] text-gray-400 sm:text-[9px]">-</span>
                      )}
                      <div className="flex shrink-0 items-center gap-px sm:gap-0.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSwapButtonPress(row.day, "day", dayLocked, isHolidayLike);
                          }}
                          className={[
                            "rounded border px-0.5 py-px text-[7px] font-bold transition sm:px-1 sm:py-0.5 sm:text-[8px]",
                            daySwapSelected
                              ? "border-yellow-300 bg-yellow-100 text-yellow-900"
                              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-sky-700",
                          ].join(" ")}
                          title={daySwapSelected ? "入れ替え元を解除" : "この枠を入れ替え元/先として選ぶ"}
                        >
                          {"⇄"}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleShiftLock(row.day, "day");
                          }}
                          disabled={!row.day_shift}
                          className="shrink-0 rounded border border-gray-200 bg-white p-px text-gray-500 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40 sm:p-0.5"
                          title={dayLocked ? "ロック解除" : "ロック"}
                        >
                          {dayLocked ? <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : <Unlock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                        </button>
                      </div>
                      {renderHoverTooltip(dayHoverInvalid)}
                    </div>
                  ) : (
                    <div
                      data-touch-drop-target="shift"
                      data-day={row.day}
                      data-shift-type="day"
                      data-locked={dayLocked ? "true" : "false"}
                      data-holiday-like="false"
                      onClick={() => onShiftTap(row.day, "day", dayLocked, false)}
                      onDragEnter={(event) => onHandleDisabledDayDragOver(event, row.day)}
                      onDragOver={(event) => onHandleDisabledDayDragOver(event, row.day)}
                      onDragLeave={() => onHandleDisabledDayDragLeave(row.day)}
                      className={`relative flex min-h-5 w-full items-center justify-center rounded border px-[2px] py-[2px] text-[7px] font-semibold sm:min-h-6 sm:px-0.5 sm:py-0.5 sm:text-[9px] ${disabledDayCellClass}`}
                    >
                      -
                      {renderHoverTooltip(dayHoverInvalid)}
                    </div>
                  )}
                </td>
                <td className="px-0 py-[2px] align-middle sm:px-0.5 sm:py-0.5">
                  <div
                    data-touch-drop-target="shift"
                    data-day={row.day}
                    data-shift-type="night"
                    data-locked={nightLocked ? "true" : "false"}
                    data-holiday-like={isHolidayLike ? "true" : "false"}
                    onClick={() => onShiftTap(row.day, "night", nightLocked, isHolidayLike)}
                    onDragEnter={(event) => onHandleShiftDragOver(event, row.day, "night", nightLocked, isHolidayLike)}
                    onDragOver={(event) => onHandleShiftDragOver(event, row.day, "night", nightLocked, isHolidayLike)}
                    onDragLeave={() => onHandleShiftDragLeave(row.day, "night")}
                    onDrop={(event) => onHandleShiftDrop(event, row.day, "night", nightLocked, isHolidayLike)}
                    className={`relative flex min-h-5 w-full items-center justify-between gap-0.5 rounded border px-[2px] py-[2px] sm:min-h-6 sm:gap-1 sm:px-0.5 sm:py-0.5 ${nightCellClass}`}
                  >
                    {row.night_shift ? (
                      <button
                        type="button"
                        draggable={!nightLocked}
                        onDragStart={(event) => onShiftDragStart(event, row.day, "night", row.night_shift)}
                        onDragEnd={onClearDragState}
                        onTouchStart={!nightLocked ? (event) => onShiftTouchStart(event, row.day, "night", row.night_shift) : undefined}
                        onTouchMove={!nightLocked ? onTouchDragMove : undefined}
                        onTouchEnd={!nightLocked ? onTouchDragEnd : undefined}
                        onTouchCancel={!nightLocked ? onTouchDragCancel : undefined}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (isSwapMode) {
                            onShiftTap(row.day, "night", nightLocked, isHolidayLike);
                            return;
                          }
                          onToggleHighlightedDoctor(row.night_shift);
                        }}
                        className={getDoctorBadgeClass(row.night_shift, "night", nightLocked)}
                        title="クリックでハイライト / ドラッグで移動"
                      >
                        {getDoctorName(row.night_shift)}
                      </button>
                    ) : (
                      <span className="min-w-0 flex-1 text-[7px] text-gray-400 sm:text-[9px]">-</span>
                    )}
                      <div className="flex shrink-0 items-center gap-px sm:gap-0.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSwapButtonPress(row.day, "night", nightLocked, isHolidayLike);
                          }}
                          className={[
                            "rounded border px-0.5 py-px text-[7px] font-bold transition sm:px-1 sm:py-0.5 sm:text-[8px]",
                            nightSwapSelected
                              ? "border-yellow-300 bg-yellow-100 text-yellow-900"
                              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-sky-700",
                          ].join(" ")}
                          title={nightSwapSelected ? "入れ替え元を解除" : "この枠を入れ替え元/先として選ぶ"}
                        >
                          {"⇄"}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleShiftLock(row.day, "night");
                          }}
                          disabled={!row.night_shift}
                          className="shrink-0 rounded border border-gray-200 bg-white p-px text-gray-500 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40 sm:p-0.5"
                          title={nightLocked ? "ロック解除" : "ロック"}
                        >
                          {nightLocked ? <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : <Unlock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                        </button>
                      </div>
                    {renderHoverTooltip(nightHoverInvalid)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      {toastMessage && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-[100] w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 px-3">
          <div className="rounded-2xl bg-gray-900/90 px-6 py-4 text-center text-sm font-bold leading-snug whitespace-pre-line text-white shadow-2xl backdrop-blur sm:text-lg">
            {toastMessage}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700">
          {error}
        </div>
      )}
      {!schedule.length && saveMessage && (
        <div className="mb-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[10px] font-bold text-green-800">
          {saveMessage}
        </div>
      )}
      {!schedule.length && !isLoading && !error && (
        <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-center text-[10px] text-gray-400">
          左上の「自動生成」ボタンを押してください
        </div>
      )}

      {schedule.length > 0 && (
        <div className="animate-fade-in">
          <div className="sticky top-0 z-40 mb-2 space-y-2 bg-white/95 pb-2 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="w-full min-w-0 text-[9px] leading-tight text-gray-500">
                {"D&D で移動・入替・上書きできます。スマホでは [⇄] ボタンで入れ替え元/先を選び、医師や削除をタップ配置できます。"}
                {highlightedDoctorName ? <div className="mt-0.5 font-semibold text-sky-700">ハイライト中: {highlightedDoctorName}</div> : null}
                {manualSelectionLabel ? <div className="mt-0.5 font-semibold text-emerald-700">タップ配置: {manualSelectionLabel}</div> : null}
                {isEraseSelectionActive ? <div className="mt-0.5 font-semibold text-red-600">タップ削除: 削除アイテム選択中</div> : null}
                {swapSourceLabel ? <div className="mt-0.5 font-semibold text-sky-700">入れ替え元: {swapSourceLabel}</div> : null}
                {isOverrideMode ? <div className="mt-0.5 font-semibold text-amber-700">強制配置モード: 手動配置の制約チェックを無効化中</div> : null}
              </div>
              <div className="flex w-full flex-wrap items-center gap-1.5 md:w-auto md:shrink-0 md:justify-end">
                <button
                  type="button"
                  onClick={onToggleSwapMode}
                  className={`rounded-md border px-1.5 py-1 text-[9px] font-bold transition ${
                    isSwapMode
                      ? "border-sky-300 bg-sky-100 text-sky-800"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  入れ替えモード
                </button>
                <button
                  type="button"
                  onClick={onToggleOverrideMode}
                  className={`rounded-md border px-1.5 py-1 text-[9px] font-bold transition ${
                    isOverrideMode
                      ? "border-amber-300 bg-amber-100 text-amber-800"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  強制配置モード
                </button>
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[9px] font-bold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  戻る
                </button>
                <button
                  type="button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[9px] font-bold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  進む
                </button>
                <button
                  type="button"
                  onClick={onLockAll}
                  disabled={!schedule.some((row) => row.day_shift || row.night_shift)}
                  className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-1 text-[9px] font-bold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  全ロック
                </button>
                <button
                  type="button"
                  onClick={onUnlockAll}
                  disabled={lockedShiftCount === 0}
                  className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[9px] font-bold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  全解除
                </button>
                <button
                  type="button"
                  onClick={onRegenerateUnlocked}
                  disabled={isLoading || isOverrideMode}
                  className="rounded-md border border-sky-200 bg-sky-50 px-1.5 py-1 text-[9px] font-bold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {lockedShiftCount > 0 ? "未固定枠を再生成" : "全体を自動生成"}
                </button>
                <button
                  type="button"
                  onClick={onDeleteMonthSchedule}
                  disabled={isDeletingMonthSchedule}
                  className="rounded-md border border-red-200 bg-red-50 px-1.5 py-1 text-[9px] font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeletingMonthSchedule ? "削除中" : "全削除"}
                </button>
              </div>
            </div>
            {isOverrideMode ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-800">
                強制配置モード中は制約違反を許可するため、自動生成を無効化しています。
              </div>
            ) : null}
            {swapSourceLabel ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-2 py-1 text-[9px] font-semibold text-yellow-900">
                <div>{"入れ替え先を選択してください"}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-yellow-800">{"元"}: {swapSourceLabel}</span>
                  <button
                    type="button"
                    onClick={onCancelSwapSelection}
                    className="rounded border border-yellow-300 bg-white px-2 py-0.5 text-[9px] font-bold text-yellow-900 transition hover:bg-yellow-100"
                  >
                    {"キャンセル"}
                  </button>
                </div>
              </div>
            ) : null}


            <div
              data-touch-drop-target="trash"
              onDragOver={onTrashDragOver}
              onDrop={onTrashDrop}
              className={`mb-2 flex min-h-9 items-center justify-center gap-1 rounded-lg border border-dashed px-2 py-1 text-[9px] font-bold transition ${
                dragSourceType === "calendar"
                  ? "border-red-400 bg-red-50 text-red-700"
                  : "border-red-200 bg-red-50/70 text-red-500"
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{dragSourceType === "calendar" ? "ここにドロップでシフト解除" : "ゴミ箱へドロップでシフト解除"}</span>
              <span className="text-[8px] font-medium text-red-400">カレンダー枠のみ有効</span>
            </div>

            <div className="rounded-lg border bg-gray-50 p-1.5">
              <div className="mb-1 text-[9px] font-bold text-gray-700">医師別スコア / 手動配置</div>
              <div className="mb-2 mt-1 flex flex-wrap items-center gap-3 px-1 text-[10px]">
                <span className="text-gray-500">スコアの目安:</span>
                <span className="font-bold text-green-600">目標差0.5以内</span>
                <span className="font-bold text-gray-700">通常</span>
                <span className="font-bold text-orange-500">目標差1.5以上</span>
                <span className="font-bold text-red-600">Min / Max逸脱</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {scoreEntries.map((entry) => {
                  const isSelected = entry.doctorId === highlightedDoctorId || entry.doctorId === selectedManualDoctorId;
                  return (
                    <button
                      key={entry.doctorId}
                      type="button"
                      draggable
                      onDragStart={(event) => onDoctorListDragStart(event, entry.doctorId)}
                      onDragEnd={onClearDragState}
                      onTouchStart={(event) => onDoctorListTouchStart(event, entry.doctorId)}
                      onTouchMove={onTouchDragMove}
                      onTouchEnd={onTouchDragEnd}
                      onTouchCancel={onTouchDragCancel}
                      onClick={() => {
                        if (isSwapMode) {
                          onSelectManualDoctor(entry.doctorId);
                          return;
                        }
                        onToggleHighlightedDoctor(entry.doctorId);
                      }}
                      className={`${getScoreChipClass(isSelected)} ${!isSwapMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                      title={`クリックでハイライト / ドラッグで割り当て / Min ${formatScore(entry.min)} / Target ${formatScore(entry.target)} / Max ${formatScore(entry.max)}`}
                    >
                      <span className="max-w-[4.5rem] truncate font-semibold text-gray-700">{getDoctorName(entry.doctorId)}</span>
                      <span className={`font-bold ${getScoreTextClass(entry.tone)}`}>{formatScore(entry.score)}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => onDoctorListDragStart(event, null)}
                  onDragEnd={onClearDragState}
                  onTouchStart={(event) => onDoctorListTouchStart(event, null)}
                  onTouchMove={onTouchDragMove}
                  onTouchEnd={onTouchDragEnd}
                  onTouchCancel={onTouchDragCancel}
                  onClick={() => {
                    if (!isSwapMode) return;
                    onToggleEraseSelection();
                  }}
                  className={`${getScoreChipClass(isEraseSelectionActive, "erase")} ${isSwapMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
                  title="入れ替えモード中はタップで削除選択 / ドラッグでシフト解除"
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="font-semibold">削除</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-y-1 md:grid-cols-2 md:gap-x-3 md:gap-y-2">{scheduleColumns.map((rows, index) => renderScheduleTable(rows, `column-${index}`))}</div>

          <div className="mt-2 flex flex-col items-center gap-1">
            {saveValidationMessages.length > 0 ? (
              <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
                <div className="font-bold">制約違反があります。修正してください。</div>
                <div className="mt-1 space-y-1">
                  {saveValidationMessages.slice(0, 3).map((message, index) => (
                    <div key={String(index) + message} className="whitespace-pre-line leading-snug">
                      {message}
                    </div>
                  ))}
                  {saveValidationMessages.length > 3 ? (
                    <div className="text-[9px] text-amber-700">ほか {saveValidationMessages.length - 3} 件</div>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onDismissSaveValidation}
                    className="rounded-md border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-800 transition hover:bg-amber-100"
                  >
                    {"戻る"}
                  </button>
                  <button
                    type="button"
                    onClick={onForceSaveToDB}
                    className="text-[10px] font-semibold text-gray-500 underline underline-offset-2 transition hover:text-gray-700"
                  >
                    {"違反を無視して確定する"}
                  </button>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={onSaveToDB}
              disabled={isSaving}
              className="w-full rounded-full bg-green-600 px-3 py-1.5 text-[10px] font-bold text-white shadow transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "保存中..." : "このシフトを保存"}
            </button>
            {saveMessage && <div className="text-[10px] font-bold text-green-800">保存結果: {saveMessage}</div>}
          </div>
        </div>
      )}
    </>
  );
}





