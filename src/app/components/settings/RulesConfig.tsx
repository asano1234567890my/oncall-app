"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ja } from "react-day-picker/locale";
import { format } from "date-fns";
import "react-day-picker/dist/style.css";
import StepperNumberInput from "../inputs/StepperNumberInput";
import TargetShiftPopover, { externalLabels, internalLabels } from "../TargetShiftPopover";
import type { HardConstraints, ExternalFixedDate } from "../../types/dashboard";
import SettingsModalPortal from "./SettingsModalPortal";
import { hardConstraintNumberInputs, hardConstraintToggleInputs, dayPickerBaseClassName, dayPickerWithNavClassNames } from "./shared";

type RulesConfigProps = {
  isOpen: boolean;
  hardConstraints: HardConstraints;
  isSaving?: boolean;
  saveMessage?: string;
  onClose: () => void;
  onReset: () => void;
  onSave?: () => void;
  onShowGuide?: () => void;
  onHardConstraintChange: (key: keyof HardConstraints, value: number | boolean | string | unknown[]) => void;
};

export default function RulesConfig({
  isOpen,
  hardConstraints,
  isSaving = false,
  saveMessage = "",
  onClose,
  onReset,
  onSave,
  onShowGuide,
  onHardConstraintChange,
}: RulesConfigProps) {
  const [calMonth, setCalMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  });
  const [extPopover, setExtPopover] = useState<{ dateStr: string } | null>(null);
  const [extInputMode, setExtInputMode] = useState<"external" | "internal">("external");
  const [localInternalDays, setLocalInternalDays] = useState(8);
  const targetDaysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();

  const externalDates: ExternalFixedDate[] = hardConstraints.external_fixed_dates ?? [];
  const getExtEntry = (dateStr: string) => externalDates.find((e) => e.date === dateStr);

  const isSundayOrHoliday = (day: Date) => day.getDay() === 0;

  const handleExternalDayClick = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    if (isSundayOrHoliday(day)) {
      setExtPopover({ dateStr });
      return;
    }
    // 平日・土曜: トグル
    const existing = getExtEntry(dateStr);
    const next = existing
      ? externalDates.filter((e) => e.date !== dateStr)
      : [...externalDates, { date: dateStr, target_shift: "all" as const }];
    onHardConstraintChange("external_fixed_dates", next.sort((a, b) => a.date.localeCompare(b.date)));
  };

  const handleExtPopoverSelect = (value: "all" | "day" | "night" | null) => {
    if (!extPopover) return;
    const dateStr = extPopover.dateStr;
    const filtered = externalDates.filter((e) => e.date !== dateStr);
    const next = value ? [...filtered, { date: dateStr, target_shift: value }] : filtered;
    onHardConstraintChange("external_fixed_dates", next.sort((a, b) => a.date.localeCompare(b.date)));
  };

  const removeExtDate = (dateStr: string) => {
    onHardConstraintChange("external_fixed_dates", externalDates.filter((e) => e.date !== dateStr));
  };

  const getExtShiftLabel = (ts: string) => ts === "all" ? "[外]" : ts === "day" ? "[外日]" : "[外当]";

  return (
    <SettingsModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
        <div className="flex max-h-[85dvh] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-2xl sm:max-h-[90vh]">
          <div className="flex items-start justify-between gap-2 border-b border-indigo-100 bg-indigo-50 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-gray-900">基本ルール</h3>
              <p className="mt-0.5 text-xs text-gray-500">スケジュール生成時に厳守されます</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {onSave && (
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving}
                    className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "保存中…" : "保存"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onReset}
                  className="rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50"
                >
                  既定値に戻す
                </button>
                {saveMessage && (
                  <span className="text-xs font-bold text-emerald-700">{saveMessage}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white hover:text-gray-700"
              aria-label="閉じる"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {hardConstraintNumberInputs
                .filter((c) => !(hardConstraints.holiday_shift_mode === "combined" && c.key === "max_sunhol_days"))
                .map((constraint) => {
                const value = typeof hardConstraints[constraint.key] === "number" ? (hardConstraints[constraint.key] as number) : 0;
                return (
                  <label key={constraint.key} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-1 text-[11px] font-bold text-gray-700">{constraint.label}</div>
                    <div className="mb-2 text-[11px] text-gray-500">{constraint.hint}</div>
                    <div className="flex items-center gap-2">
                      <StepperNumberInput
                        value={value}
                        onCommit={(nextValue) => onHardConstraintChange(constraint.key, nextValue)}
                        fallbackValue={value}
                        min={constraint.min}
                        max={constraint.max}
                        step={constraint.step}
                        inputMode="numeric"
                        inputClassName="text-sm font-bold"
                      />
                      <span className="shrink-0 text-xs font-bold text-gray-500">{constraint.unit}</span>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="space-y-3">
              {hardConstraintToggleInputs.map((constraint) => {
                const enabled = Boolean(hardConstraints[constraint.key]);
                return (
                  <div
                    key={constraint.key}
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-800">{constraint.label}</div>
                      <div className="mt-1 text-[11px] text-gray-500">{constraint.hint}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onHardConstraintChange(constraint.key, !enabled)}
                      className={`inline-flex h-10 min-w-28 items-center justify-center rounded-full border px-4 text-xs font-bold transition ${
                        enabled ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-500"
                      }`}
                    >
                      {enabled ? "ON" : "OFF"}
                    </button>
                  </div>
                );
              })}

              {/* 日当直モード */}
              <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-800">日祝のシフト割り当てモード</div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    「別々」= 日直と当直を別の医師が担当 /「日当直」= 同一人物が日直＋当直を兼務（スコア1.5・日祝勤務は1回カウント）
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => onHardConstraintChange("holiday_shift_mode", "split")}
                    className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-xs font-bold transition ${
                      hardConstraints.holiday_shift_mode !== "combined"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                  >
                    別々
                  </button>
                  <button
                    type="button"
                    onClick={() => onHardConstraintChange("holiday_shift_mode", "combined")}
                    className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-xs font-bold transition ${
                      hardConstraints.holiday_shift_mode === "combined"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                  >
                    日当直
                  </button>
                </div>
              </div>
            </div>

            {/* 外部枠（常勤以外） */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-bold text-gray-800">外部枠（常勤以外）</div>
              <div className="mt-1 text-[11px] text-gray-500">
                非常勤医師が入る日や、自チームの担当外の日に使います。指定した分の枠を外部枠としてスケジュールを生成します。
                担当する日だけ選ぶ場合は、カレンダーで「全選択」→ 担当日を解除すると便利です。
                常勤医師だけで全枠を埋める場合は「なし」のままでOKです。
              </div>
              <div className="mt-3 flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onHardConstraintChange("external_slot_count", 0);
                    onHardConstraintChange("external_fixed_dates", [] as unknown as string);
                  }}
                  className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-xs font-bold transition ${
                    (hardConstraints.external_slot_count ?? 0) === 0 && (hardConstraints.external_fixed_dates?.length ?? 0) === 0
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-gray-50 text-gray-500"
                  }`}
                >
                  なし
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if ((hardConstraints.external_slot_count ?? 0) === 0) {
                      onHardConstraintChange("external_slot_count", 4);
                    }
                  }}
                  className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-xs font-bold transition ${
                    (hardConstraints.external_slot_count ?? 0) > 0 || (hardConstraints.external_fixed_dates?.length ?? 0) > 0
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-gray-50 text-gray-500"
                  }`}
                >
                  あり
                </button>
              </div>
              {((hardConstraints.external_slot_count ?? 0) > 0 || (hardConstraints.external_fixed_dates?.length ?? 0) > 0) && (
                <div className="mt-3 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  {/* 指定方法の切り替え */}
                  <div className="flex gap-1.5 mb-2">
                    <button type="button" onClick={() => {
                      setExtInputMode("external");
                      // 外部枠モード: カレンダーをクリア（空スタート）
                      const y = calMonth.getFullYear(); const m = calMonth.getMonth() + 1;
                      const other = externalDates.filter((e) => Number(e.date.slice(0, 4)) !== y || Number(e.date.slice(5, 7)) !== m);
                      onHardConstraintChange("external_fixed_dates", other);
                    }}
                      className={`flex-1 rounded-lg border-2 px-2 py-2 text-[11px] font-bold transition ${extInputMode === "external" ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 bg-white text-gray-400"}`}>
                      外部枠数で指定
                    </button>
                    <button type="button" onClick={() => {
                      setExtInputMode("internal");
                      // 当月に外部日が未設定なら全日を外部で埋める（白紙スタート）
                      const y = calMonth.getFullYear(); const m = calMonth.getMonth() + 1;
                      const hasMonthEntries = externalDates.some((e) => Number(e.date.slice(0, 4)) === y && Number(e.date.slice(5, 7)) === m);
                      if (!hasMonthEntries) {
                        const dim = new Date(y, m, 0).getDate();
                        const all = Array.from({ length: dim }, (_, i) => ({ date: format(new Date(y, m - 1, i + 1), "yyyy-MM-dd"), target_shift: "all" as const }));
                        const other = externalDates.filter((e) => Number(e.date.slice(0, 4)) !== y || Number(e.date.slice(5, 7)) !== m);
                        onHardConstraintChange("external_fixed_dates", [...other, ...all].sort((a, b) => a.date.localeCompare(b.date)));
                      }
                    }}
                      className={`flex-1 rounded-lg border-2 px-2 py-2 text-[11px] font-bold transition ${extInputMode === "internal" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-400"}`}>
                      勤務日数で指定
                    </button>
                  </div>
                  {extInputMode === "external" ? (
                    <label className="block">
                      <div className="mb-1 text-[11px] font-bold text-teal-700">外部枠数（{targetDaysInMonth}日中）</div>
                      <div className="mb-1 text-[10px] text-gray-500">この回数分を外部枠にして、残りを常勤で生成します</div>
                      <StepperNumberInput
                        value={hardConstraints.external_slot_count ?? 0}
                        onCommit={(v) => onHardConstraintChange("external_slot_count", v)}
                        fallbackValue={0}
                        min={0}
                        max={targetDaysInMonth - 1}
                        step={1}
                        inputMode="numeric"
                        inputClassName="text-sm font-bold"
                      />
                    </label>
                  ) : (
                    <label className="block">
                      <div className="mb-1 text-[11px] font-bold text-blue-700">勤務日数（{targetDaysInMonth}日中）</div>
                      <div className="mb-1 text-[10px] text-gray-500">常勤で埋める日数を指定。残りが外部枠になります</div>
                      <StepperNumberInput
                        value={localInternalDays}
                        onCommit={(v) => { setLocalInternalDays(v); onHardConstraintChange("external_slot_count", Math.max(0, targetDaysInMonth - v)); }}
                        fallbackValue={8}
                        min={1}
                        max={targetDaysInMonth}
                        step={1}
                        inputMode="numeric"
                        inputClassName="text-sm font-bold"
                      />
                    </label>
                  )}

                  {/* 確定日カレンダー */}
                  <div>
                    <div className="mb-1 text-[11px] font-bold text-gray-700">
                      {extInputMode === "internal" ? "勤務する日をタップで指定" : "外部枠にする日（任意）"}
                    </div>
                    <div className="mb-2 text-[10px] text-gray-500">
                      {extInputMode === "internal"
                        ? "タップした日が勤務日になります。それ以外が外部枠です。"
                        : "日付が決まっている場合はタップで指定。日曜・祝日は日直/当直を選べます。"}
                    </div>
                    <div className="mb-2 flex gap-1.5">
                      <button type="button" onClick={() => {
                        const y = calMonth.getFullYear(); const m = calMonth.getMonth();
                        const dim = new Date(y, m + 1, 0).getDate();
                        const all = Array.from({ length: dim }, (_, i) => ({ date: format(new Date(y, m, i + 1), "yyyy-MM-dd"), target_shift: "all" as const }));
                        const other = externalDates.filter((e) => Number(e.date.slice(0, 4)) !== y || Number(e.date.slice(5, 7)) !== m + 1);
                        onHardConstraintChange("external_fixed_dates", [...other, ...all].sort((a, b) => a.date.localeCompare(b.date)));
                      }} className={`rounded border px-2 py-1 text-[10px] font-bold transition ${extInputMode === "internal" ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100" : "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100"}`}>
                        {extInputMode === "internal" ? "全日勤務" : "全日外部"}
                      </button>
                      <button type="button" onClick={() => {
                        const y = calMonth.getFullYear(); const m = calMonth.getMonth() + 1;
                        const other = externalDates.filter((e) => Number(e.date.slice(0, 4)) !== y || Number(e.date.slice(5, 7)) !== m);
                        onHardConstraintChange("external_fixed_dates", other);
                      }} className="rounded border border-gray-300 bg-white px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-100 transition">リセット</button>
                    </div>
                    <DayPicker
                      month={calMonth}
                      onMonthChange={setCalMonth}
                      locale={ja}
                      navLayout="after"
                      onDayClick={handleExternalDayClick}
                      modifiers={extInputMode === "internal" ? {
                        internalWorking: (day: Date) => {
                          const m = calMonth.getMonth() + 1; const y = calMonth.getFullYear();
                          if (day.getMonth() + 1 !== m || day.getFullYear() !== y) return false;
                          return !getExtEntry(format(day, "yyyy-MM-dd"));
                        },
                        saturday: (day: Date) => day.getDay() === 6,
                        sunday: (day: Date) => day.getDay() === 0,
                      } : {
                        externalFixed: (day: Date) => !!getExtEntry(format(day, "yyyy-MM-dd")),
                        saturday: (day: Date) => day.getDay() === 6,
                        sunday: (day: Date) => day.getDay() === 0,
                      }}
                      className={dayPickerBaseClassName}
                      classNames={dayPickerWithNavClassNames}
                      modifiersClassNames={extInputMode === "internal" ? {
                        internalWorking: "[&>button]:!bg-blue-200 [&>button]:!text-blue-900 [&>button]:!border-blue-400 [&>button]:font-bold",
                        saturday: "[&>button]:bg-blue-50/70 [&>button]:text-blue-600",
                        sunday: "[&>button]:bg-red-50/70 [&>button]:text-red-600",
                        today: "[&>button]:ring-1 [&>button]:ring-indigo-200",
                      } : {
                        externalFixed: "[&>button]:!bg-teal-200 [&>button]:!text-teal-900 [&>button]:!border-teal-400 [&>button]:font-bold",
                        saturday: "[&>button]:bg-blue-50/70 [&>button]:text-blue-600",
                        sunday: "[&>button]:bg-red-50/70 [&>button]:text-red-600",
                        today: "[&>button]:ring-1 [&>button]:ring-indigo-200",
                      }}
                    />
                    <TargetShiftPopover
                      open={Boolean(extPopover)}
                      title={extPopover ? `${Number(extPopover.dateStr.slice(5,7))}/${Number(extPopover.dateStr.slice(8))} の設定` : "設定"}
                      currentValue={extPopover ? (getExtEntry(extPopover.dateStr)?.target_shift ?? null) : null}
                      onSelect={handleExtPopoverSelect}
                      onClose={() => setExtPopover(null)}
                      labels={extInputMode === "internal" ? internalLabels : externalLabels}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </SettingsModalPortal>

  );
}