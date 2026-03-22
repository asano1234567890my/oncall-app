// src/app/components/DoctorUnavailableDetail.tsx — 1医師の不可日詳細モーダル（モバイル用）
"use client";

import { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ja } from "react-day-picker/locale";
import "react-day-picker/dist/style.css";
import SettingsModalPortal from "./settings/SettingsModalPortal";
import {
  dayPickerBaseClassName,
  baseCalendarModifierClasses,
  dayPickerWithNavClassNames,
  fixedWeekdayLabels,
  getFixedWeekdayButtonTone,
  getFixedWeekdayButtonLabel,
  pad2,
} from "./settings/shared";
import type {
  Doctor,
  UnavailableDateEntry,
  FixedUnavailableWeekdayEntry,
  TargetShift,
} from "../types/dashboard";

type DoctorUnavailableDetailProps = {
  doctor: Doctor | null;
  year: number;
  month: number;
  onClose: () => void;
  unavailableEntries: UnavailableDateEntry[];
  fixedEntries: FixedUnavailableWeekdayEntry[];
  pyWeekdays: number[];
  onToggleUnavailable: (doctorId: string, ymd: string, targetShift?: TargetShift | null) => void;
  onToggleFixedWeekday: (doctorId: string, weekdayPy: number, targetShift?: TargetShift | null) => void;
};

export default function DoctorUnavailableDetail({
  doctor,
  year,
  month: targetMonth,
  onClose,
  unavailableEntries,
  fixedEntries,
  pyWeekdays,
  onToggleUnavailable,
  onToggleFixedWeekday,
}: DoctorUnavailableDetailProps) {
  const [month, setMonth] = useState(() => new Date(year, targetMonth - 1, 1));
  const [copiedLink, setCopiedLink] = useState(false);

  if (!doctor) return null;

  const selectedDates: Date[] = [];
  for (const entry of unavailableEntries) {
    const match = entry.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) continue;
    const [, y, m, d] = match;
    selectedDates.push(new Date(Number(y), Number(m) - 1, Number(d)));
  }

  const getFixedWeekdayTargetShift = (weekdayPy: number): TargetShift | null => {
    const entry = fixedEntries.find((e) => e.day_of_week === weekdayPy);
    return entry ? entry.target_shift : null;
  };

  const handleCopyLink = async () => {
    if (!doctor.access_token) return;
    const url = `${window.location.origin}/entry/${doctor.access_token}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    } catch { /* ignore */ }
  };

  const monthPrefix = `${year}-${String(targetMonth).padStart(2, "0")}-`;
  const hasAny = unavailableEntries.some((e) => e.date.startsWith(monthPrefix));

  return (
    <SettingsModalPortal isOpen>
      <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 backdrop-blur-sm sm:items-center sm:py-6">
        <div className="flex max-h-[90dvh] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl animate-slide-up sm:animate-none">
          {/* ヘッダー */}
          <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-base font-bold text-gray-900 truncate">{doctor.name}</h3>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                hasAny ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
              }`}>
                {hasAny ? "入力済み" : "未入力"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {doctor.access_token && (
                <button
                  onClick={() => { void handleCopyLink(); }}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                    copiedLink
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {copiedLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedLink ? "コピー済み" : "入力用URL"}
                </button>
              )}
              <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* コンテンツ */}
          <div className="overflow-y-auto p-4 space-y-4">
            {/* 固定不可曜日 */}
            <div>
              <div className="mb-2 text-xs font-bold text-gray-600">固定不可曜日</div>
              <div className="flex gap-1">
                {pyWeekdays.map((wd) => {
                  const ts = getFixedWeekdayTargetShift(wd);
                  return (
                    <button
                      key={wd}
                      type="button"
                      onClick={() => onToggleFixedWeekday(doctor.id, wd)}
                      className={`flex-1 rounded-lg border py-2 text-center text-xs font-bold transition ${getFixedWeekdayButtonTone(wd, ts)}`}
                    >
                      {fixedWeekdayLabels[wd]}{getFixedWeekdayButtonLabel(ts)}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 text-[10px] text-gray-400">タップで終日不可 → 日直のみ → 当直のみ → 解除</div>
            </div>

            {/* 不可日カレンダー */}
            <div>
              <div className="mb-2 text-xs font-bold text-gray-600">不可日カレンダー</div>
              <DayPicker
                mode="multiple"
                month={month}
                onMonthChange={setMonth}
                locale={ja}
                selected={selectedDates}
                onDayClick={(date) => {
                  const ymd = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
                  onToggleUnavailable(doctor.id, ymd);
                }}
                showOutsideDays
                className={dayPickerBaseClassName}
                classNames={dayPickerWithNavClassNames}
                modifiers={{
                  saturday: (date: Date) => date.getDay() === 6,
                  sunday: (date: Date) => date.getDay() === 0,
                }}
                modifiersClassNames={baseCalendarModifierClasses}
              />
              <div className="mt-1 text-[10px] text-gray-400">
                日付タップで不可日を追加/解除（{unavailableEntries.length}日設定中）
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsModalPortal>
  );
}
