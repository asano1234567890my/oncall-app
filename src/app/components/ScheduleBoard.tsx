"use client";

import { Lock, Unlock } from "lucide-react";
import type { DragEvent } from "react";

type ShiftType = "day" | "night";

type ScheduleRow = {
  day: number;
  day_shift?: string | null;
  night_shift?: string | null;
  is_holiday?: boolean;
};

type ScheduleBoardProps = {
  isLoading: boolean;
  dragNotice: string;
  error: string;
  schedule: ScheduleRow[];
  scheduleColumns: ScheduleRow[][];
  scores: Record<string, unknown>;
  getDoctorName: (doctorId: string | null | undefined) => string;
  year: number;
  month: number;
  holidaySet: Set<string>;
  manualHolidaySetInMonth: Set<string>;
  toYmd: (year: number, month: number, day: number) => string;
  getWeekday: (year: number, month: number, day: number) => string;
  isShiftLocked: (day: number, shiftType: ShiftType) => boolean;
  invalidHoverShiftKey: string | null;
  onHandleShiftDragOver: (event: DragEvent<HTMLDivElement>, day: number, shiftType: ShiftType, locked: boolean, isHolidayLike: boolean) => void;
  onHandleShiftDragLeave: (day: number, shiftType: ShiftType) => void;
  onHandleShiftDrop: (event: DragEvent<HTMLDivElement>, day: number, shiftType: ShiftType, locked: boolean, isHolidayLike: boolean) => void;
  onHandleDisabledDayDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onShiftDragStart: (event: DragEvent<HTMLSpanElement>, day: number, shiftType: ShiftType, doctorId: string | null | undefined) => void;
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
  onHandleShiftDragOver,
  onHandleShiftDragLeave,
  onHandleShiftDrop,
  onHandleDisabledDayDragOver,
  onShiftDragStart,
  onClearDragState,
  onToggleShiftLock,
  onDeleteMonthSchedule,
  isDeletingMonthSchedule,
  onSaveToDB,
  isSaving,
  saveMessage,
}: ScheduleBoardProps) {
  const renderScheduleTable = (rows: ScheduleRow[], columnKey: string) => (
    <div key={columnKey} className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full table-fixed bg-white text-center text-xs md:text-[13px]">
        <thead className="bg-gray-100 whitespace-nowrap">
          <tr>
            <th className="py-2 px-1.5 md:px-2 border-b">日付</th>
            <th className="py-2 px-1.5 md:px-2 border-b">曜日</th>
            <th className="py-2 px-1.5 md:px-2 border-b bg-orange-50">日直</th>
            <th className="py-2 px-1.5 md:px-2 border-b bg-indigo-50">当直</th>
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
            const isHolidayLike = Boolean(row.is_holiday) || isSun || isAutoHoliday || isManualHoliday;
            const isDayShiftEnabled = isHolidayLike;
            const dayLocked = isShiftLocked(row.day, "day");
            const nightLocked = isShiftLocked(row.day, "night");
            const dayShiftKey = `${row.day}_day`;
            const nightShiftKey = `${row.day}_night`;
            const dayHoverInvalid = invalidHoverShiftKey === dayShiftKey;
            const nightHoverInvalid = invalidHoverShiftKey === nightShiftKey;

            return (
              <tr key={`${columnKey}-${row.day}`} className={`border-b ${isHolidayLike ? "bg-red-50" : isSat ? "bg-blue-50" : ""}`}>
                <td className="w-14 py-1.5 px-1.5 md:px-2 whitespace-nowrap align-middle text-[11px] font-semibold text-gray-700">{row.day}日</td>
                <td className={`w-12 py-1.5 px-1.5 md:px-2 align-middle text-[11px] font-bold ${isSun ? "text-red-500" : isSat ? "text-blue-500" : ""}`}>{wd}</td>
                <td className="w-[37%] py-1.5 px-1.5 md:px-2 align-middle">
                  {isDayShiftEnabled ? (
                    <div
                      onDragEnter={(e) => onHandleShiftDragOver(e, row.day, "day", dayLocked, isHolidayLike)}
                      onDragOver={(e) => onHandleShiftDragOver(e, row.day, "day", dayLocked, isHolidayLike)}
                      onDragLeave={() => onHandleShiftDragLeave(row.day, "day")}
                      onDrop={(e) => onHandleShiftDrop(e, row.day, "day", dayLocked, isHolidayLike)}
                      className={`min-h-9 rounded-md border px-1.5 py-1 flex items-center justify-between gap-1.5 ${
                        dayHoverInvalid
                          ? "border-red-300 bg-red-200 cursor-not-allowed"
                          : dayLocked
                          ? "border-amber-300 bg-amber-50"
                          : "border-transparent hover:border-gray-200"
                      }`}
                    >
                      {row.day_shift !== null && row.day_shift !== undefined ? (
                        <span
                          draggable={!dayLocked}
                          onDragStart={(e) => onShiftDragStart(e, row.day, "day", row.day_shift)}
                          onDragEnd={onClearDragState}
                          className={`min-w-0 flex-1 truncate px-2 py-1 rounded-full text-[11px] font-bold whitespace-nowrap cursor-grab active:cursor-grabbing ${
                            dayLocked ? "bg-amber-100 text-amber-900" : "bg-orange-100 text-orange-800"
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
                        className="p-1 rounded border border-gray-200 bg-white text-gray-500 hover:text-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={dayLocked ? "ロック解除" : "ロック"}
                      >
                        {dayLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragEnter={onHandleDisabledDayDragOver}
                      onDragOver={onHandleDisabledDayDragOver}
                      className="min-h-9 rounded-md border border-gray-200 bg-gray-100 px-1.5 py-1 flex items-center justify-center text-[11px] font-semibold text-gray-400 cursor-not-allowed"
                    >
                      -
                    </div>
                  )}
                </td>
                <td className="w-[37%] py-1.5 px-1.5 md:px-2 align-middle">
                  <div
                    onDragEnter={(e) => onHandleShiftDragOver(e, row.day, "night", nightLocked, isHolidayLike)}
                    onDragOver={(e) => onHandleShiftDragOver(e, row.day, "night", nightLocked, isHolidayLike)}
                    onDragLeave={() => onHandleShiftDragLeave(row.day, "night")}
                    onDrop={(e) => onHandleShiftDrop(e, row.day, "night", nightLocked, isHolidayLike)}
                    className={`min-h-9 rounded-md border px-1.5 py-1 flex items-center justify-between gap-1.5 ${
                      nightHoverInvalid
                        ? "border-red-300 bg-red-200 cursor-not-allowed"
                        : nightLocked
                        ? "border-amber-300 bg-amber-50"
                        : "border-transparent hover:border-gray-200"
                    }`}
                  >
                    {row.night_shift !== null && row.night_shift !== undefined ? (
                      <span
                        draggable={!nightLocked}
                        onDragStart={(e) => onShiftDragStart(e, row.day, "night", row.night_shift)}
                        onDragEnd={onClearDragState}
                        className={`min-w-0 flex-1 truncate px-2 py-1 rounded-full text-[11px] font-bold whitespace-nowrap cursor-grab active:cursor-grabbing ${
                          nightLocked ? "bg-amber-100 text-amber-900" : "bg-indigo-100 text-indigo-800"
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
                      className="p-1 rounded border border-gray-200 bg-white text-gray-500 hover:text-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={nightLocked ? "ロック解除" : "ロック"}
                    >
                      {nightLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    </button>
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
      {dragNotice && <div className="bg-amber-50 text-amber-800 p-3 mb-4 rounded-xl border border-amber-200">{dragNotice}</div>}

      {!schedule.length && !isLoading && !error && (
        <div className="flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-gray-300 rounded-lg text-gray-400 bg-gray-50 p-4 text-center">
          左下の「生成ボタン」を押してください
        </div>
      )}

      {schedule.length > 0 && (
        <div className="animate-fade-in">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-gray-500">シフトをドラッグして移動/入れ替えできます。ロック済みコマは移動されません。</div>
            <button
              type="button"
              onClick={onDeleteMonthSchedule}
              disabled={isDeletingMonthSchedule}
              className="w-full md:w-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeletingMonthSchedule ? "削除中..." : "この月のシフトを全削除"}
            </button>
          </div>

          <div className="bg-gray-50 p-3 md:p-4 rounded-lg border mb-4 md:mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-2">⚖️ 負担スコア</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(scores).map(([doctorId, score]) => (
                <div key={doctorId} className="bg-white px-2 py-1 rounded border text-xs shadow-sm flex items-center">
                  <span className="text-gray-500 mr-1 md:mr-2">{getDoctorName(doctorId)}</span>
                  <span className="font-bold">{String(score)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 lg:hidden">{renderScheduleTable(schedule, "mobile")}</div>
          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-4">{scheduleColumns.map((rows, index) => renderScheduleTable(rows, `desktop-${index}`))}</div>

          <div className="mt-6 flex flex-col items-center">
            <button
              onClick={onSaveToDB}
              disabled={isSaving}
              className="px-6 py-3 md:px-8 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold shadow-lg transform hover:scale-105 transition w-full md:w-auto"
            >
              {isSaving ? "保存中..." : "💾 このシフトを確定・保存する"}
            </button>
            {saveMessage && <div className="mt-4 text-green-800 font-bold">🎉 {saveMessage}</div>}
          </div>
        </div>
      )}
    </>
  );
}
