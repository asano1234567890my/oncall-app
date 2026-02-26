"use client";

import { useState, useEffect } from "react";

export default function DashboardPage() {
  const [year, setYear] = useState<number>(2024);
  const [month, setMonth] = useState<number>(4);
  const [numDoctors, setNumDoctors] = useState<number>(0);
  const [doctors, setDoctors] = useState<{ id: string, name: string }[]>([]);

  // 祝日（全員共通の休み）
  const [holidays, setHolidays] = useState<number[]>([29]);

  // シフト結果・状態管理
  const [schedule, setSchedule] = useState<any[]>([]);
  const [scores, setScores] = useState<any>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>("");

  // 💡 医師ごとの休み希望管理用
  const [selectedDocIndex, setSelectedDocIndex] = useState<number>(0);
  const [unavailableMap, setUnavailableMap] = useState<Record<number, number[]>>({});

  // 医師リストの初期取得
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
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

  // ヘルパー関数
  const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
  const getWeekday = (year: number, month: number, day: number) => {
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return weekdays[new Date(year, month - 1, day).getDay()];
  };

  // 共通祝日の切り替え
  const toggleHoliday = (day: number) => {
    setHolidays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  // 💡 医師個別の休みを切り替える関数
  const toggleUnavailable = (docIdx: number, day: number) => {
    setUnavailableMap((prev) => {
      const currentDays = prev[docIdx] || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day].sort((a, b) => a - b);
      return { ...prev, [docIdx]: newDays };
    });
  };

  // ✨ シフト自動生成実行
  const handleGenerate = async () => {
    setIsLoading(true);
    setError("");
    setSchedule([]);
    setScores({});

    try {
      const validHolidays = holidays.filter(d => d <= getDaysInMonth(year, month));

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/doctors/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: year,
          month: month,
          num_doctors: numDoctors,
          holidays: validHolidays,
          unavailable: unavailableMap, // ポチポチしたMapを送信
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/doctors/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month,
          num_doctors: numDoctors,
          schedule: schedule.map(s => ({
            day: s.day,
            day_shift: s.day_shift,
            night_shift: s.night_shift
          }))
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
        <h1 className="text-3xl font-bold text-gray-800 mb-8 border-b pb-4">
          🏥 当直表 自動生成ダッシュボード
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* --- 左側：条件設定フォーム --- */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 col-span-1 h-fit">
            <h2 className="text-xl font-bold text-blue-800 mb-4">⚙️ 生成条件</h2>

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
                  type="number" value={numDoctors} readOnly
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
                      key={day} type="button" onClick={() => toggleHoliday(day)} disabled={isSun}
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

            {/* 🏥 医師ごとの休み希望（ポチポチUI） */}
            <div className="mb-6 p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 mb-3 text-center">👨‍⚕️ 個別休み希望</label>
              <select 
                value={selectedDocIndex} 
                onChange={(e) => setSelectedDocIndex(Number(e.target.value))}
                className="w-full p-2 mb-4 border rounded font-bold text-blue-700 bg-blue-50 outline-none"
              >
                {doctors.map((doc, idx) => (
                  <option key={doc.id} value={idx}>{doc.name} 先生</option>
                ))}
              </select>

              <div className="flex flex-wrap gap-1 justify-center">
                {Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1).map((day) => {
                  const isSelected = (unavailableMap[selectedDocIndex] || []).includes(day);
                  return (
                    <button
                      key={day} type="button" onClick={() => toggleUnavailable(selectedDocIndex, day)}
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

            <button
              onClick={handleGenerate} disabled={isLoading || numDoctors === 0}
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
                {/* スコア表示 */}
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

                {/* テーブル */}
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
                        return (
                          <tr key={row.day} className={`border-b ${row.is_holiday || wd === "日" ? "bg-red-50" : wd === "土" ? "bg-blue-50" : ""}`}>
                            <td className="py-2 px-3">{row.day}日</td>
                            <td className={`py-2 px-3 font-bold ${wd === "日" ? "text-red-500" : wd === "土" ? "text-blue-500" : ""}`}>{wd}</td>
                            <td className="py-2 px-3">{row.day_shift !== null ? <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold">{doctors[row.day_shift]?.name}</span> : "-"}</td>
                            <td className="py-2 px-3">{row.night_shift !== null ? <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-bold">{doctors[row.night_shift]?.name}</span> : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex flex-col items-center">
                  <button
                    onClick={handleSaveToDB} disabled={isSaving}
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