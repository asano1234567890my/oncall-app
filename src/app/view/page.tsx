"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, FileSpreadsheet, Pencil, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { domToPng } from "modern-screenshot";
import AppHeader from "../components/AppHeader";
import { useCustomHolidays } from "../hooks/useCustomHolidays";
import { useHolidays } from "../hooks/useHolidays";
import { getAuthHeaders, useAuth } from "../hooks/useAuth";
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

export default function ViewSchedulePage() {
  const defaultTargetMonth = getDefaultTargetMonth();
  const [year, setYear] = useState(defaultTargetMonth.year);
  const [month, setMonth] = useState(defaultTargetMonth.month);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [publishedMonths, setPublishedMonths] = useState<Set<string>>(new Set());
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const { auth, logout } = useAuth();
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
    if (customError) return next;
    for (const date of disabledSet) {
      if (date.startsWith(prefix)) next.delete(date);
    }
    for (const date of manualSet) {
      if (date.startsWith(prefix)) next.add(date);
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
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    const fetchPublished = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/settings/published_months`, { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.months)) {
          setPublishedMonths(new Set(data.months as string[]));
        }
      } catch { /* ignore */ }
    };
    void fetchPublished();
    return () => { cancelled = true; };
  }, [auth.isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    const fetchDoctors = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/doctors/`, { cache: "no-store", headers: getAuthHeaders() });
        if (!response.ok) return;
        const data: Doctor[] = await response.json();
        if (!cancelled) setDoctors(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setDoctors([]);
      }
    };
    void fetchDoctors();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchSchedule = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}/api/schedule/${year}/${month}`, { cache: "no-store", headers: getAuthHeaders() });
        if (!response.ok) throw new Error("failed");
        const data: ScheduleRow[] = await response.json();
        if (!cancelled) {
          setSchedule(Array.isArray(data) ? [...data].sort((a, b) => a.day - b.day) : []);
        }
      } catch {
        if (!cancelled) {
          setSchedule([]);
          setError("当直表を読み込めませんでした。");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchSchedule();
    return () => { cancelled = true; };
  }, [month, year]);

  const scheduleColumns = useMemo(() => {
    if (schedule.length === 0) return [];
    const mid = schedule.length <= 28 ? 14 : 15;
    return [schedule.slice(0, mid), schedule.slice(mid)];
  }, [schedule]);

  const handleDownloadImage = async () => {
    if (!tableRef.current || isDownloading || schedule.length === 0) return;
    setIsDownloading(true);
    try {
      const dataUrl = await domToPng(tableRef.current, { scale: 3, backgroundColor: "#ffffff", quality: 1 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `oncall-${year}-${pad2(month)}.png`;
      link.click();
    } catch {
      window.alert("画像の保存に失敗しました。");
    } finally {
      setIsDownloading(false);
    }
  };

  const monthKey = `${year}-${pad2(month)}`;
  const isPublished = publishedMonths.has(monthKey);

  const handleTogglePublish = async () => {
    setIsTogglingPublish(true);
    try {
      const next = new Set(publishedMonths);
      if (isPublished) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      const res = await fetch(`${API_BASE}/api/settings/published_months`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ months: [...next] }),
      });
      if (res.ok) {
        setPublishedMonths(next);
      }
    } catch { /* ignore */ }
    setIsTogglingPublish(false);
  };

  const handleExport = async (format: "pdf" | "xlsx") => {
    if (schedule.length === 0) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/schedule/export/${year}/${month}?format=${format}`,
        { headers: getAuthHeaders() },
      );
      if (!res.ok) throw new Error("failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `oncall_${year}_${pad2(month)}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      window.alert("ダウンロードに失敗しました。");
    }
  };

  const renderColumn = (rows: ScheduleRow[]) => (
    <table className="w-full text-[11px] sm:text-[13px] border-collapse">
      <thead>
        <tr className="border-b-2 border-gray-400 bg-gray-50 text-[10px] sm:text-[11px] text-gray-500">
          <th className="px-1.5 py-1.5 text-left font-medium">日付</th>
          <th className="px-1.5 py-1.5 text-center font-medium border-l border-gray-400">日直</th>
          <th className="px-1.5 py-1.5 text-center font-medium border-l border-gray-400">当直</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-300">
        {rows.map((row) => {
          const weekday = getWeekdayLabel(year, month, row.day);
          const dateKey = toDateKey(year, month, row.day);
          const isSun = weekday === "日";
          const isSat = weekday === "土";
          const isHolidayLike = isSun || Boolean(row.is_sunhol ?? row.is_holiday) || mergedHolidaySet.has(dateKey);
          const showDayShift = isHolidayLike || isSat;
          return (
            <tr key={row.day} className={isHolidayLike ? "bg-red-50/40" : isSat ? "bg-blue-50/40" : ""}>
              <td className={`px-1.5 py-1 font-medium whitespace-nowrap ${isHolidayLike ? "text-red-600" : isSat ? "text-blue-600" : "text-gray-800"}`}>
                {row.day}({weekday})
              </td>
              <td className="px-1.5 py-1 text-center text-gray-700 truncate max-w-[5rem] border-l border-gray-400">
                {showDayShift ? getDoctorLabel(row.day_shift) : ""}
              </td>
              <td className="px-1.5 py-1 text-center text-gray-700 truncate max-w-[5rem] border-l border-gray-400">
                {getDoctorLabel(row.night_shift)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* ── Header ── */}
      {auth.isAuthenticated ? (
        <AppHeader hospitalName={auth.hospitalName} onLogout={logout} />
      ) : (
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-base font-extrabold text-gray-800">シフらく</span>
              <span className="text-sm text-gray-400">当直表</span>
            </div>
            <div className="flex items-center gap-2">
              <a href="/login" className="rounded-md px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">ログイン</a>
              <a href="/register" className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors">新規登録</a>
            </div>
          </div>
        </header>
      )}

      {/* ── Content ── */}
      <main className="mx-auto max-w-3xl px-4 py-4">
        {/* Year/Month selector + actions */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-1.5 text-sm">
            <input
              type="number"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-8 w-[4.5rem] rounded-md border border-gray-300 px-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="年"
            />
            <span className="text-gray-500">年</span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-8 rounded-md border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="月"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {auth.isAuthenticated && schedule.length > 0 && (
              <>
                <Link
                  href={typeof window !== "undefined" && window.innerWidth >= 768 && !("ontouchstart" in window) ? `/dashboard?edit=${year}-${month}` : `/app?edit=${year}-${month}`}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  編集する
                </Link>
                <button
                  onClick={() => { void handleTogglePublish(); }}
                  disabled={isTogglingPublish}
                  className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                    isPublished
                      ? "border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
                      : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  }`}
                >
                  {isPublished ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {isPublished ? "公開中" : "非公開"}
                </button>
              </>
            )}
            <button
              onClick={() => { void handleDownloadImage(); }}
              disabled={isDownloading || schedule.length === 0}
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              {isDownloading ? "保存中..." : "画像"}
            </button>
            {auth.isAuthenticated && schedule.length > 0 && (
              <>
                <button
                  onClick={() => { void handleExport("pdf"); }}
                  className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </button>
                <button
                  onClick={() => { void handleExport("xlsx"); }}
                  className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100 transition-colors"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Schedule table */}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-600">
            {error}
          </div>
        ) : loading ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">
            読み込み中...
          </div>
        ) : schedule.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">
            この月の当直表はまだ保存されていません。
          </div>
        ) : (
          <div ref={tableRef} className="grid grid-cols-2 items-start gap-2">
            {scheduleColumns.map((rows, i) => (
              <div key={i === 0 ? "left" : "right"} className="overflow-hidden rounded-xl border-2 border-gray-400 bg-white shadow-sm">
                {renderColumn(rows)}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
