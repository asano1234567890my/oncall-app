"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, User, ChevronLeft, ChevronRight } from "lucide-react";
import AppHeader from "../components/AppHeader";
import { getAuthHeaders, useAuth } from "../hooks/useAuth";
import { useHolidays } from "../hooks/useHolidays";
import { useCustomHolidays } from "../hooks/useCustomHolidays";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const MONTH_LABELS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const WEEKDAY_LABELS = ["日","月","火","水","木","金","土"] as const;

type DoctorInfo = { id: string; name: string };
type ShiftEntry = { date: string; doctor_id: string; shift_type: string };
type StatsData = { doctors: DoctorInfo[]; shifts: ShiftEntry[]; holidays: string[] };

// ── Helpers ──

const pad2 = (n: number) => String(n).padStart(2, "0");

function isSaturdayDate(dateStr: string) {
  return new Date(dateStr).getDay() === 6;
}

function isSundayOrHoliday(dateStr: string, holidaySet: Set<string>) {
  const d = new Date(dateStr);
  return d.getDay() === 0 || holidaySet.has(dateStr);
}

function getWeekday(year: number, month: number, day: number) {
  return WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];
}

// ── Main component ──

export default function ReportPage() {
  const { auth, logout } = useAuth();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [tab, setTab] = useState<"overview" | "doctor">("overview");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const { holidaySet: standardHolidaySet } = useHolidays(year);
  const { manualSet, disabledSet, customError } = useCustomHolidays(year);

  const mergedHolidaySet = useMemo(() => {
    const s = new Set<string>(standardHolidaySet);
    if (customError) return s;
    for (const d of disabledSet) s.delete(d);
    for (const d of manualSet) s.add(d);
    return s;
  }, [standardHolidaySet, manualSet, disabledSet, customError]);

  // Merge API holidays + custom holidays
  const holidaySet = useMemo(() => {
    const s = new Set(mergedHolidaySet);
    if (data) for (const h of data.holidays) s.add(h);
    return s;
  }, [mergedHolidaySet, data]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/schedule/stats?year=${year}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error();
        const d: StatsData = await res.json();
        if (!cancelled) {
          setData(d);
          if (!selectedDoctorId && d.doctors.length > 0) setSelectedDoctorId(d.doctors[0].id);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [auth.isAuthenticated, year]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ──

  const doctorMap = useMemo(() => {
    if (!data) return new Map<string, string>();
    return new Map(data.doctors.map(d => [d.id, d.name]));
  }, [data]);

  // Per-doctor per-month counts
  const monthlyCounts = useMemo(() => {
    if (!data) return new Map<string, { night: number[]; day: number[]; satNight: number[]; sunholNight: number[] }>();
    const map = new Map<string, { night: number[]; day: number[]; satNight: number[]; sunholNight: number[] }>();
    for (const doc of data.doctors) {
      map.set(doc.id, {
        night: Array(12).fill(0) as number[],
        day: Array(12).fill(0) as number[],
        satNight: Array(12).fill(0) as number[],
        sunholNight: Array(12).fill(0) as number[],
      });
    }
    for (const s of data.shifts) {
      const entry = map.get(s.doctor_id);
      if (!entry) continue;
      const m = parseInt(s.date.substring(5, 7), 10) - 1;
      if (s.shift_type === "night") {
        entry.night[m]++;
        if (isSaturdayDate(s.date)) entry.satNight[m]++;
        if (isSundayOrHoliday(s.date, holidaySet)) entry.sunholNight[m]++;
      } else {
        entry.day[m]++;
      }
    }
    return map;
  }, [data, holidaySet]);

  // Doctor shifts for selected month (calendar)
  const doctorMonthShifts = useMemo(() => {
    if (!data || !selectedDoctorId) return new Map<number, { day: boolean; night: boolean }>();
    const prefix = `${year}-${pad2(selectedMonth)}`;
    const map = new Map<number, { day: boolean; night: boolean }>();
    for (const s of data.shifts) {
      if (s.doctor_id !== selectedDoctorId || !s.date.startsWith(prefix)) continue;
      const dayNum = parseInt(s.date.substring(8, 10), 10);
      const existing = map.get(dayNum) || { day: false, night: false };
      if (s.shift_type === "night") existing.night = true;
      else existing.day = true;
      map.set(dayNum, existing);
    }
    return map;
  }, [data, selectedDoctorId, selectedMonth, year]);

  // Average interval for selected doctor
  const avgInterval = useMemo(() => {
    if (!data || !selectedDoctorId) return null;
    const dates = data.shifts
      .filter(s => s.doctor_id === selectedDoctorId && s.shift_type === "night")
      .map(s => new Date(s.date).getTime())
      .sort((a, b) => a - b);
    if (dates.length < 2) return null;
    let totalGap = 0;
    for (let i = 1; i < dates.length; i++) totalGap += (dates[i] - dates[i - 1]) / 86400000;
    return (totalGap / (dates.length - 1)).toFixed(1);
  }, [data, selectedDoctorId]);

  const selectedDoctor = data?.doctors.find(d => d.id === selectedDoctorId);
  const daysInMonth = new Date(year, selectedMonth, 0).getDate();

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">ログインが必要です</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <AppHeader hospitalName={auth.hospitalName} onLogout={logout} />

      <main className="mx-auto max-w-5xl px-4 py-4">
        {/* Year selector + tabs */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setYear(y => y - 1)} className="rounded p-1 hover:bg-gray-200"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-lg font-bold text-gray-800 min-w-[4rem] text-center">{year}年</span>
            <button onClick={() => setYear(y => y + 1)} className="rounded p-1 hover:bg-gray-200"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setTab("overview")}
              className={`flex items-center gap-1 px-4 py-1.5 text-sm font-bold transition-colors ${tab === "overview" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              全体
            </button>
            <button
              onClick={() => setTab("doctor")}
              className={`flex items-center gap-1 px-4 py-1.5 text-sm font-bold transition-colors ${tab === "doctor" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <User className="h-3.5 w-3.5" />
              各医師
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">読み込み中...</div>
        ) : !data || data.doctors.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">データがありません</div>
        ) : tab === "overview" ? (
          <OverviewTab data={data} monthlyCounts={monthlyCounts} doctorMap={doctorMap} holidaySet={holidaySet} year={year} />
        ) : (
          <DoctorTab
            data={data}
            selectedDoctorId={selectedDoctorId}
            setSelectedDoctorId={setSelectedDoctorId}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            selectedDoctor={selectedDoctor}
            doctorMonthShifts={doctorMonthShifts}
            monthlyCounts={monthlyCounts}
            holidaySet={holidaySet}
            avgInterval={avgInterval}
            year={year}
            daysInMonth={daysInMonth}
          />
        )}
      </main>
    </div>
  );
}

// ── 全体タブ ──

function OverviewTab({
  data, monthlyCounts, doctorMap, holidaySet, year,
}: {
  data: StatsData;
  monthlyCounts: Map<string, { night: number[]; day: number[]; satNight: number[]; sunholNight: number[] }>;
  doctorMap: Map<string, string>;
  holidaySet: Set<string>;
  year: number;
}) {
  const [subTab, setSubTab] = useState<"night" | "satNight" | "sunholNight">("night");

  const label = subTab === "night" ? "当直回数" : subTab === "satNight" ? "土曜当直" : "日祝当直";

  return (
    <div className="space-y-4">
      {/* Sub-tab selector */}
      <div className="flex gap-1">
        {([["night", "当直回数"], ["satNight", "土曜当直"], ["sunholNight", "日祝当直"]] as const).map(([key, lbl]) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${subTab === key ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-bold border-b border-r border-gray-200 min-w-[6rem]">医師名</th>
              {MONTH_LABELS.map((m, i) => (
                <th key={i} className="px-2 py-2 text-center font-medium border-b border-gray-200 min-w-[2.5rem]">{m}</th>
              ))}
              <th className="px-3 py-2 text-center font-bold border-b border-l-2 border-gray-300 min-w-[3rem] bg-gray-100">合計</th>
            </tr>
          </thead>
          <tbody>
            {data.doctors.map((doc, di) => {
              const counts = monthlyCounts.get(doc.id);
              if (!counts) return null;
              const vals = counts[subTab];
              const total = vals.reduce((a, b) => a + b, 0);
              return (
                <tr key={doc.id} className={di % 2 === 0 ? "" : "bg-gray-50/50"}>
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-gray-800 border-r border-gray-200 whitespace-nowrap">{doc.name}</td>
                  {vals.map((v, mi) => (
                    <td key={mi} className={`px-2 py-1.5 text-center ${v === 0 ? "text-gray-300" : "text-gray-800 font-medium"}`}>
                      {v || "-"}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-center font-bold text-gray-800 border-l-2 border-gray-300 bg-gray-50">
                    {total}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Totals row */}
          <tfoot>
            <tr className="bg-gray-100 border-t-2 border-gray-300">
              <td className="sticky left-0 z-10 bg-gray-100 px-3 py-1.5 font-bold text-gray-600 border-r border-gray-200">合計</td>
              {Array.from({ length: 12 }, (_, mi) => {
                const total = data.doctors.reduce((sum, doc) => {
                  const c = monthlyCounts.get(doc.id);
                  return sum + (c ? c[subTab][mi] : 0);
                }, 0);
                return (
                  <td key={mi} className={`px-2 py-1.5 text-center font-bold ${total === 0 ? "text-gray-300" : "text-gray-700"}`}>
                    {total || "-"}
                  </td>
                );
              })}
              <td className="px-3 py-1.5 text-center font-bold text-gray-800 border-l-2 border-gray-300">
                {data.doctors.reduce((sum, doc) => {
                  const c = monthlyCounts.get(doc.id);
                  return sum + (c ? c[subTab].reduce((a, b) => a + b, 0) : 0);
                }, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── 各医師タブ ──

function DoctorTab({
  data, selectedDoctorId, setSelectedDoctorId, selectedMonth, setSelectedMonth,
  selectedDoctor, doctorMonthShifts, monthlyCounts, holidaySet, avgInterval,
  year, daysInMonth,
}: {
  data: StatsData;
  selectedDoctorId: string;
  setSelectedDoctorId: (id: string) => void;
  selectedMonth: number;
  setSelectedMonth: (m: number) => void;
  selectedDoctor: DoctorInfo | undefined;
  doctorMonthShifts: Map<number, { day: boolean; night: boolean }>;
  monthlyCounts: Map<string, { night: number[]; day: number[]; satNight: number[]; sunholNight: number[] }>;
  holidaySet: Set<string>;
  avgInterval: string | null;
  year: number;
  daysInMonth: number;
}) {
  const counts = monthlyCounts.get(selectedDoctorId);
  const yearTotalNight = counts ? counts.night.reduce((a, b) => a + b, 0) : 0;
  const yearTotalDay = counts ? counts.day.reduce((a, b) => a + b, 0) : 0;
  const yearTotalSat = counts ? counts.satNight.reduce((a, b) => a + b, 0) : 0;
  const yearTotalSunhol = counts ? counts.sunholNight.reduce((a, b) => a + b, 0) : 0;

  // Calendar 2-column split
  const mid = daysInMonth <= 28 ? 14 : 15;
  const leftDays = Array.from({ length: mid }, (_, i) => i + 1);
  const rightDays = Array.from({ length: daysInMonth - mid }, (_, i) => mid + i + 1);

  const renderCalendarColumn = (days: number[]) => (
    <table className="w-full text-xs sm:text-[13px] border-collapse">
      <thead>
        <tr className="border-b-2 border-gray-400 bg-gray-50 text-[10px] sm:text-[11px] text-gray-500">
          <th className="px-1.5 py-1.5 text-left font-medium">日付</th>
          <th className="px-1.5 py-1.5 text-center font-medium border-l border-gray-400">日直</th>
          <th className="px-1.5 py-1.5 text-center font-medium border-l border-gray-400">当直</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-300">
        {days.map(day => {
          const wd = getWeekday(year, selectedMonth, day);
          const dateKey = `${year}-${pad2(selectedMonth)}-${pad2(day)}`;
          const isSun = wd === "日";
          const isSat = wd === "土";
          const isHol = isSun || holidaySet.has(dateKey);
          const shift = doctorMonthShifts.get(day);
          const hasDay = shift?.day ?? false;
          const hasNight = shift?.night ?? false;

          return (
            <tr key={day} className={isHol ? "bg-red-50/40" : isSat ? "bg-blue-50/40" : ""}>
              <td className={`px-1.5 py-1 font-medium whitespace-nowrap ${isHol ? "text-red-600" : isSat ? "text-blue-600" : "text-gray-800"}`}>
                {day}({wd})
              </td>
              <td className="px-1.5 py-1 text-center border-l border-gray-400">
                {hasDay ? <span className="inline-block rounded bg-orange-100 px-1.5 py-0.5 text-orange-700 font-bold text-[11px]">日直</span> : ""}
              </td>
              <td className="px-1.5 py-1 text-center border-l border-gray-400">
                {hasNight ? <span className="inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700 font-bold text-[11px]">当直</span> : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left: Calendar */}
      <div className="flex-1 min-w-0">
        {/* Doctor + Month selectors */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={selectedDoctorId}
            onChange={e => setSelectedDoctorId(e.target.value)}
            className="h-8 rounded-md border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {data.doctors.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button onClick={() => setSelectedMonth(Math.max(1, selectedMonth - 1))} className="rounded p-1 hover:bg-gray-200"><ChevronLeft className="h-4 w-4" /></button>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="h-8 rounded-md border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTH_LABELS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <button onClick={() => setSelectedMonth(Math.min(12, selectedMonth + 1))} className="rounded p-1 hover:bg-gray-200"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        {/* 2-column calendar */}
        <div className="grid grid-cols-2 gap-2">
          <div className="overflow-hidden rounded-xl border-2 border-gray-400 bg-white shadow-sm">
            {renderCalendarColumn(leftDays)}
          </div>
          <div className="overflow-hidden rounded-xl border-2 border-gray-400 bg-white shadow-sm">
            {renderCalendarColumn(rightDays)}
          </div>
        </div>
      </div>

      {/* Right: Sidebar stats */}
      <div className="lg:w-72 space-y-3">
        {/* Year summary card */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-3">{year}年 年間集計</h3>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="当直" value={yearTotalNight} color="indigo" />
            <StatCard label="日直" value={yearTotalDay} color="orange" />
            <StatCard label="土曜当直" value={yearTotalSat} color="blue" />
            <StatCard label="日祝当直" value={yearTotalSunhol} color="red" />
          </div>
          {avgInterval && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">平均当直間隔</p>
              <p className="text-lg font-bold text-gray-800">{avgInterval}<span className="text-xs font-normal text-gray-500 ml-1">日に1回</span></p>
            </div>
          )}
        </div>

        {/* Monthly breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-3">月別当直回数</h3>
          <div className="space-y-1">
            {MONTH_LABELS.map((m, i) => {
              const nightCount = counts ? counts.night[i] : 0;
              const dayCount = counts ? counts.day[i] : 0;
              const total = nightCount + dayCount;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={`text-xs w-8 text-right ${selectedMonth === i + 1 ? "font-bold text-blue-600" : "text-gray-500"}`}>{m}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden flex">
                    {nightCount > 0 && (
                      <div
                        className="h-full bg-indigo-400 rounded-l-full"
                        style={{ width: `${(nightCount / Math.max(total, 1)) * 100}%`, minWidth: nightCount > 0 ? "4px" : 0 }}
                      />
                    )}
                    {dayCount > 0 && (
                      <div
                        className="h-full bg-orange-300"
                        style={{ width: `${(dayCount / Math.max(total, 1)) * 100}%`, minWidth: dayCount > 0 ? "4px" : 0 }}
                      />
                    )}
                  </div>
                  <span className={`text-xs w-5 text-right ${total === 0 ? "text-gray-300" : "font-bold text-gray-700"}`}>{total || "-"}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-indigo-400" />当直</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-orange-300" />日直</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small stat card ──

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700",
    orange: "bg-orange-50 text-orange-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-lg p-2 ${colorMap[color] || "bg-gray-50 text-gray-700"}`}>
      <p className="text-[10px] font-medium opacity-70">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
