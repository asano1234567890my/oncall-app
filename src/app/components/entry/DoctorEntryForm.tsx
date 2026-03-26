// src/app/components/entry/DoctorEntryForm.tsx — 不可日カレンダー＋固定不可曜日の共通コンポーネント
"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, CalendarCheck } from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { DayPicker } from "react-day-picker";
import { ja } from "react-day-picker/locale";
import { format } from "date-fns";
import TargetShiftPopover from "../TargetShiftPopover";
import type {
  FixedUnavailableWeekdayEntry,
  UnavailableDateEntry,
  UnavailableDayRecord,
} from "../../types/dashboard";
import {
  filterUnavailableDateEntriesByMonth,
  getFixedWeekdayTargetShiftForDate,
  getUnavailableDateTargetShift,
  isUnavailableDateInMonth,
  normalizeFixedUnavailableWeekdayEntries,
  normalizeUnavailableDateEntries,
  setUnavailableDateTargetShift,
} from "../../utils/unavailableSettings";
import { useCustomHolidays } from "../../hooks/useCustomHolidays";
import { useHolidays } from "../../hooks/useHolidays";
import "react-day-picker/dist/style.css";

// ── Types ──

export type PublicDoctor = {
  name: string;
  is_locked?: boolean;
  unavailable_dates?: string[];
  unavailable_days?: UnavailableDayRecord[];
  fixed_weekdays?: FixedUnavailableWeekdayEntry[];
};

type MessageResponse = {
  detail?: string;
  message?: string;
};

type DoctorEntryFormProps = {
  /** 医師の個別アクセストークン */
  accessToken: string;
  /** 確定シフトや全体当直表リンクを表示するか（共有ページでは非表示にする場合） */
  showConfirmedShifts?: boolean;
  /** 外部から渡す管理者メッセージ（共有ページでは親から渡す） */
  externalDoctorMessage?: string | null;
  /** 外部から渡す不可日上限（共有ページでは親から渡す） */
  externalUnavailDayLimit?: number | null;
};

// ── Helpers ──

const getApiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const getNextMonthDate = (baseDate = new Date()) =>
  new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);

const readOptionalJson = async <T,>(response: Response): Promise<T | null> => {
  const body = await response.text();
  if (!body.trim()) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
};

const getResponseMessage = (payload: MessageResponse | null, fallback: string) =>
  payload?.message || payload?.detail || fallback;

// ── Calendar modifier classes ──

const unavailableAllModifierClass =
  "[&>button]:relative [&>button]:!border-red-400 [&>button]:!bg-red-300 [&>button]:!text-transparent [&>button]:shadow-sm hover:[&>button]:!bg-red-400 [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[11px] [&>button]:after:font-bold [&>button]:after:text-red-900 [&>button]:after:content-['[休]']";

const unavailableDayModifierClass =
  "[&>button]:relative [&>button]:border-red-300 [&>button]:text-transparent [&>button]:bg-[linear-gradient(135deg,#fecaca_0%,#fecaca_50%,transparent_50%,transparent_100%)] [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[11px] [&>button]:after:font-bold [&>button]:after:text-red-800 [&>button]:after:content-['[日]']";

const unavailableNightModifierClass =
  "[&>button]:relative [&>button]:border-red-300 [&>button]:text-transparent [&>button]:bg-[linear-gradient(135deg,transparent_0%,transparent_50%,#fecaca_50%,#fecaca_100%)] [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[11px] [&>button]:after:font-bold [&>button]:after:text-red-800 [&>button]:after:content-['[当]']";

const fixedWeekdayAllModifierClass =
  "[&>button]:relative [&>button]:!border-orange-300 [&>button]:!bg-orange-100 [&>button]:!text-transparent [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[10px] [&>button]:after:font-bold [&>button]:after:text-orange-700 [&>button]:after:content-['[固]']";

const fixedWeekdayDayModifierClass =
  "[&>button]:relative [&>button]:!border-orange-200 [&>button]:!bg-orange-50 [&>button]:!text-transparent [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[10px] [&>button]:after:font-bold [&>button]:after:text-orange-600 [&>button]:after:content-['[固日]']";

const fixedWeekdayNightModifierClass =
  "[&>button]:relative [&>button]:!border-orange-200 [&>button]:!bg-orange-50 [&>button]:!text-transparent [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[10px] [&>button]:after:font-bold [&>button]:after:text-orange-600 [&>button]:after:content-['[固当]']";

// ── Data converters ──

export function toUnavailableEntriesFromDoctor(data: PublicDoctor): UnavailableDateEntry[] {
  const legacyEntries = Array.isArray(data.unavailable_dates)
    ? data.unavailable_dates.map((date) => ({ date: String(date), target_shift: "all" as const }))
    : [];
  const structuredEntries = Array.isArray(data.unavailable_days)
    ? data.unavailable_days
        .filter((entry) => entry && entry.is_fixed === false && typeof entry.date === "string" && entry.date)
        .map((entry) => ({
          date: String(entry.date),
          target_shift: entry.target_shift ?? "all",
        }))
    : [];
  return normalizeUnavailableDateEntries([...legacyEntries, ...structuredEntries]);
}

export function toFixedWeekdayEntriesFromDoctor(data: PublicDoctor): FixedUnavailableWeekdayEntry[] {
  const structuredEntries = Array.isArray(data.unavailable_days)
    ? data.unavailable_days.flatMap((entry) => {
        if (!entry || entry.is_fixed !== true) return [];
        const rawDayOfWeek = entry.day_of_week ?? entry.weekday;
        const dayOfWeek = Number(rawDayOfWeek);
        if (!Number.isFinite(dayOfWeek)) return [];
        return [{ day_of_week: dayOfWeek, target_shift: entry.target_shift ?? "all" }];
      })
    : [];
  return normalizeFixedUnavailableWeekdayEntries([...(data.fixed_weekdays ?? []), ...structuredEntries]);
}

// ── Component ──

export default function DoctorEntryForm({
  accessToken,
  showConfirmedShifts = true,
  externalDoctorMessage,
  externalUnavailDayLimit,
}: DoctorEntryFormProps) {
  const [doctor, setDoctor] = useState<PublicDoctor | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<UnavailableDateEntry[]>([]);
  const [fixedWeekdayEntries, setFixedWeekdayEntries] = useState<FixedUnavailableWeekdayEntry[]>([]);
  const [doctorMessage, setDoctorMessage] = useState<string | null>(null);
  const [unavailDayLimit, setUnavailDayLimit] = useState<number | null>(null);
  const [month, setMonth] = useState<Date>(() => getNextMonthDate());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [popover, setPopover] = useState<{ dateKey: string } | null>(null);
  const [fixedWeekdayPopover, setFixedWeekdayPopover] = useState<{ weekday: number } | null>(null);
  const [confirmedShifts, setConfirmedShifts] = useState<{ date: string; shift_type: string }[]>([]);

  const locked = Boolean(doctor?.is_locked);
  const displayedYear = month.getFullYear();
  const displayedMonthNumber = month.getMonth() + 1;
  const { holidaySet: standardHolidaySet } = useHolidays(displayedYear);
  const { manualSet, disabledSet, customError } = useCustomHolidays(displayedYear);

  // 外部から渡されたメッセージ・上限を優先
  const effectiveDoctorMessage = externalDoctorMessage !== undefined ? externalDoctorMessage : doctorMessage;
  const effectiveUnavailDayLimit = externalUnavailDayLimit !== undefined ? externalUnavailDayLimit : unavailDayLimit;

  const mergedHolidaySet = useMemo(() => {
    const next = new Set<string>(standardHolidaySet);
    const prefix = `${displayedYear}-`;
    if (customError) return next;
    for (const date of disabledSet) {
      if (date.startsWith(prefix)) next.delete(date);
    }
    for (const date of manualSet) {
      if (date.startsWith(prefix)) next.add(date);
    }
    return next;
  }, [customError, disabledSet, displayedYear, manualSet, standardHolidaySet]);

  const selectedEntriesInDisplayedMonth = useMemo(
    () => filterUnavailableDateEntriesByMonth(selectedEntries, displayedYear, displayedMonthNumber),
    [displayedMonthNumber, displayedYear, selectedEntries]
  );

  const unavailableCounts = useMemo(
    () =>
      selectedEntriesInDisplayedMonth.reduce(
        (acc, entry) => {
          acc.total += 1;
          acc[entry.target_shift] += 1;
          return acc;
        },
        { total: 0, all: 0, day: 0, night: 0 }
      ),
    [selectedEntriesInDisplayedMonth]
  );

  const calendarModifiers = useMemo(
    () => ({
      saturday: (day: Date) => day.getDay() === 6,
      sunday: (day: Date) => day.getDay() === 0,
      holiday: (day: Date) => mergedHolidaySet.has(ymd(day)),
      allUnavailable: (day: Date) => getUnavailableDateTargetShift(selectedEntriesInDisplayedMonth, ymd(day)) === "all",
      dayUnavailable: (day: Date) => getUnavailableDateTargetShift(selectedEntriesInDisplayedMonth, ymd(day)) === "day",
      nightUnavailable: (day: Date) => getUnavailableDateTargetShift(selectedEntriesInDisplayedMonth, ymd(day)) === "night",
      // 固定不可曜日（個別不可日がない日のみ）
      fixedWeekdayAll: (day: Date) => !getUnavailableDateTargetShift(selectedEntriesInDisplayedMonth, ymd(day)) && getFixedWeekdayTargetShiftForDate(fixedWeekdayEntries, day) === "all",
      fixedWeekdayDay: (day: Date) => !getUnavailableDateTargetShift(selectedEntriesInDisplayedMonth, ymd(day)) && getFixedWeekdayTargetShiftForDate(fixedWeekdayEntries, day) === "day",
      fixedWeekdayNight: (day: Date) => !getUnavailableDateTargetShift(selectedEntriesInDisplayedMonth, ymd(day)) && getFixedWeekdayTargetShiftForDate(fixedWeekdayEntries, day) === "night",
    }),
    [fixedWeekdayEntries, mergedHolidaySet, selectedEntriesInDisplayedMonth]
  );

  const title = useMemo(() => {
    if (!doctor) return "休み希望入力";
    return `${doctor.name} 先生の休み希望入力`;
  }, [doctor]);

  const fetchDoctor = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setInvalid(false);
    setError("");
    try {
      const res = await fetch(`${getApiBase()}/api/public/doctors/${accessToken}`, { cache: "no-store" });
      if (res.status === 404) {
        setInvalid(true);
        setDoctor(null);
        return;
      }
      if (!res.ok) throw new Error("取得に失敗しました");

      const data: PublicDoctor & { doctor_message?: string | null; unavail_day_limit?: number | null } = await res.json();
      const normalizedDoctor: PublicDoctor = {
        ...data,
        fixed_weekdays: toFixedWeekdayEntriesFromDoctor(data),
      };
      setDoctor(normalizedDoctor);
      setFixedWeekdayEntries(normalizedDoctor.fixed_weekdays ?? []);
      if (data.doctor_message) setDoctorMessage(data.doctor_message);
      if (data.unavail_day_limit != null) setUnavailDayLimit(data.unavail_day_limit);

      const selected = toUnavailableEntriesFromDoctor(normalizedDoctor);
      setSelectedEntries(selected);

      if (showConfirmedShifts) {
        try {
          const shiftRes = await fetch(`${getApiBase()}/api/schedule/public-shifts/${accessToken}`, { cache: "no-store" });
          if (shiftRes.ok) {
            const shifts: { date: string; shift_type: string }[] = await shiftRes.json();
            setConfirmedShifts(shifts);
          }
        } catch {
          // シフト取得失敗は無視
        }
      }
    } catch (e) {
      console.error(e);
      setError("読み込みに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchDoctor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    setPopover(null);
  }, [month]);

  const isHolidayLikeDate = (date: Date) => date.getDay() === 0 || mergedHolidaySet.has(ymd(date));
  const isAtLimit = effectiveUnavailDayLimit !== null && effectiveUnavailDayLimit !== undefined && unavailableCounts.total >= effectiveUnavailDayLimit;

  const handleDayClick = (day: Date) => {
    if (locked) return;
    const dateKey = ymd(day);
    if (!isUnavailableDateInMonth(dateKey, displayedYear, displayedMonthNumber)) return;
    // 固定不可曜日に該当する日はスキップ
    if (getFixedWeekdayTargetShiftForDate(fixedWeekdayEntries, day)) return;
    const currentValue = getUnavailableDateTargetShift(selectedEntriesInDisplayedMonth, dateKey);
    if (isHolidayLikeDate(day)) {
      setPopover({ dateKey });
      return;
    }
    if (!currentValue && isAtLimit) return;
    setSelectedEntries((prev) => {
      const existing = getUnavailableDateTargetShift(prev, dateKey);
      return setUnavailableDateTargetShift(prev, dateKey, existing ? null : "all");
    });
  };

  const handleSave = async () => {
    if (!accessToken || locked) return;
    setIsSaving(true);
    setError("");
    try {
      const unavailableDays = filterUnavailableDateEntriesByMonth(
        selectedEntries, displayedYear, displayedMonthNumber
      ).map((entry) => ({ date: entry.date, target_shift: entry.target_shift }));

      const payload = {
        unavailable_days: unavailableDays,
        fixed_weekdays: fixedWeekdayEntries,
        unavailable_year: displayedYear,
        unavailable_month: displayedMonthNumber,
      };

      const res = await fetch(`${getApiBase()}/api/public/doctors/${accessToken}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responsePayload = await readOptionalJson<MessageResponse>(res);

      if (res.status === 404) {
        setInvalid(true);
        setDoctor(null);
        toast.error("無効なURLです");
        return;
      }
      if (res.status === 403) {
        const nextError = getResponseMessage(responsePayload, "保存できませんでした（入力期間が終了している、または権限がありません）。");
        setError(nextError);
        toast.error(nextError);
        return;
      }
      if (!res.ok) {
        throw new Error(getResponseMessage(responsePayload, "保存に失敗しました"));
      }
      await fetchDoctor();
      toast.success("保存しました");
    } catch (e) {
      console.error(e);
      const nextError = e instanceof Error ? e.message : "保存に失敗しました。通信状況をご確認ください。";
      setError(nextError);
      toast.error(nextError);
    } finally {
      setIsSaving(false);
    }
  };

  if (invalid) {
    return (
      <div className="rounded-xl border bg-white p-6 text-center shadow-sm">
        <div className="text-lg font-bold text-gray-800">医師情報が見つかりません</div>
        <div className="mt-2 text-sm text-gray-500">URLをご確認ください。</div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-lg font-bold text-gray-800">{title}</div>
            <div className="mt-1 text-xs text-gray-500">先生の休み希望のみ入力できます。</div>
          </div>
        </div>

        {locked && !isLoading && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
            入力期間は終了しています（確認のみ可能です）
          </div>
        )}

        {isLoading ? (
          <div className="mt-6 text-sm text-gray-500">読み込み中...</div>
        ) : (
          <>
            {/* 管理者からの案内メッセージ */}
            {effectiveDoctorMessage && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-800 whitespace-pre-wrap">
                {effectiveDoctorMessage}
              </div>
            )}

            {/* 固定不可曜日 */}
            <section className="mt-5">
              <div className="text-sm font-bold text-gray-700">固定不可曜日</div>
              <div className="mt-1 text-xs text-gray-500">
                毎週決まった曜日に当直できない場合はここで設定してください。
                日曜・祝日は日直/当直を分けて設定できます。
              </div>
              <div className={`mt-2 flex gap-1 ${locked ? "opacity-60 pointer-events-none" : ""}`}>
                {([0, 1, 2, 3, 4, 5, 6, 7] as const).map((pyWd) => {
                  const labels = ["月", "火", "水", "木", "金", "土", "日", "祝"];
                  const entry = fixedWeekdayEntries.find((e) => e.day_of_week === pyWd);
                  const isActive = !!entry;
                  const targetShift = entry?.target_shift ?? null;
                  const isHolidayLike = pyWd === 6 || pyWd === 7;
                  // ボタンラベル: アクティブなら[休]/[日]/[当]を付ける
                  const shiftLabel = targetShift === "all" ? "[休]" : targetShift === "day" ? "[日]" : targetShift === "night" ? "[当]" : "";
                  return (
                    <button
                      key={pyWd}
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        if (locked) return;
                        // 日祝はポップオーバーで日直/当直を選択
                        if (isHolidayLike) {
                          setFixedWeekdayPopover({ weekday: pyWd });
                          return;
                        }
                        // 平日・土曜はトグル
                        setFixedWeekdayEntries((prev) => {
                          if (isActive) return prev.filter((e) => e.day_of_week !== pyWd);
                          return [...prev, { day_of_week: pyWd, target_shift: "all" as const }];
                        });
                      }}
                      className={`flex-1 rounded-lg border py-2 text-center text-xs font-bold transition ${
                        isActive
                          ? pyWd === 6 || pyWd === 7
                            ? "border-red-300 bg-red-100 text-red-700"
                            : pyWd === 5
                              ? "border-blue-300 bg-blue-100 text-blue-700"
                              : "border-red-300 bg-red-100 text-red-700"
                          : pyWd === 6 || pyWd === 7
                            ? "border-red-200 bg-red-50 text-red-400 hover:bg-red-100"
                            : pyWd === 5
                              ? "border-blue-200 bg-blue-50 text-blue-500 hover:bg-blue-100"
                              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {labels[pyWd]}{shiftLabel}
                    </button>
                  );
                })}
              </div>
              <TargetShiftPopover
                open={Boolean(fixedWeekdayPopover)}
                title={fixedWeekdayPopover ? `${["月","火","水","木","金","土","日","祝"][fixedWeekdayPopover.weekday]}曜日の不可設定` : "不可設定"}
                currentValue={fixedWeekdayPopover ? (fixedWeekdayEntries.find((e) => e.day_of_week === fixedWeekdayPopover.weekday)?.target_shift ?? null) : null}
                onSelect={(value) => {
                  if (!fixedWeekdayPopover || locked) return;
                  const wd = fixedWeekdayPopover.weekday;
                  setFixedWeekdayEntries((prev) => {
                    const filtered = prev.filter((e) => e.day_of_week !== wd);
                    if (!value) return filtered;
                    return [...filtered, { day_of_week: wd, target_shift: value }];
                  });
                }}
                onClose={() => setFixedWeekdayPopover(null)}
              />
              <div className="mt-1 text-[10px] text-gray-400">タップで不可 ↔ 解除（日曜・祝日は日直/当直を選択）</div>
            </section>

            <section className="mt-5">
              <div className="text-sm font-bold text-gray-700">個別不可日（カレンダー）</div>
              <div className="mt-1 text-xs text-gray-500">
                平日・土曜は1タップで[休] 終日不可、日曜・祝日は日直/当直を分けて設定できます。
                {locked ? <><br />現在はロック中です。</> : null}
              </div>

              <div className={`mt-4 ${locked ? "opacity-60" : ""}`}>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm sm:p-4">
                  <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-bold">
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-700">[休] = 終日</span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">[日] = 日直のみ</span>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-sky-800">[当] = 当直のみ</span>
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-orange-700">[固] = 固定不可曜日</span>
                  </div>
                  <DayPicker
                    month={month}
                    onMonthChange={setMonth}
                    locale={ja}
                    onDayClick={handleDayClick}
                    navLayout="after"
                    modifiers={calendarModifiers}
                    className={[
                      "w-full",
                      "[--rdp-day-width:2.5rem] [--rdp-day-height:2.5rem]",
                      "[--rdp-day_button-width:2.5rem] [--rdp-day_button-height:2.5rem]",
                      "[--rdp-nav_button-width:2.5rem] [--rdp-nav_button-height:2.5rem]",
                      "[--rdp-months-gap:0px]",
                      "sm:[--rdp-day-width:2.75rem] sm:[--rdp-day-height:2.75rem]",
                      "sm:[--rdp-day_button-width:2.75rem] sm:[--rdp-day_button-height:2.75rem]",
                      "sm:[--rdp-nav_button-width:2.75rem] sm:[--rdp-nav_button-height:2.75rem]",
                    ].join(" ")}
                    classNames={{
                      root: "w-full",
                      months: "block w-full max-w-none",
                      month: "w-full space-y-3 sm:space-y-4",
                      month_caption: "flex min-w-0 items-center justify-center text-center",
                      caption_label: "truncate px-3 text-base font-bold tracking-tight text-slate-900 sm:text-lg",
                      nav: "flex items-center justify-end gap-2",
                      button_previous:
                        "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:pointer-events-none disabled:opacity-40 sm:h-11 sm:w-11",
                      button_next:
                        "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:pointer-events-none disabled:opacity-40 sm:h-11 sm:w-11",
                      chevron: "h-4 w-4 fill-current",
                      month_grid: "w-full table-fixed border-collapse",
                      weekdays: "border-b border-slate-200/80",
                      weekday: "pb-2 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 sm:pb-3 sm:text-xs",
                      week: "border-b border-slate-100 last:border-b-0",
                      day: "p-0 text-center align-middle",
                      day_button:
                        "mx-auto my-1 flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-sm font-medium text-slate-700 transition hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 sm:h-11 sm:w-11 sm:text-[15px]",
                    }}
                    modifiersClassNames={{
                      saturday: "[&>button]:bg-blue-50/70 [&>button]:text-blue-600 hover:[&>button]:bg-blue-100/80",
                      sunday: "[&>button]:bg-red-50/70 [&>button]:text-red-600 hover:[&>button]:bg-red-100/80",
                      holiday: "[&>button]:bg-red-50/70 [&>button]:text-red-600 hover:[&>button]:bg-red-100/80",
                      allUnavailable: unavailableAllModifierClass,
                      dayUnavailable: unavailableDayModifierClass,
                      nightUnavailable: unavailableNightModifierClass,
                      fixedWeekdayAll: fixedWeekdayAllModifierClass,
                      fixedWeekdayDay: fixedWeekdayDayModifierClass,
                      fixedWeekdayNight: fixedWeekdayNightModifierClass,
                      today: "[&>button]:ring-1 [&>button]:ring-indigo-200 [&>button]:font-semibold [&>button]:text-indigo-700",
                      outside: "[&>button]:bg-transparent [&>button]:text-slate-300",
                      disabled: "[&>button]:!bg-transparent [&>button]:!text-slate-300 [&>button]:opacity-45 [&>button]:hover:bg-transparent [&>button]:hover:shadow-none",
                    }}
                  />
                  <TargetShiftPopover
                    open={Boolean(popover)}
                    title={popover ? `${month.getMonth() + 1}月${Number(popover.dateKey.slice(-2))}日の不可設定` : "不可設定"}
                    currentValue={popover ? getUnavailableDateTargetShift(selectedEntriesInDisplayedMonth, popover.dateKey) : null}
                    onSelect={(value) => {
                      if (!popover || locked) return;
                      const existing = getUnavailableDateTargetShift(selectedEntriesInDisplayedMonth, popover.dateKey);
                      if (!existing && value && isAtLimit) return;
                      setSelectedEntries((prev) => setUnavailableDateTargetShift(prev, popover.dateKey, value));
                    }}
                    onClose={() => setPopover(null)}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <span>選択中</span>
                <span className={`text-sm font-bold ${isAtLimit ? "text-red-600" : "text-slate-900"}`}>
                  {unavailableCounts.total}{effectiveUnavailDayLimit !== null && effectiveUnavailDayLimit !== undefined ? `/${effectiveUnavailDayLimit}` : ""}件
                </span>
                <span>終日 {unavailableCounts.all}</span>
                <span className="text-amber-700">日直のみ {unavailableCounts.day}</span>
                <span className="text-sky-700">当直のみ {unavailableCounts.night}</span>
              </div>
              {isAtLimit && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                  不可日の上限（{effectiveUnavailDayLimit}日）に達しています。追加するには既存の不可日を解除してください。
                </div>
              )}
            </section>

            {/* 確定シフト一覧（表示中の月のみ） */}
            {showConfirmedShifts && (() => {
              const monthPrefix = `${displayedYear}-${String(displayedMonthNumber).padStart(2, "0")}`;
              const shiftsInMonth = confirmedShifts.filter((s) => s.date.startsWith(monthPrefix));
              if (shiftsInMonth.length === 0) return null;
              return (
                <section className="mt-6">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
                    <CalendarCheck className="h-4 w-4 text-green-600" />
                    {displayedMonthNumber}月の確定シフト
                  </div>
                  <div className="mt-2 space-y-1">
                    {shiftsInMonth.map((s) => {
                      const d = new Date(s.date + "T00:00:00");
                      const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const isHol = mergedHolidaySet.has(s.date);
                      const label = s.shift_type === "day" ? "日直" : "当直";
                      return (
                        <div key={`${s.date}-${s.shift_type}`}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                            isHol || d.getDay() === 0
                              ? "border-red-100 bg-red-50/50"
                              : d.getDay() === 6
                                ? "border-blue-100 bg-blue-50/50"
                                : "border-gray-100 bg-white"
                          }`}>
                          <span className={`font-medium ${isHol || d.getDay() === 0 ? "text-red-700" : isWeekend ? "text-blue-700" : "text-gray-800"}`}>
                            {d.getMonth() + 1}/{d.getDate()}({weekday})
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            s.shift_type === "day"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <a
                    href={`https://www.google.com/calendar/r?cid=${encodeURIComponent(`${getApiBase()}/api/schedule/ical/${accessToken}?year=${displayedYear}&month=${displayedMonthNumber}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-800 transition hover:bg-green-100"
                  >
                    <Calendar className="h-4 w-4" />{displayedMonthNumber}月のシフトをGoogleカレンダーに登録
                  </a>
                  <Link
                    href={`/view/${accessToken}`}
                    className="mt-2 block w-full rounded-lg border bg-white px-4 py-3 text-center text-sm font-bold text-gray-600 hover:bg-gray-50"
                  >
                    全体の当直表を見る
                  </Link>
                </section>
              );
            })()}

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {/* 保存ボタン（固定フッター） */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/90 backdrop-blur">
        <div className="mx-auto w-full max-w-md p-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving || locked}
            className="w-full rounded-xl bg-emerald-600 py-4 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {locked ? "ロック中（保存不可）" : isSaving ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>
    </>
  );
}
