// src/app/components/InlineDemo.tsx — LP埋め込みデモ（ルール設定＋1か月分表示）
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, CheckCircle, Lightbulb, HelpCircle } from "lucide-react";

type ScheduleRow = {
  day: number;
  is_sunhol: boolean;
  day_shift: string | null;
  night_shift: string | null;
};

export default function InlineDemo() {
  // ── 基本設定 ──
  const [numDoctors, setNumDoctors] = useState(12);
  const [intervalDays, setIntervalDays] = useState(4);

  // ── 配分方法（基本設定として表示） ──
  const [distributionMode, setDistributionMode] = useState<"fair" | "seniority">("fair");
  const fairness = distributionMode === "fair";
  const seniorityMode = distributionMode === "seniority";

  // ── ハード制約 ──
  const [maxSaturdayNights, setMaxSaturdayNights] = useState(1);
  const [maxSunholWorks, setMaxSunholWorks] = useState<number | null>(3);
  const [holidayShiftMode, setHolidayShiftMode] = useState<"split" | "combined">("split");

  // ── シフトスコア（詳細設定で編集可能） ──
  const [scoreWeekdayNight, setScoreWeekdayNight] = useState(1.0);
  const [scoreSaturdayNight, setScoreSaturdayNight] = useState(1.5);
  const [scoreHolidayDay, setScoreHolidayDay] = useState(0.5);
  const [scoreHolidayNight, setScoreHolidayNight] = useState(1.0);
  const [showScoreHelp, setShowScoreHelp] = useState(false);

  // shiftsPerMonth is derived from numDoctors (hidden from user)
  const shiftsPerMonth = Math.max(1, Math.round(30 / numDoctors));

  // ── UI状態 ──
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [diagnosticErrors, setDiagnosticErrors] = useState<{ id: string; name_ja: string; current_value?: string | null; suggestion_ja?: string | null }[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [elapsedMs, setElapsedMs] = useState(0);
  const [swapSelection, setSwapSelection] = useState<{ day: number; type: "day" | "night" } | null>(null);
  const [swapCount, setSwapCount] = useState(0);

  const now = new Date();
  const [demoYear, setDemoYear] = useState(now.getFullYear());
  const [demoMonth, setDemoMonth] = useState(now.getMonth() + 1);

  const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

  const getDateStr = (day: number) => {
    const m = String(demoMonth).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${m}/${d}`;
  };

  const getWeekday = (day: number) => {
    const dow = new Date(demoYear, demoMonth - 1, day).getDay();
    return WEEKDAY_LABELS[dow === 0 ? 6 : dow - 1];
  };

  const isSaturday = (day: number) => {
    return new Date(demoYear, demoMonth - 1, day).getDay() === 6;
  };

  const intervalLabel = intervalDays === 0 ? "翌日OK" : `${intervalDays}日`;

  // ── 月変更 ──
  const changeMonth = (delta: number) => {
    let y = demoYear;
    let m = demoMonth + delta;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setDemoYear(y);
    setDemoMonth(m);
  };

  // ── 適用中ルール数 ──
  const ruleCount = [
    true, // 当直間隔
    maxSaturdayNights < 99,
    maxSunholWorks !== null,
    true, // 日当直モード
    fairness,

    seniorityMode,
  ].filter(Boolean).length;

  // ── 年次別スコア目標を計算 ──
  // 中央値 = shiftsPerMonth, 最年長(医師N) = 1.0, 最年少(医師1) = shiftsPerMonth × 2
  const buildSeniorityScores = () => {
    if (!seniorityMode) return { target: {}, min: {}, max: {} };
    const juniorTarget = shiftsPerMonth * 2; // 最年少（医師0）
    const seniorTarget = 1.0;               // 最年長（医師N-1）
    const target: Record<string, number> = {};
    const min: Record<string, number> = {};
    const max: Record<string, number> = {};
    for (let i = 0; i < numDoctors; i++) {
      // 医師0 = 1年目(junior, high target), 医師N-1 = N年目(senior, low target)
      const ratio = numDoctors > 1 ? i / (numDoctors - 1) : 0;
      const t = juniorTarget - ratio * (juniorTarget - seniorTarget);
      target[String(i)] = Math.round(t * 10) / 10;
      min[String(i)] = Math.max(0.5, Math.round((t - 2) * 10) / 10);
      max[String(i)] = Math.round((t + 2) * 10) / 10;
    }
    return { target, min, max };
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError("");
    setDiagnosticErrors([]);
    const t0 = performance.now();
    try {
      const objectiveWeights: Record<string, number> = {};
      if (seniorityMode) {
        // 年次傾斜モード: 公平配分を抑えて年次目標を最優先
        objectiveWeights.month_fairness = 0;
        objectiveWeights.sunhol_fairness = 0;
        objectiveWeights.sat_month_fairness = 0;
        objectiveWeights.target = 300;
      } else if (fairness) {
        objectiveWeights.month_fairness = 100;
        objectiveWeights.sunhol_fairness = 200;
        objectiveWeights.sat_month_fairness = 100;
      } else {
        objectiveWeights.month_fairness = 0;
        objectiveWeights.sunhol_fairness = 0;
        objectiveWeights.sat_month_fairness = 0;
      }

      const seniority = buildSeniorityScores();
      const scoreMax = seniorityMode
        ? shiftsPerMonth * 2 + 1
        : Math.max(6, Math.ceil(30 / numDoctors) + 2);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/demo/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          num_doctors: numDoctors,
          year: demoYear,
          month: demoMonth,
          interval_days: intervalDays,
          max_saturday_nights: maxSaturdayNights,
          max_sunhol_works: maxSunholWorks,
          score_min: seniorityMode ? 0.5 : 0.5,
          score_max: seniorityMode ? scoreMax : 10,
          holiday_shift_mode: holidayShiftMode,
          objective_weights: objectiveWeights,
          target_score_by_doctor: seniorityMode ? seniority.target : undefined,
          min_score_by_doctor: seniorityMode ? seniority.min : undefined,
          max_score_by_doctor: seniorityMode ? seniority.max : undefined,
          shift_scores: {
            weekday_night: scoreWeekdayNight,
            saturday_night: scoreSaturdayNight,
            holiday_day: scoreHolidayDay,
            holiday_night: scoreHolidayNight,
          },
        }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = (data as Record<string, unknown>)?.detail;
        throw new Error(typeof detail === "string" ? detail : "生成に失敗しました");
      }
      const result = data as { success?: boolean; message?: string; schedule?: ScheduleRow[]; scores?: Record<string, number>; diagnostics?: { pre_check_errors?: { id: string; name_ja: string; current_value?: string | null; suggestion_ja?: string | null }[] } };
      if (result.success === false) {
        if (result.diagnostics?.pre_check_errors) {
          setDiagnosticErrors(result.diagnostics.pre_check_errors);
        }
        throw new Error(result.message || "スケジュールを生成できませんでした");
      }
      setSchedule(result.schedule || []);
      setScores(result.scores || {});
      setElapsedMs(performance.now() - t0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const getDoctorLabel = (id: string | null) => {
    if (!id) return "−";
    const match = id.match(/^demo_(\d+)$/);
    if (match) {
      const idx = Number(match[1]);
      if (seniorityMode) return `医師${idx + 1}(${idx + 1}年目)`;
      return `医師${idx + 1}`;
    }
    return id;
  };

  const getDoctorShortLabel = (id: string | null) => {
    if (!id) return "−";
    const match = id.match(/^demo_(\d+)$/);
    if (match) return `医${Number(match[1]) + 1}`;
    return id;
  };

  const dayOfWeekClass = (dow: string, isSunhol: boolean) => {
    if (isSunhol || dow === "日") return "text-red-600";
    if (dow === "土") return "text-blue-600";
    return "text-gray-700";
  };

  const rowBgClass = (row: ScheduleRow) => {
    if (row.is_sunhol) return "bg-red-50/40";
    if (isSaturday(row.day)) return "bg-blue-50/30";
    return "";
  };

  // ── スコア再計算（スワップ後に使用） ──
  const recalcScores = (sched: ScheduleRow[]): Record<string, number> => {
    const totals: Record<string, number> = {};
    for (const row of sched) {
      if (row.day_shift) {
        totals[row.day_shift] = (totals[row.day_shift] || 0) + scoreHolidayDay;
      }
      if (row.night_shift) {
        const sat = isSaturday(row.day);
        const w = row.is_sunhol ? scoreHolidayNight : sat ? scoreSaturdayNight : scoreWeekdayNight;
        totals[row.night_shift] = (totals[row.night_shift] || 0) + w;
      }
    }
    return totals;
  };

  // ── ハード制約チェック ──
  const [swapWarning, setSwapWarning] = useState("");
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showWarning = (msg: string) => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    setSwapWarning(msg);
    warningTimer.current = setTimeout(() => setSwapWarning(""), 2500);
  };
  useEffect(() => () => { if (warningTimer.current) clearTimeout(warningTimer.current); }, []);

  const getDoctorWorkDays = (sched: ScheduleRow[], doctorId: string): number[] => {
    const days: number[] = [];
    for (const row of sched) {
      if (row.day_shift === doctorId || row.night_shift === doctorId) {
        days.push(row.day);
      }
    }
    return days.sort((a, b) => a - b);
  };

  const checkConstraints = (sched: ScheduleRow[]): string | null => {
    // 当直間隔チェック
    const allDoctors = new Set<string>();
    for (const row of sched) {
      if (row.day_shift) allDoctors.add(row.day_shift);
      if (row.night_shift) allDoctors.add(row.night_shift);
    }
    for (const doc of allDoctors) {
      const workDays = getDoctorWorkDays(sched, doc);
      for (let i = 1; i < workDays.length; i++) {
        const gap = workDays[i] - workDays[i - 1] - 1;
        if (gap < intervalDays) {
          const label = getDoctorShortLabel(doc);
          return `${label}の${workDays[i - 1]}日と${workDays[i]}日の間隔が${gap}日しかありません（最低${intervalDays}日必要）`;
        }
      }
    }

    // 土曜当直上限チェック
    if (maxSaturdayNights < 99) {
      for (const doc of allDoctors) {
        let satCount = 0;
        for (const row of sched) {
          if (row.night_shift === doc && isSaturday(row.day)) satCount++;
        }
        if (satCount > maxSaturdayNights) {
          const label = getDoctorShortLabel(doc);
          return `${label}の土曜当直が${satCount}回になります（上限${maxSaturdayNights}回）`;
        }
      }
    }

    // 日祝勤務上限チェック
    if (maxSunholWorks !== null) {
      for (const doc of allDoctors) {
        let count = 0;
        for (const row of sched) {
          if (!row.is_sunhol) continue;
          if (row.day_shift === doc) count++;
          if (row.night_shift === doc) count++;
        }
        if (count > maxSunholWorks) {
          const label = getDoctorShortLabel(doc);
          return `${label}の日祝勤務が${count}回になります（上限${maxSunholWorks}回）`;
        }
      }
    }

    return null;
  };

  // ── 医師名タップ → ハイライト ──
  const [highlightDoctor, setHighlightDoctor] = useState<string | null>(null);

  const handleDoctorTap = (doctorId: string | null) => {
    if (!doctorId) return;
    setHighlightDoctor((prev) => (prev === doctorId ? null : doctorId));
  };

  const isSameDoctorHighlight = (doctorId: string | null) =>
    highlightDoctor !== null && doctorId === highlightDoctor;

  // ── combined判定 ──
  const isCombinedRow = (row: ScheduleRow) =>
    holidayShiftMode === "combined" && row.is_sunhol && row.day_shift && row.night_shift;

  // ── 入れ替え先の違反プレビュー ──
  // swapSelection が設定されている間、各セルに仮スワップして違反を事前チェック
  const swapViolationMap = useMemo(() => {
    const map = new Map<string, string>(); // "day-type" → 理由
    if (!swapSelection) return map;

    const selRow = schedule.find((r) => r.day === swapSelection.day);
    if (!selRow) return map;
    const combinedA = isCombinedRow(selRow);

    for (const row of schedule) {
      const types: Array<"day" | "night"> = [];
      if (row.day_shift && !combinedA && !(isCombinedRow(row))) types.push("day");
      if (row.night_shift) types.push("night");
      // combined の場合は night ボタンだけ（day は非表示）
      if (isCombinedRow(row)) {
        types.length = 0;
        types.push("night"); // combined は night ボタンで代表
      }

      for (const type of types) {
        const effectiveType = isCombinedRow(row) ? "day" as const : type;
        // 自分自身はスキップ
        if (swapSelection.day === row.day && swapSelection.type === effectiveType) continue;

        // 仮スワップ
        const newSched = schedule.map((r) => ({ ...r }));
        const rA = newSched.find((r) => r.day === swapSelection.day)!;
        const rB = newSched.find((r) => r.day === row.day)!;
        const combinedB = isCombinedRow(row);

        if (combinedA && combinedB) {
          const tmpD = rA.day_shift; const tmpN = rA.night_shift;
          rA.day_shift = rB.day_shift; rA.night_shift = rB.night_shift;
          rB.day_shift = tmpD; rB.night_shift = tmpN;
        } else if (combinedA) {
          const keyB = effectiveType === "day" ? "day_shift" as const : "night_shift" as const;
          const tmpDoc = rA.day_shift;
          rA.day_shift = rB[keyB]; rA.night_shift = rB[keyB];
          rB[keyB] = tmpDoc;
        } else if (combinedB) {
          const keyA = swapSelection.type === "day" ? "day_shift" as const : "night_shift" as const;
          const tmpDoc = rB.day_shift;
          rB.day_shift = rA[keyA]; rB.night_shift = rA[keyA];
          rA[keyA] = tmpDoc;
        } else {
          const keyA = swapSelection.type === "day" ? "day_shift" as const : "night_shift" as const;
          const keyB = effectiveType === "day" ? "day_shift" as const : "night_shift" as const;
          const tmp = rA[keyA];
          rA[keyA] = rB[keyB];
          rB[keyB] = tmp;
        }

        const violation = checkConstraints(newSched);
        if (violation) {
          map.set(`${row.day}-${type}`, violation);
        }
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapSelection, schedule, intervalDays, maxSaturdayNights, maxSunholWorks, holidayShiftMode]);

  const getSwapViolation = (day: number, type: "day" | "night"): string | null =>
    swapViolationMap.get(`${day}-${type}`) ?? null;

  // ── 入れ替えボタン ──
  const handleSwapBtn = (day: number, type: "day" | "night") => {
    setSwapWarning("");
    const row = schedule.find((r) => r.day === day);
    if (!row) return;
    const combined = isCombinedRow(row);
    const doctorId = type === "day" ? row.day_shift : row.night_shift;
    if (!doctorId) return;

    // combinedの場合、typeを正規化（どちらを押しても "day" 扱い）
    const effectiveType = combined ? "day" as const : type;

    if (!swapSelection) {
      setSwapSelection({ day, type: effectiveType });
      setHighlightDoctor(doctorId);
      return;
    }

    // 同じセルをもう一度 → 選択解除
    if (swapSelection.day === day && swapSelection.type === effectiveType) {
      setSwapSelection(null);
      setHighlightDoctor(null);
      return;
    }

    // スワップをシミュレーションして制約チェック
    const newSchedule = schedule.map((r) => ({ ...r }));
    const rowA = newSchedule.find((r) => r.day === swapSelection.day)!;
    const rowB = newSchedule.find((r) => r.day === day)!;
    const selRowA = schedule.find((r) => r.day === swapSelection.day)!;
    const combinedA = isCombinedRow(selRowA);

    if (combinedA && combined) {
      // 両方combined → day_shift, night_shift 両方入れ替え
      const tmpD = rowA.day_shift; const tmpN = rowA.night_shift;
      rowA.day_shift = rowB.day_shift; rowA.night_shift = rowB.night_shift;
      rowB.day_shift = tmpD; rowB.night_shift = tmpN;
    } else if (combinedA) {
      // A側がcombined → Aのday+nightをBの該当セルの医師に置換、Bの該当セルにAの元医師を入れる
      const keyB = effectiveType === "day" ? "day_shift" : "night_shift";
      const tmpDoc = rowA.day_shift;
      rowA.day_shift = rowB[keyB]; rowA.night_shift = rowB[keyB];
      rowB[keyB] = tmpDoc;
    } else if (combined) {
      // B側がcombined → Bのday+nightをAの該当セルの医師に置換
      const keyA = swapSelection.type === "day" ? "day_shift" : "night_shift";
      const tmpDoc = rowB.day_shift;
      rowB.day_shift = rowA[keyA]; rowB.night_shift = rowA[keyA];
      rowA[keyA] = tmpDoc;
    } else {
      // 通常の1セル入れ替え
      const keyA = swapSelection.type === "day" ? "day_shift" : "night_shift";
      const keyB = effectiveType === "day" ? "day_shift" : "night_shift";
      const tmp = rowA[keyA];
      rowA[keyA] = rowB[keyB];
      rowB[keyB] = tmp;
    }

    const violation = checkConstraints(newSchedule);
    if (violation) {
      showWarning(violation);
      setSwapSelection(null);
      setHighlightDoctor(null);
      return;
    }

    setSchedule(newSchedule);
    setScores(recalcScores(newSchedule));
    // combined行はday+nightの両方フラッシュ
    if (combinedA || combined) {
      const cells = new Set<string>();
      if (combinedA) { cells.add(`${swapSelection.day}-day`); cells.add(`${swapSelection.day}-night`); }
      else { cells.add(`${swapSelection.day}-${swapSelection.type}`); }
      if (combined) { cells.add(`${day}-day`); cells.add(`${day}-night`); }
      else { cells.add(`${day}-${effectiveType}`); }
      if (swappedTimer.current) clearTimeout(swappedTimer.current);
      setSwappedCells(cells);
      swappedTimer.current = setTimeout(() => setSwappedCells(new Set()), 1200);
    } else {
      flashSwapped(swapSelection, { day, type: effectiveType });
    }
    setSwapSelection(null);
    setHighlightDoctor(null);
    setSwapCount((c) => c + 1);
  };

  const isSwapSelected = (day: number, type: "day" | "night") =>
    swapSelection?.day === day && swapSelection?.type === type;

  // combined行では "day" で統一されるので、night側もチェック
  const isSwapSelectedCombined = (day: number) =>
    swapSelection?.day === day && swapSelection?.type === "day";

  // ── 入れ替え完了ハイライト（フェードアウト） ──
  const [swappedCells, setSwappedCells] = useState<Set<string>>(new Set());
  const swappedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSwapped = (a: { day: number; type: string }, b: { day: number; type: string }) => {
    if (swappedTimer.current) clearTimeout(swappedTimer.current);
    setSwappedCells(new Set([`${a.day}-${a.type}`, `${b.day}-${b.type}`]));
    swappedTimer.current = setTimeout(() => setSwappedCells(new Set()), 1200);
  };

  const isSwappedCell = (day: number, type: "day" | "night") =>
    swappedCells.has(`${day}-${type}`);

  // ── 結果表示 ──
  if (schedule.length > 0) {
    const scoreEntries = Object.entries(scores).sort(([a], [b]) => {
      const na = parseInt(a.replace(/\D/g, ""), 10);
      const nb = parseInt(b.replace(/\D/g, ""), 10);
      return na - nb;
    });
    const scoreValues = scoreEntries.map(([, v]) => v);
    const minScore = Math.min(...scoreValues);
    const maxScore = Math.max(...scoreValues);
    const scoreDiff = maxScore - minScore;

    return (
      <div className="relative">
        {/* ── 制約違反ポップアップ（ブラー付きオーバーレイ） ── */}
        {swapWarning && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-xl"
            onClick={() => setSwapWarning("")}
          >
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-xl" />
            <div className="relative z-10 mx-4 rounded-xl bg-white border-2 border-red-300 shadow-xl px-5 py-4 text-center animate-in fade-in zoom-in duration-200">
              <div className="mb-2 flex justify-center"><AlertTriangle className="h-7 w-7 text-red-500" /></div>
              <p className="text-sm font-bold text-red-700 mb-1">{swapWarning}</p>
              <p className="text-xs text-red-500">ルール違反のため入れ替えをキャンセルしました</p>
              <p className="text-[11px] text-gray-400 mt-2">タップで閉じる</p>
            </div>
          </div>
        )}

        {/* サマリーバナー */}
        <div className={`mb-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 px-4 py-3 text-center transition-[filter] ${swapWarning ? "blur-[2px]" : ""}`}>
          <p className="text-sm font-bold text-blue-800">
            {numDoctors}名 × {schedule.length}日 × {ruleCount}ルール
            <span className="mx-1.5 text-blue-400">→</span>
            <span className="text-blue-600">{(elapsedMs / 1000).toFixed(1)}秒</span>で生成
          </p>
          {seniorityMode ? (
            <p className="text-xs text-blue-600 mt-0.5">年次に応じた傾斜配分を適用</p>
          ) : scoreDiff <= 1.0 ? (
            <p className="text-xs text-blue-600 mt-0.5">スコア差 {scoreDiff.toFixed(1)} — 公平な配分です</p>
          ) : null}
        </div>

        {/* スワップ操作ヒント */}
        <div className={`mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-center transition-[filter] ${swapWarning ? "blur-[2px]" : ""}`}>
          {swapSelection ? (
            <p className="text-xs font-bold text-amber-700">
              <RefreshCw className="inline h-3.5 w-3.5 mr-1 align-middle" />入れ替え先の ↔ ボタンをタップしてください
            </p>
          ) : swapCount > 0 ? (
            <p className="text-xs text-amber-700">
              <CheckCircle className="inline h-3.5 w-3.5 mr-1 align-middle text-green-600" />{swapCount}回入れ替え済み — ↔ ボタンでさらに入れ替えできます
            </p>
          ) : (
            <p className="text-xs text-amber-700">
              <Lightbulb className="inline h-3.5 w-3.5 mr-1 align-middle" />名前タップでハイライト / ↔ ボタンで入れ替え
            </p>
          )}
        </div>

        {/* 1か月分のスケジュール表 */}
        <div className={`mb-4 overflow-x-auto rounded-lg border border-gray-200 transition-[filter] ${swapWarning ? "blur-[2px]" : ""}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-2 py-2 text-left font-medium text-xs">日付</th>
                <th className="px-1 py-2 text-left font-medium text-xs">曜</th>
                <th className="px-1 py-2 text-left font-medium text-xs" colSpan={2}>日直</th>
                <th className="px-1 py-2 text-left font-medium text-xs" colSpan={2}>当直</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schedule.map((row) => {
                const dow = getWeekday(row.day);
                const combined = isCombinedRow(row);
                const dayViolation = getSwapViolation(row.day, "day");
                const nightViolation = getSwapViolation(row.day, "night");
                return (
                  <tr key={row.day} className={rowBgClass(row)}>
                    <td className="px-2 py-1 font-mono text-xs text-gray-500">{getDateStr(row.day)}</td>
                    <td className={`px-1 py-1 font-bold text-xs ${dayOfWeekClass(dow, row.is_sunhol)}`}>
                      {dow}
                    </td>
                    {/* 日直 名前 */}
                    <td
                      className={`px-1 py-1 text-xs font-medium select-none rounded ${
                        isSwappedCell(row.day, "day")
                          ? "demo-swap-flash"
                          : swapSelection && dayViolation
                            ? "bg-red-100 text-red-700"
                            : isSameDoctorHighlight(row.day_shift)
                              ? "bg-blue-100 text-blue-800"
                              : row.day_shift
                                ? "text-gray-800 cursor-pointer hover:bg-blue-50 transition-colors"
                                : "text-gray-400"
                      }`}
                      onClick={() => handleDoctorTap(row.day_shift)}
                      title={swapSelection && dayViolation ? dayViolation : undefined}
                    >
                      {row.day_shift ? getDoctorShortLabel(row.day_shift) : "−"}
                    </td>
                    {/* 日直 入れ替えボタン（combined時は非表示） */}
                    <td className="px-0.5 py-1">
                      {row.day_shift && !combined && (
                        <button
                          onClick={() => handleSwapBtn(row.day, "day")}
                          className={`px-2.5 py-1 rounded text-sm font-bold border transition-colors ${
                            isSwapSelected(row.day, "day")
                              ? "bg-blue-500 text-white border-blue-500"
                              : dayViolation && swapSelection
                                ? "bg-red-50 text-red-400 border-red-200 cursor-not-allowed"
                                : "bg-amber-50 text-amber-600 border-amber-300 hover:bg-amber-100"
                          }`}
                          title={swapSelection && dayViolation ? dayViolation : "入れ替え"}
                        >↔</button>
                      )}
                    </td>
                    {/* 当直 名前 */}
                    <td
                      className={`px-1 py-1 text-xs font-medium select-none rounded ${
                        isSwappedCell(row.day, "night")
                          ? "demo-swap-flash"
                          : swapSelection && nightViolation
                            ? "bg-red-100 text-red-700"
                            : isSameDoctorHighlight(row.night_shift)
                              ? "bg-blue-100 text-blue-800"
                              : row.night_shift
                                ? "text-gray-800 cursor-pointer hover:bg-blue-50 transition-colors"
                                : "text-gray-400"
                      }`}
                      onClick={() => handleDoctorTap(row.night_shift)}
                      title={swapSelection && nightViolation ? nightViolation : undefined}
                    >
                      {getDoctorShortLabel(row.night_shift)}
                    </td>
                    {/* 当直 入れ替えボタン（combined時はセットで入れ替え） */}
                    <td className="px-0.5 py-1">
                      {row.night_shift && (
                        <button
                          onClick={() => handleSwapBtn(row.day, combined ? "day" : "night")}
                          className={`px-2.5 py-1 rounded text-sm font-bold border transition-colors ${
                            (combined ? isSwapSelectedCombined(row.day) : isSwapSelected(row.day, "night"))
                              ? "bg-blue-500 text-white border-blue-500"
                              : (combined ? dayViolation : nightViolation) && swapSelection
                                ? "bg-red-50 text-red-400 border-red-200 cursor-not-allowed"
                                : "bg-amber-50 text-amber-600 border-amber-300 hover:bg-amber-100"
                          }`}
                          title={swapSelection && (combined ? dayViolation : nightViolation) ? (combined ? dayViolation : nightViolation)! : (combined ? "日当直セットで入れ替え" : "入れ替え")}
                        >{combined ? "⇄" : "↔"}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 全医師スコア */}
        {scoreEntries.length > 0 && (
          <div className={`mb-4 transition-[filter] ${swapWarning ? "blur-[2px]" : ""}`}>
            <p className="text-xs font-medium text-gray-500 mb-2 text-center">
              {seniorityMode ? "医師ごとの負担スコア（年次傾斜あり）" : "医師ごとの負担スコア"}
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {scoreEntries.map(([id, score]) => (
                <span
                  key={id}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    score === minScore
                      ? "bg-green-100 text-green-700"
                      : score === maxScore
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {getDoctorLabel(id)}: {typeof score === "number" ? score.toFixed(1) : score}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* アクション */}
        <div className={`flex gap-3 transition-[filter] ${swapWarning ? "blur-[2px]" : ""}`}>
          <button
            onClick={() => { setSchedule([]); setScores({}); setSwapSelection(null); setSwapCount(0); setHighlightDoctor(null); }}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            設定を変えてもう一度
          </button>
          <Link
            href="/register"
            className="flex-1 rounded-xl bg-blue-600 py-3 text-center text-sm font-bold text-white shadow-lg hover:bg-blue-700 transition-colors"
          >
            無料で始める
          </Link>
        </div>
      </div>
    );
  }

  // ── 設定フォーム ──
  return (
    <div className="space-y-5">
      {/* 医師の人数 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">医師の人数</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={2}
            max={15}
            value={numDoctors}
            onChange={(e) => setNumDoctors(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-14 text-right text-lg font-bold text-gray-800">{numDoctors}名</span>
        </div>
      </div>

      {/* 当直間隔 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
          当直明けに空ける日数
          <span className="ml-2 text-sm font-normal text-blue-600">{intervalLabel}</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={7}
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-14 text-right text-lg font-bold text-gray-800">
            {intervalDays === 0 ? "0日" : `${intervalDays}日`}
          </span>
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5 px-0.5">
          <span>翌日OK</span>
          <span>7日</span>
        </div>
      </div>

      {/* 当直の配分方法 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">当直の配分方法</label>
        <div className="flex gap-2">
          <ChoiceBtn selected={distributionMode === "fair"} onClick={() => setDistributionMode("fair")}>
            公平に配分
          </ChoiceBtn>
          <ChoiceBtn selected={distributionMode === "seniority"} onClick={() => setDistributionMode("seniority")}>
            年次で傾斜
          </ChoiceBtn>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          {distributionMode === "fair"
            ? "全員の負担スコアが均等になるよう配分します。土曜当直など負担の重いシフトも偏りなく割り振られます。"
            : `医師1＝1年目 … 医師${numDoctors}＝${numDoctors}年目として、ベテランほど少なく配分します。`}
        </p>
      </div>

      {/* 詳細ルール トグル */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <span>詳細ルール（{ruleCount}件のルールを適用中）</span>
        {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {showAdvanced && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
          {/* ── 必ず守るルール ── */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">必ず守るルール（ハード制約）</p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">土曜当直の上限（月あたり）</label>
                <div className="flex gap-2">
                  {[
                    { value: 1, label: "1回" },
                    { value: 2, label: "2回" },
                    { value: 99, label: "なし" },
                  ].map(({ value, label }) => (
                    <ChoiceBtn key={value} selected={maxSaturdayNights === value} onClick={() => setMaxSaturdayNights(value)}>
                      {label}
                    </ChoiceBtn>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1.5">日祝の勤務上限（月あたり）</label>
                <div className="flex gap-2">
                  {[
                    { value: 2, label: "2回" },
                    { value: 3, label: "3回" },
                    { value: null as number | null, label: "なし" },
                  ].map(({ value, label }) => (
                    <ChoiceBtn key={String(value)} selected={maxSunholWorks === value} onClick={() => setMaxSunholWorks(value)}>
                      {label}
                    </ChoiceBtn>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1.5">日祝の日直・当直</label>
                <div className="flex gap-2">
                  <ChoiceBtn selected={holidayShiftMode === "split"} onClick={() => setHolidayShiftMode("split")}>
                    別の人が担当
                  </ChoiceBtn>
                  <ChoiceBtn selected={holidayShiftMode === "combined"} onClick={() => setHolidayShiftMode("combined")}>
                    同じ人が担当
                  </ChoiceBtn>
                </div>
              </div>
            </div>
          </div>

          {/* ── 負担スコアの設定 ── */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">負担スコア（公平配分の基準）</p>
              <button
                type="button"
                onClick={() => setShowScoreHelp(!showScoreHelp)}
                className="text-gray-400 hover:text-blue-500 transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </div>

            {showScoreHelp && (
              <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 space-y-1.5">
                <p className="font-bold">スコアとは？</p>
                <p>シフトの種類ごとに「負担の重さ」を数値化したものです。</p>
                <p>例えば土曜当直（1.5）は平日当直（1.0）の1.5倍の負担としてカウントされます。このスコアの合計が全員均等になるようにAIが配分します。</p>
                <p className="font-bold mt-2">なぜ日数ではなくスコア？</p>
                <p>単純に回数で均等にすると「土曜当直ばかりの人」と「平日当直ばかりの人」で不公平が生まれます。スコアで重み付けすることで、<span className="font-bold">体感的な公平さ</span>を実現します。</p>
              </div>
            )}

            <div className="space-y-2">
              <ScoreInput label="平日の当直" sublabel="月〜金の夜間" value={scoreWeekdayNight} onChange={setScoreWeekdayNight} />
              <ScoreInput label="土曜の当直" sublabel="土曜の夜間（翌日が休日）" value={scoreSaturdayNight} onChange={setScoreSaturdayNight} />
              <ScoreInput label="日祝の日直" sublabel="日曜・祝日の午前" value={scoreHolidayDay} onChange={setScoreHolidayDay} />
              <ScoreInput label="日祝の当直" sublabel="日曜・祝日の夜間" value={scoreHolidayNight} onChange={setScoreHolidayNight} />
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
              数値が大きいほど「負担が重い」シフトとして扱われ、割り当て人数が均等化されます。
            </p>
          </div>
        </div>
      )}

      {/* 対象月 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">対象月</label>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => changeMonth(-1)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            ←
          </button>
          <span className="text-lg font-bold text-gray-800 min-w-[8rem] text-center">
            {demoYear}年{demoMonth}月
          </span>
          <button
            onClick={() => changeMonth(1)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            →
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <p className="font-bold">{error}</p>
          {diagnosticErrors.map((d, i) => (
            <div key={i} className="mt-1.5 pl-2 border-l-2 border-red-300 text-xs">
              <p className="font-semibold">{d.name_ja}</p>
              {d.current_value && <p>{d.current_value}</p>}
              {d.suggestion_ja && <p className="text-red-500">{d.suggestion_ja}</p>}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => { void handleGenerate(); }}
        disabled={isLoading}
        className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            {numDoctors}名 × {ruleCount}ルールで生成中...
          </span>
        ) : (
          `${demoYear}年${demoMonth}月の当直表を生成する`
        )}
      </button>

      <p className="text-[11px] text-gray-400 text-center">
        登録不要・データは保存されません
      </p>
    </div>
  );
}

/* ── サブコンポーネント ── */

function ChoiceBtn({ selected, onClick, children }: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg border-2 py-2 text-sm font-bold transition-colors ${
        selected
          ? "border-blue-600 bg-blue-50 text-blue-700"
          : "border-gray-200 text-gray-600 hover:border-blue-200"
      }`}
    >
      {children}
    </button>
  );
}

function ToggleRow({ label, sublabel, checked, onChange }: {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5 cursor-pointer hover:bg-blue-50/30 transition-colors">
      <div className="min-w-0">
        <span className="text-sm text-gray-700">{label}</span>
        {sublabel && <p className="text-[11px] text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
      <div
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors cursor-pointer ${
          checked ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
    </label>
  );
}

function ScoreInput({ label, sublabel, value, onChange }: {
  label: string;
  sublabel: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
      <div className="min-w-0">
        <span className="text-sm text-gray-700">{label}</span>
        <p className="text-[10px] text-gray-400">{sublabel}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, Math.round((value - 0.5) * 10) / 10))}
          className="h-7 w-7 rounded border border-gray-200 bg-gray-50 text-sm font-bold text-gray-600 hover:bg-gray-100 transition"
        >
          −
        </button>
        <span className="w-10 text-center text-sm font-bold text-gray-800">{value.toFixed(1)}</span>
        <button
          type="button"
          onClick={() => onChange(Math.round((value + 0.5) * 10) / 10)}
          className="h-7 w-7 rounded border border-gray-200 bg-gray-50 text-sm font-bold text-gray-600 hover:bg-gray-100 transition"
        >
          +
        </button>
      </div>
    </div>
  );
}
