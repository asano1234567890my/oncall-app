"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { domToPng } from "modern-screenshot";
import { useCustomHolidays } from "../hooks/useCustomHolidays";
import { useHolidays } from "../hooks/useHolidays";
import { getDefaultTargetMonth } from "../utils/dateUtils";

type ScheduleRow = {
  day: number;
  day_shift: string | null;
  night_shift: string | null;
  is_holiday?: boolean;
  is_sunhol?: boolean;
};

type Doctor = {
  id: string;
  name: string;
  is_active?: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

const getWeekdayLabel = (year: number, month: number, day: number) =>
  WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];

const isUuidLike = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const pad2 = (value: number) => String(value).padStart(2, "0");
const toDateKey = (year: number, month: number, day: number) => `${year}-${pad2(month)}-${pad2(day)}`;

const getRowTone = (weekday: string, isHolidayLike: boolean) => {
  if (isHolidayLike) {
    return {
      weekdayClass: "text-red-600",
      rowClass: "bg-red-50",
      labelClass: "text-red-700",
    };
  }

  if (weekday === "土") {
    return {
      weekdayClass: "text-blue-600",
      rowClass: "bg-white",
      labelClass: "text-blue-700",
    };
  }

  return {
    weekdayClass: "text-slate-700",
    rowClass: "bg-white",
    labelClass: "text-slate-600",
  };
};

export default function ViewSchedulePage() {
  const defaultTargetMonth = getDefaultTargetMonth();
  const [year, setYear] = useState(defaultTargetMonth.year);
  const [month, setMonth] = useState(defaultTargetMonth.month);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const { holidaySet: standardHolidaySet } = useHolidays(year);
  const { manualSet, disabledSet, customError } = useCustomHolidays(year);

  const doctorNameById = useMemo(
    () => Object.fromEntries(doctors.map((doctor) => [doctor.id, doctor.name])),
    [doctors],
  );

  const mergedHolidaySet = useMemo(() => {
    const next = new Set<string>(standardHolidaySet);
    const prefix = `${year}-`;

    if (customError) {
      return next;
    }

    for (const date of disabledSet) {
      if (date.startsWith(prefix)) {
        next.delete(date);
      }
    }

    for (const date of manualSet) {
      if (date.startsWith(prefix)) {
        next.add(date);
      }
    }

    return next;
  }, [customError, disabledSet, manualSet, standardHolidaySet, year]);

  const getDoctorLabel = (value: string | null) => {
    if (!value) return "-";
    if (doctorNameById[value]) return doctorNameById[value];
    if (isUuidLike(value)) return "未設定";
    return value;
  };

  useEffect(() => {
    let cancelled = false;

    const fetchDoctors = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/doctors/`, { cache: "no-store" });
        if (!response.ok) return;

        const data: Doctor[] = await response.json();
        if (!cancelled) {
          setDoctors(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setDoctors([]);
        }
      }
    };

    void fetchDoctors();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchSchedule = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/api/schedule/${year}/${month}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("failed_to_fetch_schedule");
        }

        const data: ScheduleRow[] = await response.json();
        if (!cancelled) {
          const nextRows = Array.isArray(data) ? [...data].sort((left, right) => left.day - right.day) : [];
          setSchedule(nextRows);
        }
      } catch (fetchError) {
        console.error(fetchError);
        if (!cancelled) {
          setSchedule([]);
          setError("当直表を読み込めませんでした。時間をおいて再度お試しください。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchSchedule();

    return () => {
      cancelled = true;
    };
  }, [month, year]);

  const scheduleColumns = useMemo(() => {
    if (schedule.length === 0) {
      return [];
    }

    const rowsPerColumn = Math.ceil(schedule.length / 2);
    const left = schedule.slice(0, rowsPerColumn);
    const right = schedule.slice(rowsPerColumn);

    return [left, right];
  }, [schedule]);

  const handleDownloadImage = async () => {
    if (!tableRef.current || isDownloading || schedule.length === 0) return;

    setIsDownloading(true);
    try {
      const dataUrl = await domToPng(tableRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        quality: 1,
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `oncall-${year}-${String(month).padStart(2, "0")}.png`;
      link.click();
    } catch (downloadError) {
      console.error(downloadError);
      window.alert("画像の保存に失敗しました。");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-white text-slate-900">
      <header className="shrink-0 border-b border-slate-300 px-2 py-2">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight text-slate-900 sm:text-base">確定当直表</h1>
            <p className="text-[10px] leading-tight text-slate-500 sm:text-xs">
              保存ボタンを押すと、PNG 画像として保存することができます。
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1 text-[11px] sm:text-xs">
            <input
              type="number"
              inputMode="numeric"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="h-8 w-[4.5rem] border border-slate-300 px-1 text-center outline-none"
              aria-label="年"
            />
            <span className="text-slate-600">年</span>
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="h-8 border border-slate-300 px-1 outline-none"
              aria-label="月"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((monthOption) => (
                <option key={monthOption} value={monthOption}>
                  {monthOption}月
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isDownloading || schedule.length === 0}
              className="h-8 border border-slate-300 px-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {isDownloading ? "保存中" : "保存"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-2 py-2">
        {error ? (
          <div className="flex h-full items-center justify-center border border-red-300 px-3 text-center text-xs text-red-700">
            {error}
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center border border-slate-300 text-xs text-slate-500">
            読み込み中...
          </div>
        ) : schedule.length === 0 ? (
          <div className="flex h-full items-center justify-center border border-slate-300 px-3 text-center text-xs text-slate-500">
            この月の当直表はまだ保存されていません。
          </div>
        ) : (
          <div ref={tableRef} className="flex min-h-0 flex-col border border-slate-300">
            <div className="grid grid-cols-[1fr_auto] border-b border-slate-300 bg-slate-100 px-2 py-1 text-[11px] font-semibold tracking-wide text-slate-700 sm:px-3 sm:py-1.5 sm:text-[13px]">
              <div>{year}年 {month}月</div>
              <div>{schedule.length}日分</div>
            </div>

            <div className="grid grid-cols-2">
              {scheduleColumns.map((rows, columnIndex) => (
                <div
                  key={columnIndex === 0 ? "left" : "right"}
                  className={columnIndex === 0 ? "border-r border-slate-300" : ""}
                  style={{ display: "grid", gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))` }}
                >
                  {rows.map((row) => {
                    const weekday = getWeekdayLabel(year, month, row.day);
                    const dateKey = toDateKey(year, month, row.day);
                    const isHolidayLike =
                      weekday === "日" ||
                      Boolean(row.is_sunhol ?? row.is_holiday) ||
                      mergedHolidaySet.has(dateKey);
                    const { weekdayClass, rowClass, labelClass } = getRowTone(weekday, isHolidayLike);

                    return (
                      <div
                        key={row.day}
                        className={`grid min-h-[2.2rem] h-full grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)] items-center border-b border-slate-300 px-1.5 py-0.5 text-[11px] leading-tight last:border-b-0 sm:min-h-[3rem] sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:px-2 sm:py-1 sm:text-[13px] ${rowClass}`}
                      >
                        <div className={`flex items-center gap-0.5 font-semibold ${weekdayClass}`}>
                          <span className="tabular-nums">{row.day}</span>
                          <span>{weekday}</span>
                        </div>
                        <div className="flex min-w-0 items-center gap-0.5 overflow-hidden">
                          <span className={`shrink-0 font-semibold ${labelClass}`}>日:</span>
                          <span className="truncate">{getDoctorLabel(row.day_shift)}</span>
                        </div>
                        <div className="flex min-w-0 items-center gap-0.5 overflow-hidden">
                          <span className={`shrink-0 font-semibold ${labelClass}`}>当:</span>
                          <span className="truncate">{getDoctorLabel(row.night_shift)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
