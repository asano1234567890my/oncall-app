'use client';

import React, { useMemo, useState } from 'react';
import { CalendarDays, Info, Send } from 'lucide-react';

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

function getNextMonthInfo() {
  const today = new Date();
  const thisMonth = today.getMonth(); // 0-11
  const thisYear = today.getFullYear();

  const nextMonth = (thisMonth + 1) % 12;
  const nextYear = thisMonth === 11 ? thisYear + 1 : thisYear;

  const firstDay = new Date(nextYear, nextMonth, 1);
  const firstDayWeekday = firstDay.getDay() as Weekday;
  const daysInMonth = new Date(nextYear, nextMonth + 1, 0).getDate();

  return {
    year: nextYear,
    monthIndex: nextMonth, // 0-11
    displayLabel: `${nextYear}年${nextMonth + 1}月`,
    firstDayWeekday,
    daysInMonth,
  };
}

// YYYY-MM-DD 形式
function formatDateKey(year: number, monthIndex: number, day: number) {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

const UnavailableDateCalendarPage: React.FC = () => {
  const { year, monthIndex, displayLabel, firstDayWeekday, daysInMonth } =
    useMemo(getNextMonthInfo, []);

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [fixedDays, setFixedDays] = useState<Weekday[]>([]);

  const weeks = useMemo(() => {
    const cells: (number | null)[] = [];
    // 前の月からの空白セル
    for (let i = 0; i < firstDayWeekday; i++) {
      cells.push(null);
    }
    // 当月の日付セル
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(day);
    }
    // 7列単位に分割
    const weeksArr: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeksArr.push(cells.slice(i, i + 7));
    }
    return weeksArr;
  }, [firstDayWeekday, daysInMonth]);

  const toggleFixedDay = (weekday: Weekday) => {
    setFixedDays((prev) =>
      prev.includes(weekday)
        ? prev.filter((d) => d !== weekday)
        : [...prev, weekday].sort((a, b) => a - b)
    );
  };

  const toggleDate = (day: number | null, weekday: Weekday) => {
    if (!day) return;
    const key = formatDateKey(year, monthIndex, day);
    setSelectedDates((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
  };

  const handleSubmit = () => {
    // モック：コンソールに出力
    console.log('固定不可曜日 (0=日〜6=土):', fixedDays);
    console.log('個別不可日 (YYYY-MM-DD):', selectedDates);
    alert('入力内容をコンソールに出力しました（デモ動作）。');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <main className="flex-1 pb-28">
        <div className="max-w-md mx-auto px-4 pt-4 pb-2 sm:pt-8 sm:pb-4">
          {/* ヘッダー */}
          <header className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <CalendarDays className="w-4 h-4" />
                <span>一般医師向け 当直不可日</span>
              </div>
              <h1 className="text-xl font-semibold mt-0.5">{displayLabel}</h1>
            </div>
            <div className="rounded-full bg-white shadow-sm border border-slate-200 px-3 py-1 text-xs text-slate-600">
              モバイル入力対応
            </div>
          </header>

          {/* 固定不可曜日 選択 */}
          <section className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-800">
                毎週固定の不可曜日
              </h2>
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <Info className="w-3 h-3" />
                <span>週ごとに必ず入れない曜日</span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {weekdayLabels.map((label, idx) => {
                const weekday = idx as Weekday;
                const active = fixedDays.includes(weekday);
                return (
                  <button
                    key={weekday}
                    type="button"
                    onClick={() => toggleFixedDay(weekday)}
                    className={[
                      'text-xs py-1.5 rounded-full border transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-50',
                      active
                        ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* カレンダー */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-4">
            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-slate-400 mb-1.5">
              {weekdayLabels.map((label, idx) => {
                const weekday = idx as Weekday;
                const isFixed = fixedDays.includes(weekday);
                return (
                  <div
                    key={weekday}
                    className={[
                      'py-1',
                      isFixed ? 'text-rose-500 font-semibold' : '',
                    ].join(' ')}
                  >
                    {label}
                  </div>
                );
              })}
            </div>

            {/* 日付グリッド */}
            <div className="grid grid-cols-7 gap-1">
              {weeks.map((week, weekIndex) =>
                week.map((day, colIndex) => {
                  const weekday = colIndex as Weekday;
                  const isFixed = fixedDays.includes(weekday);
                  const key =
                    day != null
                      ? formatDateKey(year, monthIndex, day)
                      : `blank-${weekIndex}-${colIndex}`;
                  const isSelected =
                    day != null && selectedDates.includes(key);

                  const baseClasses =
                    'relative aspect-square flex items-center justify-center rounded-xl text-xs sm:text-sm transition-colors cursor-pointer select-none';
                  const focusClasses =
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1 focus-visible:ring-offset-white';

                  let cellClasses =
                    'bg-white border border-slate-100 text-slate-900 hover:bg-slate-50';

                  if (isFixed && !isSelected) {
                    cellClasses =
                      'bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100';
                  }

                  if (isSelected) {
                    cellClasses =
                      'bg-rose-500 border border-rose-500 text-white font-semibold shadow-sm hover:bg-rose-600';
                  }

                  // 空セルはクリック不可
                  const isDisabled = day == null;

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => toggleDate(day, weekday)}
                      className={[
                        baseClasses,
                        focusClasses,
                        isDisabled
                          ? 'bg-transparent border-0 cursor-default'
                          : cellClasses,
                      ].join(' ')}
                    >
                      {day != null && (
                        <span className="z-10">{day}</span>
                      )}
                      {isFixed && !isDisabled && (
                        <span className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-rose-400/60" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* 凡例 */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-rose-500" />
                <span>当直不可（日単位）</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-rose-50 border border-rose-100" />
                <span>毎週固定の不可曜日</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* 固定フッター：提出ボタン */}
      <footer className="fixed inset-x-0 bottom-0 bg-white/95 backdrop-blur border-t border-slate-200">
        <div className="max-w-md mx-auto px-4 py-3 sm:py-4">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 text-white text-sm font-semibold py-3 shadow-md hover:bg-sky-700 active:bg-sky-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Send className="w-4 h-4" />
            <span>この内容で提出する</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default UnavailableDateCalendarPage;