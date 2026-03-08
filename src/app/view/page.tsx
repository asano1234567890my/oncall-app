"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { domToPng } from "modern-screenshot";
import { getDefaultTargetMonth } from "../utils/dateUtils";

type ScheduleRow = {
  day: number;
  day_shift: string | null;
  night_shift: string | null;
  is_holiday?: boolean;
};

type Doctor = {
  id: string;
  name: string;
  is_active?: boolean;
};

const getApiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function getWeekdayLabel(year: number, month: number, day: number) {
  return ["日", "月", "火", "水", "木", "金", "土"][new Date(year, month - 1, day).getDay()];
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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

  const doctorNameById = useMemo(
    () => Object.fromEntries(doctors.map((doctor) => [doctor.id, doctor.name])),
    [doctors],
  );

  const getDoctorLabel = (value: string | null) => {
    if (!value) return "";
    if (doctorNameById[value]) return doctorNameById[value];
    return isUuidLike(value) ? "未設定の医師" : value.split(/[\s　]+/)[0];
  };

  useEffect(() => {
    let cancelled = false;

    const fetchDoctors = async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/doctors/`, { cache: "no-store" });
        if (!res.ok) return;

        const data: Doctor[] = await res.json();
        if (!cancelled) {
          setDoctors(data);
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
        const res = await fetch(`${getApiBase()}/api/schedule/${year}/${month}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("勤務表の取得に失敗しました");
        }

        const data: ScheduleRow[] = await res.json();
        if (!cancelled) {
          setSchedule(Array.isArray(data) ? data : []);
        }
      } catch (fetchError) {
        console.error(fetchError);
        if (!cancelled) {
          setSchedule([]);
          setError("勤務表を読み込めませんでした。時間をおいて再度お試しください。");
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
  }, [year, month]);

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
      link.download = `当直表_${year}年${month}月.png`;
      link.click();
    } catch (downloadError) {
      console.error(downloadError);
      alert("画像の保存に失敗しました");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 md:px-6 md:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:mb-6 md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800 md:text-2xl">勤務カレンダー</h1>
              <p className="mt-1 text-sm text-slate-500">公開中の勤務表を確認し、そのまま画像として保存できます。</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-sm font-bold text-slate-800"
                />
                <span className="text-sm text-slate-600">年</span>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-bold text-slate-800"
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((monthOption) => (
                    <option key={monthOption} value={monthOption}>
                      {monthOption}月
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isDownloading || schedule.length === 0}
                className="min-h-11 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDownloading ? "画像を準備中..." : "画像を保存"}
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-500 shadow-sm">
            勤務表を読み込み中...
          </div>
        ) : schedule.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-400 shadow-sm">
            この月の勤務表はまだ保存されていません。
          </div>
        ) : (
          <div ref={tableRef} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 text-center">
              <div className="text-lg font-bold text-slate-800">{year}年 {month}月 当直表</div>
              <div className="mt-1 text-xs text-slate-500">日直・当直ともに医師名で表示します。</div>
            </div>

            <div className="md:hidden">
              <div className="divide-y divide-slate-100">
                {schedule.map((row) => {
                  const weekday = getWeekdayLabel(year, month, row.day);
                  const isSunday = weekday === "日";
                  const isSaturday = weekday === "土";
                  const badgeClass = isSunday || row.is_holiday ? "text-red-600" : isSaturday ? "text-blue-600" : "text-slate-600";

                  return (
                    <div key={row.day} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-bold text-slate-800">{row.day}日</div>
                        <div className={`text-sm font-bold ${badgeClass}`}>{weekday}</div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2">
                        <div className="rounded-xl bg-orange-50 px-3 py-2">
                          <div className="text-[11px] font-bold text-orange-700">日直</div>
                          <div className="mt-1 text-sm font-semibold text-orange-900">{getDoctorLabel(row.day_shift) || "-"}</div>
                        </div>
                        <div className="rounded-xl bg-indigo-50 px-3 py-2">
                          <div className="text-[11px] font-bold text-indigo-700">当直</div>
                          <div className="mt-1 text-sm font-semibold text-indigo-900">{getDoctorLabel(row.night_shift) || "-"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="w-24 px-4 py-3 text-center font-semibold">日付</th>
                    <th className="px-4 py-3 font-semibold text-orange-100">日直</th>
                    <th className="px-4 py-3 font-semibold text-indigo-100">当直</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row) => {
                    const weekday = getWeekdayLabel(year, month, row.day);
                    const isSunday = weekday === "日";
                    const isSaturday = weekday === "土";
                    const weekdayClass = isSunday || row.is_holiday ? "text-red-500" : isSaturday ? "text-blue-500" : "text-slate-600";

                    return (
                      <tr key={row.day} className="border-b border-slate-100">
                        <td className={`px-4 py-3 text-center font-semibold ${weekdayClass}`}>
                          {row.day}日 <span className="text-xs">({weekday})</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex min-w-24 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">
                            {getDoctorLabel(row.day_shift) || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex min-w-24 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800">
                            {getDoctorLabel(row.night_shift) || "-"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}