// src/app/view/page.tsx
"use client";

import { useState, useEffect } from "react";

export default function ViewSchedulePage() {
  const [year, setYear] = useState(2024);
  const [month, setMonth] = useState(4);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // データ取得関数
  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/schedule/${year}/${month}`);
      if (res.ok) {
        const data = await res.json();
        setSchedule(data);
      }
    } catch (error) {
      console.error("Failed to fetch:", error);
    } finally {
      setLoading(false);
    }
  };

  // 年月が変わるたびに自動で読み込む
  useEffect(() => {
    fetchSchedule();
  }, [year, month]);

  const getWeekday = (y: number, m: number, d: number) => {
    return ["日", "月", "火", "水", "木", "金", "土"][new Date(y, m - 1, d).getDay()];
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <h1 className="text-2xl font-bold text-slate-800">🗓️ 勤務カレンダー</h1>
          
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
            <input 
              type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="w-20 p-1 border-none focus:ring-0 text-center font-bold"
            />
            <span>年</span>
            <select 
              value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="p-1 border-none focus:ring-0 font-bold bg-transparent"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i+1} value={i+1}>{i+1}月</option>
              ))}
            </select>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-20 text-slate-400">読み込み中...</div>
        ) : schedule.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
            この月のシフトはまだ登録されていません
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-4 font-semibold w-24">日付</th>
                  <th className="p-4 font-semibold bg-orange-600/10 text-orange-800">日直</th>
                  <th className="p-4 font-semibold bg-indigo-600/10 text-indigo-800">当直</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((day) => {
                  const wd = getWeekday(year, month, day.day);
                  const isSun = wd === "日";
                  const isSat = wd === "土";

                  return (
                    <tr key={day.day} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className={`p-4 font-medium ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-slate-600'}`}>
                        {day.day}日 ({wd})
                      </td>
                      <td className="p-4">
                        {day.day_shift && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                            👤 {day.day_shift}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {day.night_shift && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                            🌙 {day.night_shift}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}