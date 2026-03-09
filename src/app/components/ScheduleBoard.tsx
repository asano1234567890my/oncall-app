"use client";

import { Lock, Trash2, Unlock } from "lucide-react";
import type { DragEvent } from "react";
import type { ScheduleRow, ShiftType } from "../types/dashboard";

type ScheduleBoardProps = {
  isLoading: boolean;
  dragNotice: string;
  dragSourceType: "calendar" | "list" | null;
  error: string;
  schedule: ScheduleRow[];
  scheduleColumns: ScheduleRow[][];
  scores: Record<string, number | string>;
  getDoctorName: (doctorId: string | null | undefined) => string;
  highlightedDoctorId: string | null;
  year: number;
  month: number;
  holidaySet: Set<string>;
  manualHolidaySetInMonth: Set<string>;
  toYmd: (year: number, month: number, day: number) => string;
  getWeekday: (year: number, month: number, day: number) => string;
  isHighlightedDoctorBlockedDay: (day: number) => boolean;
  isShiftLocked: (day: number, shiftType: ShiftType) => boolean;
  invalidHoverShiftKey: string | null;
  hoverErrorMessage: string;
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
  onDoctorListDragStart: (event: DragEvent<HTMLElement>, doctorId: string) => void;
  onToggleHighlightedDoctor: (doctorId: string | null | undefined) => void;
  onClearDragState: () => void;
  onToggleShiftLock: (day: number, shiftType: ShiftType) => void;
  onLockAll: () => void;
  onUnlockAll: () => void;
  onTrashDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onTrashDrop: (event: DragEvent<HTMLDivElement>) => void;
  lockedShiftCount: number;
  onDeleteMonthSchedule: () => void;
  isDeletingMonthSchedule: boolean;
  onSaveToDB: () => void;
  isSaving: boolean;
  saveMessage: string;
};

export default function ScheduleBoard({
  isLoading,
  dragNotice,
  dragSourceType,
  error,
  schedule,
  scheduleColumns,
  scores,
  getDoctorName,
  highlightedDoctorId,
  year,
  month,
  holidaySet,
  manualHolidaySetInMonth,
  toYmd,
  getWeekday,
  isHighlightedDoctorBlockedDay,
  isShiftLocked,
  invalidHoverShiftKey,
  hoverErrorMessage,
  onHandleShiftDragOver,
  onHandleShiftDragLeave,
  onHandleShiftDrop,
  onHandleDisabledDayDragOver,
  onHandleDisabledDayDragLeave,
  onShiftDragStart,
  onDoctorListDragStart,
  onToggleHighlightedDoctor,
  onClearDragState,
  onToggleShiftLock,
  onLockAll,
  onUnlockAll,
  onTrashDragOver,
  onTrashDrop,
  lockedShiftCount,
  onDeleteMonthSchedule,
  isDeletingMonthSchedule,
  onSaveToDB,
  isSaving,
  saveMessage,
}: ScheduleBoardProps) {
  const highlightedDoctorName = highlightedDoctorId ? getDoctorName(highlightedDoctorId) : null;

  const renderHoverTooltip = (show: boolean) => {
    if (!show || !hoverErrorMessage) return null;

    return (
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-0.5 w-40 -translate-x-1/2 rounded-md border border-red-200 bg-red-600 px-1.5 py-1 text-[9px] leading-tight whitespace-pre-line text-white shadow-lg">
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

    return `${tone} min-w-0 flex-1 truncate rounded-full px-1 py-0.5 text-[9px] font-bold leading-tight whitespace-nowrap ${
      locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
    } ${isHighlighted ? "ring-1 ring-sky-500 ring-offset-1" : ""}`;
  };

  const renderScheduleTable = (rows: ScheduleRow[], columnKey: string) => (
    <div key={columnKey} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full table-fixed bg-white text-center text-[9px] leading-tight md:text-[10px]">
        <thead className="bg-gray-100 text-[8px] text-gray-600">
          <tr>
            <th className="border-b px-0.5 py-0.5">日付</th>
            <th className="border-b px-0.5 py-0.5">曜日</th>
            <th className="border-b bg-orange-50 px-0.5 py-0.5">日直</th>
            <th className="border-b bg-indigo-50 px-0.5 py-0.5">当直</th>
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
            const dayCellClass = dayHoverInvalid
              ? "cursor-not-allowed border-red-300 bg-red-200"
              : dayLocked
                ? highlightBlocked
                  ? "border-amber-300 bg-red-100"
                  : "border-amber-300 bg-amber-50"
                : highlightBlocked
                  ? "border-red-200 bg-red-100"
                  : "border-transparent bg-white hover:border-gray-200";
            const nightCellClass = nightHoverInvalid
              ? "cursor-not-allowed border-red-300 bg-red-200"
              : nightLocked
                ? highlightBlocked
                  ? "border-amber-300 bg-red-100"
                  : "border-amber-300 bg-amber-50"
                : highlightBlocked
                  ? "border-red-200 bg-red-100"
                  : "border-transparent bg-white hover:border-gray-200";
            const disabledDayCellClass = dayHoverInvalid
              ? "cursor-not-allowed border-red-300 bg-red-200 text-red-700"
              : highlightBlocked
                ? "cursor-not-allowed border-red-200 bg-red-100 text-red-500"
                : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400";

            return (
              <tr key={`${columnKey}-${row.day}`} className={`border-b ${isHolidayLike ? "bg-red-50/30" : isSat ? "bg-blue-50/30" : "bg-white"}`}>
                <td className={`w-9 px-0.5 py-0.5 align-middle text-[9px] font-semibold ${dateCellClass}`}>{row.day}日</td>
                <td className={`w-6 px-0.5 py-0.5 align-middle text-[9px] font-bold ${weekdayCellClass}`}>{wd}</td>
                <td className="w-[42%] px-0.5 py-0.5 align-middle">
                  {isDayShiftEnabled ? (
                    <div
                      onDragEnter={(event) => onHandleShiftDragOver(event, row.day, "day", dayLocked, isHolidayLike)}
                      onDragOver={(event) => onHandleShiftDragOver(event, row.day, "day", dayLocked, isHolidayLike)}
                      onDragLeave={() => onHandleShiftDragLeave(row.day, "day")}
                      onDrop={(event) => onHandleShiftDrop(event, row.day, "day", dayLocked, isHolidayLike)}
                      className={`relative flex min-h-6 items-center justify-between gap-0.5 rounded border px-0.5 py-0.5 ${dayCellClass}`}
                    >
                      {row.day_shift ? (
                        <button
                          type="button"
                          draggable={!dayLocked}
                          onDragStart={(event) => onShiftDragStart(event, row.day, "day", row.day_shift)}
                          onDragEnd={onClearDragState}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleHighlightedDoctor(row.day_shift);
                          }}
                          className={getDoctorBadgeClass(row.day_shift, "day", dayLocked)}
                          title="クリックでハイライト / ドラッグで移動"
                        >
                          {getDoctorName(row.day_shift)}
                        </button>
                      ) : (
                        <span className="text-[9px] text-gray-400">-</span>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleShiftLock(row.day, "day")}
                        disabled={!row.day_shift}
                        className="rounded border border-gray-200 bg-white p-0.5 text-gray-500 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
                        title={dayLocked ? "ロック解除" : "ロック"}
                      >
                        {dayLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      </button>
                      {renderHoverTooltip(dayHoverInvalid)}
                    </div>
                  ) : (
                    <div
                      onDragEnter={(event) => onHandleDisabledDayDragOver(event, row.day)}
                      onDragOver={(event) => onHandleDisabledDayDragOver(event, row.day)}
                      onDragLeave={() => onHandleDisabledDayDragLeave(row.day)}
                      className={`relative flex min-h-6 items-center justify-center rounded border px-0.5 py-0.5 text-[9px] font-semibold ${disabledDayCellClass}`}
                    >
                      -
                      {renderHoverTooltip(dayHoverInvalid)}
                    </div>
                  )}
                </td>
                <td className="w-[42%] px-0.5 py-0.5 align-middle">
                  <div
                    onDragEnter={(event) => onHandleShiftDragOver(event, row.day, "night", nightLocked, isHolidayLike)}
                    onDragOver={(event) => onHandleShiftDragOver(event, row.day, "night", nightLocked, isHolidayLike)}
                    onDragLeave={() => onHandleShiftDragLeave(row.day, "night")}
                    onDrop={(event) => onHandleShiftDrop(event, row.day, "night", nightLocked, isHolidayLike)}
                    className={`relative flex min-h-6 items-center justify-between gap-0.5 rounded border px-0.5 py-0.5 ${nightCellClass}`}
                  >
                    {row.night_shift ? (
                      <button
                        type="button"
                        draggable={!nightLocked}
                        onDragStart={(event) => onShiftDragStart(event, row.day, "night", row.night_shift)}
                        onDragEnd={onClearDragState}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleHighlightedDoctor(row.night_shift);
                        }}
                        className={getDoctorBadgeClass(row.night_shift, "night", nightLocked)}
                        title="クリックでハイライト / ドラッグで移動"
                      >
                        {getDoctorName(row.night_shift)}
                      </button>
                    ) : (
                      <span className="text-[9px] text-gray-400">-</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleShiftLock(row.day, "night")}
                      disabled={!row.night_shift}
                      className="rounded border border-gray-200 bg-white p-0.5 text-gray-500 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
                      title={nightLocked ? "ロック解除" : "ロック"}
                    >
                      {nightLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    </button>
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
      {dragNotice && <div className="mb-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] whitespace-pre-line text-amber-800">{dragNotice}</div>}

      {!schedule.length && !isLoading && !error && (
        <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-center text-[10px] text-gray-400">
          左上の「自動生成」ボタンを押してください
        </div>
      )}

      {schedule.length > 0 && (
        <div className="animate-fade-in">
          <div className="mb-1.5 flex items-start justify-between gap-1">
            <div className="min-w-0 text-[9px] leading-tight text-gray-500">
              D&amp;D で移動・入替・上書きできます。スコア表から直接割当、ゴミ箱へドロップで解除できます。
              {highlightedDoctorName ? <div className="mt-0.5 font-semibold text-sky-700">ハイライト中: {highlightedDoctorName}</div> : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
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
                onClick={onDeleteMonthSchedule}
                disabled={isDeletingMonthSchedule}
                className="rounded-md border border-red-200 bg-red-50 px-1.5 py-1 text-[9px] font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeletingMonthSchedule ? "削除中" : "全削除"}
              </button>
            </div>
          </div>

          <div
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

          <div className="mb-2 rounded-lg border bg-gray-50 p-1.5">
            <div className="mb-1 text-[9px] font-bold text-gray-700">医師別スコア</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(scores).map(([doctorId, score]) => {
                const isSelected = doctorId === highlightedDoctorId;
                return (
                  <button
                    key={doctorId}
                    type="button"
                    draggable
                    onDragStart={(event) => onDoctorListDragStart(event, doctorId)}
                    onDragEnd={onClearDragState}
                    onClick={() => onToggleHighlightedDoctor(doctorId)}
                    className={`flex cursor-grab items-center gap-1 rounded border px-1 py-0.5 text-[9px] shadow-sm active:cursor-grabbing ${
                      isSelected ? "border-sky-300 bg-sky-100 text-sky-900" : "border-gray-200 bg-white text-gray-700"
                    }`}
                    title="クリックでハイライト / ドラッグで割り当て"
                  >
                    <span className="max-w-[4.5rem] truncate font-semibold">{getDoctorName(doctorId)}</span>
                    <span className="font-bold">{String(score)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1">{scheduleColumns.map((rows, index) => renderScheduleTable(rows, `column-${index}`))}</div>

          <div className="mt-2 flex flex-col items-center gap-1">
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
