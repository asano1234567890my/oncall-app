"use client";

import { Lock, Unlock } from "lucide-react";
import type { DragEvent } from "react";

type ShiftType = "day" | "night";

type ScheduleRow = {
  day: number;
  day_shift?: string | null;
  night_shift?: string | null;
  is_holiday?: boolean;
  is_sunhol?: boolean;
};

type ScheduleBoardProps = {
  isLoading: boolean;
  dragNotice: string;
  error: string;
  schedule: ScheduleRow[];
  scheduleColumns: ScheduleRow[][];
  scores: Record<string, number | string>;
  getDoctorName: (doctorId: string | null | undefined) => string;
  year: number;
  month: number;
  holidaySet: Set<string>;
  manualHolidaySetInMonth: Set<string>;
  toYmd: (year: number, month: number, day: number) => string;
  getWeekday: (year: number, month: number, day: number) => string;
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
    event: DragEvent<HTMLSpanElement>,
    day: number,
    shiftType: ShiftType,
    doctorId: string | null | undefined
  ) => void;
  onClearDragState: () => void;
  onToggleShiftLock: (day: number, shiftType: ShiftType) => void;
  onDeleteMonthSchedule: () => void;
  isDeletingMonthSchedule: boolean;
  onSaveToDB: () => void;
  isSaving: boolean;
  saveMessage: string;
};

export default function ScheduleBoard({
  isLoading,
  dragNotice,
  error,
  schedule,
  scheduleColumns,
  scores,
  getDoctorName,
  year,
  month,
  holidaySet,
  manualHolidaySetInMonth,
  toYmd,
  getWeekday,
  isShiftLocked,
  invalidHoverShiftKey,
  hoverErrorMessage,
  onHandleShiftDragOver,
  onHandleShiftDragLeave,
  onHandleShiftDrop,
  onHandleDisabledDayDragOver,
  onHandleDisabledDayDragLeave,
  onShiftDragStart,
  onClearDragState,
  onToggleShiftLock,
  onDeleteMonthSchedule,
  isDeletingMonthSchedule,
  onSaveToDB,
  isSaving,
  saveMessage,
}: ScheduleBoardProps) {
  const renderHoverTooltip = (show: boolean) => {
    if (!show || !hoverErrorMessage) return null;

    return (
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-48 -translate-x-1/2 rounded-md border border-red-200 bg-red-600 px-2 py-1 text-[10px] font-semibold leading-tight text-white shadow-lg">
        {hoverErrorMessage}
      </div>
    );
  };

  const renderScheduleTable = (rows: ScheduleRow[], columnKey: string) => (
    <div key={columnKey} className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full table-fixed bg-white text-center text-xs md:text-[13px]">
        <thead className="bg-gray-100 whitespace-nowrap">
          <tr>
            <th className="border-b py-2 px-1.5 md:px-2">日付</th>
            <th className="border-b py-2 px-1.5 md:px-2">曜日</th>
            <th className="border-b bg-orange-50 py-2 px-1.5 md:px-2">日直</th>
            <th className="border-b bg-indigo-50 py-2 px-1.5 md:px-2">当直</th>
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
            const dateCellClass = isHolidayLike
              ? "border-red-100 bg-red-50 text-red-700"
              : isSat
                ? "border-blue-100 bg-blue-50 text-blue-700"
                : "text-gray-700";
            const weekdayCellClass = isHolidayLike
              ? "border-red-100 bg-red-50 text-red-600"
              : isSat
                ? "border-blue-100 bg-blue-50 text-blue-600"
                : "text-gray-600";

            return (
              <tr
                key={`${columnKey}-${row.day}`}
                className={`border-b ${isHolidayLike ? "bg-red-50/40" : isSat ? "bg-blue-50/40" : "bg-white"}`}
              >
                <td className={`w-14 whitespace-nowrap py-1.5 px-1.5 text-[11px] font-semibold align-middle md:px-2 ${dateCellClass}`}>
                  {row.day}日
                </td>
                <td className={`w-12 py-1.5 px-1.5 text-[11px] font-bold align-middle md:px-2 ${weekdayCellClass}`}>
                  {wd}
                </td>
                <td className="w-[37%] py-1.5 px-1.5 align-middle md:px-2">
                  {isDayShiftEnabled ? (
                    <div
                      onDragEnter={(event) => onHandleShiftDragOver(event, row.day, "day", dayLocked, isHolidayLike)}
                      onDragOver={(event) => onHandleShiftDragOver(event, row.day, "day", dayLocked, isHolidayLike)}
                      onDragLeave={() => onHandleShiftDragLeave(row.day, "day")}
                      onDrop={(event) => onHandleShiftDrop(event, row.day, "day", dayLocked, isHolidayLike)}
                      className={`relative flex min-h-9 items-center justify-between gap-1.5 rounded-md border px-1.5 py-1 ${
                        dayHoverInvalid
                          ? "cursor-not-allowed border-red-300 bg-red-200"
                          : dayLocked
                            ? "border-amber-300 bg-amber-50"
                            : "border-transparent hover:border-gray-200"
                      }`}
                    >
                      {row.day_shift ? (
                        <span
                          draggable={!dayLocked}
                          onDragStart={(event) => onShiftDragStart(event, row.day, "day", row.day_shift)}
                          onDragEnd={onClearDragState}
                          className={`min-w-0 flex-1 truncate rounded-full px-2 py-1 text-[11px] font-bold whitespace-nowrap ${
                            dayLocked
                              ? "cursor-default bg-amber-100 text-amber-900"
                              : "cursor-grab active:cursor-grabbing bg-orange-100 text-orange-800"
                          }`}
                        >
                          {getDoctorName(row.day_shift)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleShiftLock(row.day, "day")}
                        disabled={!row.day_shift}
                        className="rounded border border-gray-200 bg-white p-1 text-gray-500 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
                        title={dayLocked ? "ロック解除" : "ロック"}
                      >
                        {dayLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                      </button>
                      {renderHoverTooltip(dayHoverInvalid)}
                    </div>
                  ) : (
                    <div
                      onDragEnter={(event) => onHandleDisabledDayDragOver(event, row.day)}
                      onDragOver={(event) => onHandleDisabledDayDragOver(event, row.day)}
                      onDragLeave={() => onHandleDisabledDayDragLeave(row.day)}
                      className={`relative flex min-h-9 items-center justify-center rounded-md border px-1.5 py-1 text-[11px] font-semibold ${
                        dayHoverInvalid
                          ? "cursor-not-allowed border-red-300 bg-red-200 text-red-700"
                          : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                      }`}
                    >
                      -
                      {renderHoverTooltip(dayHoverInvalid)}
                    </div>
                  )}
                </td>
                <td className="w-[37%] py-1.5 px-1.5 align-middle md:px-2">
                  <div
                    onDragEnter={(event) => onHandleShiftDragOver(event, row.day, "night", nightLocked, isHolidayLike)}
                    onDragOver={(event) => onHandleShiftDragOver(event, row.day, "night", nightLocked, isHolidayLike)}
                    onDragLeave={() => onHandleShiftDragLeave(row.day, "night")}
                    onDrop={(event) => onHandleShiftDrop(event, row.day, "night", nightLocked, isHolidayLike)}
                    className={`relative flex min-h-9 items-center justify-between gap-1.5 rounded-md border px-1.5 py-1 ${
                      nightHoverInvalid
                        ? "cursor-not-allowed border-red-300 bg-red-200"
                        : nightLocked
                          ? "border-amber-300 bg-amber-50"
                          : "border-transparent hover:border-gray-200"
                    }`}
                  >
                    {row.night_shift ? (
                      <span
                        draggable={!nightLocked}
                        onDragStart={(event) => onShiftDragStart(event, row.day, "night", row.night_shift)}
                        onDragEnd={onClearDragState}
                        className={`min-w-0 flex-1 truncate rounded-full px-2 py-1 text-[11px] font-bold whitespace-nowrap ${
                          nightLocked
                            ? "cursor-default bg-amber-100 text-amber-900"
                            : "cursor-grab active:cursor-grabbing bg-indigo-100 text-indigo-800"
                        }`}
                      >
                        {getDoctorName(row.night_shift)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleShiftLock(row.day, "night")}
                      disabled={!row.night_shift}
                      className="rounded border border-gray-200 bg-white p-1 text-gray-500 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
                      title={nightLocked ? "ロック解除" : "ロック"}
                    >
                      {nightLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
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
      {dragNotice && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">{dragNotice}</div>}

      {!schedule.length && !isLoading && !error && (
        <div className="flex min-h-[400px] h-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center text-gray-400">
          左上の「生成」ボタンを押してください
        </div>
      )}

      {schedule.length > 0 && (
        <div className="animate-fade-in">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-gray-500">
              シフトをドラッグして移動・入れ替えできます。ロック済みコマは移動されません。
            </div>
            <button
              type="button"
              onClick={onDeleteMonthSchedule}
              disabled={isDeletingMonthSchedule}
              className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            >
              {isDeletingMonthSchedule ? "削除中..." : "この月のシフトを全削除"}
            </button>
          </div>

          <div className="mb-4 rounded-lg border bg-gray-50 p-3 md:mb-6 md:p-4">
            <h3 className="mb-2 text-sm font-bold text-gray-700">医師別スコア</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(scores).map(([doctorId, score]) => (
                <div key={doctorId} className="flex items-center rounded border bg-white px-2 py-1 text-xs shadow-sm">
                  <span className="mr-1 text-gray-500 md:mr-2">{getDoctorName(doctorId)}</span>
                  <span className="font-bold">{String(score)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 lg:hidden">{renderScheduleTable(schedule, "mobile")}</div>
          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-4">
            {scheduleColumns.map((rows, index) => renderScheduleTable(rows, `desktop-${index}`))}
          </div>

          <div className="mt-6 flex flex-col items-center">
            <button
              type="button"
              onClick={onSaveToDB}
              disabled={isSaving}
              className="w-full rounded-full bg-green-600 px-6 py-3 font-bold text-white shadow-lg transition hover:scale-105 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:px-8"
            >
              {isSaving ? "保存中..." : "このシフトを確定して保存する"}
            </button>
            {saveMessage && <div className="mt-4 font-bold text-green-800">保存完了: {saveMessage}</div>}
          </div>
        </div>
      )}
    </>
  );
}
