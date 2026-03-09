// src/app/entry/[token]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { useCustomHolidays } from "../../hooks/useCustomHolidays";
import { useHolidays } from "../../hooks/useHolidays";
import "react-day-picker/dist/style.css";

type UnavailableDay = {
  date: string | null;
  day_of_week: number | null;
  is_fixed: boolean;
};

type PublicDoctor = {
  name: string;
  is_locked?: boolean;
  unavailable_dates?: string[];
  unavailable_days?: UnavailableDay[];
  fixed_weekdays?: number[];
};

const getApiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

function uniqSort(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

function toSelectedFromDoctor(data: PublicDoctor): string[] {
  if (Array.isArray(data.unavailable_dates) && data.unavailable_dates.length > 0) {
    return uniqSort(data.unavailable_dates);
  }
  if (Array.isArray(data.unavailable_days)) {
    const dates = data.unavailable_days
      .filter((u) => u && u.is_fixed === false && typeof u.date === "string" && u.date)
      .map((u) => String(u.date));
    return uniqSort(dates);
  }
  return [];
}

export default function EntryPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const router = useRouter();

  const [doctor, setDoctor] = useState<PublicDoctor | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const selectedDates = useMemo(() => {
    const list = Array.from(selectedSet).map((s) => {
      try {
        return parseISO(s);
      } catch {
        return null;
      }
    });
    return list.filter(Boolean) as Date[];
  }, [selectedSet]);

  const [month, setMonth] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const locked = Boolean(doctor?.is_locked);
  const displayedYear = month.getFullYear();
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

  const calendarModifiers = useMemo(
    () => ({
      saturday: (day: Date) => day.getDay() === 6,
      sunday: (day: Date) => day.getDay() === 0,
      holiday: (day: Date) => mergedHolidaySet.has(ymd(day)),
    }),
    [mergedHolidaySet]
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
      setDoctor(data);

      const selected = toSelectedFromDoctor(data);
      setSelectedSet(new Set(selected));

      if (selected.length > 0) {
        try {
          setMonth(parseISO(selected[0]));
        } catch {
          // ignore
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
  }, [token]);

  const onDayClick = (day: Date) => {
    if (locked) return;

    const key = ymd(day);
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!token) return;
    if (locked) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        unavailable_dates: uniqSort(Array.from(selectedSet)),
        fixed_weekdays: doctor?.fixed_weekdays ?? [],
      };

      const res = await fetch(`${getApiBase()}/api/public/doctors/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 404) {
        setInvalid(true);
        setDoctor(null);
        return;
      }
      if (res.status === 403) {
        setError("保存できませんでした（入力期間が終了している、または権限がありません）。");
        return;
      }
      if (!res.ok) throw new Error("保存に失敗しました");

      setMessage("保存しました");
      await fetchDoctor();
    } catch (e) {
      console.error(e);
      setError("保存に失敗しました。通信状況をご確認ください。");
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

          <div className="mt-4">
            <Link
              href="/view"
              className="block w-full rounded-lg border bg-white px-4 py-3 text-center text-sm font-bold text-gray-800 hover:bg-gray-50"
            >
              📅 確定した当直表を見る
            </Link>
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
                  日付をタップして選択/解除できます。<br />
                  前提条件として研究日とその前日は当直には入りません。<br />
                  外来日前日は当直に含まれるため、ご自身で不可日指定をお願いします。
                  {locked ? <><br />現在はロック中です。</> : null}
                </div>

                <div className={`mt-4 ${locked ? "opacity-75" : ""}`}>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm sm:p-4">
                    <DayPicker
                      mode="multiple"
                      month={month}
                      onMonthChange={setMonth}
                      selected={selectedDates}
                      onDayClick={onDayClick}
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
                        selected:
                          "[&>button]:!border-indigo-600 [&>button]:!bg-indigo-600 [&>button]:!text-white [&>button]:shadow-sm hover:[&>button]:!bg-indigo-700",
                        today:
                          "[&>button]:ring-1 [&>button]:ring-indigo-200 [&>button]:font-semibold [&>button]:text-indigo-700",
                        outside: "[&>button]:bg-transparent [&>button]:text-slate-300",
                        disabled:
                          "[&>button]:!bg-transparent [&>button]:!text-slate-300 [&>button]:opacity-45 [&>button]:hover:bg-transparent [&>button]:hover:shadow-none",
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <span>選択中の日数</span>
                  <span className="text-sm font-bold text-slate-900">{selectedSet.size}日</span>
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