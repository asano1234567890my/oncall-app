"use client";

import { Loader2 } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import StepperNumberInput from "./inputs/StepperNumberInput";
import DoctorListManager from "./settings/DoctorListManager";
import PreviousMonthShiftsConfig from "./settings/PreviousMonthShiftsConfig";
import RulesConfig from "./settings/RulesConfig";
import UnavailableDaysInput from "./settings/UnavailableDaysInput";
import WeightsConfig from "./settings/WeightsConfig";
import {
  baseCalendarModifierClasses,
  dayPickerBaseClassName,
  dayPickerClassNames,
  type WeightChangeSummary,
} from "./settings/shared";
import type {
  Doctor,
  FixedUnavailableWeekdayMap,
  HardConstraints,
  HolidayLikeDayInfo,
  ObjectiveWeights,
  ShiftType,
  TargetShift,
  UnavailableDateMap,
} from "../types/dashboard";

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
  hardConstraints: HardConstraints;
  weightChanges: WeightChangeSummary;
  isWeightsOpen: boolean;
  isHardConstraintsOpen: boolean;
  isPreviousMonthShiftsOpen: boolean;
  year: number;
  month: number;
  doctorUnavailableMonth: Date;
  numDoctors: number;
  activeDoctors: Doctor[];
  holidayWorkdayOverrides: Set<string>;
  daysInMonth: number;
  selectedDoctorId: string;
  unavailableMap: UnavailableDateMap;
  fixedUnavailableWeekdaysMap: FixedUnavailableWeekdayMap;
  pyWeekdays: number[];
  pyWeekdaysJp: string[];
  prevMonthLastDay: number;
  prevMonthTailDays: number[];
  getPreviousMonthShiftDoctorId: (prevDay: number, shiftType: ShiftType) => string;
  onScoreMinChange: (value: number) => void;
  onScoreMaxChange: (value: number) => void;
  isSavingOptimizerConfig: boolean;
  optimizerSaveMessage: string;
  onSaveOptimizerConfig: () => void;
  onToggleWeights: () => void;
  onResetWeights: () => void;
  onCloseWeights: () => void;
  onToggleHardConstraints: () => void;
  onResetHardConstraints: () => void;
  onCloseHardConstraints: () => void;
  onTogglePreviousMonthShifts: () => void;
  onClosePreviousMonthShifts: () => void;
  onWeightChange: (key: keyof ObjectiveWeights, value: number) => void;
  onHardConstraintChange: (key: keyof HardConstraints, value: number | boolean) => void;
  onYearChange: (value: number) => void;
  onMonthChange: (value: number) => void;
  isHolidayLikeDay: (day: number) => HolidayLikeDayInfo;
  onToggleHoliday: (day: number) => void;
  onToggleHolidayOverride: (ymd: string) => void;
  onSaveCustomHolidays: () => void;
  onSelectedDoctorChange: (doctorId: string) => void;
  onDoctorUnavailableMonthChange: (value: Date) => void;
  onToggleAllUnavailable: () => void;
  onToggleUnavailable: (doctorId: string, ymd: string, targetShift?: TargetShift | null) => void;
  onToggleFixedWeekday: (doctorId: string, weekdayPy: number, targetShift?: TargetShift | null) => void;
  onPrevMonthLastDayChange: (value: number) => void;
  onSetPreviousMonthShift: (prevDay: number, shiftType: ShiftType, doctorId: string) => void;
  onGenerate: () => void;
  isGenerateDisabled?: boolean;
};

type DoctorSettingsPanelProps = {
  isBulkSavingDoctors: boolean;
  activeDoctors: Doctor[];
  minScoreMap: Record<string, number>;
  maxScoreMap: Record<string, number>;
  targetScoreMap: Record<string, number>;
  scoreMin: number;
  scoreMax: number;
  onSaveAllDoctorsSettings: () => void;
  onMinScoreChange: (doctorId: string, value: number) => void;
  onMaxScoreChange: (doctorId: string, value: number) => void;
  onTargetScoreChange: (doctorId: string, value: number) => void;
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
  hardConstraints,
  weightChanges,
  isWeightsOpen,
  isHardConstraintsOpen,
  isPreviousMonthShiftsOpen,
  year,
  month,
  doctorUnavailableMonth,
  numDoctors,
  activeDoctors,
  holidayWorkdayOverrides,
  daysInMonth,
  selectedDoctorId,
  unavailableMap,
  fixedUnavailableWeekdaysMap,
  pyWeekdays,
  prevMonthLastDay,
  prevMonthTailDays,
  getPreviousMonthShiftDoctorId,
  onScoreMinChange,
  onScoreMaxChange,
  isSavingOptimizerConfig,
  optimizerSaveMessage,
  onSaveOptimizerConfig,
  onToggleWeights,
  onResetWeights,
  onCloseWeights,
  onToggleHardConstraints,
  onResetHardConstraints,
  onCloseHardConstraints,
  onTogglePreviousMonthShifts,
  onClosePreviousMonthShifts,
  onWeightChange,
  onHardConstraintChange,
  onYearChange,
  onMonthChange,
  isHolidayLikeDay,
  onToggleHoliday,
  onToggleHolidayOverride,
  onSaveCustomHolidays,
  onSelectedDoctorChange,
  onDoctorUnavailableMonthChange,
  onToggleAllUnavailable,
  onToggleUnavailable,
  onToggleFixedWeekday,
  onPrevMonthLastDayChange,
  onSetPreviousMonthShift,
  onGenerate,
  isGenerateDisabled = false,
}: GenerationSettingsPanelProps) {
  const displayMonth = new Date(year, month - 1, 1);

  const holidayCounts = (() => {
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
  })();

  const holidaySelectedDates = (() => {
    const dates: Date[] = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const info = isHolidayLikeDay(day);
      if (info.isManualHoliday || (info.isAutoHoliday && !holidayWorkdayOverrides.has(info.ymd))) {
        dates.push(new Date(year, month - 1, day));
      }
    }
    return dates;
  })();

  const holidayCalendarModifiers = {
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
  };

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

  const previousMonthShiftCount = prevMonthTailDays.reduce((count, day) => {
    const dayDoctorId = getPreviousMonthShiftDoctorId(day, "day");
    const nightDoctorId = getPreviousMonthShiftDoctorId(day, "night");
    return count + (dayDoctorId ? 1 : 0) + (nightDoctorId ? 1 : 0);
  }, 0);

  return (
    <div
      className={`relative h-fit min-w-0 rounded-xl border border-blue-100 bg-blue-50 p-4 transition md:p-5 lg:sticky lg:top-24 ${
        isLoading ? "opacity-80" : "opacity-100"
      }`}
    >
      {isLoading ? (
        <div className="pointer-events-auto absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-white/50 p-4 backdrop-blur-[1px]">
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>生成中は入力を一時ロックしています</span>
          </div>
        </div>
      ) : null}

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-900">制約設定と休日設定</h2>
          <div className="mt-1 space-y-1 text-sm text-blue-700">
            <p>生成条件の制約の調整ができます。</p>
            <p>祝日、各医師の個別希望、固定不可曜日の設定を確認できます。</p>
            <p>スコア：日直 0.5、当直（日祝+平日） 1.0、土曜日　1.5</p>
          </div>
        </div>
        <div className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-700">{format(displayMonth, "yyyy年M月")}</div>
      </div>

      <div className="mb-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-gray-800">最適化サマリー</div>
            <div className="text-xs text-gray-500">全体のスコア範囲、重み(ソフト制約)、ハード制約の状態をここで確認・調整できます。</div>
          </div>
          {weightChanges.isDefault ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">既定値</span>
          ) : (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">変更あり {weightChanges.changedCount}件</span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 text-[11px] font-bold text-gray-700">score_min</div>
            <StepperNumberInput value={scoreMin} onCommit={onScoreMinChange} fallbackValue={0.5} step={0.5} inputMode="decimal" />
          </label>
          <label className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 text-[11px] font-bold text-gray-700">score_max</div>
            <StepperNumberInput value={scoreMax} onCommit={onScoreMaxChange} fallbackValue={4.5} step={0.5} inputMode="decimal" />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onSaveOptimizerConfig}
            disabled={isSavingOptimizerConfig}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingOptimizerConfig ? "保存中..." : "スコア・重み・ルールを保存"}
          </button>
          {optimizerSaveMessage && (
            <span className="text-xs font-bold text-emerald-700">{optimizerSaveMessage}</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          {weightChanges.top.length > 0 ? (
            weightChanges.top.map((item) => (
              <span key={item} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 font-bold text-gray-700">
                {item}
              </span>
            ))
          ) : (
            <span className="text-gray-500">重みは既定値のままです。</span>
          )}
        </div>

        <div className="mt-3 text-[11px] text-gray-500">人数が少ない月は score_max を少し広げると解なしを避けやすくなります。</div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggleWeights}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
          >
            重み設定を開く
          </button>
          <button
            type="button"
            onClick={onToggleHardConstraints}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
          >
            ルール（ハード制約）設定を開く
          </button>
          <button
            type="button"
            onClick={onTogglePreviousMonthShifts}
            className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
          >
            前月末勤務を確認・修正する
          </button>
        </div>
      </div>

      <WeightsConfig
        isOpen={isWeightsOpen}
        objectiveWeights={objectiveWeights}
        isSaving={isSavingOptimizerConfig}
        saveMessage={optimizerSaveMessage}
        onClose={onCloseWeights}
        onReset={onResetWeights}
        onSave={onSaveOptimizerConfig}
        onWeightChange={onWeightChange}
      />

      <RulesConfig
        isOpen={isHardConstraintsOpen}
        hardConstraints={hardConstraints}
        isSaving={isSavingOptimizerConfig}
        saveMessage={optimizerSaveMessage}
        onClose={onCloseHardConstraints}
        onReset={onResetHardConstraints}
        onSave={onSaveOptimizerConfig}
        onHardConstraintChange={onHardConstraintChange}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:grid-cols-2">
        <label>
          <div className="mb-1 text-sm font-bold text-gray-700">年</div>
          <StepperNumberInput value={year} onCommit={onYearChange} fallbackValue={year} step={1} inputMode="numeric" />
        </label>
        <label>
          <div className="mb-1 text-sm font-bold text-gray-700">月</div>
          <StepperNumberInput value={month} onCommit={onMonthChange} fallbackValue={month} min={1} max={12} step={1} inputMode="numeric" />
        </label>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          稼働医師数: <span className="font-bold text-gray-800">{numDoctors}名</span>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          対象日数: <span className="font-bold text-gray-800">{daysInMonth}日</span>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-800">祝日・手動休日</h3>
            <p className="mt-1 text-[11px] text-gray-500">通常日を押すと追加休日、標準祝日を押すと通常出勤へ切り替えます。</p>
          </div>
          <button
            type="button"
            onClick={onSaveCustomHolidays}
            disabled={isSavingCustom || isLoadingCustom}
            className={`rounded-lg px-3 py-2 text-xs font-bold text-white transition ${
              isSavingCustom || isLoadingCustom
                ? "cursor-not-allowed bg-gray-400"
                : hasUnsavedCustomChanges
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-slate-600 hover:bg-slate-700"
            }`}
          >
            {isSavingCustom ? "保存中..." : "祝日設定を保存"}
          </button>
        </div>

        {isLoadingCustom || customError || customSaveMessage ? (
          <div
            className={`mb-3 rounded-xl border px-3 py-2 text-[12px] font-bold ${
              customError
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : customSaveMessage
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            {customError ? `祝日設定の保存に失敗しました: ${customError}` : customSaveMessage || "祝日設定を読み込み中です..."}
          </div>
        ) : null}

        <DayPicker
          mode="multiple"
          month={displayMonth}
          selected={holidaySelectedDates}
          onDayClick={handleHolidayDateClick}
          showOutsideDays
          className={dayPickerBaseClassName}
          classNames={dayPickerClassNames}
          modifiers={holidayCalendarModifiers}
          modifiersClassNames={{
            ...baseCalendarModifierClasses,
            autoHoliday: "[&>button]:bg-red-50/70 [&>button]:text-red-600 hover:[&>button]:bg-red-100/80",
            manualHoliday: "[&>button]:bg-rose-500 [&>button]:text-white hover:[&>button]:bg-rose-600",
            overrideHoliday:
              "[&>button]:border-emerald-300 [&>button]:bg-emerald-50 [&>button]:text-emerald-700 hover:[&>button]:bg-emerald-100/80",
          }}
        />

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-600">標準祝日 {holidayCounts.autoCount}</span>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">追加休日 {holidayCounts.manualCount}</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">平日扱い {holidayCounts.overrideCount}</span>
          {hasUnsavedCustomChanges ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">未保存の変更があります</span>
          ) : null}
        </div>
      </div>

      <UnavailableDaysInput
        doctorUnavailableMonth={doctorUnavailableMonth}
        activeDoctors={activeDoctors}
        selectedDoctorId={selectedDoctorId}
        unavailableMap={unavailableMap}
        fixedUnavailableWeekdaysMap={fixedUnavailableWeekdaysMap}
        pyWeekdays={pyWeekdays}
        onSelectedDoctorChange={onSelectedDoctorChange}
        onDoctorUnavailableMonthChange={onDoctorUnavailableMonthChange}
        onToggleAllUnavailable={onToggleAllUnavailable}
        onToggleUnavailable={onToggleUnavailable}
        onToggleFixedWeekday={onToggleFixedWeekday}
      />

      <PreviousMonthShiftsConfig
        isOpen={isPreviousMonthShiftsOpen}
        year={year}
        month={month}
        prevMonthLastDay={prevMonthLastDay}
        prevMonthTailDays={prevMonthTailDays}
        activeDoctors={activeDoctors}
        previousMonthShiftCount={previousMonthShiftCount}
        getPreviousMonthShiftDoctorId={getPreviousMonthShiftDoctorId}
        onClose={onClosePreviousMonthShifts}
        onPrevMonthLastDayChange={onPrevMonthLastDayChange}
        onSetPreviousMonthShift={onSetPreviousMonthShift}
      />

      <button
        type="button"
        onClick={onGenerate}
        disabled={isLoading || numDoctors === 0 || isGenerateDisabled}
        className={`mt-2 w-full rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg transition ${
          isLoading || numDoctors === 0 || isGenerateDisabled ? "cursor-not-allowed bg-gray-400" : "bg-blue-700 hover:bg-blue-800"
        }`}
      >
        {isLoading ? "生成中..." : numDoctors === 0 ? "有効な医師がいません" : isGenerateDisabled ? "強制配置モード中は生成できません" : "上記設定で当直表を自動生成"}
      </button>
    </div>
  );
}

export function DoctorSettingsPanel(props: DoctorSettingsPanelProps) {
  return <DoctorListManager {...props} />;
}
