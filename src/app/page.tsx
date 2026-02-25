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
    month_fairness: 100,
    past_sat_gap: 10,
    past_sunhol_gap: 5,
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

  // ✅ 医師ごとの固定不可曜日（毎週固定）
  // doctorIndex -> [weekday 0=Mon..6=Sun]  ← Python datetime.weekday() と一致させる
  const [fixedUnavailableWeekdaysMap, setFixedUnavailableWeekdaysMap] = useState<Record<number, number[]>>({});

  // 医師リストの初期取得
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/doctors/");
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

  // ヘルパー関数（表示用：JS基準）
  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const weekdaysJp = ["日", "月", "火", "水", "木", "金", "土"]; // JS getDay(): 0=日..6=土
  const getWeekday = (y: number, m: number, day: number) => {
    return weekdaysJp[new Date(y, m - 1, day).getDay()];
  };

  // ✅ Python weekday 用（バックエンドと合わせる：0=月..6=日）
  const pyWeekdaysJp = ["月", "火", "水", "木", "金", "土", "日"]; // Python weekday(): 0=月..6=日
  const pyWeekdays = [0, 1, 2, 3, 4, 5, 6];

  // 共通祝日の切り替え
  const toggleHoliday = (day: number) => {
    setHolidays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  // 医師個別の休み（日付）を切り替える
  const toggleUnavailable = (docIdx: number, day: number) => {
    setUnavailableMap((prev) => {
      const currentDays = prev[docIdx] || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day].sort((a, b) => a - b);
      return { ...prev, [docIdx]: newDays };
    });
  };

  // 固定不可曜日を切り替える（Python基準 weekday を保持）
  const toggleFixedWeekday = (docIdx: number, weekdayPy: number) => {
    setFixedUnavailableWeekdaysMap((prev) => {
      const current = prev[docIdx] || [];
      const next = current.includes(weekdayPy)
        ? current.filter((w) => w !== weekdayPy)
        : [...current, weekdayPy].sort((a, b) => a - b);
      return { ...prev, [docIdx]: next };
    });
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

      const res = await fetch("http://127.0.0.1:8000/api/optimize/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: year,
          month: month,
          num_doctors: numDoctors,
          holidays: validHolidays,

          // 個別不可日
          unavailable: unavailableMap,

          // 固定不可曜日（Python基準で送る）
          fixed_unavailable_weekdays: fixedUnavailableWeekdaysMap,

          // 主要条件
          score_min: scoreMin,
          score_max: scoreMax,
          objective_weights: objectiveWeights,

          // NOTE: 月跨ぎ4日間隔・過去補正はUI未対応（MVP最小）
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
      const res = await fetch("http://127.0.0.1:8000/api/schedule/save", {
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
                  <span>4日間隔（勤務後4日禁止） / 土曜当直は月1回まで / 日祝同日兼務禁止</span>
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
                <li className="text-[10px] text-gray-500">※月跨ぎ4日間隔・過去補正入力はUI未対応（現状0扱い）</li>
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
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="border rounded p-2 w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">月</label>
                <input
                  type="number"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="border rounded p-2 w-full"
                />
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
                  <span
                    key={doc.id}
                    className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200"
                  >
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

            {/* 固定不可曜日（毎週固定） */}
            <div className="mb-6 p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 mb-3 text-center">📅 固定不可曜日（毎週）</label>

              <div className="text-[10px] text-gray-500 text-center mb-3">
                選択中の医師に対して、毎週この曜日は勤務に入りません。
              </div>

              <div className="flex items-center justify-center gap-2 flex-wrap">
                {pyWeekdays.map((pyWd) => {
                  const label = pyWeekdaysJp[pyWd];
                  const selected = (fixedUnavailableWeekdaysMap[selectedDocIndex] || []).includes(pyWd);
                  const isSun = pyWd === 6; // Python: 6=日
                  const isSat = pyWd === 5; // Python: 5=土

                  return (
                    <button
                      key={pyWd}
                      type="button"
                      onClick={() => toggleFixedWeekday(selectedDocIndex, pyWd)}
                      className={`w-9 h-9 rounded-full text-[11px] font-bold border transition-all ${
                        selected
                          ? isSun
                            ? "bg-red-500 text-white border-red-600"
                            : isSat
                            ? "bg-blue-600 text-white border-blue-700"
                            : "bg-gray-800 text-white border-gray-900"
                          : isSun
                          ? "bg-red-50 text-red-400 border-red-200"
                          : isSat
                          ? "bg-blue-50 text-blue-500 border-blue-200"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                      title={`${doctors[selectedDocIndex]?.name || "医師"}：${label}曜日を固定不可にする`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 text-[9px] text-center text-gray-500">
                固定不可:{" "}
                {(fixedUnavailableWeekdaysMap[selectedDocIndex] || [])
                  .slice()
                  .sort((a, b) => a - b)
                  .map((wd) => pyWeekdaysJp[wd])}
                {(fixedUnavailableWeekdaysMap[selectedDocIndex] || []).length === 0 ? "なし" : ""}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading || numDoctors === 0}
              className={`w-full py-3 rounded font-bold text-white shadow-md ${
                isLoading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isLoading ? "AIが計算中..." : "✨ シフトを自動生成"}
            </button>
          </div>

          {/* --- 右側：結果表示エリア --- */}
          <div className="col-span-2">
            {error && <div className="bg-red-100 text-red-700 p-4 mb-6 rounded border-l-4 border-red-500">{error}</div>}

            {!schedule.length && !isLoading && !error && (
              <div className="flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-gray-300 rounded-lg text-gray-400 bg-gray-50">
                生成ボタンを押してください
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
                            <td className={`py-2 px-3 font-bold ${isSun ? "text-red-500" : isSat ? "text-blue-500" : ""}`}>
                              {wd}
                            </td>
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