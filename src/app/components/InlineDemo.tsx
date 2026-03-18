// src/app/components/InlineDemo.tsx — LP埋め込みデモ
"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type ScheduleRow = {
  date: string;
  day_of_week: string;
  day_shift: string | null;
  night_shift: string | null;
  is_holiday: boolean;
};

export default function InlineDemo() {
  const [numDoctors, setNumDoctors] = useState(8);
  const [intervalDays, setIntervalDays] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});

  const handleGenerate = async () => {
    setIsLoading(true);
    setError("");
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/demo/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          num_doctors: numDoctors,
          year,
          month,
          interval_days: intervalDays,
          max_saturday_nights: 2,
          score_min: 3,
          score_max: 6,
        }),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const detail = (data as Record<string, unknown>)?.detail;
        throw new Error(typeof detail === "string" ? detail : "生成に失敗しました");
      }
      const data: unknown = await res.json();
      const result = data as { schedule?: ScheduleRow[]; scores?: Record<string, number> };
      setSchedule(result.schedule || []);
      setScores(result.scores || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const getDoctorLabel = (id: string | null) => {
    if (!id) return "−";
    const match = id.match(/^demo_(\d+)$/);
    if (match) return `医師${Number(match[1]) + 1}`;
    return id;
  };

  const dayOfWeekClass = (dow: string, isHoliday: boolean) => {
    if (isHoliday || dow === "日") return "text-red-600";
    if (dow === "土") return "text-blue-600";
    return "text-gray-700";
  };

  return (
    <div>
      {schedule.length === 0 ? (
        /* ── 設定フォーム ── */
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">医師の人数</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={2}
                max={15}
                value={numDoctors}
                onChange={(e) => setNumDoctors(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-12 text-right text-lg font-bold text-gray-800">{numDoctors}名</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">当直間隔</label>
            <div className="flex gap-2">
              {[
                { value: 0, label: "翌日OK" },
                { value: 1, label: "1日" },
                { value: 2, label: "2日" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setIntervalDays(value)}
                  className={`flex-1 rounded-lg border-2 py-2 text-sm font-bold transition-colors ${
                    intervalDays === value
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:border-blue-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            onClick={() => { void handleGenerate(); }}
            disabled={isLoading}
            className="w-full rounded-xl bg-blue-600 py-3 text-base font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                生成中...
              </span>
            ) : (
              "当直表を生成する"
            )}
          </button>
        </div>
      ) : (
        /* ── 結果表示 ── */
        <div>
          <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-3 py-2 text-left font-medium">日付</th>
                  <th className="px-3 py-2 text-left font-medium">曜日</th>
                  <th className="px-3 py-2 text-left font-medium">日直</th>
                  <th className="px-3 py-2 text-left font-medium">当直</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedule.slice(0, 14).map((row) => (
                  <tr key={row.date} className={row.is_holiday ? "bg-red-50/30" : ""}>
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{row.date.slice(5)}</td>
                    <td className={`px-3 py-1.5 font-bold text-xs ${dayOfWeekClass(row.day_of_week, row.is_holiday)}`}>
                      {row.day_of_week}
                    </td>
                    <td className="px-3 py-1.5 text-xs">{row.day_shift ? getDoctorLabel(row.day_shift) : "−"}</td>
                    <td className="px-3 py-1.5 text-xs font-medium">{getDoctorLabel(row.night_shift)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {schedule.length > 14 && (
            <p className="text-xs text-gray-400 text-center mb-4">
              ...他 {schedule.length - 14} 日分（登録すると全日表示）
            </p>
          )}

          {/* スコア表示 */}
          {Object.keys(scores).length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2 justify-center">
              {Object.entries(scores)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(0, 8)
                .map(([id, score]) => (
                  <span key={id} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                    {getDoctorLabel(id)}: {typeof score === "number" ? score.toFixed(1) : score}
                  </span>
                ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setSchedule([]); setScores({}); }}
              className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              もう一度
            </button>
            <Link
              href="/register"
              className="flex-1 rounded-xl bg-blue-600 py-3 text-center text-sm font-bold text-white shadow-lg hover:bg-blue-700 transition-colors"
            >
              無料で始める
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
