// src/app/components/settings/HolidaySettingsDrawer.tsx — 祝日・休日設定ドロワー
"use client";

import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ja } from "react-day-picker/locale";
import SettingsModalPortal from "./SettingsModalPortal";
import {
  dayPickerBaseClassName,
  dayPickerWithNavClassNames,
  baseCalendarModifierClasses,
} from "./shared";

const pad2 = (n: number) => String(n).padStart(2, "0");
const toYmd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

type HolidaySettingsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onShowGuide?: () => void;
  year: number;
  month: number;
  /** 年単位の自動祝日Set (yyyy-mm-dd) */
  holidaySet: Set<string>;
  /** 年単位の手動追加祝日Set (yyyy-mm-dd) */
  manualHolidaySet: Set<string>;
  /** 平日扱いにした祝日Set (yyyy-mm-dd) */
  holidayWorkdayOverrides: Set<string>;
  onToggleHoliday: (ymd: string) => void;
  onToggleHolidayOverride: (ymd: string) => void;
  onSaveCustomHolidays: () => void;
  isLoadingCustom: boolean;
  isSavingCustom: boolean;
  customError: string;
  customSaveMessage: string;
  hasUnsavedCustomChanges: boolean;
};

export default function HolidaySettingsDrawer({
  isOpen,
  onClose,
  onShowGuide,
  year,
  month,
  holidaySet,
  manualHolidaySet,
  holidayWorkdayOverrides,
  onToggleHoliday,
  onToggleHolidayOverride,
  onSaveCustomHolidays,
  isLoadingCustom,
  isSavingCustom,
  customError,
  customSaveMessage,
  hasUnsavedCustomChanges,
}: HolidaySettingsDrawerProps) {
  const [displayMonth, setDisplayMonth] = useState(new Date(year, month - 1, 1));

  const dispYear = displayMonth.getFullYear();
  const dispMonth = displayMonth.getMonth() + 1;
  const dispDaysInMonth = new Date(dispYear, dispMonth, 0).getDate();

  // 表示月のカウント（標準祝日・手動追加・平日扱い）
  const holidayCounts = useMemo(() => {
    let autoCount = 0;
    let manualCount = 0;
    let overrideCount = 0;
    for (let day = 1; day <= dispDaysInMonth; day += 1) {
      const ymd = toYmd(dispYear, dispMonth, day);
      const isAuto = holidaySet.has(ymd);
      const isManual = manualHolidaySet.has(ymd);
      if (isAuto && holidayWorkdayOverrides.has(ymd)) overrideCount += 1;
      else if (isAuto) autoCount += 1;
      if (isManual) manualCount += 1;
    }
    return { autoCount, manualCount, overrideCount };
  }, [dispDaysInMonth, dispYear, dispMonth, holidaySet, manualHolidaySet, holidayWorkdayOverrides]);

  // カレンダーの選択済み日付（祝日・手動追加で、平日扱いでないもの）
  const holidaySelectedDates = useMemo(() => {
    const dates: Date[] = [];
    for (let day = 1; day <= dispDaysInMonth; day += 1) {
      const ymd = toYmd(dispYear, dispMonth, day);
      const isAuto = holidaySet.has(ymd);
      const isManual = manualHolidaySet.has(ymd);
      if (isManual || (isAuto && !holidayWorkdayOverrides.has(ymd))) {
        dates.push(new Date(dispYear, dispMonth - 1, day));
      }
    }
    return dates;
  }, [dispDaysInMonth, dispYear, dispMonth, holidaySet, manualHolidaySet, holidayWorkdayOverrides]);

  // カレンダーのモディファイア（表示月に連動）
  const holidayCalendarModifiers = useMemo(() => ({
    saturday: (date: Date) => date.getDay() === 6,
    sunday: (date: Date) => date.getDay() === 0,
    autoHoliday: (date: Date) => {
      const ymd = toYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
      return holidaySet.has(ymd) && !holidayWorkdayOverrides.has(ymd);
    },
    manualHoliday: (date: Date) => {
      const ymd = toYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
      return manualHolidaySet.has(ymd);
    },
    overrideHoliday: (date: Date) => {
      const ymd = toYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
      return holidaySet.has(ymd) && holidayWorkdayOverrides.has(ymd);
    },
  }), [holidaySet, manualHolidaySet, holidayWorkdayOverrides]);

  const handleHolidayDateClick = (date: Date) => {
    if (date.getDay() === 0) return; // 日曜は操作不可
    const ymd = toYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
    if (holidaySet.has(ymd)) {
      onToggleHolidayOverride(ymd);
      return;
    }
    onToggleHoliday(ymd);
  };

  return (
    <SettingsModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
        <div className="flex max-h-[85dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl sm:max-h-[90vh]">
          {/* ヘッダー */}
          <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-4 py-4 sm:px-5">
            <h3 className="text-base font-bold text-gray-900">祝日・休日設定</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSaveCustomHolidays}
                disabled={isSavingCustom || isLoadingCustom}
                className={`rounded-lg px-3 py-2 text-xs font-bold text-white transition ${
                  isSavingCustom || isLoadingCustom
                    ? "cursor-not-allowed bg-gray-400"
                    : hasUnsavedCustomChanges
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-slate-600 hover:bg-slate-700"
                }`}
              >
                {isSavingCustom ? "保存中..." : "保存"}
              </button>
              {onShowGuide && (
                <button type="button" onClick={onShowGuide} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">?</button>
              )}
              <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50">
                閉じる
              </button>
            </div>
          </div>

          {/* コンテンツ */}
          <div className="overflow-y-auto p-4 sm:p-5">
            <p className="mb-3 text-xs text-gray-500">
              通常日を押すと追加休日、標準祝日を押すと通常出勤へ切り替えます。
            </p>

            {(isLoadingCustom || customError || customSaveMessage) && (
              <div
                className={`mb-3 rounded-xl border px-3 py-2 text-[12px] font-bold ${
                  customError
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : customSaveMessage
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-blue-200 bg-blue-50 text-blue-700"
                }`}
              >
                {customError ? `保存に失敗しました: ${customError}` : customSaveMessage || "読み込み中..."}
              </div>
            )}

            <DayPicker
              mode="multiple"
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              locale={ja}
              selected={holidaySelectedDates}
              onDayClick={handleHolidayDateClick}
              showOutsideDays
              className={dayPickerBaseClassName}
              classNames={dayPickerWithNavClassNames}
              modifiers={holidayCalendarModifiers}
              modifiersClassNames={{
                ...baseCalendarModifierClasses,
                autoHoliday: "[&>button]:bg-red-50/70 [&>button]:text-red-600 hover:[&>button]:bg-red-100/80",
                manualHoliday: "[&>button]:bg-rose-500 [&>button]:text-white hover:[&>button]:bg-rose-600",
                overrideHoliday:
                  "[&>button]:border-emerald-300 [&>button]:bg-emerald-50 [&>button]:text-emerald-700 hover:[&>button]:bg-emerald-100/80",
              }}
            />

            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-600">標準祝日 {holidayCounts.autoCount}</span>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">追加休日 {holidayCounts.manualCount}</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">平日扱い {holidayCounts.overrideCount}</span>
              {hasUnsavedCustomChanges && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">未保存の変更があります</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </SettingsModalPortal>
  );
}
