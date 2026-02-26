"use client";

import { useState, useEffect } from "react";

type Doctor = { id: string; name: string };

export default function DashboardPage() {
  const [year, setYear] = useState<number>(2024);
  const [month, setMonth] = useState<number>(4);
  const [numDoctors, setNumDoctors] = useState<number>(0);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // 祝日（全員共通の休み）
  const [holidays, setHolidays] = useState<number[]>([29]);

  // 仕様の主要条件（表示＋API送信に使う）
  const [scoreMin, setScoreMin] = useState<number>(0.5);
  const [scoreMax, setScoreMax] = useState<number>(4.5);
  const objectiveWeights = {
    // 既存互換用
    month_fairness: 100,
    past_sat_gap: 10,
    past_sunhol_gap: 5,
    // 統合版：新規追加（※バックエンドに合わせて整数化）
    gap5: 100,          // 最大級（勤務後5日目を強く避ける）
    pre_clinic: 100,    // 最大級（外来前日当直を強く避ける）
    sat_consec: 80,     // 次点（2ヶ月連続土曜を避ける）
    gap6: 50,           // 次点（勤務後6日目を避ける）
    score_balance: 30,  // 中（全体スコアの公平性）
    target: 10,         // 弱（個別ターゲット）
  };

  // シフト結果・状態管理
  const [schedule, setSchedule] = useState<any[]>([]);
  const [scores, setScores] = useState<any>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>("");

  // 医師ごとの休み希望管理用
  const [selectedDocIndex, setSelectedDocIndex] = useState<number>(0);
  const [unavailableMap, setUnavailableMap] = useState<Record<number, number[]>>({});

  // ✅ 固定不可曜日（毎週固定）
  const [fixedUnavailableWeekdaysMap, setFixedUnavailableWeekdaysMap] = useState<Record<number, number[]>>({});

  // ✅ 月跨ぎ4日間隔（前月末勤務）
  const calcPrevMonthLastDay = (y: number, m: number) => {
    return new Date(y, m - 1, 0).getDate();
  };
  const [prevMonthLastDay, setPrevMonthLastDay] = useState<number>(calcPrevMonthLastDay(2024, 4));
  const [prevMonthWorkedDaysMap, setPrevMonthWorkedDaysMap] = useState<Record<number, number[]>>({});

  // ✨ 【追加】個別スコア・条件設定用 State
  const [minScoreMap, setMinScoreMap] = useState<Record<number, number>>({});
  const [maxScoreMap, setMaxScoreMap] = useState<Record<number, number>>({});
  const [targetScoreMap, setTargetScoreMap] = useState<Record<number, number>>({});
  const [satPrevMap, setSatPrevMap] = useState<Record<number, boolean>>({});

// 医師リストの初期取得
useEffect(() => {
  const fetchDoctors = async () => {
    try {
      // ✅ 環境変数からURLを取得。設定されていなければローカルのURLを使う
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/doctors/`);
      
      if (res.ok) {
        const data = await res.json();
        setDoctors(data);
        setNumDoctors(data.length);
      }
    } catch (err) {
      console.error("医師リストの取得に失敗:", err);
    }
  };
  fetchDoctors();
}, []);

  // 年月が変わったら「前月最終日」を自動更新
  useEffect(() => {
    const last = calcPrevMonthLastDay(year, month);
    setPrevMonthLastDay(last);
    setPrevMonthWorkedDaysMap({});
  }, [year, month]);

  // ヘルパー関数
  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const weekdaysJp = ["日", "月", "火", "水", "木", "金", "土"]; 
  const getWeekday = (y: number, m: number, day: number) => {
    return weekdaysJp[new Date(y, m - 1, day).getDay()];
  };
  const pyWeekdaysJp = ["月", "火", "水", "木", "金", "土", "日"]; 
  const pyWeekdays = [0, 1, 2, 3, 4, 5, 6];

  // 共通祝日の切り替え
  const toggleHoliday = (day: number) => {
    setHolidays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  // 個別休みの切り替え
  const toggleUnavailable = (docIdx: number, day: number) => {
    setUnavailableMap((prev) => {
      const currentDays = prev[docIdx] || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day].sort((a, b) => a - b);
      return { ...prev, [docIdx]: newDays };
    });
  };

  // 固定不可曜日の切り替え
  const toggleFixedWeekday = (docIdx: number, weekdayPy: number) => {
    setFixedUnavailableWeekdaysMap((prev) => {
      const current = prev[docIdx] || [];
      const next = current.includes(weekdayPy)
        ? current.filter((w) => w !== weekdayPy)
        : [...current, weekdayPy].sort((a, b) => a - b);
      return { ...prev, [docIdx]: next };
    });
  };

  // 前月末勤務日の切り替え
  const togglePrevMonthWorkedDay = (docIdx: number, prevDay: number) => {
    setPrevMonthWorkedDaysMap((prev) => {
      const current = prev[docIdx] || [];
      const next = current.includes(prevDay)
        ? current.filter((d) => d !== prevDay)
        : [...current, prevDay].sort((a, b) => a - b);
      return { ...prev, [docIdx]: next };
    });
  };

  // ✨ 【追加】前月土曜当直フラグの切り替え
  const toggleSatPrev = (docIdx: number) => {
    setSatPrevMap((prev) => ({ ...prev, [docIdx]: !prev[docIdx] }));
  };

  // ✨ シフト自動生成
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
      
      Object.entries(unavailableMap).forEach(([k, v]) => { formattedUnavailable[String(k)] = v; });
      Object.entries(fixedUnavailableWeekdaysMap).forEach(([k, v]) => { formattedFixedWeekdays[String(k)] = v; });
      Object.entries(prevMonthWorkedDaysMap).forEach(([k, v]) => { formattedPrevMonthWorked[String(k)] = v; });
      
      Object.entries(minScoreMap).forEach(([k, v]) => { formattedMinScore[String(k)] = v; });
      Object.entries(maxScoreMap).forEach(([k, v]) => { formattedMaxScore[String(k)] = v; });
      Object.entries(targetScoreMap).forEach(([k, v]) => { formattedTargetScore[String(k)] = v; });
      Object.entries(satPrevMap).forEach(([k, v]) => { formattedSatPrev[String(k)] = v; });

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

          // ✨ 【追加】個別設定データを送信
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

  // 💾 データベースへ保存
  const handleSaveToDB = async () => {
    setIsSaving(true);
    setSaveMessage("");
    setError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"; // ← これを追加
      const res = await fetch(`${apiUrl}/api/schedule/save`, {
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

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <main className="max-w-5xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 border-b pb-4">🏥 当直表 自動生成ダッシュボード</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* --- 左側：条件設定フォーム --- */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 col-span-1 h-fit">
            <h2 className="text-xl font-bold text-blue-800 mb-4">⚙️ 生成条件</h2>

            {/* 主要条件表示 */}
            <div className="mb-6 p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
              <div className="text-sm font-bold text-gray-700 mb-2 text-center">📌 適用中の主要条件</div>

              <ul className="text-xs text-gray-700 space-y-1">
                <li className="flex gap-2">
                  <span className="font-bold text-blue-700">ハード</span>
                  <span>4日間隔（勤務後4日禁止） / 月跨ぎ4日間隔 / 土曜当直は月1回まで / 日祝同日兼務禁止</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-700">スコア</span>
                  <span>
                    月間スコア範囲: {scoreMin} 〜 {scoreMax}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-700">目的</span>
                  <span>
                    当月公平 : 過去土曜 : 過去日祝 = {objectiveWeights.month_fairness}:{objectiveWeights.past_sat_gap}:
                    {objectiveWeights.past_sunhol_gap}
                  </span>
                </li>
              </ul>

              <div className="mt-3 grid grid-cols-2 gap-3">
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

            <div className="grid grid-cols-2 gap-4 mb-4">
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
                <input
                  type="number"
                  value={numDoctors}
                  readOnly
                  className="border rounded p-2 w-full bg-gray-100 text-gray-500 cursor-not-allowed"
                />
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

            <div className="mb-6">
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
            <div className="mb-6 p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 mb-3 text-center">👨‍⚕️ 個別休み希望</label>
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
              <div className="mt-2 text-[9px] text-center text-indigo-500 font-bold">
                選択中: {unavailableMap[selectedDocIndex]?.length || 0} 日
              </div>
            </div>

            {/* ✅ 固定不可曜日（毎週固定）：全医師×曜日で一括入力 */}
            <div className="mb-6 p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 mb-3 text-center">📅 固定不可曜日（毎週） 一括入力</label>

              <div className="text-[10px] text-gray-500 text-center mb-3">
                各医師の「毎週入れない曜日」をチェックしてください（バックエンドと一致：0=月..6=日）。
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[520px]">
                  <div className="grid grid-cols-[180px_repeat(7,1fr)] gap-1 items-center mb-2">
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
                      <div key={doc.id} className="grid grid-cols-[180px_repeat(7,1fr)] gap-1 items-center">
                        <button
                          type="button"
                          onClick={() => setSelectedDocIndex(docIdx)}
                          className={`text-left text-[11px] font-bold px-2 py-2 rounded border truncate transition ${
                            selectedDocIndex === docIdx
                              ? "bg-blue-600 text-white border-blue-700"
                              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                          }`}
                          title="クリックで個別休み希望の対象を切り替え"
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
                              title={`${doc.name}：${pyWeekdaysJp[pyWd]}曜日を固定不可にする`}
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
                個別休み希望の対象:{" "}
                <span className="font-bold text-gray-700">{doctors[selectedDocIndex]?.name || "未選択"}</span>{" "}
                ／ 固定不可:{" "}
                {(fixedUnavailableWeekdaysMap[selectedDocIndex] || []).length === 0
                  ? "なし"
                  : (fixedUnavailableWeekdaysMap[selectedDocIndex] || [])
                      .slice()
                      .sort((a, b) => a - b)
                      .map((wd) => pyWeekdaysJp[wd])
                      .join(" / ")}
              </div>
            </div>

            {/* ✅ 月跨ぎ4日間隔：前月末勤務入力（最小） */}
            <div className="mb-6 p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 mb-3 text-center">⏮️ 月跨ぎ4日間隔：前月末勤務</label>

              <div className="text-[10px] text-gray-500 text-center mb-3">
                前月末に勤務がある医師は、当月初日〜数日が自動で禁止になります（厳密な月跨ぎ4日間隔）。
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">前月の最終日（28/29/30/31）</label>
                  <input
                    type="number"
                    value={prevMonthLastDay}
                    onChange={(e) => setPrevMonthLastDay(Number(e.target.value))}
                    className="border rounded p-2 w-full text-sm"
                  />
                </div>
                <div className="text-[10px] text-gray-500 flex items-end">
                  ※年月変更時は自動計算し直し＆選択クリアされます
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[520px]">
                  <div className="grid grid-cols-[180px_repeat(4,1fr)] gap-1 items-center mb-2">
                    <div className="text-[11px] font-bold text-gray-600">医師</div>
                    {prevMonthTailDays.map((d) => (
                      <div key={d} className="text-[11px] font-bold text-center rounded py-1 border bg-gray-50 text-gray-700 border-gray-100">
                        {d}日
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    {doctors.map((doc, docIdx) => (
                      <div key={doc.id} className="grid grid-cols-[180px_repeat(4,1fr)] gap-1 items-center">
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
                                selected
                                  ? "bg-gray-900 text-white border-gray-900"
                                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                              }`}
                              title={`${doc.name}：前月${d}日に勤務した`}
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
                ※ここは「前月末の勤務があった日」だけを入力する簡易版です（必要最小）
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
          <div className="col-span-2">
            
            {/* ✨ 【追加】医師個別のスコア・条件設定テーブル */}
            <div className="bg-orange-50 p-6 rounded-lg border border-orange-100 shadow-sm mb-6">
              <h3 className="text-md font-bold text-orange-800 mb-3 flex items-center gap-2">
                <span>🎯 医師別 スコア＆条件設定</span>
                <span className="text-xs font-normal text-orange-600 bg-orange-100 px-2 py-1 rounded">※空欄は全体設定({scoreMin}〜{scoreMax})を適用</span>
              </h3>
              
              <div className="overflow-x-auto bg-white border rounded-lg">
                <table className="min-w-full text-center text-[12px]">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      <th className="py-2 px-2 border-b text-left">医師名</th>
                      <th className="py-2 px-2 border-b">Min</th>
                      <th className="py-2 px-2 border-b">Max</th>
                      <th className="py-2 px-2 border-b">目標(Target)</th>
                      <th className="py-2 px-2 border-b text-orange-700">前月土曜当直</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map((doc, idx) => (
                      <tr key={doc.id} className="border-b hover:bg-gray-50">
                        <td className="py-1 px-2 text-left font-bold text-gray-700">{doc.name}</td>
                        <td className="py-1 px-2">
                          <input type="number" step="0.5" className="w-14 border rounded p-1 text-center"
                            value={minScoreMap[idx] === undefined ? "" : minScoreMap[idx]} 
                            onChange={(e) => setMinScoreMap({...minScoreMap, [idx]: parseFloat(e.target.value)})} 
                            placeholder={String(scoreMin)} 
                          />
                        </td>
                        <td className="py-1 px-2">
                          <input type="number" step="0.5" className="w-14 border rounded p-1 text-center"
                            value={maxScoreMap[idx] === undefined ? "" : maxScoreMap[idx]} 
                            onChange={(e) => setMaxScoreMap({...maxScoreMap, [idx]: parseFloat(e.target.value)})} 
                            placeholder={String(scoreMax)} 
                          />
                        </td>
                        <td className="py-1 px-2">
                          <input type="number" step="0.5" className="w-16 border rounded p-1 text-center bg-blue-50"
                            value={targetScoreMap[idx] === undefined ? "" : targetScoreMap[idx]} 
                            onChange={(e) => setTargetScoreMap({...targetScoreMap, [idx]: parseFloat(e.target.value)})} 
                            placeholder="任意" 
                          />
                        </td>
                        <td className="py-1 px-2">
                          <button 
                            onClick={() => toggleSatPrev(idx)} 
                            className={`px-3 py-1 rounded text-[10px] font-bold border ${satPrevMap[idx] ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-gray-400 border-gray-200'}`}
                          >
                            {satPrevMap[idx] ? "はい (連続回避)" : "いいえ"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && <div className="bg-red-100 text-red-700 p-4 mb-6 rounded border-l-4 border-red-500">{error}</div>}

            {!schedule.length && !isLoading && !error && (
              <div className="flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-gray-300 rounded-lg text-gray-400 bg-gray-50">
                左下の「生成ボタン」を押してください
              </div>
            )}

            {schedule.length > 0 && (
              <div className="animate-fade-in">
                <div className="bg-gray-50 p-4 rounded-lg border mb-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">⚖️ 負担スコア</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(scores).map(([docId, score]) => (
                      <div key={docId} className="bg-white px-3 py-1 rounded border text-xs shadow-sm">
                        <span className="text-gray-500 mr-2">{doctors[Number(docId)]?.name || `医${docId}`}</span>
                        <span className="font-bold">{String(score)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border shadow-sm">
                  <table className="min-w-full bg-white text-center text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-2 px-3 border-b">日付</th>
                        <th className="py-2 px-3 border-b">曜日</th>
                        <th className="py-2 px-3 border-b bg-orange-50">日直</th>
                        <th className="py-2 px-3 border-b bg-indigo-50">当直</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((row) => {
                        const wd = getWeekday(year, month, row.day);
                        const isSun = wd === "日";
                        const isSat = wd === "土";
                        const isHolidayLike = row.is_holiday || isSun; // 旧レスポンス互換
                        return (
                          <tr key={row.day} className={`border-b ${isHolidayLike ? "bg-red-50" : isSat ? "bg-blue-50" : ""}`}>
                            <td className="py-2 px-3">{row.day}日</td>
                            <td className={`py-2 px-3 font-bold ${isSun ? "text-red-500" : isSat ? "text-blue-500" : ""}`}>{wd}</td>
                            <td className="py-2 px-3">
                              {row.day_shift !== null && row.day_shift !== undefined ? (
                                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold">
                                  {doctors[row.day_shift]?.name}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {row.night_shift !== null && row.night_shift !== undefined ? (
                                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-bold">
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
                    className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold shadow-lg transform hover:scale-105 transition"
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