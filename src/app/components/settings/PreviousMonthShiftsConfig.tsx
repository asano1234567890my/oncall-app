"use client";

import { format } from "date-fns";
import StepperNumberInput from "../inputs/StepperNumberInput";
import type { Doctor, ShiftType } from "../../types/dashboard";

type PreviousMonthShiftsConfigProps = {
  isOpen: boolean;
  year: number;
  month: number;
  prevMonthLastDay: number;
  prevMonthTailDays: number[];
  activeDoctors: Doctor[];
  previousMonthShiftCount: number;
  getPreviousMonthShiftDoctorId: (prevDay: number, shiftType: ShiftType) => string;
  onClose: () => void;
  onPrevMonthLastDayChange: (value: number) => void;
  onSetPreviousMonthShift: (prevDay: number, shiftType: ShiftType, doctorId: string) => void;
};

export default function PreviousMonthShiftsConfig({
  isOpen,
  year,
  month,
  prevMonthLastDay,
  prevMonthTailDays,
  activeDoctors,
  previousMonthShiftCount,
  getPreviousMonthShiftDoctorId,
  onClose,
  onPrevMonthLastDayChange,
  onSetPreviousMonthShift,
}: PreviousMonthShiftsConfigProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
      <div className="flex max-h-[85dvh] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-2xl sm:max-h-[90vh]">
        <div className="flex items-start justify-between gap-4 border-b border-violet-100 bg-violet-50 px-4 py-4 sm:px-5">
          <div>
            <h3 className="text-base font-bold text-gray-900">前月末勤務</h3>
            <p className="mt-1 text-xs text-gray-500">前月末の勤務を日付ごとに確認・修正します。</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-violet-200 bg-white px-2 py-1 text-[11px] font-bold text-violet-700">
              入力済み {previousMonthShiftCount}枠
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50"
            >
              閉じる
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-end">
            <label>
              <div className="mb-1 text-[11px] font-bold text-gray-700">前月の最終日</div>
              <StepperNumberInput
                value={prevMonthLastDay}
                onCommit={onPrevMonthLastDayChange}
                fallbackValue={prevMonthLastDay}
                min={1}
                step={1}
                inputMode="numeric"
              />
            </label>
            <div className="text-[11px] text-gray-500">直近4日分を previous_month_shifts として optimize に送信します。</div>
          </div>

          <div className="space-y-2">
            {prevMonthTailDays.map((day) => (
              <div
                key={day}
                className="grid grid-cols-1 gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)]"
              >
                <div className="flex items-center justify-center rounded-lg bg-white text-sm font-bold text-gray-700">
                  {format(new Date(year, month - 2, day), "M/d")}
                </div>
                <label className="space-y-1">
                  <div className="text-[11px] font-bold text-gray-700">日直</div>
                  <select
                    value={getPreviousMonthShiftDoctorId(day, "day")}
                    onChange={(event) => onSetPreviousMonthShift(day, "day", event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                  >
                    <option value="">未設定</option>
                    {activeDoctors.map((doctor) => (
                      <option key={`prev-day-${day}-${doctor.id}`} value={doctor.id}>
                        {doctor.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <div className="text-[11px] font-bold text-gray-700">当直</div>
                  <select
                    value={getPreviousMonthShiftDoctorId(day, "night")}
                    onChange={(event) => onSetPreviousMonthShift(day, "night", event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                  >
                    <option value="">未設定</option>
                    {activeDoctors.map((doctor) => (
                      <option key={`prev-night-${day}-${doctor.id}`} value={doctor.id}>
                        {doctor.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
