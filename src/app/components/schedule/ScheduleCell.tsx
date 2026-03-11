"use client";

import { Lock, Unlock } from "lucide-react";
import type { DragEvent, TouchEvent } from "react";
import type { ScheduleRow, ShiftType } from "../../types/dashboard";

type ScheduleCellProps = {
  row: ScheduleRow;
  columnKey: string;
  year: number;
  month: number;
  holidaySet: Set<string>;
  manualHolidaySetInMonth: Set<string>;
  toYmd: (year: number, month: number, day: number) => string;
  getWeekday: (year: number, month: number, day: number) => string;
  getDoctorName: (doctorId: string | null | undefined) => string;
  highlightedDoctorId: string | null;
  hoverErrorMessage: string | null;
  isHighlightedDoctorBlockedDay: (day: number) => boolean;
  isShiftLocked: (day: number, shiftType: ShiftType) => boolean;
  invalidHoverShiftKey: string | null;
  touchHoverShiftKey: string | null;
  isSwapMode: boolean;
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
  onShiftTouchStart: (
    event: TouchEvent<HTMLElement>,
    day: number,
    shiftType: ShiftType,
    doctorId: string | null | undefined
  ) => void;
  onTouchDragMove: (event: TouchEvent<HTMLElement>) => void;
  onTouchDragEnd: (event: TouchEvent<HTMLElement>) => void;
  onTouchDragCancel: () => void;
  onShiftTap: (day: number, shiftType: ShiftType, locked: boolean, isHolidayLike: boolean) => void;
  onSwapButtonPress: (day: number, shiftType: ShiftType, locked: boolean, isHolidayLike: boolean) => void;
  onToggleHighlightedDoctor: (doctorId: string | null | undefined) => void;
  onClearDragState: () => void;
  onToggleShiftLock: (day: number, shiftType: ShiftType) => void;
};

export default function ScheduleCell({
  row,
  columnKey,
  year,
  month,
  holidaySet,
  manualHolidaySetInMonth,
  toYmd,
  getWeekday,
  getDoctorName,
  highlightedDoctorId,
  hoverErrorMessage,
  isHighlightedDoctorBlockedDay,
  isShiftLocked,
  invalidHoverShiftKey,
  touchHoverShiftKey,
  isSwapMode,
  isSwapSourceSelected,
  onHandleShiftDragOver,
  onHandleShiftDragLeave,
  onHandleShiftDrop,
  onHandleDisabledDayDragOver,
  onHandleDisabledDayDragLeave,
  onShiftDragStart,
  onShiftTouchStart,
  onTouchDragMove,
  onTouchDragEnd,
  onTouchDragCancel,
  onShiftTap,
  onSwapButtonPress,
  onToggleHighlightedDoctor,
  onClearDragState,
  onToggleShiftLock,
}: ScheduleCellProps) {
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

  const renderHoverTooltip = (isVisible: boolean) => {
    if (!isVisible || !hoverErrorMessage) return null;

    return (
      <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-44 -translate-x-1/2 rounded-md border border-red-200 bg-white/95 px-2 py-1 text-left text-[10px] font-semibold leading-tight whitespace-pre-line text-red-700 shadow-lg backdrop-blur md:block">
        {hoverErrorMessage}
      </div>
    );
  };

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

  const dateCellClass = isHolidayLike
    ? "border-red-100 bg-red-50 text-red-600"
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
            : isHolidayLike
              ? "border-red-100 bg-red-50 hover:border-red-200 hover:bg-red-100/80"
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
            : isHolidayLike
              ? "border-red-100 bg-red-50 hover:border-red-200 hover:bg-red-100/80"
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

  const renderShiftBox = (shiftType: ShiftType) => {
    const locked = shiftType === "day" ? dayLocked : nightLocked;
    const doctorId = shiftType === "day" ? row.day_shift : row.night_shift;
    const hoverInvalid = shiftType === "day" ? dayHoverInvalid : nightHoverInvalid;
    const touchHovered = shiftType === "day" ? dayTouchHovered : nightTouchHovered;
    const swapSelected = shiftType === "day" ? daySwapSelected : nightSwapSelected;
    const shiftKey = shiftType === "day" ? dayShiftKey : nightShiftKey;
    const cellClass = shiftType === "day" ? dayCellClass : nightCellClass;

    if (shiftType === "day" && !isDayShiftEnabled) {
      return (
        <div
          data-touch-drop-target="shift"
          data-day={row.day}
          data-shift-type="day"
          data-locked={locked ? "true" : "false"}
          data-holiday-like="false"
          onClick={() => onShiftTap(row.day, "day", locked, false)}
          onDragEnter={(event) => onHandleDisabledDayDragOver(event, row.day)}
          onDragOver={(event) => onHandleDisabledDayDragOver(event, row.day)}
          onDragLeave={() => onHandleDisabledDayDragLeave(row.day)}
          className={`relative flex min-h-5 w-full items-center justify-center rounded border px-[2px] py-[2px] text-[7px] font-semibold sm:min-h-6 sm:px-0.5 sm:py-0.5 sm:text-[9px] ${disabledDayCellClass}`}
        >
          -
          {renderHoverTooltip(hoverInvalid)}
        </div>
      );
    }

    return (
      <div
        data-touch-drop-target="shift"
        data-day={row.day}
        data-shift-type={shiftType}
        data-locked={locked ? "true" : "false"}
        data-holiday-like={isHolidayLike ? "true" : "false"}
        onClick={() => onShiftTap(row.day, shiftType, locked, isHolidayLike)}
        onDragEnter={(event) => onHandleShiftDragOver(event, row.day, shiftType, locked, isHolidayLike)}
        onDragOver={(event) => onHandleShiftDragOver(event, row.day, shiftType, locked, isHolidayLike)}
        onDragLeave={() => onHandleShiftDragLeave(row.day, shiftType)}
        onDrop={(event) => onHandleShiftDrop(event, row.day, shiftType, locked, isHolidayLike)}
        className={`relative flex min-h-5 w-full items-center justify-between gap-0.5 rounded border px-[2px] py-[2px] sm:min-h-6 sm:gap-1 sm:px-0.5 sm:py-0.5 ${cellClass}`}
      >
        {doctorId ? (
          <button
            type="button"
            draggable={!locked}
            onDragStart={(event) => onShiftDragStart(event, row.day, shiftType, doctorId)}
            onDragEnd={onClearDragState}
            onTouchStart={!locked ? (event) => onShiftTouchStart(event, row.day, shiftType, doctorId) : undefined}
            onTouchMove={!locked ? onTouchDragMove : undefined}
            onTouchEnd={!locked ? onTouchDragEnd : undefined}
            onTouchCancel={!locked ? onTouchDragCancel : undefined}
            onClick={(event) => {
              event.stopPropagation();
              if (isSwapMode) {
                onShiftTap(row.day, shiftType, locked, isHolidayLike);
                return;
              }
              onToggleHighlightedDoctor(doctorId);
            }}
            className={getDoctorBadgeClass(doctorId, shiftType, locked)}
            title="クリックでハイライト / ドラッグで移動"
          >
            {getDoctorName(doctorId)}
          </button>
        ) : (
          <span className="min-w-0 flex-1 text-[7px] text-gray-400 sm:text-[9px]">-</span>
        )}
        <div className="flex shrink-0 items-center gap-px sm:gap-0.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSwapButtonPress(row.day, shiftType, locked, isHolidayLike);
            }}
            className={[
              "min-w-[1.5rem] rounded border px-1.5 py-px text-[7px] font-bold transition sm:min-w-[1.75rem] sm:px-2 sm:py-0.5 sm:text-[8px]",
              swapSelected
                ? "border-yellow-300 bg-yellow-100 text-yellow-900"
                : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-sky-700",
            ].join(" ")}
            title={swapSelected ? "入れ替え元を解除" : "この枠を入れ替え元/先として選ぶ"}
          >
            ⇄
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleShiftLock(row.day, shiftType);
            }}
            disabled={!doctorId}
            className="inline-flex h-[18px] min-w-[1.5rem] shrink-0 items-center justify-center rounded border border-gray-200 bg-white px-1 py-px text-gray-500 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40 sm:h-5 sm:min-w-[1.75rem] sm:px-1.5 sm:py-0.5"
            title={locked ? "ロック解除" : "ロック"}
          >
            {locked ? <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : <Unlock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
          </button>
        </div>
        {renderHoverTooltip(hoverInvalid || touchHovered || invalidHoverShiftKey === shiftKey)}
      </div>
    );
  };

  return (
    <tr key={`${columnKey}-${row.day}`} className={`border-b ${isHolidayLike ? "bg-red-50" : isSat ? "bg-blue-50/30" : "bg-white"}`}>
      <td className={`w-5 px-0 py-[2px] align-middle text-[7px] font-semibold sm:w-7 sm:px-0.5 sm:py-0.5 sm:text-[9px] ${dateCellClass}`}>
        <span className="sm:hidden">{row.day}</span>
        <span className="hidden sm:inline">{row.day}日</span>
      </td>
      <td className={`w-4 px-0 py-[2px] align-middle text-[7px] font-bold sm:w-5 sm:px-0.5 sm:py-0.5 sm:text-[9px] ${weekdayCellClass}`}>{wd}</td>
      <td className="px-0 py-[2px] align-middle sm:px-0.5 sm:py-0.5">{renderShiftBox("day")}</td>
      <td className="px-0 py-[2px] align-middle sm:px-0.5 sm:py-0.5">{renderShiftBox("night")}</td>
    </tr>
  );
}
