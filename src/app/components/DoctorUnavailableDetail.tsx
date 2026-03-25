// src/app/components/DoctorUnavailableDetail.tsx — 1医師の不可日詳細モーダル（モバイル用）
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Copy, Check, Share2, QrCode } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ja } from "react-day-picker/locale";
import "react-day-picker/dist/style.css";
import SettingsModalPortal from "./settings/SettingsModalPortal";
import TargetShiftPopover from "./TargetShiftPopover";
import { useHolidays } from "../hooks/useHolidays";
import { useCustomHolidays } from "../hooks/useCustomHolidays";
import {
  dayPickerBaseClassName,
  baseCalendarModifierClasses,
  dayPickerWithNavClassNames,
  fixedWeekdayLabels,
  getFixedWeekdayButtonTone,
  getFixedWeekdayButtonLabel,
  pad2,
  toDateKey,
  unavailableAllModifierClass,
  unavailableDayModifierClass,
  unavailableNightModifierClass,
} from "./settings/shared";
import { getUnavailableDateTargetShift } from "../utils/unavailableSettings";
import type {
  Doctor,
  UnavailableDateEntry,
  FixedUnavailableWeekdayEntry,
  TargetShift,
} from "../types/dashboard";

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
};

const getDoctorUrl = (token: string) =>
  typeof window !== "undefined" ? `${window.location.origin}/entry/${token}` : `/entry/${token}`;

async function generateQrDataUrl(text: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, { width: 256, margin: 2 });
}

// ── Share dropdown (LINE / email / QR) ──
function ShareDropdown({ doctor }: { doctor: Doctor }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  if (!doctor.access_token) return null;
  const url = getDoctorUrl(doctor.access_token);
  const msg = `${doctor.name}先生\n不可日の入力をお願いします。\n${url}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <Share2 className="h-3 w-3" />
        共有
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            onClick={async () => {
              try {
                await copyText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch { /* ignore */ }
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "コピー済み" : "URLをコピー"}
          </button>
          <a
            href={`https://line.me/R/share?text=${encodeURIComponent(msg)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            onClick={() => setIsOpen(false)}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.81 2 10.5c0 2.9 1.93 5.45 4.83 6.91l-.58 3.43a.3.3 0 0 0 .42.34l4-2.08c.43.06.87.1 1.33.1 5.52 0 10-3.81 10-8.5S17.52 2 12 2z"/></svg>
            LINEで送る
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent(`不可日入力のお願い（${doctor.name}先生）`)}&body=${encodeURIComponent(msg)}`}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            onClick={() => setIsOpen(false)}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            メールで送る
          </a>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            onClick={async () => {
              setIsOpen(false);
              try {
                const dataUrl = await generateQrDataUrl(url);
                setQrDataUrl(dataUrl);
              } catch { /* ignore */ }
            }}
          >
            <QrCode className="h-3.5 w-3.5" />
            QRコードを表示
          </button>
        </div>
      )}
      {qrDataUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setQrDataUrl(null)}>
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-gray-800 mb-3">{doctor.name}先生</p>
            <img src={qrDataUrl} alt="QR Code" className="mx-auto w-48 h-48" />
            <p className="mt-3 text-[10px] text-gray-400 break-all">{url}</p>
            <button onClick={() => setQrDataUrl(null)} className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200">
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  onSave?: () => void;
  isSaving?: boolean;
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
  onSave,
  isSaving = false,
}: DoctorUnavailableDetailProps) {
  const [month, setMonth] = useState(() => new Date(year, targetMonth - 1, 1));
  const [unavailablePopover, setUnavailablePopover] = useState<{ dateKey: string } | null>(null);

  const displayedYear = month.getFullYear();
  const displayedMonthNumber = month.getMonth() + 1;

  const { holidaySet: standardHolidaySet } = useHolidays(displayedYear);
  const { manualSet, disabledSet, customError } = useCustomHolidays(displayedYear);
  const holidaySet = useMemo(() => {
    const next = new Set<string>(standardHolidaySet);
    if (customError) return next;
    for (const date of disabledSet) next.delete(date);
    for (const date of manualSet) next.add(date);
    return next;
  }, [customError, disabledSet, manualSet, standardHolidaySet]);

  if (!doctor) return null;

  const monthPrefix = `${displayedYear}-${pad2(displayedMonthNumber)}-`;
  const entriesInMonth = unavailableEntries.filter((e) => e.date.startsWith(monthPrefix));

  const selectedDates: Date[] = entriesInMonth.map((entry) => {
    const [y, m, d] = entry.date.split("-").map(Number);
    return new Date(y, m - 1, d);
  });

  const getFixedWeekdayTargetShift = (weekdayPy: number): TargetShift | null => {
    const entry = fixedEntries.find((e) => e.day_of_week === weekdayPy);
    return entry ? entry.target_shift : null;
  };

  const hasAny = entriesInMonth.length > 0;

  const handleDayClick = (date: Date) => {
    if (date.getFullYear() !== displayedYear || date.getMonth() !== displayedMonthNumber - 1) return;
    const dateKey = toDateKey(date);
    const isSundayOrHoliday = date.getDay() === 0 || holidaySet.has(dateKey);
    if (!isSundayOrHoliday) {
      onToggleUnavailable(doctor.id, dateKey);
      setUnavailablePopover(null);
      return;
    }
    setUnavailablePopover({ dateKey });
  };

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
              {doctor.access_token && <ShareDropdown doctor={doctor} />}
              {onSave && (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSaving}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white transition ${
                    isSaving ? "cursor-not-allowed bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {isSaving ? "保存中..." : "保存"}
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
                onMonthChange={(m) => { setUnavailablePopover(null); setMonth(m); }}
                locale={ja}
                selected={selectedDates}
                onDayClick={handleDayClick}
                showOutsideDays
                className={dayPickerBaseClassName}
                classNames={dayPickerWithNavClassNames}
                modifiers={{
                  saturday: (date: Date) => date.getDay() === 6,
                  sunday: (date: Date) => date.getDay() === 0,
                  holiday: (date: Date) =>
                    date.getFullYear() === displayedYear &&
                    date.getMonth() === displayedMonthNumber - 1 &&
                    holidaySet.has(toDateKey(date)),
                  allUnavailable: (date: Date) => getUnavailableDateTargetShift(entriesInMonth, toDateKey(date)) === "all",
                  dayUnavailable: (date: Date) => getUnavailableDateTargetShift(entriesInMonth, toDateKey(date)) === "day",
                  nightUnavailable: (date: Date) => getUnavailableDateTargetShift(entriesInMonth, toDateKey(date)) === "night",
                }}
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
                title={unavailablePopover ? `${displayedMonthNumber}月${Number(unavailablePopover.dateKey.slice(-2))}日の不可設定` : "不可設定"}
                currentValue={unavailablePopover ? getUnavailableDateTargetShift(entriesInMonth, unavailablePopover.dateKey) : null}
                onSelect={(value) => {
                  if (!unavailablePopover) return;
                  onToggleUnavailable(doctor.id, unavailablePopover.dateKey, value);
                }}
                onClose={() => setUnavailablePopover(null)}
              />
              <div className="mt-1 text-[10px] text-gray-400">
                平日・土曜はタップで終日休み、日曜・祝日はポップアップで日直/当直別に設定（{entriesInMonth.length}日設定中）
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsModalPortal>
  );
}
