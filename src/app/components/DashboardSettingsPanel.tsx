"use client";

import { useState } from "react";
import { ChevronDown, Save } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ja } from "react-day-picker/locale";
import "react-day-picker/dist/style.css";
import StepperNumberInput from "./inputs/StepperNumberInput";
import WeightsConfig from "./settings/WeightsConfig";
import RulesConfig from "./settings/RulesConfig";
import ShiftScoresConfig from "./settings/ShiftScoresConfig";
import UnavailableDaysInput from "./settings/UnavailableDaysInput";
import {
  baseCalendarModifierClasses,
  dayPickerBaseClassName,
  dayPickerClassNames,
  hardConstraintNumberInputs,
} from "./settings/shared";
import type {
  Doctor,
  FixedUnavailableWeekdayMap,
  HardConstraints,
  HolidayLikeDayInfo,
  ObjectiveWeights,
  ShiftType,
  ShiftScores,
  TargetShift,
  UnavailableDateMap,
} from "../types/dashboard";
import type { WeightChangeSummary } from "./settings/shared";

// ── Accordion section ──
function Section({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800">{title}</span>
          {badge && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">{badge}</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

// ── Props ──
type DashboardSettingsPanelProps = {
  // Core data
  year: number;
  month: number;
  daysInMonth: number;
  numDoctors: number;
  activeDoctors: Doctor[];
  // Score
  scoreMin: number;
  scoreMax: number;
  onScoreMinChange: (value: number) => void;
  onScoreMaxChange: (value: number) => void;
  // Hard constraints
  hardConstraints: HardConstraints;
  onHardConstraintChange: (key: keyof HardConstraints, value: number | boolean | string) => void;
  // Optimizer save
  isSavingOptimizerConfig: boolean;
  optimizerSaveMessage: string;
  onSaveOptimizerConfig: () => void;
  // Holidays
  isLoadingCustom: boolean;
  isSavingCustom: boolean;
  customError: string;
  customSaveMessage: string;
  hasUnsavedCustomChanges: boolean;
  holidayWorkdayOverrides: Set<string>;
  isHolidayLikeDay: (day: number) => HolidayLikeDayInfo;
  onToggleHoliday: (day: number) => void;
  onToggleHolidayOverride: (ymd: string) => void;
  onSaveCustomHolidays: () => void;
  // Doctor unavailable
  doctorUnavailableMonth: Date;
  selectedDoctorId: string;
  unavailableMap: UnavailableDateMap;
  fixedUnavailableWeekdaysMap: FixedUnavailableWeekdayMap;
  pyWeekdays: number[];
  onSelectedDoctorChange: (doctorId: string) => void;
  onDoctorUnavailableMonthChange: (value: Date) => void;
  onToggleAllUnavailable: () => void;
  onToggleUnavailable: (doctorId: string, ymd: string, targetShift?: TargetShift | null) => void;
  onToggleFixedWeekday: (doctorId: string, weekdayPy: number, targetShift?: TargetShift | null) => void;
  // Doctor scores
  minScoreMap: Record<string, number>;
  maxScoreMap: Record<string, number>;
  targetScoreMap: Record<string, number | null>;
  onMinScoreChange: (doctorId: string, value: number) => void;
  onMaxScoreChange: (doctorId: string, value: number) => void;
  onTargetScoreChange: (doctorId: string, value: number | null) => void;
  // Doctor save
  onSaveAllDoctorsSettings: () => void;
  isBulkSavingDoctors: boolean;
  // Weights (for advanced modal)
  objectiveWeights: ObjectiveWeights;
  weightChanges: WeightChangeSummary;
  isWeightsOpen: boolean;
  isHardConstraintsOpen: boolean;
  onToggleWeights: () => void;
  onResetWeights: () => void;
  onCloseWeights: () => void;
  onWeightChange: (key: keyof ObjectiveWeights, value: number) => void;
  onSetWeights: (weights: ObjectiveWeights) => void;
  ratioOverrides?: import("./settings/shared").WeightRatioOverrides;
  onRatioOverridesChange?: (overrides: import("./settings/shared").WeightRatioOverrides) => void;
  onToggleHardConstraints: () => void;
  onResetHardConstraints: () => void;
  onCloseHardConstraints: () => void;
  // Shift scores
  shiftScores: ShiftScores;
  setShiftScores: (scores: ShiftScores) => void;
};

const pad2 = (v: number) => String(v).padStart(2, "0");

// 基本ルールに表示する制約キー
const basicRuleKeys = new Set(["interval_days", "max_weekend_holiday_works", "max_saturday_nights"]);
// max_sunhol_days, max_sunhol_works はUIから廃止（バックエンドデフォルトで動作）

export default function DashboardSettingsPanel(props: DashboardSettingsPanelProps) {
  const {
    year, month, daysInMonth, numDoctors, activeDoctors,
    scoreMin, scoreMax, onScoreMinChange, onScoreMaxChange,
    hardConstraints, onHardConstraintChange,
    isSavingOptimizerConfig, optimizerSaveMessage, onSaveOptimizerConfig,
    isLoadingCustom, isSavingCustom, customError, customSaveMessage,
    hasUnsavedCustomChanges, holidayWorkdayOverrides,
    isHolidayLikeDay, onToggleHoliday, onToggleHolidayOverride, onSaveCustomHolidays,
    doctorUnavailableMonth, selectedDoctorId, unavailableMap, fixedUnavailableWeekdaysMap,
    pyWeekdays, onSelectedDoctorChange, onDoctorUnavailableMonthChange,
    onToggleAllUnavailable, onToggleUnavailable, onToggleFixedWeekday,
    minScoreMap, maxScoreMap, targetScoreMap,
    onMinScoreChange, onMaxScoreChange, onTargetScoreChange,
    onSaveAllDoctorsSettings, isBulkSavingDoctors,
    objectiveWeights, weightChanges, isWeightsOpen, isHardConstraintsOpen,
    onToggleWeights, onResetWeights, onCloseWeights, onWeightChange, onSetWeights,
    ratioOverrides, onRatioOverridesChange,
    onToggleHardConstraints, onResetHardConstraints, onCloseHardConstraints,
    shiftScores, setShiftScores,
  } = props;

  const [isShiftScoresOpen, setIsShiftScoresOpen] = useState(false);
  const displayMonth = new Date(year, month - 1, 1);

  // ── Holiday calendar helpers ──
  const holidaySelectedDates: Date[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const info = isHolidayLikeDay(day);
    if (info.isManualHoliday || (info.isAutoHoliday && !holidayWorkdayOverrides.has(info.ymd))) {
      holidaySelectedDates.push(new Date(year, month - 1, day));
    }
  }

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
    if (info.isAutoHoliday) { onToggleHolidayOverride(info.ymd); return; }
    onToggleHoliday(day);
  };

  return (
    <div className="space-y-0">
      {/* Header info */}
      <div className="mb-2 flex items-center gap-3 text-sm text-gray-500">
        <span>{year}年{month}月</span>
        <span>医師{numDoctors}名</span>
        <span>{daysInMonth}日</span>
      </div>

      {/* ━━ 1. 基本ルール ━━ */}
      <Section title="基本ルール" defaultOpen>
        <div className="space-y-2">
          {/* 勤務間隔・土日祝上限・土曜当直上限 */}
          {hardConstraintNumberInputs
            .filter((c) => basicRuleKeys.has(c.key))
            .map((c) => {
              const value = typeof hardConstraints[c.key] === "number" ? (hardConstraints[c.key] as number) : 0;
              return (
                <div key={c.key} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-700">{c.label}</span>
                  <div className="flex items-center gap-1">
                    <StepperNumberInput
                      value={value}
                      onCommit={(v) => onHardConstraintChange(c.key, v)}
                      fallbackValue={value}
                      min={c.min} max={c.max} step={c.step}
                      inputMode="numeric"
                      inputClassName="text-xs font-bold w-12 text-center"
                    />
                    <span className="text-[10px] text-gray-400 w-4">{c.unit}</span>
                  </div>
                </div>
              );
            })}

          {/* 日祝シフトモード */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-700">日祝シフトモード</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onHardConstraintChange("holiday_shift_mode", "split")}
                className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                  hardConstraints.holiday_shift_mode !== "combined" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                別々
              </button>
              <button
                type="button"
                onClick={() => onHardConstraintChange("holiday_shift_mode", "combined")}
                className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                  hardConstraints.holiday_shift_mode === "combined" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                日当直
              </button>
            </div>
          </div>

          {/* シフトスコア */}
          <button
            type="button"
            onClick={() => setIsShiftScoresOpen(true)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50/50"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500">シフトスコア</span>
              <span className="text-[10px] text-blue-600 font-semibold">編集</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">平日当直</span>
                <span className="font-bold text-gray-800">{shiftScores.weekday_night}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">土曜当直</span>
                <span className="font-bold text-gray-800">{shiftScores.saturday_night}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">日祝日直</span>
                <span className="font-bold text-gray-800">{shiftScores.holiday_day}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">日祝当直</span>
                <span className="font-bold text-gray-800">{shiftScores.holiday_night}</span>
              </div>
            </div>
          </button>

          {/* スコア範囲 */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="mb-1 text-[10px] font-bold text-gray-500">スコア下限</div>
              <StepperNumberInput value={scoreMin} onCommit={onScoreMinChange} fallbackValue={0.5} step={0.5} inputMode="decimal" inputClassName="text-xs font-bold" />
            </div>
            <div className="flex-1">
              <div className="mb-1 text-[10px] font-bold text-gray-500">スコア上限</div>
              <StepperNumberInput value={scoreMax} onCommit={onScoreMaxChange} fallbackValue={4.5} step={0.5} inputMode="decimal" inputClassName="text-xs font-bold" />
            </div>
          </div>

          <button
            type="button"
            onClick={onSaveOptimizerConfig}
            disabled={isSavingOptimizerConfig}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {isSavingOptimizerConfig ? "保存中..." : "基本設定を保存"}
          </button>
          {optimizerSaveMessage && <div className="mt-1 text-xs font-semibold text-emerald-600">{optimizerSaveMessage}</div>}
        </div>
      </Section>

      {/* ━━ 3. 祝日カレンダー ━━ */}
      <Section title="祝日・休日" badge={hasUnsavedCustomChanges ? "未保存" : undefined}>
        <DayPicker
          mode="multiple"
          month={displayMonth}
          locale={ja}
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
            overrideHoliday: "[&>button]:border-emerald-300 [&>button]:bg-emerald-50 [&>button]:text-emerald-700 hover:[&>button]:bg-emerald-100/80",
          }}
        />
        <div className="mt-2 text-[10px] text-gray-400">日付クリックで休日追加/解除。祝日クリックで平日化。</div>
        {(customError || customSaveMessage) && (
          <div className={`mt-1 text-xs font-semibold ${customError ? "text-red-600" : "text-emerald-600"}`}>
            {customError || customSaveMessage}
          </div>
        )}
        <button
          type="button"
          onClick={onSaveCustomHolidays}
          disabled={isSavingCustom || isLoadingCustom}
          className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50 ${
            hasUnsavedCustomChanges ? "bg-rose-600 hover:bg-rose-700" : "bg-gray-500 hover:bg-gray-600"
          }`}
        >
          {isSavingCustom ? "保存中..." : "祝日設定を保存"}
        </button>
      </Section>

      {/* ━━ 4. 医師別不可日 ━━ */}
      <Section title="医師別 不可日">
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
        <button
          type="button"
          onClick={onSaveAllDoctorsSettings}
          disabled={isBulkSavingDoctors}
          className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {isBulkSavingDoctors ? "保存中..." : "医師設定を一括保存"}
        </button>
      </Section>

      {/* ━━ 5. 医師別スコア ━━ */}
      <Section title="医師別スコア">
        <div className="space-y-1.5">
          {activeDoctors.map((doctor) => (
            <div key={doctor.id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5">
              <span className="w-20 truncate text-xs font-bold text-gray-700" title={doctor.name}>{doctor.name}</span>
              <div className="flex flex-1 items-center gap-1">
                <StepperNumberInput
                  value={minScoreMap[doctor.id] ?? scoreMin}
                  onCommit={(v) => onMinScoreChange(doctor.id, v)}
                  fallbackValue={scoreMin} step={0.5} inputMode="decimal"
                  inputClassName="text-[11px] font-bold w-10 text-center"
                />
                <span className="text-[10px] text-gray-400">〜</span>
                <StepperNumberInput
                  value={maxScoreMap[doctor.id] ?? scoreMax}
                  onCommit={(v) => onMaxScoreChange(doctor.id, v)}
                  fallbackValue={scoreMax} step={0.5} inputMode="decimal"
                  inputClassName="text-[11px] font-bold w-10 text-center"
                />
                <span className="text-[10px] text-gray-400">目標</span>
                <StepperNumberInput
                  value={targetScoreMap[doctor.id] ?? 0}
                  onCommit={(v) => onTargetScoreChange(doctor.id, v === 0 ? null : v)}
                  fallbackValue={0} step={0.5} inputMode="decimal"
                  inputClassName="text-[11px] font-bold w-10 text-center"
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ━━ 6. 上級設定 ━━ */}
      <Section title="上級設定">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onToggleWeights}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              優先度の調整{!weightChanges.isDefault && ` (${weightChanges.changedCount}件変更)`}
            </button>
          </div>
        </div>
      </Section>

      {/* ── Modals (rendered via portals) ── */}
      <WeightsConfig
        isOpen={isWeightsOpen}
        objectiveWeights={objectiveWeights}
        hardConstraints={hardConstraints}
        isSaving={isSavingOptimizerConfig}
        saveMessage={optimizerSaveMessage}
        onClose={onCloseWeights}
        onReset={onResetWeights}
        onSave={onSaveOptimizerConfig}
        onSetWeights={onSetWeights}
        ratioOverrides={ratioOverrides}
        onRatioOverridesChange={onRatioOverridesChange}
        grouped
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
      <ShiftScoresConfig
        isOpen={isShiftScoresOpen}
        shiftScores={shiftScores}
        isSaving={isSavingOptimizerConfig}
        saveMessage={optimizerSaveMessage}
        onClose={() => setIsShiftScoresOpen(false)}
        onReset={() => setShiftScores({ weekday_night: 1.0, saturday_night: 1.5, holiday_day: 0.5, holiday_night: 1.0 })}
        onSave={onSaveOptimizerConfig}
        onShiftScoreChange={(key, value) => setShiftScores({ ...shiftScores, [key]: value })}
      />
    </div>
  );
}
