"use client";

import { useMemo, useState, useCallback } from "react";
import { Pencil, Lock } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ja } from "react-day-picker/locale";
import "react-day-picker/dist/style.css";
import TargetShiftPopover from "../TargetShiftPopover";
import { useCustomHolidays } from "../../hooks/useCustomHolidays";
import { useHolidays } from "../../hooks/useHolidays";
import type {
  Doctor,
  FixedUnavailableWeekdayMap,
  TargetShift,
  UnavailableDateMap,
} from "../../types/dashboard";
import { getFixedWeekdayTargetShift, getUnavailableDateTargetShift } from "../../utils/unavailableSettings";
import {
  baseCalendarModifierClasses,
  dayPickerBaseClassName,
  dayPickerWithNavClassNames,
  fixedWeekdayLabels,
  getFixedWeekdayButtonLabel,
  getFixedWeekdayButtonTone,
  pad2,
  parseDateKey,
  toDateKey,
  unavailableAllModifierClass,
  unavailableDayModifierClass,
  unavailableNightModifierClass,
  getTargetShiftSummaryLabel,
} from "./shared";

type UnavailableDaysInputProps = {
  doctorUnavailableMonth: Date;
  activeDoctors: Doctor[];
  selectedDoctorId: string;
  unavailableMap: UnavailableDateMap;
  fixedUnavailableWeekdaysMap: FixedUnavailableWeekdayMap;
  pyWeekdays: number[];
  onSelectedDoctorChange: (doctorId: string) => void;
  onDoctorUnavailableMonthChange: (value: Date) => void;
  onToggleAllUnavailable: () => void;
  onToggleUnavailable: (doctorId: string, ymd: string, targetShift?: TargetShift | null) => void;
  onToggleFixedWeekday: (doctorId: string, weekdayPy: number, targetShift?: TargetShift | null) => void;
  onSave?: () => void;
  isSaving?: boolean;
};

export default function UnavailableDaysInput({
  doctorUnavailableMonth,
  activeDoctors,
  selectedDoctorId,
  unavailableMap,
  fixedUnavailableWeekdaysMap,
  pyWeekdays,
  onSelectedDoctorChange,
  onDoctorUnavailableMonthChange,
  onToggleAllUnavailable,
  onToggleUnavailable,
  onToggleFixedWeekday,
  onSave,
  isSaving = false,
}: UnavailableDaysInputProps) {
  const doctorUnavailableYear = doctorUnavailableMonth.getFullYear();
  const doctorUnavailableMonthNumber = doctorUnavailableMonth.getMonth() + 1;
  const doctorUnavailableMonthPrefix = `${doctorUnavailableYear}-${pad2(doctorUnavailableMonthNumber)}-`;
  const selectedDoctor = activeDoctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;
  const [unavailablePopover, setUnavailablePopover] = useState<{ dateKey: string } | null>(null);
  const [fixedWeekdayPopover, setFixedWeekdayPopover] = useState<{ doctorId: string; weekday: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { holidaySet: doctorUnavailableStandardHolidaySet } = useHolidays(doctorUnavailableYear);
  const {
    manualSet: doctorUnavailableManualSet,
    disabledSet: doctorUnavailableDisabledSet,
    customError: doctorUnavailableCustomError,
  } = useCustomHolidays(doctorUnavailableYear);

  const doctorUnavailableHolidaySet = useMemo(() => {
    const next = new Set<string>(doctorUnavailableStandardHolidaySet);

    if (doctorUnavailableCustomError) {
      return next;
    }

    for (const date of doctorUnavailableDisabledSet) {
      next.delete(date);
    }

    for (const date of doctorUnavailableManualSet) {
      next.add(date);
    }

    return next;
  }, [doctorUnavailableCustomError, doctorUnavailableDisabledSet, doctorUnavailableManualSet, doctorUnavailableStandardHolidaySet]);

  const selectedUnavailableInMonth = useMemo(() => {
    const selectedDoctorUnavailable = unavailableMap[selectedDoctorId] ?? [];
    return selectedDoctorUnavailable
      .filter((entry) => entry.date.startsWith(doctorUnavailableMonthPrefix))
      .slice()
      .sort((left, right) => left.date.localeCompare(right.date));
  }, [doctorUnavailableMonthPrefix, selectedDoctorId, unavailableMap]);

  const selectedUnavailableDates = useMemo(
    () =>
      selectedUnavailableInMonth
        .map((entry) => parseDateKey(entry.date))
        .filter((value): value is Date => value instanceof Date),
    [selectedUnavailableInMonth]
  );

  const selectedFixedWeekdays = useMemo(
    () => (selectedDoctorId ? fixedUnavailableWeekdaysMap[selectedDoctorId] ?? [] : []),
    [fixedUnavailableWeekdaysMap, selectedDoctorId]
  );

  const unavailableCounts = useMemo(
    () =>
      selectedUnavailableInMonth.reduce(
        (acc, entry) => {
          acc.total += 1;
          acc[entry.target_shift] += 1;
          return acc;
        },
        { total: 0, all: 0, day: 0, night: 0 }
      ),
    [selectedUnavailableInMonth]
  );

  const unavailableCalendarModifiers = useMemo(
    () => ({
      saturday: (date: Date) => date.getDay() === 6,
      sunday: (date: Date) => date.getDay() === 0,
      holiday: (date: Date) =>
        date.getFullYear() === doctorUnavailableYear &&
        date.getMonth() === doctorUnavailableMonthNumber - 1 &&
        doctorUnavailableHolidaySet.has(toDateKey(date)),
      allUnavailable: (date: Date) => getUnavailableDateTargetShift(selectedUnavailableInMonth, toDateKey(date)) === "all",
      dayUnavailable: (date: Date) => getUnavailableDateTargetShift(selectedUnavailableInMonth, toDateKey(date)) === "day",
      nightUnavailable: (date: Date) => getUnavailableDateTargetShift(selectedUnavailableInMonth, toDateKey(date)) === "night",
    }),
    [doctorUnavailableHolidaySet, doctorUnavailableMonthNumber, doctorUnavailableYear, selectedUnavailableInMonth]
  );

  const handleDoctorSelection = (doctorId: string) => {
    setUnavailablePopover(null);
    setFixedWeekdayPopover(null);
    setIsEditing(false);
    onSelectedDoctorChange(doctorId);
  };

  const handleDoctorUnavailableMonthChange = (nextMonth: Date) => {
    setUnavailablePopover(null);
    onDoctorUnavailableMonthChange(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
  };

  const handleUnavailableDayClick = (date: Date, modifiers: Record<string, boolean>) => {
    if (!isEditing) return;
    if (
      date.getFullYear() !== doctorUnavailableYear ||
      date.getMonth() !== doctorUnavailableMonthNumber - 1 ||
      !selectedDoctorId ||
      modifiers.disabled
    ) {
      return;
    }

    const dateKey = toDateKey(date);
    const isSundayOrHoliday = date.getDay() === 0 || doctorUnavailableHolidaySet.has(dateKey);

    if (!isSundayOrHoliday) {
      onToggleUnavailable(selectedDoctorId, dateKey);
      setUnavailablePopover(null);
      return;
    }

    setUnavailablePopover({ dateKey });
  };

  const handleFixedWeekdayClick = (
    doctorId: string,
    weekday: number,
    targetShift: TargetShift | null
  ) => {
    if (!isEditing) return;
    if (weekday < 6) {
      onToggleFixedWeekday(doctorId, weekday, targetShift ? null : "all");
      setFixedWeekdayPopover(null);
      return;
    }

    setFixedWeekdayPopover({ doctorId, weekday });
  };

  return (
    <>
      <div className="mb-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-800">医師別不可日設定</h3>
            <p className="mt-1 text-[11px] text-gray-500">平日・土曜は1タップで終日休み、日曜・祝日はポップアップで日直/当直別に設定できます。</p>
          </div>
          <div className="flex items-center gap-2">
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className={`rounded-lg px-3 py-2 text-xs font-bold text-white transition ${
                  isSaving ? "cursor-not-allowed bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isSaving ? "保存中..." : "不可日を保存"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              disabled={!selectedDoctorId}
              className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                isEditing
                  ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              } disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400`}
            >
              {isEditing ? <Pencil className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {isEditing ? "編集中" : "編集"}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={onToggleAllUnavailable}
                disabled={!selectedDoctorId}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              >
                全リセット/全選択
              </button>
            )}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {activeDoctors.map((doctor) => (
            <button
              key={doctor.id}
              type="button"
              onClick={() => handleDoctorSelection(doctor.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                selectedDoctorId === doctor.id ? "border-blue-700 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {doctor.name}
            </button>
          ))}
        </div>

        <div className={!isEditing ? "opacity-60" : ""}>
          <DayPicker
            mode="multiple"
            month={doctorUnavailableMonth}
            onMonthChange={handleDoctorUnavailableMonthChange}
            locale={ja}
            selected={selectedUnavailableDates}
            onDayClick={handleUnavailableDayClick}
            showOutsideDays
            disabled={!selectedDoctorId}
            className={dayPickerBaseClassName}
            classNames={dayPickerWithNavClassNames}
            modifiers={unavailableCalendarModifiers}
            modifiersClassNames={{
              ...baseCalendarModifierClasses,
              holiday: "[&>button]:bg-red-50/70 [&>button]:text-red-600 hover:[&>button]:bg-red-100/80",
              allUnavailable: unavailableAllModifierClass,
              dayUnavailable: unavailableDayModifierClass,
              nightUnavailable: unavailableNightModifierClass,
            }}
          />
          <TargetShiftPopover
            open={Boolean(unavailablePopover)}
            title={unavailablePopover ? `${doctorUnavailableMonthNumber}月${Number(unavailablePopover.dateKey.slice(-2))}日の不可設定` : "不可設定"}
            currentValue={
              unavailablePopover ? getUnavailableDateTargetShift(selectedUnavailableInMonth, unavailablePopover.dateKey) : null
            }
            onSelect={(value) => {
              if (!selectedDoctorId || !unavailablePopover) return;
              onToggleUnavailable(selectedDoctorId, unavailablePopover.dateKey, value);
            }}
            onClose={() => setUnavailablePopover(null)}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] text-gray-600">
          <span className="font-bold">{selectedDoctor?.name ?? "医師未選択"}</span>
          <span className="font-bold text-indigo-600">選択中: {unavailableCounts.total}件</span>
          <span className="text-gray-500">終日 {unavailableCounts.all}</span>
          <span className="text-amber-700">日直のみ {unavailableCounts.day}</span>
          <span className="text-sky-700">当直のみ {unavailableCounts.night}</span>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-800">固定不可曜日</h3>
            <p className="mt-1 text-[11px] text-gray-500">月〜土は1タップで終日不可、日曜と祝日はポップアップでシフト別に設定できます。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                isEditing
                  ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {isEditing ? <Pencil className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {isEditing ? "編集中" : "編集"}
            </button>
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className={`rounded-lg px-3 py-2 text-xs font-bold text-white transition ${
                  isSaving ? "cursor-not-allowed bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isSaving ? "保存中..." : "固定曜日を保存"}
              </button>
            )}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-bold">
          <span className="rounded-full border border-gray-200 bg-white px-2 py-1 text-gray-600">[休] = 終日</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">[日] = 日直のみ</span>
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-sky-800">[当] = 当直のみ</span>
        </div>

        <div className={`overflow-x-auto ${!isEditing ? "opacity-60" : ""}`}>
          <div className="min-w-[320px]">
            <div className="mb-2 grid grid-cols-[88px_repeat(8,1fr)] items-center gap-1">
              <div className="text-[11px] font-bold text-gray-600">医師</div>
              {pyWeekdays.map((weekday) => {
                const isSat = weekday === 5;
                const isSun = weekday === 6;
                const isHoliday = weekday === 7;
                return (
                  <div
                    key={weekday}
                    className={`rounded border py-1 text-center text-[11px] font-bold ${
                      isSun || isHoliday
                        ? "border-red-100 bg-red-50 text-red-500"
                        : isSat
                          ? "border-blue-100 bg-blue-50 text-blue-600"
                          : "border-gray-100 bg-gray-50 text-gray-700"
                    }`}
                  >
                    {fixedWeekdayLabels[weekday]}
                  </div>
                );
              })}
            </div>

            <div className="space-y-1">
              {activeDoctors.map((doctor) => (
                <div key={doctor.id} className="grid grid-cols-[88px_repeat(8,1fr)] items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDoctorSelection(doctor.id)}
                    className={`truncate rounded border px-2 py-2 text-left text-[11px] font-bold transition ${
                      selectedDoctorId === doctor.id ? "border-blue-700 bg-blue-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {doctor.name}
                  </button>
                  {pyWeekdays.map((weekday) => {
                    const targetShift = getFixedWeekdayTargetShift(fixedUnavailableWeekdaysMap[doctor.id] ?? [], weekday);
                    return (
                      <button
                        key={`${doctor.id}-${weekday}`}
                        type="button"
                        onClick={() => handleFixedWeekdayClick(doctor.id, weekday, targetShift)}
                        title={targetShift ?? "設定なし"}
                        className={`h-9 rounded border text-[12px] font-bold transition ${getFixedWeekdayButtonTone(weekday, targetShift)}`}
                      >
                        {getFixedWeekdayButtonLabel(targetShift)}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <TargetShiftPopover
          open={Boolean(fixedWeekdayPopover)}
          title={
            fixedWeekdayPopover
              ? `${activeDoctors.find((doctor) => doctor.id === fixedWeekdayPopover.doctorId)?.name ?? ""} / ${fixedWeekdayLabels[fixedWeekdayPopover.weekday] ?? ""}`
              : "固定不可設定"
          }
          currentValue={
            fixedWeekdayPopover
              ? getFixedWeekdayTargetShift(fixedUnavailableWeekdaysMap[fixedWeekdayPopover.doctorId] ?? [], fixedWeekdayPopover.weekday)
              : null
          }
          onSelect={(value) => {
            if (!fixedWeekdayPopover) return;
            onToggleFixedWeekday(fixedWeekdayPopover.doctorId, fixedWeekdayPopover.weekday, value);
          }}
          onClose={() => setFixedWeekdayPopover(null)}
        />

        <div className="mt-3 text-[11px] text-gray-500">
          選択中:
          <span className="ml-1 font-bold text-gray-700">{selectedDoctor?.name ?? "未選択"}</span>
          <span className="ml-2">
            {selectedFixedWeekdays.length === 0
              ? "未設定"
              : selectedFixedWeekdays
                  .slice()
                  .sort((left, right) => left.day_of_week - right.day_of_week)
                  .map((entry) => `${fixedWeekdayLabels[entry.day_of_week]}(${getTargetShiftSummaryLabel(entry.target_shift)})`)
                  .join(" / ")}
          </span>
        </div>
      </div>
    </>
  );
}


