// src/app/page.tsx
"use client";

import { useState } from "react";

export default function DashboardPage() {
  const [year, setYear] = useState<number>(2024);
  const [month, setMonth] = useState<number>(4);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [scores, setScores] = useState<any>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleGenerate = async () => {
    setIsLoading(true);
    setError("");
    setSchedule([]);
    setScores({});

    try {
      // FastAPIの最適化エンドポイントを叩く
      const res = await fetch("http://127.0.0.1:8000/api/optimize/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: year,
          month: month,
          num_doctors: 10, // テスト用: 医師10人
          holidays: [29],  // テスト用: 29日を祝日とする
          unavailable: { "0": [1, 2, 3], "1": [29, 30] }, // テスト用: 休み希望
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

  // 曜日を計算するヘルパー関数
  const getWeekday = (year: number, month: number, day: number) => {
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const date = new Date(year, month - 1, day);
    return weekdays[date.getDay()];
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <main className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 border-b pb-4">
          🏥 当直表 自動生成ダッシュボード
        </h1>

        {/* コントロールパネル */}
        <div className="flex items-end gap-4 mb-8 bg-blue-50 p-6 rounded-lg border border-blue-100">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">年</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border border-gray-300 rounded p-2 w-24 text-center"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">月</label>
            <input
              type="number"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="border border-gray-300 rounded p-2 w-20 text-center"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className={`px-8 py-2 rounded font-bold text-white transition ${
              isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow"
            }`}
          >
            {isLoading ? "AIが神シフトを計算中..." : "✨ シフトを自動生成する"}
          </button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-8 rounded">
            <p className="font-bold">エラーが発生しました</p>
            <p>{error}</p>
          </div>
        )}

        {/* 結果表示エリア */}
        {schedule.length > 0 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{year}年 {month}月 当直表</h2>
            
            <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm mb-8">
              <table className="min-w-full bg-white text-center">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="py-3 px-4 border-b">日付</th>
                    <th className="py-3 px-4 border-b">曜日</th>
                    <th className="py-3 px-4 border-b bg-orange-50">日直 (日祝のみ)</th>
                    <th className="py-3 px-4 border-b bg-indigo-50">当直</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row) => {
                    const weekday = getWeekday(year, month, row.day);
                    const isWeekend = weekday === "土" || weekday === "日" || row.is_holiday;
                    
                    return (
                      <tr key={row.day} className={`border-b ${row.is_holiday || weekday === "日" ? "bg-red-50" : weekday === "土" ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                        <td className="py-2 px-4 font-semibold">{row.day}日 {row.is_holiday && <span className="text-red-500 text-xs ml-1">[祝]</span>}</td>
                        <td className={`py-2 px-4 font-bold ${weekday === "日" ? "text-red-500" : weekday === "土" ? "text-blue-500" : ""}`}>{weekday}</td>
                        <td className="py-2 px-4">
                          {row.day_shift !== null ? (
                            <span className="inline-block bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-bold">医師 {row.day_shift}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-2 px-4">
                          {row.night_shift !== null ? (
                            <span className="inline-block bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-bold">医師 {row.night_shift}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* スコア（負担）の表示 */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-bold text-gray-700 mb-3">⚖️ 負担スコア（全員が平等になるよう調整済）</h3>
              <div className="flex flex-wrap gap-4">
                {Object.entries(scores).map(([docId, score]) => (
                  <div key={docId} className="bg-white px-4 py-2 rounded border border-gray-200 shadow-sm flex flex-col items-center">
                    <span className="text-sm text-gray-500">医師 {docId}</span>
                    <span className="text-lg font-bold text-gray-800">{String(score)}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}