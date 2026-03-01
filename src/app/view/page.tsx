// src/app/view/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
// ✅ 変更: html2canvasを削除し、最新のCSSに対応したmodern-screenshotをインポート
import { domToPng } from "modern-screenshot";

export default function ViewSchedulePage() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // 画像化する対象の要素を紐付けるためのRef
  const tableRef = useRef<HTMLDivElement>(null);

  // データ取得関数
  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/schedule/${year}/${month}`);
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

  // ✅ modern-screenshot を使った画像保存関数
  const handleDownloadImage = async () => {
    if (!tableRef.current || isDownloading) return;

    setIsDownloading(true);
    try {
      const dataUrl = await domToPng(tableRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        quality: 1.0,
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `当直表_${year}年${month}月.png`;
      link.click();
    } catch (error) {
      console.error("画像の保存に失敗しました", error);
      alert("画像の保存に失敗しました。");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-1 md:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="flex flex-wrap items-center justify-between mb-2 md:mb-6 gap-2">
          <h1 className="text-lg md:text-2xl font-bold text-slate-800">🗓️ 勤務カレンダー</h1>

          <div className="flex gap-2 w-full md:w-auto justify-between">
            <div className="flex items-center gap-1 bg-white p-1.5 rounded-lg shadow-sm border border-slate-200">
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-16 p-0 border-none focus:ring-0 text-center font-bold text-sm"
              />
              <span className="text-sm">年</span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="p-0 pl-1 border-none focus:ring-0 font-bold bg-transparent text-sm"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}月
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleDownloadImage}
              disabled={isDownloading || schedule.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-bold px-3 py-1.5 rounded-lg shadow flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              {isDownloading ? "保存中..." : "📥 画像保存"}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-20 text-slate-400">読み込み中...</div>
        ) : schedule.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
            この月のシフトはまだ登録されていません
          </div>
        ) : (
          <div ref={tableRef} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-2 text-center font-bold text-lg bg-slate-50 border-b border-slate-200">
              {year}年 {month}月 当直表
            </div>
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="py-1.5 px-2 font-semibold w-16 text-center">日付</th>
                  <th className="py-1.5 px-2 font-semibold bg-orange-600/10 text-orange-800">日直</th>
                  <th className="py-1.5 px-2 font-semibold bg-indigo-600/10 text-indigo-800">当直</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((day) => {
                  const wd = getWeekday(year, month, day.day);
                  const isSun = wd === "日";
                  const isSat = wd === "土";

                  return (
                    <tr key={day.day} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td
                        className={`py-1.5 px-2 font-medium text-center ${
                          isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-slate-600"
                        }`}
                      >
                        {day.day} <span className="text-[10px] md:text-xs">({wd})</span>
                      </td>
                      <td className="py-1.5 px-1">
                        {day.day_shift && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] md:text-xs font-bold bg-orange-100 text-orange-800 whitespace-nowrap">
                            👤 {day.day_shift.split(/[\s　]+/)[0]}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-1">
                        {day.night_shift && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] md:text-xs font-bold bg-indigo-100 text-indigo-800 whitespace-nowrap">
                            🌙 {day.night_shift.split(/[\s　]+/)[0]}
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