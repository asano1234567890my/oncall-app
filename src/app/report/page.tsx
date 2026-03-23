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
type MonthlyCounts = { weekdayNight: number[]; satNight: number[]; sunholDay: number[]; sunholNight: number[] };

// ── Score weights (must match optimizer) ──
const SCORE_WEEKDAY_NIGHT = 1.0;
const SCORE_SAT_NIGHT = 1.5;
const SCORE_SUNHOL_NIGHT = 1.0;
const SCORE_DAY = 0.5;

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
  const [targetScore, setTargetScore] = useState<{ min: number; max: number }>({ min: 0.5, max: 4.5 });
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(11);
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
        const [statsRes, configRes] = await Promise.all([
          fetch(`${API_BASE}/api/schedule/stats?year=${year}`, { headers: getAuthHeaders() }),
          fetch(`${API_BASE}/api/settings/optimizer_config`, { headers: getAuthHeaders() }),
        ]);
        if (!statsRes.ok) throw new Error();
        const d: StatsData = await statsRes.json();
        if (configRes.ok) {
          const cfg = await configRes.json();
          if (!cancelled && typeof cfg.score_min === "number" && typeof cfg.score_max === "number") {
            setTargetScore({ min: cfg.score_min, max: cfg.score_max });
          }
        }
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
    if (!data) return new Map<string, MonthlyCounts>();
    const map = new Map<string, MonthlyCounts>();
    for (const doc of data.doctors) {
      map.set(doc.id, {
        weekdayNight: Array(12).fill(0) as number[],
        satNight: Array(12).fill(0) as number[],
        sunholDay: Array(12).fill(0) as number[],
        sunholNight: Array(12).fill(0) as number[],
      });
    }
    for (const s of data.shifts) {
      const entry = map.get(s.doctor_id);
      if (!entry) continue;
      const m = parseInt(s.date.substring(5, 7), 10) - 1;
      if (s.shift_type === "night") {
        if (isSaturdayDate(s.date)) entry.satNight[m]++;
        else if (isSundayOrHoliday(s.date, holidaySet)) entry.sunholNight[m]++;
        else entry.weekdayNight[m]++;
      } else {
        // Day shifts only exist on sunhol/sat — count sunhol day shifts
        if (isSundayOrHoliday(s.date, holidaySet)) entry.sunholDay[m]++;
        // Saturday day shifts are rare; group with sunholDay for simplicity
        else entry.sunholDay[m]++;
      }
    }
    return map;
  }, [data, holidaySet]);

  // Per-doctor monthly scores (weighted)
  const monthlyScores = useMemo(() => {
    if (!monthlyCounts) return new Map<string, number[]>();
    const map = new Map<string, number[]>();
    for (const [docId, c] of monthlyCounts) {
      const scores = Array.from({ length: 12 }, (_, i) =>
        c.weekdayNight[i] * SCORE_WEEKDAY_NIGHT +
        c.satNight[i] * SCORE_SAT_NIGHT +
        c.sunholNight[i] * SCORE_SUNHOL_NIGHT +
        c.sunholDay[i] * SCORE_DAY
      );
      map.set(docId, scores);
    }
    return map;
  }, [monthlyCounts]);

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

  // Average interval for selected doctor (filtered by range)
  const avgInterval = useMemo(() => {
    if (!data || !selectedDoctorId) return null;
    const rangeStartMonth = rangeStart + 1;
    const rangeEndMonth = rangeEnd + 1;
    const dates = data.shifts
      .filter(s => {
        if (s.doctor_id !== selectedDoctorId || s.shift_type !== "night") return false;
        const m = parseInt(s.date.substring(5, 7), 10);
        return m >= rangeStartMonth && m <= rangeEndMonth;
      })
      .map(s => new Date(s.date).getTime())
      .sort((a, b) => a - b);
    if (dates.length < 2) return null;
    let totalGap = 0;
    for (let i = 1; i < dates.length; i++) totalGap += (dates[i] - dates[i - 1]) / 86400000;
    return (totalGap / (dates.length - 1)).toFixed(1);
  }, [data, selectedDoctorId, rangeStart, rangeEnd]);

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
        {/* Year selector + tabs + range */}
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
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <span className="font-bold">期間:</span>
            <button onClick={() => setRangeStart(rangeStart - 1)} disabled={rangeStart <= 0} className="rounded p-0.5 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="h-3 w-3" /></button>
            <span className="font-bold text-gray-800 min-w-[2rem] text-center">{rangeStart + 1}月</span>
            <button onClick={() => setRangeStart(rangeStart + 1)} disabled={rangeStart >= rangeEnd} className="rounded p-0.5 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="h-3 w-3" /></button>
            <span className="text-gray-400">〜</span>
            <button onClick={() => setRangeEnd(rangeEnd - 1)} disabled={rangeEnd <= rangeStart} className="rounded p-0.5 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="h-3 w-3" /></button>
            <span className="font-bold text-gray-800 min-w-[2rem] text-center">{rangeEnd + 1}月</span>
            <button onClick={() => setRangeEnd(rangeEnd + 1)} disabled={rangeEnd >= 11} className="rounded p-0.5 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="h-3 w-3" /></button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">読み込み中...</div>
        ) : !data || data.doctors.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">データがありません</div>
        ) : tab === "overview" ? (
          <OverviewTab data={data} monthlyCounts={monthlyCounts} monthlyScores={monthlyScores} doctorMap={doctorMap} holidaySet={holidaySet} year={year} targetScore={targetScore} rangeStart={rangeStart} rangeEnd={rangeEnd} />
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
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
          />
        )}
      </main>
    </div>
  );
}

// ── Color palette for doctor lines ──
const DOCTOR_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#3b82f6", "#84cc16",
  "#06b6d4", "#e11d48", "#a855f7", "#22c55e", "#eab308",
];

// ── 全体タブ ──

function OverviewTab({
  data, monthlyCounts, monthlyScores, doctorMap, holidaySet, year, targetScore,
  rangeStart, rangeEnd,
}: {
  data: StatsData;
  monthlyCounts: Map<string, MonthlyCounts>;
  monthlyScores: Map<string, number[]>;
  doctorMap: Map<string, string>;
  holidaySet: Set<string>;
  year: number;
  targetScore: { min: number; max: number };
  rangeStart: number;
  rangeEnd: number;
}) {
  const [subTab, setSubTab] = useState<keyof MonthlyCounts | "sunholTotal">("weekdayNight");
  const [highlightDoctorId, setHighlightDoctorId] = useState<string | null>(null);

  // Custom target score per month (initialized from optimizer config)
  const [customTarget, setCustomTarget] = useState(() => (targetScore.min + targetScore.max) / 2);

  // Auto-detect last month with data
  const lastDataMonth = useMemo(() => {
    let last = 0;
    for (const [, scores] of monthlyScores) {
      for (let m = 11; m >= 0; m--) {
        if (scores[m] > 0 && m > last) { last = m; break; }
      }
    }
    return last;
  }, [monthlyScores]);

  // Range months (inclusive, no cross-year: start <= end enforced)
  const rangeMonths = useMemo(() => {
    const months: number[] = [];
    for (let m = rangeStart; m <= rangeEnd; m++) months.push(m);
    return months;
  }, [rangeStart, rangeEnd]);

  const rangeLength = rangeMonths.length;

  // Scores for selected range
  const rangeScores = useMemo(() => {
    return data.doctors.map((doc, i) => {
      const scores = monthlyScores.get(doc.id) || Array(12).fill(0);
      const total = rangeMonths.reduce((sum, m) => sum + scores[m], 0);
      return { id: doc.id, name: doc.name, score: total, color: DOCTOR_COLORS[i % DOCTOR_COLORS.length] };
    });
  }, [data.doctors, monthlyScores, rangeMonths]);

  // Cumulative scores for line chart (within range, starting from 0)
  const cumulativeData = useMemo(() => {
    return data.doctors.map((doc, i) => {
      const scores = monthlyScores.get(doc.id) || Array(12).fill(0);
      const cumulative: number[] = [0]; // start at 0
      let sum = 0;
      for (const m of rangeMonths) {
        sum += scores[m];
        cumulative.push(sum);
      }
      return { id: doc.id, name: doc.name, cumulative, color: DOCTOR_COLORS[i % DOCTOR_COLORS.length] };
    });
  }, [data.doctors, monthlyScores, rangeMonths]);

  // Number of points = rangeLength + 1 (0 origin + each month end)
  const numPoints = rangeLength + 1;

  const maxCumulative = useMemo(() => {
    let max = customTarget * rangeLength;
    for (const d of cumulativeData) {
      const last = d.cumulative[d.cumulative.length - 1] || 0;
      max = Math.max(max, last);
    }
    return Math.ceil(max * 1.1) || 1;
  }, [cumulativeData, rangeLength, customTarget]);

  const maxRangeScore = useMemo(() => {
    const targetTotal = customTarget * rangeLength;
    let max = targetTotal;
    for (const d of rangeScores) max = Math.max(max, d.score);
    return Math.ceil(max * 1.1) || 1;
  }, [rangeScores, customTarget, rangeLength]);

  return (
    <div className="space-y-4">
      {/* ── Target setting ── */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1 text-gray-600">
          <span className="font-bold">目標:</span>
          <button onClick={() => setCustomTarget(Math.max(0.5, +(customTarget - 0.5).toFixed(1)))} className="rounded p-0.5 hover:bg-gray-200"><ChevronLeft className="h-3 w-3" /></button>
          <span className="font-bold text-gray-800 min-w-[2.5rem] text-center">{customTarget.toFixed(1)}</span>
          <button onClick={() => setCustomTarget(+(customTarget + 0.5).toFixed(1))} className="rounded p-0.5 hover:bg-gray-200"><ChevronRight className="h-3 w-3" /></button>
          <span className="text-gray-400">/月</span>
        </div>
      </div>

      {/* ── Score deviation chart + Cumulative trend ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Score deviation */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <h3 className="text-xs font-bold text-gray-800 mb-2">スコア（目標との乖離）<span className="font-normal text-gray-400 ml-1">{rangeStart + 1}月〜{rangeEnd + 1}月</span></h3>
          <div className="space-y-1">
            {rangeScores.map(d => {
              const targetTotal = customTarget * rangeLength;
              const barW = Math.max((d.score / maxRangeScore) * 100, 0);
              const targetW = (targetTotal / maxRangeScore) * 100;
              const isHighlighted = highlightDoctorId === d.id;
              const isFaded = highlightDoctorId !== null && !isHighlighted;
              return (
                <div
                  key={d.id}
                  className={`flex items-center gap-1.5 cursor-pointer rounded px-1 py-0.5 transition-opacity ${isFaded ? "opacity-30" : ""} ${isHighlighted ? "bg-gray-100" : ""}`}
                  onClick={() => setHighlightDoctorId(prev => prev === d.id ? null : d.id)}
                >
                  <span className="text-[11px] w-16 text-right truncate text-gray-700 font-medium">{d.name}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded relative">
                    <div className="absolute h-full rounded" style={{ width: `${barW}%`, backgroundColor: d.color, opacity: 0.8 }} />
                    <div className="absolute top-0 h-full w-0.5 bg-gray-800" style={{ left: `${targetW}%` }} title={`目標: ${targetTotal.toFixed(1)}`} />
                  </div>
                  <span className="text-[11px] w-8 text-right font-bold text-gray-700">{d.score.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-gray-800" />目標 {(customTarget * rangeLength).toFixed(1)}</span>
          </div>
        </div>

        {/* Cumulative trend */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <h3 className="text-xs font-bold text-gray-800 mb-2">累積スコア推移<span className="font-normal text-gray-400 ml-1">目標 {customTarget.toFixed(1)}/月</span></h3>
          <svg viewBox="0 0 400 200" className="w-full" style={{ maxHeight: "220px" }}>
            {/* Grid lines */}
            {Array.from({ length: 5 }, (_, i) => {
              const y = 10 + (i * 180) / 4;
              const val = maxCumulative - (i * maxCumulative) / 4;
              return (
                <g key={i}>
                  <line x1="40" y1={y} x2="390" y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
                  <text x="36" y={y + 3} textAnchor="end" className="text-[8px]" fill="#9ca3af">{val.toFixed(0)}</text>
                </g>
              );
            })}
            {/* Month labels (at each month's right edge) */}
            {rangeMonths.map((m, i) => {
              const x = 40 + ((i + 1) * 350) / Math.max(numPoints - 1, 1);
              return <text key={i} x={x} y={198} textAnchor="middle" className="text-[7px]" fill="#9ca3af">{MONTH_LABELS[m]}</text>;
            })}
            {/* Target reference line (from 0,0 to end) */}
            <line
              x1="40"
              y1={190}
              x2={40 + ((numPoints - 1) * 350) / Math.max(numPoints - 1, 1)}
              y2={190 - ((customTarget * rangeLength) / maxCumulative) * 180}
              stroke="#374151"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.5"
            />
            {/* Doctor lines */}
            {cumulativeData.map(d => {
              const isHighlighted = highlightDoctorId === d.id;
              const isFaded = highlightDoctorId !== null && !isHighlighted;
              const points = d.cumulative.map((val, i) => {
                const x = 40 + (i * 350) / Math.max(numPoints - 1, 1);
                const y = 190 - (val / maxCumulative) * 180;
                return `${x},${y}`;
              }).join(" ");
              return (
                <polyline
                  key={d.id}
                  points={points}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={isHighlighted ? 2.5 : 1.2}
                  opacity={isFaded ? 0.15 : isHighlighted ? 1 : 0.7}
                  className="cursor-pointer transition-opacity"
                  onClick={() => setHighlightDoctorId(prev => prev === d.id ? null : d.id)}
                />
              );
            })}
            {/* Dots on highlighted doctor (skip the 0 origin point) */}
            {highlightDoctorId && (() => {
              const d = cumulativeData.find(x => x.id === highlightDoctorId);
              if (!d) return null;
              return d.cumulative.slice(1).map((val, i) => {
                const x = 40 + ((i + 1) * 350) / Math.max(numPoints - 1, 1);
                const y = 190 - (val / maxCumulative) * 180;
                return <circle key={i} cx={x} cy={y} r="3" fill={d.color} />;
              });
            })()}
          </svg>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px]">
            <span className="flex items-center gap-1 text-gray-400"><span className="inline-block w-3 border-t border-dashed border-gray-800" />目標</span>
            {cumulativeData.map(d => {
              const isHighlighted = highlightDoctorId === d.id;
              const isFaded = highlightDoctorId !== null && !isHighlighted;
              return (
                <span
                  key={d.id}
                  className={`flex items-center gap-1 cursor-pointer transition-opacity ${isFaded ? "opacity-30" : ""}`}
                  onClick={() => setHighlightDoctorId(prev => prev === d.id ? null : d.id)}
                >
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className={`${isHighlighted ? "font-bold text-gray-800" : "text-gray-500"}`}>{d.name}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Summary table: all shift types at a glance ── */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-baseline gap-2 px-3 pt-2 pb-1">
          <h3 className="text-xs font-bold text-gray-800">回数サマリー</h3>
          <span className="text-[10px] text-gray-400">
            {rangeStart === 0 && rangeEnd === 11 ? `${year}年` : `${year}年 ${rangeStart + 1}月〜${rangeEnd + 1}月`}
          </span>
        </div>
        <table className="w-full text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-bold border-b border-r border-gray-200 min-w-[5rem]">医師名</th>
              <th className="px-2 py-2 text-center font-bold border-b border-gray-200 min-w-[3rem] text-indigo-600">平日</th>
              <th className="px-2 py-2 text-center font-bold border-b border-gray-200 min-w-[3rem] text-blue-600">土曜</th>
              <th colSpan={3} className="px-2 py-2 text-center font-bold border-b border-l-2 border-gray-200 min-w-[6rem] text-red-600">日祝</th>
              <th className="px-2 py-2 text-center font-bold border-b border-l-2 border-gray-300 min-w-[3rem] bg-gray-100">合計</th>
            </tr>
            <tr className="bg-gray-50/50 text-[10px] text-gray-400">
              <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200" />
              <th className="px-2 py-1 text-center border-b border-gray-200">当直</th>
              <th className="px-2 py-1 text-center border-b border-gray-200">当直</th>
              <th className="px-2 py-1 text-center border-b border-l-2 border-gray-200 text-orange-500">日直</th>
              <th className="px-2 py-1 text-center border-b border-gray-200 text-red-500">当直</th>
              <th className="px-2 py-1 text-center border-b border-gray-200 text-red-400 font-bold">計</th>
              <th className="px-2 py-1 text-center border-b border-l-2 border-gray-300 bg-gray-100" />
            </tr>
          </thead>
          <tbody>
            {data.doctors.map((doc, di) => {
              const c = monthlyCounts.get(doc.id);
              if (!c) return null;
              const sumR = (arr: number[]) => rangeMonths.reduce((s, m) => s + arr[m], 0);
              const wn = sumR(c.weekdayNight);
              const sn = sumR(c.satNight);
              const shd = sumR(c.sunholDay);
              const shn = sumR(c.sunholNight);
              const shTotal = shd + shn;
              const grand = wn + sn + shd + shn;
              const cell = (v: number, cls?: string) => (
                <td className={`px-2 py-1.5 text-center ${v === 0 ? "text-gray-300" : `font-medium ${cls || "text-gray-800"}`}`}>{v || "-"}</td>
              );
              return (
                <tr key={doc.id} className={di % 2 === 0 ? "" : "bg-gray-50/50"}>
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-gray-800 border-r border-gray-200 whitespace-nowrap">{doc.name}</td>
                  {cell(wn, "text-indigo-700")}
                  {cell(sn, "text-blue-700")}
                  <td className={`px-2 py-1.5 text-center border-l-2 border-gray-200 ${shd === 0 ? "text-gray-300" : "font-medium text-orange-600"}`}>{shd || "-"}</td>
                  {cell(shn, "text-red-600")}
                  <td className={`px-2 py-1.5 text-center ${shTotal === 0 ? "text-gray-300" : "font-bold text-red-700"}`}>{shTotal || "-"}</td>
                  <td className="px-2 py-1.5 text-center font-bold text-gray-800 border-l-2 border-gray-300 bg-gray-50">{grand}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 border-t-2 border-gray-300">
              <td className="sticky left-0 z-10 bg-gray-100 px-3 py-1.5 font-bold text-gray-600 border-r border-gray-200">合計</td>
              {(() => {
                let twn = 0, tsn = 0, tshd = 0, tshn = 0;
                for (const doc of data.doctors) {
                  const c = monthlyCounts.get(doc.id);
                  if (!c) continue;
                  const sumR = (arr: number[]) => rangeMonths.reduce((s, m) => s + arr[m], 0);
                  twn += sumR(c.weekdayNight);
                  tsn += sumR(c.satNight);
                  tshd += sumR(c.sunholDay);
                  tshn += sumR(c.sunholNight);
                }
                const tsh = tshd + tshn;
                const tg = twn + tsn + tshd + tshn;
                return (
                  <>
                    <td className="px-2 py-1.5 text-center font-bold text-indigo-700">{twn}</td>
                    <td className="px-2 py-1.5 text-center font-bold text-blue-700">{tsn}</td>
                    <td className="px-2 py-1.5 text-center font-bold text-orange-600 border-l-2 border-gray-200">{tshd}</td>
                    <td className="px-2 py-1.5 text-center font-bold text-red-600">{tshn}</td>
                    <td className="px-2 py-1.5 text-center font-bold text-red-700">{tsh}</td>
                    <td className="px-2 py-1.5 text-center font-bold text-gray-800 border-l-2 border-gray-300">{tg}</td>
                  </>
                );
              })()}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Monthly detail (expandable) ── */}
      <details className="group">
        <summary className="flex items-center gap-1 cursor-pointer text-xs font-bold text-gray-500 hover:text-gray-700">
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
          月別詳細
        </summary>
        <div className="mt-2 flex gap-1 items-center mb-2">
          {([["weekdayNight", "平日当直"], ["satNight", "土曜当直"], ["sunholDay", "日祝日直"], ["sunholNight", "日祝当直"], ["sunholTotal", "日祝合計"]] as const).map(([key, lbl]) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${subTab === key ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {lbl}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-bold border-b border-r border-gray-200 min-w-[5rem]">医師名</th>
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
                const vals = subTab === "sunholTotal"
                  ? counts.sunholDay.map((v, i) => v + counts.sunholNight[i])
                  : counts[subTab];
                const total = vals.reduce((a, b) => a + b, 0);
                return (
                  <tr key={doc.id} className={di % 2 === 0 ? "" : "bg-gray-50/50"}>
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-gray-800 border-r border-gray-200 whitespace-nowrap">{doc.name}</td>
                    {vals.map((v, mi) => (
                      <td key={mi} className={`px-2 py-1.5 text-center ${v === 0 ? "text-gray-300" : "text-gray-800 font-medium"}`}>
                        {v || "-"}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-center font-bold text-gray-800 border-l-2 border-gray-300 bg-gray-50">{total}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td className="sticky left-0 z-10 bg-gray-100 px-3 py-1.5 font-bold text-gray-600 border-r border-gray-200">合計</td>
                {Array.from({ length: 12 }, (_, mi) => {
                  const total = data.doctors.reduce((sum, doc) => {
                    const c = monthlyCounts.get(doc.id);
                    if (!c) return sum;
                    return sum + (subTab === "sunholTotal" ? c.sunholDay[mi] + c.sunholNight[mi] : c[subTab][mi]);
                  }, 0);
                  return (
                    <td key={mi} className={`px-2 py-1.5 text-center font-bold ${total === 0 ? "text-gray-300" : "text-gray-700"}`}>{total || "-"}</td>
                  );
                })}
                <td className="px-3 py-1.5 text-center font-bold text-gray-800 border-l-2 border-gray-300">
                  {data.doctors.reduce((sum, doc) => {
                    const c = monthlyCounts.get(doc.id);
                    if (!c) return sum;
                    const vals = subTab === "sunholTotal"
                      ? c.sunholDay.map((v, i) => v + c.sunholNight[i])
                      : c[subTab];
                    return sum + vals.reduce((a, b) => a + b, 0);
                  }, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
    </div>
  );
}

// ── 各医師タブ ──

function DoctorTab({
  data, selectedDoctorId, setSelectedDoctorId, selectedMonth, setSelectedMonth,
  selectedDoctor, doctorMonthShifts, monthlyCounts, holidaySet, avgInterval,
  year, daysInMonth, rangeStart, rangeEnd,
}: {
  data: StatsData;
  selectedDoctorId: string;
  setSelectedDoctorId: (id: string) => void;
  selectedMonth: number;
  setSelectedMonth: (m: number) => void;
  selectedDoctor: DoctorInfo | undefined;
  doctorMonthShifts: Map<number, { day: boolean; night: boolean }>;
  monthlyCounts: Map<string, MonthlyCounts>;
  holidaySet: Set<string>;
  avgInterval: string | null;
  year: number;
  daysInMonth: number;
  rangeStart: number;
  rangeEnd: number;
}) {
  const counts = monthlyCounts.get(selectedDoctorId);
  // Sum only within selected range
  const sumRange = (arr: number[]) => {
    let s = 0;
    for (let i = rangeStart; i <= rangeEnd; i++) s += arr[i];
    return s;
  };
  const yearTotalNight = counts ? sumRange(counts.weekdayNight) : 0;
  const yearTotalDay = counts ? sumRange(counts.sunholDay) : 0;
  const yearTotalSat = counts ? sumRange(counts.satNight) : 0;
  const yearTotalSunhol = counts ? sumRange(counts.sunholNight) : 0;

  // Build calendar grid (always 6 weeks for consistent height)
  const firstDayOfWeek = new Date(year, selectedMonth - 1, 1).getDay(); // 0=Sun
  const calendarWeeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDayOfWeek).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      calendarWeeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    calendarWeeks.push(week);
  }
  while (calendarWeeks.length < 6) {
    calendarWeeks.push(Array(7).fill(null));
  }

  return (
    <div className="space-y-4">
      {/* Doctor + Month selectors */}
      <div className="flex flex-wrap items-center gap-2">
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

      <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr_1fr] gap-3 items-stretch">
        {/* Left: Calendar grid */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm w-full flex flex-col">
          <table className="w-full border-collapse table-fixed text-xs">
            <thead>
              <tr className="bg-gray-50">
                {WEEKDAY_LABELS.map((wd, i) => (
                  <th key={wd} className={`py-1 text-center text-[10px] font-bold ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"}`}>
                    {wd}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendarWeeks.map((weekRow, wi) => (
                <tr key={wi} className="border-t border-gray-100">
                  {weekRow.map((day, di) => {
                    if (day === null) return <td key={di} className="p-0.5" />;
                    const dateKey = `${year}-${pad2(selectedMonth)}-${pad2(day)}`;
                    const isHol = di === 0 || holidaySet.has(dateKey);
                    const isSat = di === 6;
                    const shift = doctorMonthShifts.get(day);
                    const hasDay = shift?.day ?? false;
                    const hasNight = shift?.night ?? false;
                    return (
                      <td
                        key={di}
                        className={`p-0.5 text-center align-top ${isHol ? "bg-red-50/40" : isSat ? "bg-blue-50/40" : ""}`}
                      >
                        <div className={`text-[11px] font-medium leading-tight ${isHol ? "text-red-600" : isSat ? "text-blue-600" : "text-gray-700"}`}>
                          {day}
                        </div>
                        <div className="flex justify-center gap-0.5 h-2">
                          {hasDay && <span className="inline-block w-2 h-2 rounded-full bg-orange-400" title="日直" />}
                          {hasNight && <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" title="当直" />}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {/* Footer: legend + monthly summary fills remaining space */}
          <div className="flex-1 flex flex-col justify-end border-t border-gray-100 px-2.5 py-2 space-y-1.5">
            <div className="flex justify-center gap-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400" />日直</span>
              <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />当直</span>
            </div>
            {(() => {
              const mi = selectedMonth - 1;
              const mNight = counts ? counts.weekdayNight[mi] : 0;
              const mDay = counts ? counts.sunholDay[mi] : 0;
              const mSat = counts ? counts.satNight[mi] : 0;
              const mSunhol = counts ? counts.sunholNight[mi] : 0;
              return (mNight + mDay + mSat + mSunhol) > 0 ? (
                <div className="text-[10px] text-gray-500 space-y-0.5">
                  <p className="font-bold text-gray-700 text-[11px]">{selectedMonth}月の集計</p>
                  <div className="grid grid-cols-2 gap-x-2">
                    <span>平日 <b className="text-gray-800">{mNight}</b></span>
                    <span>日直 <b className="text-gray-800">{mDay}</b></span>
                    <span>土曜 <b className="text-gray-800">{mSat}</b></span>
                    <span>日祝 <b className="text-gray-800">{mSunhol}</b></span>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* Center: Year summary + average interval */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm h-full">
          <h3 className="text-xs font-bold text-gray-800 mb-2">
            {rangeStart === 0 && rangeEnd === 11
              ? `${year}年 年間集計`
              : `${year}年 ${rangeStart + 1}月〜${rangeEnd + 1}月`}
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            <StatCard label="平日当直" value={yearTotalNight} color="indigo" />
            <StatCard label="日直" value={yearTotalDay} color="orange" />
            <StatCard label="土曜当直" value={yearTotalSat} color="blue" />
            <StatCard label="日祝当直" value={yearTotalSunhol} color="red" />
          </div>
          {avgInterval && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-500">平均当直間隔</p>
              <p className="text-base font-bold text-gray-800">{avgInterval}<span className="text-[10px] font-normal text-gray-500 ml-1">日に1回</span></p>
            </div>
          )}
        </div>

        {/* Right: Monthly breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm h-full">
          <h3 className="text-xs font-bold text-gray-800 mb-2">月別当直回数</h3>
          <div className="space-y-0.5">
            {MONTH_LABELS.map((m, i) => {
              const inRange = i >= rangeStart && i <= rangeEnd;
              const nightCount = counts ? (counts.weekdayNight[i] + counts.satNight[i] + counts.sunholNight[i]) : 0;
              const dayCount = counts ? counts.sunholDay[i] : 0;
              const total = nightCount + dayCount;
              return (
                <div key={i} className={`flex items-center gap-1.5 ${inRange ? "" : "opacity-25"}`}>
                  <span className={`text-[11px] w-7 text-right ${selectedMonth === i + 1 ? "font-bold text-blue-600" : "text-gray-500"}`}>{m}</span>
                  <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden flex">
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
                  <span className={`text-[11px] w-4 text-right ${total === 0 ? "text-gray-300" : "font-bold text-gray-700"}`}>{total || "-"}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400" />当直</span>
            <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-300" />日直</span>
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
