"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, User, ChevronLeft, ChevronRight, HelpCircle, X, Filter } from "lucide-react";
import AppHeader from "../components/AppHeader";
import { getAuthHeaders, useAuth } from "../hooks/useAuth";
import { useHolidays } from "../hooks/useHolidays";
import { useCustomHolidays } from "../hooks/useCustomHolidays";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const WEEKDAY_LABELS = ["日","月","火","水","木","金","土"] as const;

type DoctorInfo = { id: string; name: string };
type ShiftEntry = { date: string; doctor_id: string; shift_type: string };
type StatsData = { doctors: DoctorInfo[]; shifts: ShiftEntry[]; holidays: string[] };
type MonthlyCounts = { weekdayNight: number[]; satNight: number[]; sunholDay: number[]; sunholNight: number[] };
type MonthSlot = { year: number; month: number };

/** 基準月から過去12ヶ月のスロット配列を生成 */
function computeMonthSlots(baseYear: number, baseMonth: number): MonthSlot[] {
  const slots: MonthSlot[] = [];
  for (let i = 11; i >= 0; i--) {
    let m = baseMonth - i;
    let y = baseYear;
    while (m <= 0) { m += 12; y--; }
    slots.push({ year: y, month: m });
  }
  return slots;
}

/** スロットの表示ラベル（年またぎ時は "25/4" 形式、同年なら "4月"） */
function slotLabel(slot: MonthSlot, slots: MonthSlot[]): string {
  const hasMultipleYears = slots[0].year !== slots[slots.length - 1].year;
  if (hasMultipleYears) {
    return `${String(slot.year).slice(2)}/${slot.month}`;
  }
  return `${slot.month}月`;
}

// ── Score weights (must match optimizer) ──
const SCORE_WEEKDAY_NIGHT = 1.0;
const SCORE_SAT_NIGHT = 1.5;
const SCORE_SUNHOL_NIGHT = 1.0;
const SCORE_DAY = 0.5;

// ── Helpers ──

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 自然順ソート（"医師2" < "医師10"） */
const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, "ja", { numeric: true, sensitivity: "base" });

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

// ── Initial wizard (2 pages, reusable from ? button) ──

const WIZARD_STORAGE_KEY = "report_wizard_dismissed";

function ReportWizard({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: "レポートの見かた",
      body: "基準月から過去12ヶ月間の当直データを集計します。「全体」タブで医師全員のスコア比較・累積推移・回数サマリーを、「各医師」タブで個別のカレンダー・集計・月別内訳を確認できます。",
    },
    {
      title: "操作方法",
      body: "基準月の矢印で対象期間を移動、「期間」で範囲の絞り込み、「目標」でスコア基準値の変更ができます。「医師」ボタンで表示する医師をフィルターできます。",
    },
  ];
  const s = steps[step];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800">{s.title}</h2>
          <button onClick={onDismiss} className="rounded p-0.5 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed mb-4">{s.body}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span key={i} className={`inline-block h-1.5 w-1.5 rounded-full ${i === step ? "bg-blue-600" : "bg-gray-300"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">
                戻る
              </button>
            )}
            {step < steps.length - 1 ? (
              <button onClick={() => setStep(step + 1)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">
                次へ
              </button>
            ) : (
              <button onClick={onDismiss} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">
                OK
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──

export default function ReportPage() {
  const { auth, logout } = useAuth();
  const [showWizard, setShowWizard] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(WIZARD_STORAGE_KEY);
  });
  const dismissWizard = () => {
    setShowWizard(false);
    localStorage.setItem(WIZARD_STORAGE_KEY, "1");
  };
  const now = new Date();
  const [baseYear, setBaseYear] = useState(() => now.getFullYear());
  const [baseMonth, setBaseMonth] = useState(() => now.getMonth() + 1);
  const [tab, setTab] = useState<"overview" | "doctor">("overview");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState(11); // default: base month (last slot)
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [targetScore, setTargetScore] = useState<{ min: number; max: number }>({ min: 0.5, max: 4.5 });
  const [rangeMode, setRangeMode] = useState<"3m" | "1y">("3m");
  const rangeStart = rangeMode === "3m" ? 9 : 0;
  const rangeEnd = 11;
  const [hiddenDoctorIds, setHiddenDoctorIds] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filter on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  // 12-month window from base
  const monthSlots = useMemo(() => computeMonthSlots(baseYear, baseMonth), [baseYear, baseMonth]);
  const slotLabels = useMemo(() => monthSlots.map(s => slotLabel(s, monthSlots)), [monthSlots]);

  // Years needed for data fetch
  const fetchYears = useMemo(() => {
    const years = new Set(monthSlots.map(s => s.year));
    return [...years].sort();
  }, [monthSlots]);

  // Holidays for both years
  const { holidaySet: hol1 } = useHolidays(fetchYears[0]);
  const { holidaySet: hol2 } = useHolidays(fetchYears.length > 1 ? fetchYears[1] : fetchYears[0]);
  const { manualSet: manual1, disabledSet: disabled1, customError: cErr1 } = useCustomHolidays(fetchYears[0]);
  const { manualSet: manual2, disabledSet: disabled2, customError: cErr2 } = useCustomHolidays(fetchYears.length > 1 ? fetchYears[1] : fetchYears[0]);

  const mergedHolidaySet = useMemo(() => {
    const s = new Set<string>([...hol1, ...hol2]);
    if (!cErr1) { for (const d of disabled1) s.delete(d); for (const d of manual1) s.add(d); }
    if (!cErr2) { for (const d of disabled2) s.delete(d); for (const d of manual2) s.add(d); }
    return s;
  }, [hol1, hol2, manual1, manual2, disabled1, disabled2, cErr1, cErr2]);

  const holidaySet = useMemo(() => {
    const s = new Set(mergedHolidaySet);
    if (data) for (const h of data.holidays) s.add(h);
    return s;
  }, [mergedHolidaySet, data]);

  // Slot index lookup: "YYYY-MM" → slot index
  const slotIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    monthSlots.forEach((s, i) => m.set(`${s.year}-${pad2(s.month)}`, i));
    return m;
  }, [monthSlots]);

  // Base month navigation
  const moveBase = (delta: number) => {
    let m = baseMonth + delta;
    let y = baseYear;
    while (m > 12) { m -= 12; y++; }
    while (m <= 0) { m += 12; y--; }
    setBaseYear(y);
    setBaseMonth(m);
  };

  // Fetch stats for all needed years, merge
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const fetches = fetchYears.map(y =>
          fetch(`${API_BASE}/api/schedule/stats?year=${y}`, { headers: getAuthHeaders() })
        );
        const [configRes, ...statsResponses] = await Promise.all([
          fetch(`${API_BASE}/api/settings/optimizer_config`, { headers: getAuthHeaders() }),
          ...fetches,
        ]);
        // Merge stats
        const allDoctors = new Map<string, DoctorInfo>();
        const allShifts: ShiftEntry[] = [];
        const allHolidays = new Set<string>();
        for (const res of statsResponses) {
          if (!res.ok) continue;
          const d: StatsData = await res.json();
          for (const doc of d.doctors) allDoctors.set(doc.id, doc);
          allShifts.push(...d.shifts);
          for (const h of d.holidays) allHolidays.add(h);
        }
        const merged: StatsData = {
          doctors: [...allDoctors.values()].sort((a, b) => naturalCompare(a.name, b.name)),
          shifts: allShifts,
          holidays: [...allHolidays].sort(),
        };
        if (configRes.ok) {
          const cfg = await configRes.json();
          if (!cancelled && typeof cfg.score_min === "number" && typeof cfg.score_max === "number") {
            setTargetScore({ min: cfg.score_min, max: cfg.score_max });
          }
        }
        if (!cancelled) {
          setData(merged);
          if (!selectedDoctorId && merged.doctors.length > 0) setSelectedDoctorId(merged.doctors[0].id);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [auth.isAuthenticated, fetchYears.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ──

  const doctorMap = useMemo(() => {
    if (!data) return new Map<string, string>();
    return new Map(data.doctors.map(d => [d.id, d.name]));
  }, [data]);

  // Per-doctor per-slot counts (12 slots matching monthSlots)
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
      const ym = s.date.substring(0, 7); // "YYYY-MM"
      const si = slotIndexMap.get(ym);
      if (si === undefined) continue; // outside window
      if (s.shift_type === "night") {
        if (isSaturdayDate(s.date)) entry.satNight[si]++;
        else if (isSundayOrHoliday(s.date, holidaySet)) entry.sunholNight[si]++;
        else entry.weekdayNight[si]++;
      } else if (s.shift_type === "day") {
        if (isSundayOrHoliday(s.date, holidaySet) || isSaturdayDate(s.date)) entry.sunholDay[si]++;
      }
    }
    return map;
  }, [data, holidaySet, slotIndexMap]);

  // Combined holiday bonus: 日祝の当直で同日に日直がない → +0.5 (スコアのみ、回数には含めない)
  const combinedBonusCounts = useMemo(() => {
    if (!data) return new Map<string, number[]>();
    const dayShiftKeys = new Set<string>();
    for (const s of data.shifts) {
      if (s.shift_type === "day") dayShiftKeys.add(`${s.doctor_id}_${s.date}`);
    }
    const map = new Map<string, number[]>();
    for (const doc of data.doctors) map.set(doc.id, Array(12).fill(0) as number[]);
    for (const s of data.shifts) {
      if (s.shift_type !== "night") continue;
      if (!isSundayOrHoliday(s.date, holidaySet)) continue;
      if (dayShiftKeys.has(`${s.doctor_id}_${s.date}`)) continue;
      const si = slotIndexMap.get(s.date.substring(0, 7));
      if (si === undefined) continue;
      const arr = map.get(s.doctor_id);
      if (arr) arr[si]++;
    }
    return map;
  }, [data, holidaySet, slotIndexMap]);

  // Per-doctor slot scores (weighted)
  const monthlyScores = useMemo(() => {
    if (!monthlyCounts) return new Map<string, number[]>();
    const map = new Map<string, number[]>();
    for (const [docId, c] of monthlyCounts) {
      const bonus = combinedBonusCounts.get(docId) ?? Array(12).fill(0) as number[];
      const scores = Array.from({ length: 12 }, (_, i) =>
        c.weekdayNight[i] * SCORE_WEEKDAY_NIGHT +
        c.satNight[i] * SCORE_SAT_NIGHT +
        c.sunholNight[i] * SCORE_SUNHOL_NIGHT +
        c.sunholDay[i] * SCORE_DAY +
        bonus[i] * SCORE_DAY
      );
      map.set(docId, scores);
    }
    return map;
  }, [monthlyCounts, combinedBonusCounts]);

  // Doctor shifts for selected slot (calendar)
  const calendarSlot = monthSlots[selectedSlot] || monthSlots[11];
  const doctorMonthShifts = useMemo(() => {
    if (!data || !selectedDoctorId) return new Map<number, { day: boolean; night: boolean }>();
    const prefix = `${calendarSlot.year}-${pad2(calendarSlot.month)}`;
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
  }, [data, selectedDoctorId, calendarSlot]);

  // Average interval for selected doctor (filtered by range slots)
  const avgInterval = useMemo(() => {
    if (!data || !selectedDoctorId) return null;
    // Build set of valid YYYY-MM for range
    const validMonths = new Set<string>();
    for (let i = rangeStart; i <= rangeEnd; i++) {
      const s = monthSlots[i];
      validMonths.add(`${s.year}-${pad2(s.month)}`);
    }
    const dates = data.shifts
      .filter(s => {
        if (s.doctor_id !== selectedDoctorId || s.shift_type !== "night") return false;
        return validMonths.has(s.date.substring(0, 7));
      })
      .map(s => new Date(s.date).getTime())
      .sort((a, b) => a - b);
    if (dates.length < 2) return null;
    let totalGap = 0;
    for (let i = 1; i < dates.length; i++) totalGap += (dates[i] - dates[i - 1]) / 86400000;
    return (totalGap / (dates.length - 1)).toFixed(1);
  }, [data, selectedDoctorId, rangeStart, rangeEnd, monthSlots]);

  // Filtered data (excluding hidden doctors)
  const filteredData = useMemo(() => {
    if (!data || hiddenDoctorIds.size === 0) return data;
    return { ...data, doctors: data.doctors.filter(d => !hiddenDoctorIds.has(d.id)) };
  }, [data, hiddenDoctorIds]);

  const toggleDoctor = (id: string) => {
    setHiddenDoctorIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedDoctor = filteredData?.doctors.find(d => d.id === selectedDoctorId);
  const daysInMonth = new Date(calendarSlot.year, calendarSlot.month, 0).getDate();

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">ログインが必要です</p>
        <div className="flex gap-3">
          <a href="/login" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 transition-colors">ログイン</a>
          <a href="/register" className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors">新規登録</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {showWizard && <ReportWizard onDismiss={dismissWizard} />}
      <AppHeader hospitalName={auth.hospitalName} onLogout={logout} />

      <main className="mx-auto max-w-5xl px-4 py-3">
        {/* Row 1: base month + tabs + help + filter */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => moveBase(-1)} className="rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <span className="text-xs sm:text-sm font-bold text-gray-800 whitespace-nowrap">〜{baseYear}/{baseMonth}</span>
            <button onClick={() => moveBase(1)} className="rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"><ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setTab("overview")}
                className={`flex items-center gap-0.5 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold transition-colors ${tab === "overview" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                <BarChart3 className="h-3 w-3" />
                全体
              </button>
              <button
                onClick={() => setTab("doctor")}
                className={`flex items-center gap-0.5 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold transition-colors ${tab === "doctor" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                <User className="h-3 w-3" />
                各医師
              </button>
            </div>
            {data && data.doctors.length > 0 && (
            <div ref={filterRef} className="relative">
              <button
                onClick={() => setFilterOpen(v => !v)}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  hiddenDoctorIds.size > 0
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Filter className="h-3 w-3" />
                医師{hiddenDoctorIds.size > 0 ? ` (${data.doctors.length - hiddenDoctorIds.size}/${data.doctors.length})` : ""}
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-56 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1.5 shadow-lg">
                  <div className="flex items-center justify-between px-3 pb-1.5 border-b border-gray-100">
                    <span className="text-[10px] font-bold text-gray-500">表示する医師</span>
                    <div className="flex gap-1">
                      <button onClick={() => setHiddenDoctorIds(new Set())} className="text-[10px] text-blue-600 hover:underline">全選択</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => setHiddenDoctorIds(new Set(data.doctors.map(d => d.id)))} className="text-[10px] text-blue-600 hover:underline">全解除</button>
                    </div>
                  </div>
                  {data.doctors.map(d => (
                    <label key={d.id} className="flex items-center gap-2 px-3 py-1 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hiddenDoctorIds.has(d.id)}
                        onChange={() => toggleDoctor(d.id)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-700">{d.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
            <button
              onClick={() => setShowWizard(true)}
              className="rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="使い方"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {/* Row 2: range toggle */}
        <div className="mb-3 flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600">
          <span className="font-bold">期間:</span>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            <button
              onClick={() => setRangeMode("3m")}
              className={`px-2.5 py-1 text-[11px] font-bold transition-colors ${rangeMode === "3m" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              3ヶ月
            </button>
            <button
              onClick={() => setRangeMode("1y")}
              className={`px-2.5 py-1 text-[11px] font-bold transition-colors ${rangeMode === "1y" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              1年
            </button>
          </div>
          <span className="text-gray-400 text-[10px]">{slotLabels[rangeStart]}〜{slotLabels[rangeEnd]}</span>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">読み込み中...</div>
        ) : !filteredData || filteredData.doctors.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">
            {data && data.doctors.length > 0 ? "表示する医師が選択されていません" : "データがありません"}
          </div>
        ) : tab === "overview" ? (
          <OverviewTab data={filteredData} monthlyCounts={monthlyCounts} monthlyScores={monthlyScores} doctorMap={doctorMap} holidaySet={holidaySet} monthSlots={monthSlots} slotLabels={slotLabels} targetScore={targetScore} rangeStart={rangeStart} rangeEnd={rangeEnd} />
        ) : (
          <DoctorTab
            data={filteredData}
            selectedDoctorId={selectedDoctorId}
            setSelectedDoctorId={setSelectedDoctorId}
            selectedSlot={selectedSlot}
            setSelectedSlot={setSelectedSlot}
            selectedDoctor={selectedDoctor}
            doctorMonthShifts={doctorMonthShifts}
            monthlyCounts={monthlyCounts}
            holidaySet={holidaySet}
            avgInterval={avgInterval}
            calendarSlot={calendarSlot}
            daysInMonth={daysInMonth}
            monthSlots={monthSlots}
            slotLabels={slotLabels}
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
  data, monthlyCounts, monthlyScores, doctorMap, holidaySet, monthSlots, slotLabels, targetScore,
  rangeStart, rangeEnd,
}: {
  data: StatsData;
  monthlyCounts: Map<string, MonthlyCounts>;
  monthlyScores: Map<string, number[]>;
  doctorMap: Map<string, string>;
  holidaySet: Set<string>;
  monthSlots: MonthSlot[];
  slotLabels: string[];
  targetScore: { min: number; max: number };
  rangeStart: number;
  rangeEnd: number;
}) {
  const [subTab, setSubTab] = useState<keyof MonthlyCounts | "sunholTotal">("weekdayNight");
  const [highlightDoctorId, setHighlightDoctorId] = useState<string | null>(null);

  // Custom target score per month (initialized from optimizer config)
  const [customTarget, setCustomTarget] = useState(() => Math.round((targetScore.min + targetScore.max) / 2 * 2) / 2);

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
          <button onClick={() => setCustomTarget(Math.max(0.5, +(customTarget - 0.5).toFixed(1)))} className="rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"><ChevronLeft className="h-3 w-3" /></button>
          <span className="font-bold text-gray-800 min-w-[2.5rem] text-center">{customTarget.toFixed(1)}</span>
          <button onClick={() => setCustomTarget(+(customTarget + 0.5).toFixed(1))} className="rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"><ChevronRight className="h-3 w-3" /></button>
          <span className="text-gray-400">/月</span>
        </div>
      </div>

      {/* ── Score deviation chart + Cumulative trend ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Score deviation */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <h3 className="text-[11px] sm:text-xs font-bold text-gray-800 mb-2">スコア（目標との乖離）<span className="font-normal text-gray-400 ml-1">{slotLabels[rangeStart]}〜{slotLabels[rangeEnd]}</span></h3>
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
          <h3 className="text-[11px] sm:text-xs font-bold text-gray-800 mb-2">累積スコア推移<span className="font-normal text-gray-400 ml-1">目標 {customTarget.toFixed(1)}/月</span></h3>
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
              return <text key={i} x={x} y={198} textAnchor="middle" className="text-[7px]" fill="#9ca3af">{slotLabels[m]}</text>;
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
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-baseline gap-2 px-3 pt-2 pb-1">
          <h3 className="text-[11px] sm:text-xs font-bold text-gray-800">回数サマリー</h3>
          <span className="text-[10px] text-gray-400">
            {rangeStart === 0 && rangeEnd === 11 ? `${slotLabels[0]}〜${slotLabels[11]}` : `${slotLabels[rangeStart]}〜${slotLabels[rangeEnd]}`}
          </span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-bold border-b border-r border-gray-200 min-w-[5rem]">医師名</th>
              <th className="px-2 py-2 text-center font-bold border-b border-gray-200 min-w-[3rem] text-green-600">平日</th>
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
                  {cell(wn, "text-green-700")}
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
                    <td className="px-2 py-1.5 text-center font-bold text-green-700">{twn}</td>
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
      </div>

      {/* ── Monthly detail ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-[11px] sm:text-xs font-bold text-gray-800">月別詳細</h3>
        </div>
        <div className="flex gap-1 items-center mb-2 overflow-x-auto">
          {([["weekdayNight", "平日"], ["satNight", "土曜"], ["sunholDay", "日祝日"], ["sunholNight", "日祝夜"], ["sunholTotal", "日祝計"]] as const).map(([key, lbl]) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${subTab === key ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
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
                {slotLabels.map((lbl, i) => (
                  <th key={i} className="px-2 py-2 text-center font-medium border-b border-gray-200 min-w-[2.5rem]">{lbl}</th>
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
      </div>
    </div>
  );
}

// ── 各医師タブ ──

function DoctorTab({
  data, selectedDoctorId, setSelectedDoctorId, selectedSlot, setSelectedSlot,
  selectedDoctor, doctorMonthShifts, monthlyCounts, holidaySet, avgInterval,
  calendarSlot, daysInMonth, monthSlots, slotLabels, rangeStart, rangeEnd,
}: {
  data: StatsData;
  selectedDoctorId: string;
  setSelectedDoctorId: (id: string) => void;
  selectedSlot: number;
  setSelectedSlot: (s: number) => void;
  selectedDoctor: DoctorInfo | undefined;
  doctorMonthShifts: Map<number, { day: boolean; night: boolean }>;
  monthlyCounts: Map<string, MonthlyCounts>;
  holidaySet: Set<string>;
  avgInterval: string | null;
  calendarSlot: MonthSlot;
  daysInMonth: number;
  monthSlots: MonthSlot[];
  slotLabels: string[];
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
  const firstDayOfWeek = new Date(calendarSlot.year, calendarSlot.month - 1, 1).getDay(); // 0=Sun
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
          className="h-8 max-w-[10rem] truncate rounded-md border border-gray-400 px-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {data.doctors.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <button onClick={() => setSelectedSlot(Math.max(0, selectedSlot - 1))} className="rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"><ChevronLeft className="h-4 w-4" /></button>
          <select
            value={selectedSlot}
            onChange={e => setSelectedSlot(Number(e.target.value))}
            className="h-8 rounded-md border border-gray-400 px-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {slotLabels.map((lbl, i) => (
              <option key={i} value={i}>{lbl}</option>
            ))}
          </select>
          <button onClick={() => setSelectedSlot(Math.min(11, selectedSlot + 1))} className="rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"><ChevronRight className="h-4 w-4" /></button>
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
                    const dateKey = `${calendarSlot.year}-${pad2(calendarSlot.month)}-${pad2(day)}`;
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
              const mNight = counts ? counts.weekdayNight[selectedSlot] : 0;
              const mDay = counts ? counts.sunholDay[selectedSlot] : 0;
              const mSat = counts ? counts.satNight[selectedSlot] : 0;
              const mSunhol = counts ? counts.sunholNight[selectedSlot] : 0;
              return (mNight + mDay + mSat + mSunhol) > 0 ? (
                <div className="text-[10px] text-gray-500 space-y-0.5">
                  <p className="font-bold text-gray-700 text-[11px]">{slotLabels[selectedSlot]}の集計</p>
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
              ? `${slotLabels[0]}〜${slotLabels[11]} 集計`
              : `${slotLabels[rangeStart]}〜${slotLabels[rangeEnd]} 集計`}
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            <StatCard label="平日当直" value={yearTotalNight} color="green" />
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

        {/* Right: Monthly stacked breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm h-full">
          <h3 className="text-xs font-bold text-gray-800 mb-2">月別内訳</h3>
          {(() => {
            // Find max total across all months for consistent bar scale
            let maxTotal = 0;
            for (let i = 0; i < 12; i++) {
              const wn = counts ? counts.weekdayNight[i] : 0;
              const sn = counts ? counts.satNight[i] : 0;
              const shd = counts ? counts.sunholDay[i] : 0;
              const shn = counts ? counts.sunholNight[i] : 0;
              maxTotal = Math.max(maxTotal, wn + sn + shd + shn);
            }
            if (maxTotal === 0) maxTotal = 1;
            return (
              <div className="space-y-0.5">
                {slotLabels.map((lbl, i) => {
                  const inRange = i >= rangeStart && i <= rangeEnd;
                  const wn = counts ? counts.weekdayNight[i] : 0;
                  const sn = counts ? counts.satNight[i] : 0;
                  const shd = counts ? counts.sunholDay[i] : 0;
                  const shn = counts ? counts.sunholNight[i] : 0;
                  const total = wn + sn + shd + shn;
                  const barW = (total / maxTotal) * 100;
                  return (
                    <div key={i} className={`flex items-center gap-1.5 ${inRange ? "" : "opacity-25"}`}>
                      <span className={`text-[11px] w-10 text-right truncate ${selectedSlot === i ? "font-bold text-blue-600" : "text-gray-500"}`}>{lbl}</span>
                      <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full flex" style={{ width: `${barW}%` }}>
                          {wn > 0 && <div className="h-full bg-green-500" style={{ flex: wn }} />}
                          {sn > 0 && <div className="h-full bg-blue-500" style={{ flex: sn }} />}
                          {shd > 0 && <div className="h-full bg-orange-400" style={{ flex: shd }} />}
                          {shn > 0 && <div className="h-full bg-red-500" style={{ flex: shn }} />}
                        </div>
                      </div>
                      <span className={`text-[11px] w-4 text-right ${total === 0 ? "text-gray-300" : "font-bold text-gray-700"}`}>{total || "-"}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />平日</span>
            <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />土曜</span>
            <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400" />日祝日</span>
            <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />日祝夜</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small stat card ──

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    green: "bg-green-50 text-green-700",
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
