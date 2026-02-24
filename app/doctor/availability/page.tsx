"use client";

import React, { useState, useMemo } from "react";
import { DayPicker } from "react-day-picker";
import { format, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar, Send, Loader2 } from "lucide-react";
import "react-day-picker/style.css";

// 曜日ラベル（0:日 ～ 6:土）
const DAYS_OF_WEEK = [
  { value: 0, label: "日" },
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
] as const;

export default function DoctorAvailabilityPage() {
  const [unavailableDaysOfWeek, setUnavailableDaysOfWeek] = useState<number[]>([]);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 表示対象は「来月」（月初で統一）
  const nextMonth = useMemo(
    () => startOfMonth(addMonths(new Date(), 1)),
    []
  );

  const toggleDayOfWeek = (day: number) => {
    setUnavailableDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    console.log("不可日提出データ:", {
      selectedDates: selectedDates.map((d) => format(d, "yyyy-MM-dd", { locale: ja })),
      unavailableDaysOfWeek,
    });
    alert("不可日を提出しました。");
    setIsSubmitting(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* 1. ページヘッダー */}
        <header className="mb-8">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="text-blue-600" size={24} />
            来月の不可日入力
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            当直に入れない日と、毎週固定で入れない曜日を選択して提出してください。
          </p>
        </header>

        {/* 2. 毎週固定の不可曜日 */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            毎週固定の不可曜日
          </h2>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map(({ value, label }) => {
              const isSelected = unavailableDaysOfWeek.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDayOfWeek(value)}
                  className={`
                    min-w-[2.75rem] py-2.5 px-3 rounded-xl text-sm font-medium
                    border-2 transition-colors touch-manipulation
                    ${isSelected
                      ? "bg-blue-100 text-blue-700 border-blue-500"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }
                  `}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. 個別不可日カレンダー */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            個別の不可日指定
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <DayPicker
              mode="multiple"
              selected={selectedDates}
              onSelect={(dates) => setSelectedDates(dates ?? [])}
              defaultMonth={nextMonth}
              locale={ja}
              disabled={{ before: nextMonth, after: endOfMonth(nextMonth) }}
              classNames={{
                root: "rdp-root",
                month: "rdp-month",
                month_caption: "rdp-caption flex justify-center mb-3 text-slate-700 font-semibold",
                weekdays: "rdp-weekdays",
                weekday: "rdp-weekday text-slate-500 text-xs",
                week: "rdp-week",
                day: "rdp-day",
                day_button:
                  "w-10 h-10 sm:w-12 sm:h-12 rounded-xl text-sm font-medium transition-colors touch-manipulation hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2",
                selected:
                  "!bg-orange-500 !text-white hover:!bg-orange-600 focus:!ring-orange-400",
                today: "bg-slate-100 text-slate-900",
                outside: "text-slate-300",
                disabled: "text-slate-300 cursor-not-allowed hover:!bg-transparent",
                hidden: "invisible",
              }}
            />
          </div>
        </section>

        {/* 4. 提出ボタン（フッター固定風） */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-50/95 border-t border-slate-200 safe-area-pb">
          <div className="max-w-md mx-auto">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`
                w-full py-4 rounded-xl font-bold text-white shadow-lg
                flex items-center justify-center gap-2 transition-all touch-manipulation
                disabled:opacity-70 disabled:cursor-not-allowed
                ${isSubmitting
                  ? "bg-slate-400"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]"
                }
              `}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  送信中...
                </>
              ) : (
                <>
                  不可日を提出する
                  <Send size={20} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
