"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import type { ObjectiveWeights, UnavailableDateMap } from "../types/dashboard";

type DashboardDoctor = {
  id: string;
  name: string;
  is_active?: boolean;
};


type WeightChangeSummary = {
  isDefault: boolean;
  changedCount: number;
  top: string[];
};

type HolidayMeta = {
  ymd: string;
  isSun: boolean;
  isAutoHoliday: boolean;
  isManualHoliday: boolean;
  isHolidayLike: boolean;
};

type GenerationSettingsPanelProps = {
  isLoading: boolean;
  isLoadingCustom: boolean;
  customError: string;
  isSavingCustom: boolean;
  customSaveMessage: string;
  hasUnsavedCustomChanges: boolean;
  scoreMin: number;
  scoreMax: number;
  objectiveWeights: ObjectiveWeights;
  weightChanges: WeightChangeSummary;
  isWeightsOpen: boolean;
  year: number;
  month: number;
  numDoctors: number;
  activeDoctors: DashboardDoctor[];
  holidayWorkdayOverrides: Set<string>;
  daysInMonth: number;
  selectedDoctorId: string;
  unavailableMap: UnavailableDateMap;
  fixedUnavailableWeekdaysMap: Record<string, number[]>;
  pyWeekdays: number[];
  pyWeekdaysJp: string[];
  prevMonthLastDay: number;
  prevMonthTailDays: number[];
  prevMonthWorkedDaysMap: Record<string, number[]>;
  onScoreMinChange: (value: number) => void;
  onScoreMaxChange: (value: number) => void;
  onToggleWeights: () => void;
  onResetWeights: () => void;
  onCloseWeights: () => void;
  onWeightChange: (key: keyof ObjectiveWeights, value: number) => void;
  onYearChange: (value: number) => void;
  onMonthChange: (value: number) => void;
  isHolidayLikeDay: (day: number) => HolidayMeta;
  onToggleHoliday: (day: number) => void;
  onToggleHolidayOverride: (ymd: string) => void;
  onSaveCustomHolidays: () => void;
  onSelectedDoctorChange: (doctorId: string) => void;
  onToggleAllUnavailable: () => void;
  onToggleUnavailable: (doctorId: string, ymd: string) => void;
  onToggleFixedWeekday: (doctorId: string, weekdayPy: number) => void;
  onPrevMonthLastDayChange: (value: number) => void;
  onTogglePrevMonthWorkedDay: (doctorId: string, prevDay: number) => void;
  onGenerate: () => void;
};

type DoctorSettingsPanelProps = {
  isBulkSavingDoctors: boolean;
  activeDoctors: DashboardDoctor[];
  minScoreMap: Record<string, number>;
  maxScoreMap: Record<string, number>;
  targetScoreMap: Record<string, number>;
  satPrevMap: Record<string, boolean>;
  scoreMin: number;
  scoreMax: number;
  onSaveAllDoctorsSettings: () => void;
  onMinScoreChange: (doctorId: string, value: string) => void;
  onMaxScoreChange: (doctorId: string, value: string) => void;
  onTargetScoreChange: (doctorId: string, value: string) => void;
  onToggleSatPrev: (doctorId: string) => void;
};

const weightInputs = [
  { key: "gap5", label: "5日間隔回避", min: 0, max: 200, step: 5, hint: "最大級" },
  { key: "sunhol_3rd", label: "日祝3回目回避", min: 0, max: 200, step: 5, hint: "次点" },
  { key: "sat_consec", label: "連続土曜回避", min: 0, max: 200, step: 5, hint: "次点" },
  { key: "gap6", label: "6日間隔回避", min: 0, max: 200, step: 5, hint: "次点" },
  { key: "score_balance", label: "スコア公平性", min: 0, max: 200, step: 5, hint: "中" },
  { key: "target", label: "個別ターゲット", min: 0, max: 200, step: 5, hint: "弱" },
] as const satisfies ReadonlyArray<{
  key: keyof ObjectiveWeights;
  label: string;
  min: number;
  max: number;
  step: number;
  hint: string;
}>;

const pad2 = (value: number) => String(value).padStart(2, "0");
const toDateKey = (date: Date) => format(date, "yyyy-MM-dd");
const parseDateKey = (value: string) => {
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function GenerationSettingsPanel({
  isLoading,
  isLoadingCustom,
  customError,
  isSavingCustom,
  customSaveMessage,
  hasUnsavedCustomChanges,
  scoreMin,
  scoreMax,
  objectiveWeights,
  weightChanges,
  isWeightsOpen,
  year,
  month,
  numDoctors,
  activeDoctors,
  holidayWorkdayOverrides,
  daysInMonth,
  selectedDoctorId,
  unavailableMap,
  fixedUnavailableWeekdaysMap,
  pyWeekdays,
  pyWeekdaysJp,
  prevMonthLastDay,
  prevMonthTailDays,
  prevMonthWorkedDaysMap,
  onScoreMinChange,
  onScoreMaxChange,
  onToggleWeights,
  onResetWeights,
  onCloseWeights,
  onWeightChange,
  onYearChange,
  onMonthChange,
  isHolidayLikeDay,
  onToggleHoliday,
  onToggleHolidayOverride,
  onSaveCustomHolidays,
  onSelectedDoctorChange,
  onToggleAllUnavailable,
  onToggleUnavailable,
  onToggleFixedWeekday,
  onPrevMonthLastDayChange,
  onTogglePrevMonthWorkedDay,
  onGenerate,
}: GenerationSettingsPanelProps) {
  const displayMonth = useMemo(() => new Date(year, month - 1, 1), [year, month]);
  const currentMonthPrefix = `${year}-${pad2(month)}-`;
  const selectedUnavailableInMonth = useMemo(() => {
    const selectedDoctorUnavailable = unavailableMap[selectedDoctorId] ?? [];
    return selectedDoctorUnavailable.filter((value) => value.startsWith(currentMonthPrefix)).sort();
  }, [currentMonthPrefix, selectedDoctorId, unavailableMap]);
  const selectedUnavailableDates = useMemo(
    () => selectedUnavailableInMonth.map(parseDateKey).filter((value): value is Date => value !== null),
    [selectedUnavailableInMonth]
  );
  const calendarModifiers = useMemo(
    () => ({
      saturday: (date: Date) => date.getDay() === 6,
      sunday: (date: Date) => date.getDay() === 0,
      holiday: (date: Date) => {
        if (date.getFullYear() !== year || date.getMonth() !== month - 1) return false;
        const info = isHolidayLikeDay(date.getDate());
        return info.isManualHoliday || (info.isAutoHoliday && !holidayWorkdayOverrides.has(info.ymd));
      },
    }),
    [holidayWorkdayOverrides, isHolidayLikeDay, month, year]
  );
  const holidayCalendarModifiers = useMemo(
    () => ({
      saturday: (date: Date) => date.getDay() === 6,
      sunday: (date: Date) => date.getDay() === 0,
      autoHoliday: (date: Date) => {
        if (date.getFullYear() !== year || date.getMonth() !== month - 1) return false;
        const info = isHolidayLikeDay(date.getDate());
        return info.isAutoHoliday && !holidayWorkdayOverrides.has(info.ymd);
      },
      manualHoliday: (date: Date) => {
        if (date.getFullYear() !== year || date.getMonth() !== month - 1) return false;
        return isHolidayLikeDay(date.getDate()).isManualHoliday;
      },
      overrideHoliday: (date: Date) => {
        if (date.getFullYear() !== year || date.getMonth() !== month - 1) return false;
        const info = isHolidayLikeDay(date.getDate());
        return info.isAutoHoliday && holidayWorkdayOverrides.has(info.ymd);
      },
    }),
    [holidayWorkdayOverrides, isHolidayLikeDay, month, year]
  );
  const holidayCounts = useMemo(() => {
    let autoCount = 0;
    let manualCount = 0;
    let overrideCount = 0;

    for (let day = 1; day <= daysInMonth; day += 1) {
      const info = isHolidayLikeDay(day);
      if (info.isAutoHoliday && holidayWorkdayOverrides.has(info.ymd)) overrideCount += 1;
      else if (info.isAutoHoliday) autoCount += 1;
      if (info.isManualHoliday) manualCount += 1;
    }

    return { autoCount, manualCount, overrideCount };
  }, [daysInMonth, holidayWorkdayOverrides, isHolidayLikeDay]);

  const handleHolidayDateClick = (date: Date) => {
    if (date.getFullYear() !== year || date.getMonth() !== month - 1) return;

    const day = date.getDate();
    const info = isHolidayLikeDay(day);
    if (info.isSun) return;

    if (info.isAutoHoliday) {
      onToggleHolidayOverride(info.ymd);
      return;
    }

    onToggleHoliday(day);
  };

  return (
    <div
      className={`bg-blue-50 p-4 md:p-5 rounded-xl border border-blue-100 col-span-1 h-fit min-w-0 relative transition lg:sticky lg:top-24 ${
        isLoading ? "opacity-80" : "opacity-100"
      }`}
    >
      {isLoading && (
        <div className="absolute inset-0 z-10 rounded-lg bg-white/50 backdrop-blur-[1px] pointer-events-auto flex items-start justify-center p-4">
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>生成中は入力を一時ロックしています</span>
          </div>
        </div>
      )}

      <h2 className="text-xl font-bold text-blue-800 mb-4">⚙️ 生成条件</h2>

      {(isLoadingCustom || customError) && (
        <div
          className={`mb-3 rounded-lg border px-3 py-2 text-[12px] font-bold ${
            customError ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-blue-50 border-blue-200 text-blue-700"
          }`}
        >
          {customError ? `休日設定の同期エラー: ${customError}` : "休日設定を同期中..."}
        </div>
      )}

      <div className="mb-6 p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
        <div className="text-sm font-bold text-gray-700 mb-2 text-center">📌 適用中の主要条件</div>

        <ul className="text-xs text-gray-700 space-y-1.5">
          <li className="flex gap-2">
            <span className="font-bold text-blue-700 shrink-0">ハード</span>
            <span>4日間隔(月跨ぎ含) / 土曜月1回 / 日祝同日禁止 / 日直上限2回 / 研究日・前日禁止</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-700 shrink-0">スコア</span>
            <span>
              共通範囲: {scoreMin} 〜 {scoreMax} <span className="text-[10px] text-orange-600">(個別設定優先)</span>
            </span>
          </li>

          <li className="flex gap-2 items-start">
            <span className="font-bold text-blue-700 shrink-0">重み</span>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="flex flex-wrap items-center gap-1">
                  {weightChanges.isDefault ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      現在：標準設定
                    </span>
                  ) : (
                    <>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        変更あり：{weightChanges.changedCount}件
                      </span>
                      {weightChanges.top.map((item) => (
                        <span key={item} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                          {item}
                        </span>
                      ))}
                    </>
                  )}
                </span>

                <button
                  type="button"
                  onClick={onToggleWeights}
                  className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-[0.99] transition"
                >
                  設定
                </button>
              </div>

              {isWeightsOpen && (
                <div className="mt-3 rounded-lg border border-blue-100 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
                    <div className="text-[12px] font-bold text-blue-800">⚙️ 最適化の詳細設定（重み調整）</div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onResetWeights}
                        className="text-[10px] font-bold text-blue-700 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 bg-white"
                        title="重みだけ初期値に戻します"
                      >
                        初期値
                      </button>
                      <button
                        type="button"
                        onClick={onCloseWeights}
                        className="text-[10px] font-bold text-gray-600 hover:text-gray-800 px-2 py-1 rounded border border-gray-200 bg-white"
                      >
                        閉じる
                      </button>
                    </div>
                  </div>

                  <div className="p-3 space-y-3">
                    {weightInputs.map((weight) => (
                      <div key={weight.key} className="rounded-lg border border-gray-100 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="text-[12px] font-bold text-gray-700 truncate">
                              {weight.label}
                              <span className="ml-2 text-[10px] font-bold text-gray-400">{weight.hint}</span>
                            </div>
                          </div>

                          <input
                            type="number"
                            inputMode="numeric"
                            value={objectiveWeights[weight.key]}
                            onChange={(e) => onWeightChange(weight.key, Number(e.target.value))}
                            className="w-20 p-2 text-sm font-bold text-center border rounded bg-gray-50"
                            min={weight.min}
                            max={weight.max}
                            step={weight.step}
                          />
                        </div>

                        <input
                          type="range"
                          value={objectiveWeights[weight.key]}
                          onChange={(e) => onWeightChange(weight.key, Number(e.target.value))}
                          min={weight.min}
                          max={weight.max}
                          step={weight.step}
                          className="w-full accent-blue-600"
                        />

                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                          <span>{weight.min}</span>
                          <span>{weight.max}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </li>

          <li className="flex gap-2">
            <span className="font-bold text-blue-700 shrink-0">目的</span>
            <span>
              ５日間隔 ({objectiveWeights.gap5}) ✕日祝３回目回避({objectiveWeights.sunhol_3rd}) ✕連続土曜({objectiveWeights.sat_consec}) ✕ ６日間隔({objectiveWeights.gap6}) ✕ スコア公平({objectiveWeights.score_balance})
            </span>
          </li>
        </ul>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">score_min</label>
            <input type="number" step="0.1" value={scoreMin} onChange={(e) => onScoreMinChange(Number(e.target.value))} className="border rounded p-2 w-full text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">score_max</label>
            <input type="number" step="0.1" value={scoreMax} onChange={(e) => onScoreMaxChange(Number(e.target.value))} className="border rounded p-2 w-full text-sm" />
          </div>
        </div>
        <div className="mt-2 text-[10px] text-gray-500">人数が少ない月は score_max を上げないと解なしになりやすいです。</div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">年</label>
          <input type="number" value={year} onChange={(e) => onYearChange(Number(e.target.value))} className="border rounded p-2 w-full" />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">月</label>
          <input type="number" value={month} onChange={(e) => onMonthChange(Number(e.target.value))} className="border rounded p-2 w-full" />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-bold text-gray-700 mb-1">医師の人数</label>
        <div className="flex items-center gap-2">
          <input type="number" value={numDoctors} readOnly className="border rounded p-2 w-full bg-gray-100 text-gray-500 cursor-not-allowed" />
          <span className="text-sm font-bold text-blue-600">人</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {activeDoctors.map((doc) => (
            <span key={doc.id} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              {doc.name}
            </span>
          ))}
        </div>
      </div>

        <div className="mb-4 md:mb-6 rounded-lg border border-blue-100 bg-white p-3 shadow-sm md:p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <label className="block text-sm font-bold text-gray-700">病院共通の祝日・休日設定</label>
            <div className="mt-1 text-[11px] text-gray-500">通常日を押すと追加休日、祝日を押すと平日扱いへ切り替えます。日曜は固定休日です。</div>
          </div>

          <button
            type="button"
            onClick={onSaveCustomHolidays}
            disabled={isLoadingCustom || isSavingCustom || !hasUnsavedCustomChanges}
            className={`rounded-xl px-4 py-2 text-[12px] font-bold text-white shadow-sm transition ${
              isLoadingCustom || isSavingCustom || !hasUnsavedCustomChanges
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {isSavingCustom ? "保存中..." : "祝日設定を保存"}
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-bold">
          <span className="rounded-full border border-red-200 bg-white px-2 py-1 text-red-700">標準祝日</span>
          <span className="rounded-full border border-red-600 bg-red-500 px-2 py-1 text-white">追加休日</span>
          <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-amber-800">祝日だが通常出勤</span>
          <span
            className={`rounded-full border px-2 py-1 ${
              hasUnsavedCustomChanges
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {hasUnsavedCustomChanges ? "未保存の変更あり" : "保存済み"}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-rose-100 bg-rose-50/30 p-3 shadow-sm">
          <DayPicker
            month={displayMonth}
            disableNavigation
            onDayClick={handleHolidayDateClick}
            modifiers={holidayCalendarModifiers}
            className={[
              "w-full",
              "[--rdp-day-width:2.35rem] [--rdp-day-height:2.35rem]",
              "[--rdp-day_button-width:2.35rem] [--rdp-day_button-height:2.35rem]",
              "[--rdp-months-gap:0px]",
              "sm:[--rdp-day-width:2.65rem] sm:[--rdp-day-height:2.65rem]",
              "sm:[--rdp-day_button-width:2.65rem] sm:[--rdp-day_button-height:2.65rem]",
            ].join(" ")}
            classNames={{
              root: "w-full",
              months: "block w-full max-w-none",
              month: "w-full space-y-3",
              month_caption: "flex min-w-0 items-center justify-center text-center",
              caption_label: "truncate px-3 text-base font-bold tracking-tight text-slate-900",
              nav: "hidden",
              month_grid: "w-full table-fixed border-collapse",
              weekdays: "border-b border-slate-200/80",
              weekday: "pb-2 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400",
              week: "border-b border-slate-100 last:border-b-0",
              day: "p-0 text-center align-middle",
              day_button:
                "mx-auto my-1 flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-sm font-medium text-slate-700 transition hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
            }}
            modifiersClassNames={{
              saturday:
                "[&>button]:bg-blue-50/70 [&>button]:text-blue-600 hover:[&>button]:bg-blue-100/80",
              sunday:
                "[&>button]:!bg-red-100 [&>button]:!text-red-600 [&>button]:!border-red-200",
              autoHoliday:
                "[&>button]:border [&>button]:border-red-300 [&>button]:bg-white [&>button]:text-red-700 hover:[&>button]:bg-red-50",
              manualHoliday:
                "[&>button]:!border-red-600 [&>button]:!bg-red-500 [&>button]:!text-white hover:[&>button]:!bg-red-600",
              overrideHoliday:
                "[&>button]:!border-amber-300 [&>button]:!bg-amber-100 [&>button]:!text-amber-800 hover:[&>button]:!bg-amber-200",
              today:
                "[&>button]:ring-1 [&>button]:ring-indigo-200 [&>button]:font-semibold [&>button]:text-indigo-700",
              outside: "[&>button]:bg-transparent [&>button]:text-slate-300",
            }}
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-xl border border-red-100 bg-red-50 px-2 py-2 text-red-700">
            <div className="font-bold">標準祝日</div>
            <div className="mt-1 text-sm font-bold">{holidayCounts.autoCount}日</div>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-2 py-2 text-rose-700">
            <div className="font-bold">追加休日</div>
            <div className="mt-1 text-sm font-bold">{holidayCounts.manualCount}日</div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-2 py-2 text-amber-700">
            <div className="font-bold">平日扱い</div>
            <div className="mt-1 text-sm font-bold">{holidayCounts.overrideCount}日</div>
          </div>
        </div>

        {customSaveMessage && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">
            {customSaveMessage}
          </div>
        )}
      </div>


      <div className="mb-4 md:mb-6 rounded-lg border border-blue-100 bg-white p-3 shadow-sm relative md:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-bold text-gray-700">個別休み希望</label>
          <button
            type="button"
            onClick={onToggleAllUnavailable}
            className="rounded border border-transparent px-2 py-1 text-[10px] text-gray-400 transition-all hover:border-red-200 hover:text-red-600"
            title="対象月だけを一括クリアまたは一括選択します"
          >
            ↺ 対象月を一括クリア/一括選択
          </button>
        </div>

        <select
          value={selectedDoctorId}
          onChange={(e) => onSelectedDoctorChange(String(e.target.value))}
          className="mb-3 w-full rounded border bg-blue-50 p-2 font-bold text-blue-700 outline-none"
        >
          {activeDoctors.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.name} 先生
            </option>
          ))}
        </select>

        <div className="mb-3 text-[11px] text-gray-500">対象年月と連動します。</div>

        <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3 shadow-sm">
          <DayPicker
            mode="multiple"
            month={displayMonth}
            disableNavigation
            selected={selectedUnavailableDates}
            onDayClick={(date) => {
              if (!selectedDoctorId) return;
              onToggleUnavailable(selectedDoctorId, toDateKey(date));
            }}
            modifiers={calendarModifiers}
            className={[
              "w-full",
              "[--rdp-day-width:2.35rem] [--rdp-day-height:2.35rem]",
              "[--rdp-day_button-width:2.35rem] [--rdp-day_button-height:2.35rem]",
              "[--rdp-months-gap:0px]",
              "sm:[--rdp-day-width:2.65rem] sm:[--rdp-day-height:2.65rem]",
              "sm:[--rdp-day_button-width:2.65rem] sm:[--rdp-day_button-height:2.65rem]",
            ].join(" ")}
            classNames={{
              root: "w-full",
              months: "block w-full max-w-none",
              month: "w-full space-y-3",
              month_caption: "flex min-w-0 items-center justify-center text-center",
              caption_label: "truncate px-3 text-base font-bold tracking-tight text-slate-900",
              nav: "hidden",
              month_grid: "w-full table-fixed border-collapse",
              weekdays: "border-b border-slate-200/80",
              weekday: "pb-2 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400",
              week: "border-b border-slate-100 last:border-b-0",
              day: "p-0 text-center align-middle",
              day_button:
                "mx-auto my-1 flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-sm font-medium text-slate-700 transition hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
            }}
            modifiersClassNames={{
              saturday:
                "[&>button]:bg-blue-50/70 [&>button]:text-blue-600 hover:[&>button]:bg-blue-100/80",
              sunday:
                "[&>button]:bg-red-50/70 [&>button]:text-red-600 hover:[&>button]:bg-red-100/80",
              holiday:
                "[&>button]:bg-red-50/70 [&>button]:text-red-600 hover:[&>button]:bg-red-100/80",
              selected:
                "[&>button]:!border-indigo-600 [&>button]:!bg-indigo-600 [&>button]:!text-white [&>button]:shadow-sm hover:[&>button]:!bg-indigo-700",
              today:
                "[&>button]:ring-1 [&>button]:ring-indigo-200 [&>button]:font-semibold [&>button]:text-indigo-700",
              outside: "[&>button]:bg-transparent [&>button]:text-slate-300",
              disabled:
                "[&>button]:!bg-transparent [&>button]:!text-slate-300 [&>button]:opacity-45 [&>button]:hover:bg-transparent [&>button]:hover:shadow-none",
            }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] text-gray-600">
          <span className="font-bold">{year}年{month}月</span>
          <span className="font-bold text-indigo-600">選択中: {selectedUnavailableInMonth.length} 日</span>
        </div>
      </div>

      <div className="mb-4 md:mb-6 p-3 md:p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
        <label className="block text-sm font-bold text-gray-700 mb-3 text-center">📅 固定不可曜日 一括入力</label>

        <div className="text-[10px] text-gray-500 text-center mb-3">各医師の「毎週入れない曜日」をチェックしてください。</div>

        <div className="overflow-x-auto">
          <div className="min-w-[200px]">
            <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 items-center mb-2">
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
              {activeDoctors.map((doc) => (
                <div key={doc.id} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 items-center">
                  <button
                    type="button"
                    onClick={() => onSelectedDoctorChange(doc.id)}
                    className={`text-left text-[11px] font-bold px-2 py-2 rounded border truncate transition ${
                      selectedDoctorId === doc.id ? "bg-blue-600 text-white border-blue-700" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {doc.name}
                  </button>

                  {pyWeekdays.map((pyWd) => {
                    const selected = (fixedUnavailableWeekdaysMap[doc.id] || []).includes(pyWd);
                    const isSun = pyWd === 6;
                    const isSat = pyWd === 5;

                    return (
                      <button
                        key={`${doc.id}-${pyWd}`}
                        type="button"
                        onClick={() => onToggleFixedWeekday(doc.id, pyWd)}
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
          選択中: <span className="font-bold text-gray-700">{activeDoctors.find((doctor) => doctor.id === selectedDoctorId)?.name || "未選択"}</span> ／ 固定不可:{" "}
          {(fixedUnavailableWeekdaysMap[selectedDoctorId] || []).length === 0
            ? "なし"
            : (fixedUnavailableWeekdaysMap[selectedDoctorId] || [])
                .slice()
                .sort((a, b) => a - b)
                .map((weekday) => pyWeekdaysJp[weekday])
                .join(" / ")}
        </div>
      </div>

      <div className="mb-4 md:mb-6 p-3 md:p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
        <label className="block text-sm font-bold text-gray-700 mb-3 text-center">⏮️ 前月末勤務</label>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">前月の最終日</label>
            <input type="number" value={prevMonthLastDay} onChange={(e) => onPrevMonthLastDayChange(Number(e.target.value))} className="border rounded p-2 w-full text-sm" />
          </div>
          <div className="text-[10px] text-gray-500 flex items-end">※年月変更時は自動計算されます</div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[200px]">
            <div className="grid grid-cols-[90px_repeat(4,1fr)] gap-1 items-center mb-2">
              <div className="text-[11px] font-bold text-gray-600">医師</div>
              {prevMonthTailDays.map((day) => (
                <div key={day} className="text-[11px] font-bold text-center rounded py-1 border bg-gray-50 text-gray-700 border-gray-100">
                  {day}日
                </div>
              ))}
            </div>

            <div className="space-y-1">
              {activeDoctors.map((doc) => (
                <div key={doc.id} className="grid grid-cols-[90px_repeat(4,1fr)] gap-1 items-center">
                  <div className="text-left text-[11px] font-bold px-2 py-2 rounded border bg-white text-gray-700 border-gray-200 truncate">{doc.name}</div>

                  {prevMonthTailDays.map((day) => {
                    const selected = (prevMonthWorkedDaysMap[doc.id] || []).includes(day);
                    return (
                      <button
                        key={`${doc.id}-prev-${day}`}
                        type="button"
                        onClick={() => onTogglePrevMonthWorkedDay(doc.id, day)}
                        className={`h-9 rounded border text-[12px] font-bold transition ${
                          selected ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        }`}
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
      </div>

      <button
        onClick={onGenerate}
        disabled={isLoading || activeDoctors.length === 0}
        className={`w-full min-h-12 px-4 py-3 rounded font-bold text-white shadow-md transition flex items-center justify-center gap-2 ${
          isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>生成中...</span>
          </>
        ) : (
          <span>✨ シフトを自動生成</span>
        )}
      </button>
    </div>
  );
}

export function DoctorSettingsPanel({
  isBulkSavingDoctors,
  activeDoctors,
  minScoreMap,
  maxScoreMap,
  targetScoreMap,
  satPrevMap,
  scoreMin,
  scoreMax,
  onSaveAllDoctorsSettings,
  onMinScoreChange,
  onMaxScoreChange,
  onTargetScoreChange,
  onToggleSatPrev,
}: DoctorSettingsPanelProps) {
  return (
    <>
      <div className="mb-4 md:mb-6">
        <button
          type="button"
          onClick={onSaveAllDoctorsSettings}
          disabled={isBulkSavingDoctors || activeDoctors.length === 0}
          className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition ${isBulkSavingDoctors ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"}`}
          title="全医師のスコア設定＋休み希望（単発/固定）をまとめて保存します"
        >
          {isBulkSavingDoctors ? "保存中..." : "💾 全員の休み希望を一括保存"}
        </button>
        <div className="mt-2 text-[11px] text-gray-500">※ 現在の「スコア設定（Min/Max/目標）」「固定不可曜日」「個別不可日」を全員分まとめて保存します。</div>
      </div>

      <div className="bg-orange-50 p-3 md:p-4 rounded-lg border border-orange-100 shadow-sm mb-4 md:mb-5">
        <h3 className="text-md font-bold text-orange-800 mb-3 flex flex-wrap items-center gap-2">
          <span>🎯 医師別 スコア設定</span>
          <span className="text-xs font-normal text-orange-600 bg-orange-100 px-2 py-1 rounded">※空欄は全体設定を適用</span>
          <span className="text-xs font-normal text-gray-500 bg-white px-2 py-1 rounded border border-orange-200">※保存は上の「一括保存」ボタン</span>
        </h3>
        
        <div className="overflow-x-auto bg-white border rounded-lg">
          <table className="min-w-full text-center text-[12px]">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="py-2 px-2 border-b text-left">医師名</th>
                <th className="py-2 px-2 border-b">Min</th>
                <th className="py-2 px-2 border-b">Max</th>
                <th className="py-2 px-2 border-b">目標</th>
                <th className="py-2 px-2 border-b text-orange-700">前月土曜当直</th>
              </tr>
            </thead>
            <tbody>
              {activeDoctors.map((doc) => (
                <tr key={doc.id} className="border-b hover:bg-gray-50">
                  <td className="py-1 px-2 text-left font-bold text-gray-700 whitespace-nowrap">{doc.name}</td>

                  <td className="py-1 px-2">
                    <input
                      type="number"
                      step="0.5"
                      className="w-12 md:w-14 border rounded p-1 text-center"
                      value={minScoreMap[doc.id] === undefined ? "" : minScoreMap[doc.id]}
                      onChange={(e) => onMinScoreChange(doc.id, e.target.value)}
                      placeholder={String(scoreMin)}
                    />
                  </td>

                  <td className="py-1 px-2">
                    <input
                      type="number"
                      step="0.5"
                      className="w-12 md:w-14 border rounded p-1 text-center"
                      value={maxScoreMap[doc.id] === undefined ? "" : maxScoreMap[doc.id]}
                      onChange={(e) => onMaxScoreChange(doc.id, e.target.value)}
                      placeholder={String(scoreMax)}
                    />
                  </td>

                  <td className="py-1 px-2">
                    <input
                      type="number"
                      step="0.5"
                      className="w-12 md:w-16 border rounded p-1 text-center bg-blue-50"
                      value={targetScoreMap[doc.id] === undefined ? "" : targetScoreMap[doc.id]}
                      onChange={(e) => onTargetScoreChange(doc.id, e.target.value)}
                      placeholder="任意"
                    />
                  </td>

                  <td className="py-1 px-2">
                    <button
                      type="button"
                      onClick={() => onToggleSatPrev(doc.id)}
                      className={`px-2 py-1 rounded text-[10px] font-bold border ${
                        satPrevMap[doc.id] ? "bg-orange-500 text-white border-orange-600" : "bg-white text-gray-400 border-gray-200"
                      }`}
                    >
                      {satPrevMap[doc.id] ? "連続回避" : "なし"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
