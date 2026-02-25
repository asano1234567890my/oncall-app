// src/app/page.tsx
"use client";

import { useState } from "react";

export default function DashboardPage() {
  const [year, setYear] = useState<number>(2024);
  const [month, setMonth] = useState<number>(4);
  const [numDoctors, setNumDoctors] = useState<number>(10);
  
  // 変更点1：文字列ではなく、選ばれた日付の「配列」として状態を持つ
  const [holidays, setHolidays] = useState<number[]>([29]); 
  
  const [unavailableStr, setUnavailableStr] = useState<string>('{\n  "0": [1, 2, 3],\n  "1": [29, 30]\n}');

  const [schedule, setSchedule] = useState<any[]>([]);
  const [scores, setScores] = useState<any>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // 指定した月の日数を取得する関数（例：4月なら30）
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  // 曜日を取得する関数
  const getWeekday = (year: number, month: number, day: number) => {
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const date = new Date(year, month - 1, day);
    return weekdays[date.getDay()];
  };

  // 変更点2：祝日ボタンが押された時の処理（追加・削除の切り替え）
  const toggleHoliday = (day: number) => {
    setHolidays((prev) => 
      prev.includes(day) 
        ? prev.filter((d) => d !== day) // すでに選ばれていたら外す
        : [...prev, day].sort((a, b) => a - b) // 選ばれていなければ追加して並び替え
    );
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError("");
    setSchedule([]);
    setScores({});

    try {
      let parsedUnavailable = {};
      try {
        parsedUnavailable = JSON.parse(unavailableStr);
      } catch (e) {
        throw new Error("休み希望のJSONフォーマットが間違っています。");
      }

      // 存在しない日付（2月に30日など）が混ざらないようにフィルタリング
      const validHolidays = holidays.filter(d => d <= getDaysInMonth(year, month));

      const res = await fetch("http://127.0.0.1:8000/api/optimize/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: year,
          month: month,
          num_doctors: numDoctors,
          holidays: validHolidays, // 配列をそのまま送信
          unavailable: parsedUnavailable,
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
              <input type="number" value={numDoctors} min="1" onChange={(e) => setNumDoctors(Number(e.target.value))} className="border rounded p-2 w-full" />
            </div>

            {/* 変更点3：祝日選択用のポチポチカレンダーUI */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">祝日の選択</label>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1).map((day) => {
                  const isSelected = holidays.includes(day);
                  const isSunday = getWeekday(year, month, day) === "日";
                  
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleHoliday(day)}
                      disabled={isSunday} // 日曜は元々休日扱いなので押せなくする
                      className={`w-9 h-9 rounded-full text-sm font-bold flex items-center justify-center transition-all ${
                        isSelected
                          ? "bg-red-500 text-white shadow-md transform scale-105"
                          : isSunday
                          ? "bg-red-50 text-red-300 cursor-not-allowed border border-red-100" // 日曜日の見た目
                          : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400"
                      }`}
                      title={isSunday ? "日曜日は自動的に休日扱いになります" : `${day}日を祝日に設定`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-1">休み希望 (JSON形式)</label>
              <textarea 
                value={unavailableStr} 
                onChange={(e) => setUnavailableStr(e.target.value)} 
                rows={4}
                className="border rounded p-2 w-full font-mono text-sm" 
              />
              <p className="text-xs text-gray-500 mt-1">書式: "医師ID": [休みたい日, ...]</p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className={`w-full py-3 rounded font-bold text-white transition ${
                isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-md"
              }`}
            >
              {isLoading ? "AIが計算中..." : "✨ シフトを自動生成"}
            </button>
          </div>

          {/* --- 右側：結果表示エリア --- */}
          <div className="col-span-2">
            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
                <p className="font-bold">エラー</p>
                <p>{error}</p>
              </div>
            )}

            {!schedule.length && !isLoading && !error && (
              <div className="flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-gray-300 rounded-lg text-gray-400 bg-gray-50">
                左のフォームで条件を設定し、「自動生成」ボタンを押してください
              </div>
            )}

            {schedule.length > 0 && (
              <div className="animate-fade-in">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">⚖️ 負担スコア (目標: 均等)</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(scores).map(([docId, score]) => (
                      <div key={docId} className="bg-white px-3 py-1 rounded border border-gray-200 shadow-sm flex items-center gap-2">
                        <span className="text-xs text-gray-500">医{docId}</span>
                        <span className="text-sm font-bold text-gray-800">{String(score)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                  <table className="min-w-full bg-white text-center text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="py-2 px-3 border-b">日付</th>
                        <th className="py-2 px-3 border-b">曜日</th>
                        <th className="py-2 px-3 border-b bg-orange-50">日直</th>
                        <th className="py-2 px-3 border-b bg-indigo-50">当直</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((row) => {
                        const weekday = getWeekday(year, month, row.day);
                        return (
                          <tr key={row.day} className={`border-b ${row.is_holiday || weekday === "日" ? "bg-red-50" : weekday === "土" ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                            <td className="py-2 px-3">{row.day}日 {row.is_holiday && <span className="text-red-500 text-xs ml-1">[祝]</span>}</td>
                            <td className={`py-2 px-3 font-bold ${weekday === "日" ? "text-red-500" : weekday === "土" ? "text-blue-500" : ""}`}>{weekday}</td>
                            <td className="py-2 px-3">
                              {row.day_shift !== null ? <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-bold">医{row.day_shift}</span> : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="py-2 px-3">
                              {row.night_shift !== null ? <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full font-bold">医{row.night_shift}</span> : <span className="text-gray-300">-</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}