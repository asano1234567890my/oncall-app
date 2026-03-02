// src/app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Doctor = {
  id: string;
  name: string;

  // スコア（DB: float | null）
  min_score?: number | null;
  max_score?: number | null;
  target_score?: number | null;

  // ✅ DBの不可日（固定/単発）: unavailable_days
  unavailable_days?: {
    date: string | null; // "YYYY-MM-DD" or null
    day_of_week: number | null; // 0-6 or null
    is_fixed: boolean;
  }[];
};

type ObjectiveWeights = {
  // 既存互換用
  month_fairness: number;
  past_sat_gap: number;
  past_sunhol_gap: number;

  // 統合版
  gap5: number;
  pre_clinic: number;
  sat_consec: number;
  sunhol_3rd: number;
  gap6: number;
  score_balance: number;
  target: number;
};

const DEFAULT_OBJECTIVE_WEIGHTS: ObjectiveWeights = {
  month_fairness: 100,
  past_sat_gap: 10,
  past_sunhol_gap: 5,

  gap5: 100,
  pre_clinic: 100,
  sat_consec: 80,
  sunhol_3rd: 80,
  gap6: 50,
  score_balance: 30,
  target: 10,
};

export default function DashboardPage() {
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(4);
  const [numDoctors, setNumDoctors] = useState<number>(0);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // 祝日（全員共通の休み）
  const [holidays, setHolidays] = useState<number[]>([29]);

  // 仕様の主要条件（表示＋API送信に使う）
  const [scoreMin, setScoreMin] = useState<number>(0.5);
  const [scoreMax, setScoreMax] = useState<number>(4.5);

  // ✅ objectiveWeights を State 化
  const [objectiveWeights, setObjectiveWeights] = useState<ObjectiveWeights>(DEFAULT_OBJECTIVE_WEIGHTS);

  const setWeight = (key: keyof ObjectiveWeights, value: number) => {
    const v = Number.isFinite(value) ? Math.round(value) : 0;
    setObjectiveWeights((prev) => ({ ...prev, [key]: v }));
  };

  // シフト結果・状態管理
  const [schedule, setSchedule] = useState<any[]>([]);
  const [scores, setScores] = useState<any>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false); // ※シフト保存用
  const [saveMessage, setSaveMessage] = useState<string>("");

  // ✅ 要件①：全員一括保存用 state
  const [isBulkSavingDoctors, setIsBulkSavingDoctors] = useState<boolean>(false);

  // ✅ 重みスライダーの表示/非表示（UIのみ）
const [isWeightsOpen, setIsWeightsOpen] = useState(false);

  // 医師ごとの休み希望管理用（フロント側の既存State）
  const [selectedDocIndex, setSelectedDocIndex] = useState<number>(0);
  const [unavailableMap, setUnavailableMap] = useState<Record<number, number[]>>({});
  const [fixedUnavailableWeekdaysMap, setFixedUnavailableWeekdaysMap] = useState<Record<number, number[]>>({});

  // ✅ 月跨ぎ4日間隔（前月末勤務）
  const calcPrevMonthLastDay = (y: number, m: number) => new Date(y, m - 1, 0).getDate();
  const [prevMonthLastDay, setPrevMonthLastDay] = useState<number>(calcPrevMonthLastDay(2026, 4));
  const [prevMonthWorkedDaysMap, setPrevMonthWorkedDaysMap] = useState<Record<number, number[]>>({});

  // ✨ 個別スコア・条件設定用 State（フロント側）
  const [minScoreMap, setMinScoreMap] = useState<Record<number, number>>({});
  const [maxScoreMap, setMaxScoreMap] = useState<Record<number, number>>({});
  const [targetScoreMap, setTargetScoreMap] = useState<Record<number, number>>({});
  const [satPrevMap, setSatPrevMap] = useState<Record<number, boolean>>({});

  // =========================================================
  // ✅ ヘルパー
  // =========================================================
  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

  const weekdaysJp = ["日", "月", "火", "水", "木", "金", "土"];
  const getWeekday = (y: number, m: number, day: number) => weekdaysJp[new Date(y, m - 1, day).getDay()];

  const pyWeekdaysJp = ["月", "火", "水", "木", "金", "土", "日"];
  const pyWeekdays = [0, 1, 2, 3, 4, 5, 6];

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const toYmd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

  // =========================================================
  // ✅ 重要：DBの unavailable_days をフロントの Map State に復元
  // =========================================================
  const applyUnavailableDaysFromDoctors = (docs: Doctor[]) => {
    const nextUnavailable: Record<number, number[]> = {};
    const nextFixedWeekdays: Record<number, number[]> = {};

    docs.forEach((doc, idx) => {
      const list = doc.unavailable_days ?? [];
      const days: number[] = [];
      const weekdays: number[] = [];

      list.forEach((u) => {
        if (u.is_fixed === false) {
          if (u.date) {
            const dd = Number(u.date.slice(-2)); // "YYYY-MM-DD" -> DD
            if (Number.isFinite(dd)) days.push(dd);
          }
        } else {
          if (u.day_of_week !== null && u.day_of_week !== undefined) {
            weekdays.push(u.day_of_week);
          }
        }
      });

      if (days.length > 0) nextUnavailable[idx] = Array.from(new Set(days)).sort((a, b) => a - b);
      if (weekdays.length > 0) nextFixedWeekdays[idx] = Array.from(new Set(weekdays)).sort((a, b) => a - b);
    });

    setUnavailableMap(nextUnavailable);
    setFixedUnavailableWeekdaysMap(nextFixedWeekdays);
  };

  // =========================================================
  // ✅ 医師データ（スコア）を index-map に初期マッピング
  // =========================================================
  const applyScoresFromDoctors = (docs: Doctor[]) => {
    const initMin: Record<number, number> = {};
    const initMax: Record<number, number> = {};
    const initTarget: Record<number, number> = {};

    docs.forEach((doc, idx) => {
      if (doc.min_score !== null && doc.min_score !== undefined) initMin[idx] = doc.min_score;
      if (doc.max_score !== null && doc.max_score !== undefined) initMax[idx] = doc.max_score;
      if (doc.target_score !== null && doc.target_score !== undefined) initTarget[idx] = doc.target_score;
    });

    setMinScoreMap(initMin);
    setMaxScoreMap(initMax);
    setTargetScoreMap(initTarget);
  };

  // =========================================================
  // ✅ 医師リストの取得（GET）…一括保存でも再利用するため関数化
  // =========================================================
  const fetchDoctors = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/doctors/`);

      if (res.ok) {
        const data: Doctor[] = await res.json();
        setDoctors(data);
        setNumDoctors(data.length);

        // ✅ DBの不可日を復元
        applyUnavailableDaysFromDoctors(data);

        // ✅ DBのスコアを復元
        applyScoresFromDoctors(data);
      }
    } catch (err) {
      console.error("医師リストの取得に失敗:", err);
    }
  };

  // =========================================================
  // ✅ 医師リストの初期取得（GET）
  // =========================================================
  useEffect(() => {
    void fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 年月が変わったら「前月最終日」を自動更新
  useEffect(() => {
    const last = calcPrevMonthLastDay(year, month);
    setPrevMonthLastDay(last);
    setPrevMonthWorkedDaysMap({});
  }, [year, month]);

  // =========================================================
  // UI操作系
  // =========================================================
  const toggleHoliday = (day: number) => {
    setHolidays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)));
  };

  const toggleUnavailable = (docIdx: number, day: number) => {
    setUnavailableMap((prev) => {
      const currentDays = prev[docIdx] || [];
      const newDays = currentDays.includes(day) ? currentDays.filter((d) => d !== day) : [...currentDays, day].sort((a, b) => a - b);
      return { ...prev, [docIdx]: newDays };
    });
  };

  const toggleAllUnavailable = () => {
    setUnavailableMap((prev) => {
      const currentDays = prev[selectedDocIndex] || [];
      const daysInMonth = getDaysInMonth(year, month);

      let newDays: number[] = [];
      if (currentDays.length > 0) {
        newDays = [];
      } else {
        newDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      }
      return { ...prev, [selectedDocIndex]: newDays };
    });
  };

  const toggleFixedWeekday = (docIdx: number, weekdayPy: number) => {
    setFixedUnavailableWeekdaysMap((prev) => {
      const current = prev[docIdx] || [];
      const next = current.includes(weekdayPy) ? current.filter((w) => w !== weekdayPy) : [...current, weekdayPy].sort((a, b) => a - b);
      return { ...prev, [docIdx]: next };
    });
  };

  const togglePrevMonthWorkedDay = (docIdx: number, prevDay: number) => {
    setPrevMonthWorkedDaysMap((prev) => {
      const current = prev[docIdx] || [];
      const next = current.includes(prevDay) ? current.filter((d) => d !== prevDay) : [...current, prevDay].sort((a, b) => a - b);
      return { ...prev, [docIdx]: next };
    });
  };

  const toggleSatPrev = (docIdx: number) => {
    setSatPrevMap((prev) => ({ ...prev, [docIdx]: !prev[docIdx] }));
  };

  // =========================================================
  // ✅ 保存：医師設定（スコア＋休み希望）をまとめてPUT
  //   ※既存ロジックは残す（破壊しない）
  // =========================================================
  const saveDoctorSettings = async (docIdx: number) => {
    const doc = doctors[docIdx];
    if (!doc) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const fixedWeekdays = fixedUnavailableWeekdaysMap[docIdx] ?? [];

      // unavailableMap: [1,5,12] -> unavailable_dates: ["YYYY-MM-01", ...]
      const unavailableDays = unavailableMap[docIdx] ?? [];
      const unavailableDates = unavailableDays.map((day) => toYmd(year, month, day));

      const payload = {
        min_score: minScoreMap[docIdx] ?? null,
        max_score: maxScoreMap[docIdx] ?? null,
        target_score: targetScoreMap[docIdx] ?? null,

        fixed_weekdays: fixedWeekdays,
        unavailable_dates: unavailableDates,
      };

      const res = await fetch(`${apiUrl}/api/doctors/${doc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "医師設定の保存に失敗しました");
      }

      // ✅ 返却Doctorを採用し、doctors と map を同時に復元
      const updated: Doctor = await res.json().catch(() => doc);

      setDoctors((prev) => prev.map((d, i) => (i === docIdx ? { ...d, ...updated } : d)));

      // ✅ PUT後にDBの unavailable_days からUI Stateを復元（その医師だけ）
      {
        const list = updated.unavailable_days ?? [];
        const days: number[] = [];
        const weekdays: number[] = [];

        list.forEach((u) => {
          if (u.is_fixed === false) {
            if (u.date) {
              const dd = Number(u.date.slice(-2));
              if (Number.isFinite(dd)) days.push(dd);
            }
          } else {
            if (u.day_of_week !== null && u.day_of_week !== undefined) {
              weekdays.push(u.day_of_week);
            }
          }
        });

        const nextDays = Array.from(new Set(days)).sort((a, b) => a - b);
        const nextWeekdays = Array.from(new Set(weekdays)).sort((a, b) => a - b);

        setUnavailableMap((prev) => ({ ...prev, [docIdx]: nextDays }));
        setFixedUnavailableWeekdaysMap((prev) => ({ ...prev, [docIdx]: nextWeekdays }));
      }
    } catch (e: any) {
      setError(e.message || "医師設定の保存に失敗しました");
    }
  };

  // =========================================================
  // ✅ 要件①：全員の休み希望を一括保存（Promise.all）
  // =========================================================
  const saveAllDoctorsSettings = async () => {
    if (doctors.length === 0) return;

    setIsBulkSavingDoctors(true);
    setError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const tasks = doctors.map((doc, docIdx) => {
        const fixedWeekdays = fixedUnavailableWeekdaysMap[docIdx] ?? [];

        const unavailableDays = unavailableMap[docIdx] ?? [];
        const unavailableDates = unavailableDays.map((day) => toYmd(year, month, day));

        const payload = {
          min_score: minScoreMap[docIdx] ?? null,
          max_score: maxScoreMap[docIdx] ?? null,
          target_score: targetScoreMap[docIdx] ?? null,

          fixed_weekdays: fixedWeekdays,
          unavailable_dates: unavailableDates,
        };

        return fetch(`${apiUrl}/api/doctors/${doc.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const msg = errData.detail || `医師設定の保存に失敗: ${doc.name}`;
            throw new Error(msg);
          }
          return res.json().catch(() => doc);
        });
      });

      await Promise.all(tasks);

      alert("✅ 全員の休み希望（スコア含む）を保存しました。");
      await fetchDoctors();
    } catch (e: any) {
      setError(e?.message || "全員の保存に失敗しました");
      alert(`❌ 保存に失敗しました：${e?.message || ""}`);
    } finally {
      setIsBulkSavingDoctors(false);
    }
  };

  // =========================================================
  // ✨ シフト自動生成
  // =========================================================
  const handleGenerate = async () => {
    setIsLoading(true);
    setError("");
    setSchedule([]);
    setScores({});
    setSaveMessage("");

    try {
      const validHolidays = holidays.filter((d) => d <= getDaysInMonth(year, month));

      // ✅ 辞書のキーを明示的に文字列化
      const formattedUnavailable: Record<string, number[]> = {};
      const formattedFixedWeekdays: Record<string, number[]> = {};
      const formattedPrevMonthWorked: Record<string, number[]> = {};

      const formattedMinScore: Record<string, number> = {};
      const formattedMaxScore: Record<string, number> = {};
      const formattedTargetScore: Record<string, number> = {};
      const formattedSatPrev: Record<string, boolean> = {};

      Object.entries(unavailableMap).forEach(([k, v]) => {
        formattedUnavailable[String(k)] = v;
      });
      Object.entries(fixedUnavailableWeekdaysMap).forEach(([k, v]) => {
        formattedFixedWeekdays[String(k)] = v;
      });
      Object.entries(prevMonthWorkedDaysMap).forEach(([k, v]) => {
        formattedPrevMonthWorked[String(k)] = v;
      });

      Object.entries(minScoreMap).forEach(([k, v]) => {
        formattedMinScore[String(k)] = v;
      });
      Object.entries(maxScoreMap).forEach(([k, v]) => {
        formattedMaxScore[String(k)] = v;
      });
      Object.entries(targetScoreMap).forEach(([k, v]) => {
        formattedTargetScore[String(k)] = v;
      });
      Object.entries(satPrevMap).forEach(([k, v]) => {
        formattedSatPrev[String(k)] = v;
      });

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/optimize/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: year,
          month: month,
          num_doctors: numDoctors,
          holidays: validHolidays,

          unavailable: formattedUnavailable,
          fixed_unavailable_weekdays: formattedFixedWeekdays,
          prev_month_last_day: prevMonthLastDay,
          prev_month_worked_days: formattedPrevMonthWorked,
          score_min: scoreMin,
          score_max: scoreMax,

          // ✨ 個別設定データを送信
          min_score_by_doctor: formattedMinScore,
          max_score_by_doctor: formattedMaxScore,
          target_score_by_doctor: formattedTargetScore,
          sat_prev: formattedSatPrev,

          past_sat_counts: new Array(numDoctors).fill(0),
          past_sunhol_counts: new Array(numDoctors).fill(0),
          past_total_scores: {},

          objective_weights: objectiveWeights,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "最適化に失敗しました");
      }

      const data = await res.json();
      setSchedule(data.schedule);
      setScores(data.scores);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 💾 データベースへ保存（シフト）
  const handleSaveToDB = async () => {
    setIsSaving(true);
    setSaveMessage("");
    setError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/schedule/save/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month,
          num_doctors: numDoctors,
          schedule: schedule.map((s) => ({
            day: s.day,
            day_shift: s.day_shift,
            night_shift: s.night_shift,
          })),
        }),
      });

      if (!res.ok) throw new Error("保存に失敗しました");

      const data = await res.json();
      setSaveMessage(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const prevMonthTailDays = (() => {
    const last = prevMonthLastDay;
    const start = Math.max(1, last - 3);
    const days: number[] = [];
    for (let d = start; d <= last; d++) days.push(d);
    return days;
  })();

  // =========================================================
  // ✅ 要件②：重み設定のサマリー表示用
  // =========================================================
  const weightChanges = useMemo(() => {
    const keys = Object.keys(DEFAULT_OBJECTIVE_WEIGHTS) as (keyof ObjectiveWeights)[];
    const changed = keys
      .map((k) => ({ key: k, base: DEFAULT_OBJECTIVE_WEIGHTS[k], now: objectiveWeights[k] }))
      .filter((x) => x.base !== x.now);

    const isDefault = changed.length === 0;

    // 表示は多すぎると邪魔なので最大3件
    const top = changed.slice(0, 3).map((c) => `${String(c.key)}:${c.now}`);
    return { isDefault, changedCount: changed.length, top };
  }, [objectiveWeights]);

  return (
    <div className="min-h-screen bg-gray-50 p-2 md:p-8 font-sans">
      <main className="w-full max-w-5xl mx-auto bg-white rounded-xl shadow-lg p-4 md:p-8">
        <h1 className="text-xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-8 border-b pb-4">🏥 当直表 自動生成ダッシュボード</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-4 md:mb-8">
          {/* --- 左側：条件設定フォーム --- */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 col-span-1 h-fit">
            <h2 className="text-xl font-bold text-blue-800 mb-4">⚙️ 生成条件</h2>

            {/* 主要条件表示 */}
            <div className="mb-6 p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
              <div className="text-sm font-bold text-gray-700 mb-2 text-center">📌 適用中の主要条件</div>

              <ul className="text-xs text-gray-700 space-y-1.5">
                <li className="flex gap-2">
                  <span className="font-bold text-blue-700 shrink-0">ハード</span>
                  <span>4日間隔(月跨ぎ含) / 土曜月1回 / 日祝同日禁止 / 日直上限2回 / 研究日・前日禁止</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-700 shrink-0">スコア</span>
                  <span>
                    共通範囲: {scoreMin} 〜 {scoreMax} <span className="text-[10px] text-orange-600">(個別設定優先)</span>
                  </span>
                </li>

                <li className="flex gap-2 items-start">
  <span className="font-bold text-blue-700 shrink-0">重み</span>

  <div className="min-w-0 flex-1">
    <div className="flex items-start justify-between gap-2">
      {/* 左：サマリー（バッジ群） */}
      <span className="flex flex-wrap items-center gap-1">
        {weightChanges.isDefault ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            現在：標準設定
          </span>
        ) : (
          <>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              変更あり：{weightChanges.changedCount}件
            </span>
            {weightChanges.top.map((t) => (
              <span
                key={t}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200"
              >
                {t}
              </span>
            ))}
          </>
        )}
      </span>

      {/* 右：赤丸エリアの【設定】ボタン */}
      <button
        type="button"
        onClick={() => setIsWeightsOpen((v) => !v)}
        className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-[0.99] transition"
      >
        設定
      </button>
    </div>

    {/* クリックで開く：重み調整パネル（ここにスライダーを格納） */}
    {isWeightsOpen && (
      <div className="mt-3 rounded-lg border border-blue-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
          <div className="text-[12px] font-bold text-blue-800">⚙️ 最適化の詳細設定（重み調整）</div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setObjectiveWeights(DEFAULT_OBJECTIVE_WEIGHTS)}
              className="text-[10px] font-bold text-blue-700 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 bg-white"
              title="重みだけ初期値に戻します"
            >
              初期値
            </button>
            <button
              type="button"
              onClick={() => setIsWeightsOpen(false)}
              className="text-[10px] font-bold text-gray-600 hover:text-gray-800 px-2 py-1 rounded border border-gray-200 bg-white"
            >
              閉じる
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {(
            [
              { key: "gap5", label: "5日間隔回避", min: 0, max: 200, step: 5, hint: "最大級" },
              { key: "pre_clinic", label: "外来前日回避", min: 0, max: 200, step: 5, hint: "最大級" },
              { key: "sunhol_3rd", label: "日祝3回目回避", min: 0, max: 200, step: 5, hint: "次点" },
              { key: "sat_consec", label: "連続土曜回避", min: 0, max: 200, step: 5, hint: "次点" },
              { key: "gap6", label: "6日間隔回避", min: 0, max: 200, step: 5, hint: "次点" },
              { key: "score_balance", label: "スコア公平性", min: 0, max: 200, step: 5, hint: "中" },
              { key: "target", label: "個別ターゲット", min: 0, max: 200, step: 5, hint: "弱" },
            ] as const
          ).map((w) => (
            <div key={w.key} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-gray-700 truncate">
                    {w.label}
                    <span className="ml-2 text-[10px] font-bold text-gray-400">{w.hint}</span>
                  </div>
                </div>

                <input
                  type="number"
                  inputMode="numeric"
                  value={objectiveWeights[w.key]}
                  onChange={(e) => setWeight(w.key, Number(e.target.value))}
                  className="w-20 p-2 text-sm font-bold text-center border rounded bg-gray-50"
                  min={w.min}
                  max={w.max}
                  step={w.step}
                />
              </div>

              <input
                type="range"
                value={objectiveWeights[w.key]}
                onChange={(e) => setWeight(w.key, Number(e.target.value))}
                min={w.min}
                max={w.max}
                step={w.step}
                className="w-full accent-blue-600"
              />

              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>{w.min}</span>
                <span>{w.max}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
</li>

                <li className="flex gap-2">
                  <span className="font-bold text-blue-700 shrink-0">目的</span>
                  <span>
                    ５日間隔 ({objectiveWeights.gap5}) ✕外来前日({objectiveWeights.pre_clinic}) ✕日祝３回目回避({objectiveWeights.sunhol_3rd})✕連続土曜({objectiveWeights.sat_consec}) ✕
                    ６日間隔({objectiveWeights.gap6}) ✕ スコア公平({objectiveWeights.score_balance})
                  </span>
                </li>
              </ul>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">score_min</label>
                  <input
                    type="number"
                    step="0.1"
                    value={scoreMin}
                    onChange={(e) => setScoreMin(Number(e.target.value))}
                    className="border rounded p-2 w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">score_max</label>
                  <input
                    type="number"
                    step="0.1"
                    value={scoreMax}
                    onChange={(e) => setScoreMax(Number(e.target.value))}
                    className="border rounded p-2 w-full text-sm"
                  />
                </div>
              </div>
              <div className="mt-2 text-[10px] text-gray-500">人数が少ない月は score_max を上げないと解なしになりやすいです。</div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">年</label>
                <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="border rounded p-2 w-full" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">月</label>
                <input type="number" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border rounded p-2 w-full" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-1">医師の人数</label>
              <div className="flex items-center gap-2">
                <input type="number" value={numDoctors} readOnly className="border rounded p-2 w-full bg-gray-100 text-gray-500 cursor-not-allowed" />
                <span className="text-sm font-bold text-blue-600">人</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {doctors.map((doc) => (
                  <span key={doc.id} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                    {doc.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-4 md:mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">共通の祝日設定</label>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1).map((day) => {
                  const isSelected = holidays.includes(day);
                  const isSun = getWeekday(year, month, day) === "日";
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleHoliday(day)}
                      disabled={isSun}
                      className={`w-8 h-8 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                        isSelected ? "bg-red-500 text-white" : isSun ? "bg-red-50 text-red-300" : "bg-white border text-gray-600"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 個別休み希望 */}
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-white rounded-lg border border-blue-100 shadow-sm relative">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-bold text-gray-700 text-center flex-grow pl-10">👨‍⚕️ 個別休み希望</label>
                <button
                  type="button"
                  onClick={toggleAllUnavailable}
                  className="text-[10px] text-gray-400 hover:text-red-600 border border-transparent hover:border-red-200 rounded px-1.5 py-1 transition-all"
                  title="1日でも不可日があればクリア、なければ月間すべて不可日にします"
                >
                  ↺ 一括クリア/一括選択
                </button>
              </div>

              <select
                value={selectedDocIndex}
                onChange={(e) => setSelectedDocIndex(Number(e.target.value))}
                className="w-full p-2 mb-4 border rounded font-bold text-blue-700 bg-blue-50 outline-none"
              >
                {doctors.map((doc, idx) => (
                  <option key={doc.id} value={idx}>
                    {doc.name} 先生
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap gap-1 justify-center">
                {Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1).map((day) => {
                  const isSelected = (unavailableMap[selectedDocIndex] || []).includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleUnavailable(selectedDocIndex, day)}
                      className={`w-7 h-7 rounded text-[10px] font-bold transition-all ${
                        isSelected ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex justify-between items-center text-[9px]">
                <span className="text-transparent">ダミー</span>
                <span className="text-indigo-500 font-bold">選択中: {unavailableMap[selectedDocIndex]?.length || 0} 日</span>
                <span className="text-transparent">ダミー</span>
              </div>
            </div>

            {/* 固定不可曜日（毎週固定） */}
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 mb-3 text-center">📅 固定不可曜日 一括入力</label>

              <div className="text-[10px] text-gray-500 text-center mb-3">各医師の「毎週入れない曜日」をチェックしてください。</div>

              <div className="overflow-x-auto">
                <div className="min-w-[200px]">
                  <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 items-center mb-2">
                    <div className="text-[11px] font-bold text-gray-600">医師</div>
                    {pyWeekdays.map((pyWd) => {
                      const label = pyWeekdaysJp[pyWd];
                      const isSun = pyWd === 6;
                      const isSat = pyWd === 5;
                      return (
                        <div
                          key={pyWd}
                          className={`text-[11px] font-bold text-center rounded py-1 border ${
                            isSun
                              ? "bg-red-50 text-red-500 border-red-100"
                              : isSat
                              ? "bg-blue-50 text-blue-600 border-blue-100"
                              : "bg-gray-50 text-gray-700 border-gray-100"
                          }`}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1">
                    {doctors.map((doc, docIdx) => (
                      <div key={doc.id} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 items-center">
                        <button
                          type="button"
                          onClick={() => setSelectedDocIndex(docIdx)}
                          className={`text-left text-[11px] font-bold px-2 py-2 rounded border truncate transition ${
                            selectedDocIndex === docIdx ? "bg-blue-600 text-white border-blue-700" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {doc.name}
                        </button>

                        {pyWeekdays.map((pyWd) => {
                          const selected = (fixedUnavailableWeekdaysMap[docIdx] || []).includes(pyWd);
                          const isSun = pyWd === 6;
                          const isSat = pyWd === 5;

                          return (
                            <button
                              key={`${doc.id}-${pyWd}`}
                              type="button"
                              onClick={() => toggleFixedWeekday(docIdx, pyWd)}
                              className={`h-9 rounded border text-[12px] font-bold transition ${
                                selected
                                  ? isSun
                                    ? "bg-red-500 text-white border-red-600"
                                    : isSat
                                    ? "bg-blue-600 text-white border-blue-700"
                                    : "bg-gray-900 text-white border-gray-900"
                                  : isSun
                                  ? "bg-red-50 text-red-400 border-red-200 hover:bg-red-100"
                                  : isSat
                                  ? "bg-blue-50 text-blue-500 border-blue-200 hover:bg-blue-100"
                                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              {selected ? "×" : ""}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[10px] text-center text-gray-500">
                選択中: <span className="font-bold text-gray-700">{doctors[selectedDocIndex]?.name || "未選択"}</span> ／ 固定不可:{" "}
                {(fixedUnavailableWeekdaysMap[selectedDocIndex] || []).length === 0
                  ? "なし"
                  : (fixedUnavailableWeekdaysMap[selectedDocIndex] || [])
                      .slice()
                      .sort((a, b) => a - b)
                      .map((wd) => pyWeekdaysJp[wd])
                      .join(" / ")}
              </div>
            </div>

            {/* 月跨ぎ4日間隔 */}
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 mb-3 text-center">⏮️ 前月末勤務</label>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">前月の最終日</label>
                  <input
                    type="number"
                    value={prevMonthLastDay}
                    onChange={(e) => setPrevMonthLastDay(Number(e.target.value))}
                    className="border rounded p-2 w-full text-sm"
                  />
                </div>
                <div className="text-[10px] text-gray-500 flex items-end">※年月変更時は自動計算されます</div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[200px]">
                  <div className="grid grid-cols-[90px_repeat(4,1fr)] gap-1 items-center mb-2">
                    <div className="text-[11px] font-bold text-gray-600">医師</div>
                    {prevMonthTailDays.map((d) => (
                      <div key={d} className="text-[11px] font-bold text-center rounded py-1 border bg-gray-50 text-gray-700 border-gray-100">
                        {d}日
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    {doctors.map((doc, docIdx) => (
                      <div key={doc.id} className="grid grid-cols-[90px_repeat(4,1fr)] gap-1 items-center">
                        <div className="text-left text-[11px] font-bold px-2 py-2 rounded border bg-white text-gray-700 border-gray-200 truncate">
                          {doc.name}
                        </div>

                        {prevMonthTailDays.map((d) => {
                          const selected = (prevMonthWorkedDaysMap[docIdx] || []).includes(d);
                          return (
                            <button
                              key={`${doc.id}-prev-${d}`}
                              type="button"
                              onClick={() => togglePrevMonthWorkedDay(docIdx, d)}
                              className={`h-9 rounded border text-[12px] font-bold transition ${
                                selected ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              {selected ? "×" : ""}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading || numDoctors === 0}
              className={`w-full py-3 rounded font-bold text-white shadow-md ${isLoading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {isLoading ? "AIが計算中..." : "✨ シフトを自動生成"}
            </button>
          </div>

          {/* --- 右側：結果表示エリア --- */}
          <div className="col-span-1 md:col-span-2">
            {/* ✅ 要件①：大きな一括保存ボタン（押しやすい位置） */}
            <div className="mb-4 md:mb-6">
              <button
                type="button"
                onClick={saveAllDoctorsSettings}
                disabled={isBulkSavingDoctors || doctors.length === 0}
                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition ${
                  isBulkSavingDoctors ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
                title="全医師のスコア設定＋休み希望（単発/固定）をまとめて保存します"
              >
                {isBulkSavingDoctors ? "保存中..." : "💾 全員の休み希望を一括保存"}
              </button>
              <div className="mt-2 text-[11px] text-gray-500">
                ※ 現在の「スコア設定（Min/Max/目標）」「固定不可曜日」「個別不可日」を全員分まとめて保存します。
              </div>
            </div>

            {/* 医師別スコア設定 */}
            <div className="bg-orange-50 p-3 md:p-6 rounded-lg border border-orange-100 shadow-sm mb-4 md:mb-6">
              <h3 className="text-md font-bold text-orange-800 mb-3 flex flex-wrap items-center gap-2">
                <span>🎯 医師別 スコア設定</span>
                <span className="text-xs font-normal text-orange-600 bg-orange-100 px-2 py-1 rounded">※空欄は全体設定を適用</span>
                <span className="text-xs font-normal text-gray-500 bg-white px-2 py-1 rounded border border-orange-200">
                  ※保存は上の「一括保存」ボタン
                </span>
              </h3>

              <div className="overflow-x-auto bg-white border rounded-lg">
                <table className="min-w-full text-center text-[12px]">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      <th className="py-2 px-2 border-b text-left">医師名</th>
                      <th className="py-2 px-2 border-b">Min</th>
                      <th className="py-2 px-2 border-b">Max</th>
                      <th className="py-2 px-2 border-b">目標</th>
                      <th className="py-2 px-2 border-b text-orange-700">前月土曜当直</th>
                      {/* ✅ 要件①：行ごとの保存ボタンは廃止 */}
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map((doc, idx) => (
                      <tr key={doc.id} className="border-b hover:bg-gray-50">
                        <td className="py-1 px-2 text-left font-bold text-gray-700 whitespace-nowrap">{doc.name}</td>

                        <td className="py-1 px-2">
                          <input
                            type="number"
                            step="0.5"
                            className="w-12 md:w-14 border rounded p-1 text-center"
                            value={minScoreMap[idx] === undefined ? "" : minScoreMap[idx]}
                            onChange={(e) => setMinScoreMap({ ...minScoreMap, [idx]: parseFloat(e.target.value) })}
                            placeholder={String(scoreMin)}
                          />
                        </td>

                        <td className="py-1 px-2">
                          <input
                            type="number"
                            step="0.5"
                            className="w-12 md:w-14 border rounded p-1 text-center"
                            value={maxScoreMap[idx] === undefined ? "" : maxScoreMap[idx]}
                            onChange={(e) => setMaxScoreMap({ ...maxScoreMap, [idx]: parseFloat(e.target.value) })}
                            placeholder={String(scoreMax)}
                          />
                        </td>

                        <td className="py-1 px-2">
                          <input
                            type="number"
                            step="0.5"
                            className="w-12 md:w-16 border rounded p-1 text-center bg-blue-50"
                            value={targetScoreMap[idx] === undefined ? "" : targetScoreMap[idx]}
                            onChange={(e) => setTargetScoreMap({ ...targetScoreMap, [idx]: parseFloat(e.target.value) })}
                            placeholder="任意"
                          />
                        </td>

                        <td className="py-1 px-2">
                          <button
                            type="button"
                            onClick={() => toggleSatPrev(idx)}
                            className={`px-2 py-1 rounded text-[10px] font-bold border ${
                              satPrevMap[idx] ? "bg-orange-500 text-white border-orange-600" : "bg-white text-gray-400 border-gray-200"
                            }`}
                          >
                            {satPrevMap[idx] ? "連続回避" : "なし"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && <div className="bg-red-100 text-red-700 p-3 mb-4 md:mb-6 rounded border-l-4 border-red-500">{error}</div>}

            {!schedule.length && !isLoading && !error && (
              <div className="flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-gray-300 rounded-lg text-gray-400 bg-gray-50 p-4 text-center">
                左下の「生成ボタン」を押してください
              </div>
            )}

            {schedule.length > 0 && (
              <div className="animate-fade-in">
                <div className="bg-gray-50 p-3 md:p-4 rounded-lg border mb-4 md:mb-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">⚖️ 負担スコア</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(scores).map(([docId, score]) => (
                      <div key={docId} className="bg-white px-2 py-1 rounded border text-xs shadow-sm flex items-center">
                        <span className="text-gray-500 mr-1 md:mr-2">{doctors[Number(docId)]?.name || `医${docId}`}</span>
                        <span className="font-bold">{String(score)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border shadow-sm">
                  <table className="min-w-full bg-white text-center text-sm">
                    <thead className="bg-gray-100 whitespace-nowrap">
                      <tr>
                        <th className="py-2 px-2 md:px-3 border-b">日付</th>
                        <th className="py-2 px-2 md:px-3 border-b">曜日</th>
                        <th className="py-2 px-2 md:px-3 border-b bg-orange-50">日直</th>
                        <th className="py-2 px-2 md:px-3 border-b bg-indigo-50">当直</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((row) => {
                        const wd = getWeekday(year, month, row.day);
                        const isSun = wd === "日";
                        const isSat = wd === "土";
                        const isHolidayLike = row.is_holiday || isSun;
                        return (
                          <tr key={row.day} className={`border-b ${isHolidayLike ? "bg-red-50" : isSat ? "bg-blue-50" : ""}`}>
                            <td className="py-2 px-2 md:px-3 whitespace-nowrap">{row.day}日</td>
                            <td className={`py-2 px-2 md:px-3 font-bold ${isSun ? "text-red-500" : isSat ? "text-blue-500" : ""}`}>{wd}</td>
                            <td className="py-2 px-2 md:px-3">
                              {row.day_shift !== null && row.day_shift !== undefined ? (
                                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                                  {doctors[row.day_shift]?.name}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="py-2 px-2 md:px-3">
                              {row.night_shift !== null && row.night_shift !== undefined ? (
                                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                                  {doctors[row.night_shift]?.name}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex flex-col items-center">
                  <button
                    onClick={handleSaveToDB}
                    disabled={isSaving}
                    className="px-6 py-3 md:px-8 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold shadow-lg transform hover:scale-105 transition w-full md:w-auto"
                  >
                    {isSaving ? "保存中..." : "💾 このシフトを確定・保存する"}
                  </button>
                  {saveMessage && <div className="mt-4 text-green-800 font-bold">🎉 {saveMessage}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}