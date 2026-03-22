// src/app/entry/[token]/page.tsx
"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useParams, useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { ja } from "react-day-picker/locale";
import { format } from "date-fns";
import TargetShiftPopover from "../../components/TargetShiftPopover";
import type {
  FixedUnavailableWeekdayEntry,
  UnavailableDateEntry,
  UnavailableDayRecord,
} from "../../types/dashboard";
import {
  filterUnavailableDateEntriesByMonth,
  getUnavailableDateTargetShift,
  isUnavailableDateInMonth,
  normalizeFixedUnavailableWeekdayEntries,
  normalizeUnavailableDateEntries,
  setUnavailableDateTargetShift,
} from "../../utils/unavailableSettings";
import { useCustomHolidays } from "../../hooks/useCustomHolidays";
import { useHolidays } from "../../hooks/useHolidays";
import "react-day-picker/dist/style.css";

type PublicDoctor = {
  name: string;
  is_locked?: boolean;
  unavailable_dates?: string[];
  unavailable_days?: UnavailableDayRecord[];
  fixed_weekdays?: FixedUnavailableWeekdayEntry[];
};

const getApiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const getNextMonthDate = (baseDate = new Date()) =>
  new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);

type MessageResponse = {
  detail?: string;
  message?: string;
};

const readOptionalJson = async <T,>(response: Response): Promise<T | null> => {
  const body = await response.text();

  if (!body.trim()) {
    return null;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
};

const getResponseMessage = (payload: MessageResponse | null, fallback: string) =>
  payload?.message || payload?.detail || fallback;

const unavailableAllModifierClass =
  "[&>button]:relative [&>button]:!border-red-400 [&>button]:!bg-red-300 [&>button]:!text-transparent [&>button]:shadow-sm hover:[&>button]:!bg-red-400 [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[11px] [&>button]:after:font-bold [&>button]:after:text-red-900 [&>button]:after:content-['[休]']";

const unavailableDayModifierClass =
  "[&>button]:relative [&>button]:border-red-300 [&>button]:text-transparent [&>button]:bg-[linear-gradient(135deg,#fecaca_0%,#fecaca_50%,transparent_50%,transparent_100%)] [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[11px] [&>button]:after:font-bold [&>button]:after:text-red-800 [&>button]:after:content-['[日]']";

const unavailableNightModifierClass =
  "[&>button]:relative [&>button]:border-red-300 [&>button]:text-transparent [&>button]:bg-[linear-gradient(135deg,transparent_0%,transparent_50%,#fecaca_50%,#fecaca_100%)] [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[11px] [&>button]:after:font-bold [&>button]:after:text-red-800 [&>button]:after:content-['[当]']";

function toUnavailableEntriesFromDoctor(data: PublicDoctor): UnavailableDateEntry[] {
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

function toFixedWeekdayEntriesFromDoctor(data: PublicDoctor): FixedUnavailableWeekdayEntry[] {
  const structuredEntries = Array.isArray(data.unavailable_days)
    ? data.unavailable_days.flatMap((entry) => {
        if (!entry || entry.is_fixed !== true) return [];

        const rawDayOfWeek = entry.day_of_week ?? entry.weekday;
        const dayOfWeek = Number(rawDayOfWeek);
        if (!Number.isFinite(dayOfWeek)) return [];

        return [
          {
            day_of_week: dayOfWeek,
            target_shift: entry.target_shift ?? "all",
          },
        ];
      })
    : [];

  return normalizeFixedUnavailableWeekdayEntries([...(data.fixed_weekdays ?? []), ...structuredEntries]);
}

export default function EntryPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const router = useRouter();

  const [doctor, setDoctor] = useState<PublicDoctor | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<UnavailableDateEntry[]>([]);
  const [month, setMonth] = useState<Date>(() => getNextMonthDate());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [popover, setPopover] = useState<{ dateKey: string } | null>(null);

  const locked = Boolean(doctor?.is_locked);
  const displayedYear = month.getFullYear();
  const displayedMonthNumber = month.getMonth() + 1;
  const { holidaySet: standardHolidaySet } = useHolidays(displayedYear);
  const { manualSet, disabledSet, customError } = useCustomHolidays(displayedYear);

  const mergedHolidaySet = useMemo(() => {
    const next = new Set<string>(standardHolidaySet);
    const prefix = `${displayedYear}-`;

    if (customError) {
      return next;
    }

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
    }),
    [mergedHolidaySet, selectedEntriesInDisplayedMonth]
  );

  const title = useMemo(() => {
    if (!doctor) return "休み希望入力";
    return `${doctor.name} 先生の休み希望入力`;
  }, [doctor]);

  const fetchDoctor = async () => {
    if (!token) return;

    setIsLoading(true);
    setInvalid(false);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`${getApiBase()}/api/public/doctors/${token}`, { cache: "no-store" });

      if (res.status === 404) {
        setInvalid(true);
        setDoctor(null);
        return;
      }
      if (!res.ok) throw new Error("取得に失敗しました");

      const data: PublicDoctor = await res.json();
      const normalizedDoctor: PublicDoctor = {
        ...data,
        fixed_weekdays: toFixedWeekdayEntriesFromDoctor(data),
      };
      setDoctor(normalizedDoctor);

      const selected = toUnavailableEntriesFromDoctor(normalizedDoctor);
      setSelectedEntries(selected);

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
  }, [token]);

  useEffect(() => {
    setPopover(null);
  }, [month]);

  const isHolidayLikeDate = (date: Date) => date.getDay() === 0 || mergedHolidaySet.has(ymd(date));

  const handleDayClick = (day: Date) => {
    if (locked) return;

    const dateKey = ymd(day);
    if (!isUnavailableDateInMonth(dateKey, displayedYear, displayedMonthNumber)) return;

    if (isHolidayLikeDate(day)) {
      setPopover({ dateKey });
      return;
    }

    setSelectedEntries((prev) => {
      const currentValue = getUnavailableDateTargetShift(prev, dateKey);
      return setUnavailableDateTargetShift(prev, dateKey, currentValue ? null : "all");
    });
  };

  const handleSave = async () => {
    if (!token || locked) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const unavailableDays = filterUnavailableDateEntriesByMonth(
        selectedEntries,
        displayedYear,
        displayedMonthNumber
      ).map((entry) => ({
        date: entry.date,
        target_shift: entry.target_shift,
      }));

      const payload = {
        unavailable_days: unavailableDays,
        fixed_weekdays: doctor?.fixed_weekdays ?? [],
        unavailable_year: displayedYear,
        unavailable_month: displayedMonthNumber,
      };

      const res = await fetch(`${getApiBase()}/api/public/doctors/${token}`, {
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
        const nextError = getResponseMessage(
          responsePayload,
          "保存できませんでした（入力期間が終了している、または権限がありません）。"
        );
        setError(nextError);
        toast.error(nextError);
        return;
      }
      if (!res.ok) {
        throw new Error(getResponseMessage(responsePayload, "保存に失敗しました"));
      }

      await fetchDoctor();
      setMessage("保存しました");
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="mx-auto w-full max-w-md rounded-xl border bg-white p-6 text-center shadow-sm">
          <div className="text-lg font-bold text-gray-800">無効なURLです</div>
          <div className="mt-2 text-sm text-gray-500">URLをご確認ください。</div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 w-full rounded-lg bg-gray-900 py-3 font-bold text-white"
          >
            ← 戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto w-full max-w-md p-4 pb-28">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-lg font-bold text-gray-800">{title}</div>
              <div className="mt-1 text-xs text-gray-500">先生の休み希望のみ入力できます。</div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Link
              href="/view"
              className="block w-full rounded-lg border bg-white px-4 py-3 text-center text-sm font-bold text-gray-800 hover:bg-gray-50"
            >
              <Calendar className="inline h-4 w-4 mr-1 align-middle" />確定した当直表を見る
            </Link>
            <button
              type="button"
              onClick={() => {
                const apiBase = getApiBase();
                const icalUrl = `${apiBase}/api/schedule/ical/${token}`;
                void navigator.clipboard.writeText(icalUrl);
                toast.success("カレンダーURLをコピーしました。Googleカレンダーの「URLで追加」に貼り付けてください。");
              }}
              className="block w-full rounded-lg border bg-white px-4 py-3 text-center text-sm font-bold text-gray-800 hover:bg-gray-50"
            >
              <Calendar className="inline h-4 w-4 mr-1 align-middle" />Googleカレンダーに登録
            </button>
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
              <section className="mt-6">
                <div className="text-sm font-bold text-gray-700">個別不可日（カレンダー）</div>
                <div className="mt-1 text-xs text-gray-500">
                  平日・土曜は1タップで[休] 終日不可、日曜・祝日は日直/当直を分けて設定できます。<br />
                  前提条件として研究日とその前日は当直には入りません。<br />
                  外来日前日は当直に含まれるため、ご自身で不可日指定をお願いします。
                  {locked ? (
                    <>
                      <br />現在はロック中です。
                    </>
                  ) : null}
                </div>

                <div className={`mt-4 ${locked ? "opacity-75" : ""}`}>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm sm:p-4">
                    <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-bold">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-700">[休] = 終日</span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">[日] = 日直のみ</span>
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-sky-800">[当] = 当直のみ</span>
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
                        saturday:
                          "[&>button]:bg-blue-50/70 [&>button]:text-blue-600 hover:[&>button]:bg-blue-100/80",
                        sunday:
                          "[&>button]:bg-red-50/70 [&>button]:text-red-600 hover:[&>button]:bg-red-100/80",
                        holiday:
                          "[&>button]:bg-red-50/70 [&>button]:text-red-600 hover:[&>button]:bg-red-100/80",
                        allUnavailable:
                          unavailableAllModifierClass,
                        dayUnavailable:
                          unavailableDayModifierClass,
                        nightUnavailable:
                          unavailableNightModifierClass,
                        today:
                          "[&>button]:ring-1 [&>button]:ring-indigo-200 [&>button]:font-semibold [&>button]:text-indigo-700",
                        outside: "[&>button]:bg-transparent [&>button]:text-slate-300",
                        disabled:
                          "[&>button]:!bg-transparent [&>button]:!text-slate-300 [&>button]:opacity-45 [&>button]:hover:bg-transparent [&>button]:hover:shadow-none",
                      }}
                    />
                    <TargetShiftPopover
                      open={Boolean(popover)}
                      title={popover ? `${month.getMonth() + 1}月${Number(popover.dateKey.slice(-2))}日の不可設定` : "不可設定"}
                      currentValue={popover ? getUnavailableDateTargetShift(selectedEntriesInDisplayedMonth, popover.dateKey) : null}
                      onSelect={(value) => {
                        if (!popover) return;
                        setSelectedEntries((prev) => setUnavailableDateTargetShift(prev, popover.dateKey, value));
                      }}
                      onClose={() => setPopover(null)}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <span>選択中</span>
                  <span className="text-sm font-bold text-slate-900">{unavailableCounts.total}件</span>
                  <span>終日 {unavailableCounts.all}</span>
                  <span className="text-amber-700">日直のみ {unavailableCounts.day}</span>
                  <span className="text-sky-700">当直のみ {unavailableCounts.night}</span>
                </div>
              </section>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
                  {error}
                </div>
              )}

              {message && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                  {message}
                </div>
              )}
            </>
          )}
        </div>
      </main>

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
    </div>
  );
}

