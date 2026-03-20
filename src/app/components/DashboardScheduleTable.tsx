"use client";

import { Lock, Unlock } from "lucide-react";
import type { DragEvent } from "react";
import type { ScheduleRow, ShiftType } from "../types/dashboard";

type CellValidityMap = Map<string, string | null>;

type DashboardScheduleTableProps = {
  schedule: ScheduleRow[];
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
  isHighlightedDoctorBlockedShift: (day: number, shiftType: ShiftType) => boolean;
  isShiftLocked: (day: number, shiftType: ShiftType) => boolean;
  invalidHoverShiftKey: string | null;
  touchHoverShiftKey: string | null;
  // D&D
  draggingDoctorId: string | null;
  cellValidityMap: CellValidityMap;
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
  onClearDragState: () => void;
  onToggleShiftLock: (day: number, shiftType: ShiftType) => void;
  onToggleHighlightedDoctor: (doctorId: string | null | undefined) => void;
  // Messages
  toastMessage: string | null;
  error: string;
  saveMessage: string;
  isLoading: boolean;
  // Validation
  saveValidationMessages: string[];
  onDismissSaveValidation: () => void;
  onForceSaveToDB: () => void;
  // Draft
  draftMessage?: string;
  // Override
  isOverrideMode: boolean;
};

export default function DashboardScheduleTable({
  schedule,
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
  isHighlightedDoctorBlockedShift,
  isShiftLocked,
  invalidHoverShiftKey,
  touchHoverShiftKey,
  draggingDoctorId,
  cellValidityMap,
  onHandleShiftDragOver,
  onHandleShiftDragLeave,
  onHandleShiftDrop,
  onHandleDisabledDayDragOver,
  onHandleDisabledDayDragLeave,
  onShiftDragStart,
  onClearDragState,
  onToggleShiftLock,
  onToggleHighlightedDoctor,
  toastMessage,
  error,
  saveMessage,
  isLoading,
  saveValidationMessages,
  onDismissSaveValidation,
  onForceSaveToDB,
  draftMessage,
  isOverrideMode,
}: DashboardScheduleTableProps) {
  const isDragging = draggingDoctorId !== null;

  if (!schedule.length && !isLoading && !error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-400">
        ツールバーの「生成」ボタンでスケジュールを作成してください
      </div>
    );
  }

  const renderShiftCell = (row: ScheduleRow, shiftType: ShiftType, isHolidayLike: boolean) => {
    const locked = isShiftLocked(row.day, shiftType);
    const doctorId = shiftType === "day" ? row.day_shift : row.night_shift;
    const shiftKey = `${row.day}_${shiftType}`;
    const hoverInvalid = invalidHoverShiftKey === shiftKey;
    const touchHovered = touchHoverShiftKey === shiftKey;
    const dayBlocked = isHighlightedDoctorBlockedShift(row.day, shiftType);
    const isCombined = isHolidayLike && row.day_shift != null && row.day_shift === row.night_shift;

    // Drag validity feedback
    const validityKey = `${row.day}_${shiftType}`;
    const validityMsg = cellValidityMap.get(validityKey);
    const isDragValid = isDragging && validityMsg === null && cellValidityMap.has(validityKey);
    const isDragInvalid = isDragging && validityMsg !== null && validityMsg !== undefined;

    if (shiftType === "day" && !isHolidayLike) {
      return (
        <td key={shiftKey} className="overflow-hidden px-1 py-1 align-middle">
          <div
            data-touch-drop-target="shift"
            data-day={row.day}
            data-shift-type="day"
            data-locked="false"
            data-holiday-like="false"
            onDragEnter={(event) => onHandleDisabledDayDragOver(event, row.day)}
            onDragOver={(event) => onHandleDisabledDayDragOver(event, row.day)}
            onDragLeave={() => onHandleDisabledDayDragLeave(row.day)}
            className={`flex h-8 items-center justify-center rounded-md border text-xs text-gray-400 ${
              hoverInvalid
                ? "cursor-not-allowed border-red-300 bg-red-100"
                : isDragInvalid
                  ? "border-gray-200 bg-gray-100 opacity-50"
                  : "border-gray-200 bg-gray-50"
            }`}
          >
            -
          </div>
        </td>
      );
    }

    // Cell background based on drag state
    let cellBgClass: string;
    if (hoverInvalid) {
      cellBgClass = "cursor-not-allowed border-red-300 bg-red-200";
    } else if (isDragValid) {
      cellBgClass = "border-green-300 bg-green-50 ring-1 ring-green-200";
    } else if (isDragInvalid) {
      cellBgClass = "border-gray-200 bg-gray-100 opacity-50";
    } else if (touchHovered) {
      cellBgClass = "border-sky-300 bg-sky-50 ring-1 ring-sky-200";
    } else if (locked) {
      cellBgClass = dayBlocked
        ? "border-amber-300 bg-red-500/30 ring-1 ring-inset ring-red-400"
        : "border-amber-300 bg-amber-50";
    } else if (dayBlocked) {
      cellBgClass = "border-red-400 bg-red-500/30 ring-1 ring-inset ring-red-400";
    } else if (isHolidayLike) {
      cellBgClass = "border-red-100 bg-red-50/60 hover:border-red-200";
    } else {
      cellBgClass = "border-gray-200 bg-white hover:border-gray-300";
    }

    return (
      <td key={shiftKey} className="overflow-hidden px-1 py-1 align-middle">
        <div
          data-touch-drop-target="shift"
          data-day={row.day}
          data-shift-type={shiftType}
          data-locked={locked ? "true" : "false"}
          data-holiday-like={isHolidayLike ? "true" : "false"}
          onDragEnter={(event) => onHandleShiftDragOver(event, row.day, shiftType, locked, isHolidayLike)}
          onDragOver={(event) => onHandleShiftDragOver(event, row.day, shiftType, locked, isHolidayLike)}
          onDragLeave={() => onHandleShiftDragLeave(row.day, shiftType)}
          onDrop={(event) => onHandleShiftDrop(event, row.day, shiftType, locked, isHolidayLike)}
          className={`relative flex h-8 items-center justify-between gap-1 overflow-hidden rounded-md border px-1.5 py-1 ${cellBgClass}`}
        >
          {doctorId ? (
            <button
              type="button"
              draggable={!locked}
              onDragStart={(event) => onShiftDragStart(event, row.day, shiftType, doctorId)}
              onDragEnd={onClearDragState}
              onClick={(event) => {
                event.stopPropagation();
                onToggleHighlightedDoctor(doctorId);
              }}
              className={`min-w-0 flex-1 truncate rounded-md px-1.5 py-0.5 text-center text-sm font-semibold transition ${
                locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
              } ${
                doctorId === highlightedDoctorId
                  ? "bg-blue-100 text-blue-900 ring-2 ring-blue-500"
                  : shiftType === "day"
                    ? locked ? "bg-amber-100 text-amber-900" : "bg-orange-100 text-orange-800"
                    : locked ? "bg-amber-100 text-amber-900" : "bg-indigo-100 text-indigo-800"
              }`}
              title="クリックでハイライト / ドラッグで移動"
            >
              {isCombined && shiftType === "day" ? (
                <span className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
                  <span className="shrink-0 rounded bg-purple-200 px-1 text-xs font-bold text-purple-800">日当直</span>
                  <span className="truncate">{getDoctorName(doctorId)}</span>
                </span>
              ) : (
                getDoctorName(doctorId)
              )}
            </button>
          ) : (
            <span className="min-w-0 flex-1 text-sm text-gray-400">-</span>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleShiftLock(row.day, shiftType);
            }}
            disabled={!doctorId}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 transition hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-30"
            title={locked ? "ロック解除" : "ロック"}
          >
            {locked ? <Lock className="h-3.5 w-3.5 text-amber-600" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>

          {/* Hover tooltip */}
          {(hoverInvalid || touchHovered) && hoverErrorMessage && (
            <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 w-48 -translate-x-1/2 rounded-md border border-red-200 bg-white/95 px-2 py-1 text-left text-xs font-semibold leading-tight whitespace-pre-line text-red-700 shadow-lg backdrop-blur">
              {hoverErrorMessage}
            </div>
          )}
        </div>
      </td>
    );
  };

  return (
    <>
      {toastMessage && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-[100] w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 px-3">
          <div className="rounded-2xl bg-gray-900/90 px-6 py-4 text-center text-sm font-bold leading-snug whitespace-pre-line text-white shadow-2xl backdrop-blur">
            {toastMessage}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</div>
      )}

      {isOverrideMode && (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          強制配置モード中: 制約違反を許可しています。自動生成は無効です。
        </div>
      )}

      {schedule.length > 0 && (() => {
        const mid = Math.ceil(schedule.length / 2);
        const columns = [schedule.slice(0, mid), schedule.slice(mid)];

        const renderColumn = (rows: ScheduleRow[]) => (
          <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full table-fixed select-none text-center">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-12 border-b border-gray-200 px-2 py-2 text-xs font-bold text-gray-600">日付</th>
                  <th className="w-10 border-b border-gray-200 px-1 py-2 text-xs font-bold text-gray-600">曜</th>
                  <th className="border-b border-gray-200 bg-orange-50/50 px-1 py-2 text-xs font-bold text-orange-700">日直</th>
                  <th className="border-b border-gray-200 bg-indigo-50/50 px-1 py-2 text-xs font-bold text-indigo-700">当直</th>
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
                  const highlightBlocked = isHighlightedDoctorBlockedDay(row.day);

                  const rowBgClass = isHolidayLike
                    ? "bg-red-50/50"
                    : isSat
                      ? "bg-blue-50/30"
                      : "bg-white";

                  const dateCellClass = isHolidayLike
                    ? "text-red-600 font-bold"
                    : isSat
                      ? "text-blue-700 font-bold"
                      : "text-gray-700 font-semibold";

                  const weekdayCellClass = isHolidayLike
                    ? "text-red-600 font-bold"
                    : isSat
                      ? "text-blue-600 font-bold"
                      : "text-gray-500 font-semibold";

                  return (
                    <tr
                      key={row.day}
                      style={{ height: "40px" }}
                      className={`border-b border-gray-100 ${rowBgClass} ${highlightBlocked ? "ring-1 ring-inset ring-red-300" : ""}`}
                    >
                      <td className={`whitespace-nowrap px-2 py-1 text-sm ${dateCellClass}`}>{row.day}日</td>
                      <td className={`whitespace-nowrap px-1 py-1 text-sm ${weekdayCellClass}`}>{wd}</td>
                      {renderShiftCell(row, "day", isHolidayLike)}
                      {renderShiftCell(row, "night", isHolidayLike)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );

        return (
          <div className="flex gap-3">
            {renderColumn(columns[0])}
            {columns[1].length > 0 && renderColumn(columns[1])}
          </div>
        );
      })()}

      {/* Validation alerts */}
      {saveValidationMessages.length > 0 && (
        <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
          <div className="mb-1 text-xs font-bold text-orange-800">保存前の確認</div>
          <ul className="mb-2 space-y-0.5">
            {saveValidationMessages.map((msg, i) => (
              <li key={i} className="text-xs text-orange-700">・{msg}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDismissSaveValidation}
              className="rounded border border-orange-300 px-2 py-1 text-xs font-bold text-orange-700 hover:bg-orange-100"
            >
              戻る
            </button>
            <button
              type="button"
              onClick={onForceSaveToDB}
              className="rounded bg-orange-500 px-2 py-1 text-xs font-bold text-white hover:bg-orange-600"
            >
              このまま確定
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {draftMessage && <div className="mt-1 text-xs font-bold text-blue-700">{draftMessage}</div>}
      {saveMessage && !schedule.length && <div className="mt-1 text-xs font-bold text-green-800">保存結果: {saveMessage}</div>}
    </>
  );
}
