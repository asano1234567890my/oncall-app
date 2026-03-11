import { parseISO } from "date-fns";

﻿import type { HardConstraints, ObjectiveWeights, TargetShift } from "../../types/dashboard";

export type WeightChangeSummary = {
  isDefault: boolean;
  changedCount: number;
  top: string[];
};

export const weightInputs = [
  { key: "gap5", label: "5日間隔", min: 0, max: 200, step: 5, hint: "勤務間隔" },
  { key: "soft_unavailable", label: "忌避日のソフト回避", min: 0, max: 200, step: 5, hint: "希望日の尊重" },
  { key: "sat_consec", label: "2か月連続土曜回避", min: 0, max: 200, step: 5, hint: "連続土曜抑制" },
  { key: "weekend_hol_3rd", label: "土日祝合算3回目ペナルティ", min: 0, max: 200, step: 5, hint: "土日祝回数抑制" },
  { key: "gap6", label: "6日間隔", min: 0, max: 200, step: 5, hint: "余裕を持つ" },
  { key: "month_fairness", label: "同月のスコア平準化", min: 0, max: 200, step: 5, hint: "同月の偏り抑制" },
  { key: "target", label: "目標スコアへの近似度", min: 0, max: 200, step: 5, hint: "個別目標寄せ" },
  { key: "score_balance", label: "過去数か月のスコア平準化", min: 0, max: 200, step: 5, hint: "負担バランス" },
  { key: "sunhol_fairness", label: "同月の日祝回数平準化", min: 0, max: 200, step: 5, hint: "日祝回数の均等化" },
  { key: "past_sat_gap", label: "過去数か月の土曜勤務平準化", min: 0, max: 200, step: 5, hint: "過去実績考慮" },
  { key: "past_sunhol_gap", label: "過去数か月の日祝勤務平準化", min: 0, max: 200, step: 5, hint: "過去実績考慮" },
] as const satisfies ReadonlyArray<{
  key: keyof ObjectiveWeights;
  label: string;
  min: number;
  max: number;
  step: number;
  hint: string;
}>;

export const hardConstraintNumberInputs = [
  { key: "interval_days", label: "勤務間隔ルール", min: 0, max: 10, step: 1, unit: "日", hint: "0でOFF / 既定4" },
  {
    key: "max_weekend_holiday_works",
    label: "土日祝の合算勤務上限",
    min: 0,
    max: 10,
    step: 1,
    unit: "回",
    hint: "0でOFF / 既定3",
  },
  {
    key: "max_saturday_nights",
    label: "土曜当直上限",
    min: 0,
    max: 10,
    step: 1,
    unit: "回",
    hint: "0でOFF / 既定1",
  },
  {
    key: "max_sunhol_days",
    label: "日祝・日直上限",
    min: 0,
    max: 10,
    step: 1,
    unit: "回",
    hint: "0でOFF / 既定2",
  },
  {
    key: "max_sunhol_works",
    label: "日祝勤務上限",
    min: 0,
    max: 10,
    step: 1,
    unit: "回",
    hint: "0でOFF / 既定3",
  },
] as const satisfies ReadonlyArray<{
  key: keyof HardConstraints;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint: string;
}>;

export const hardConstraintToggleInputs = [
  {
    key: "prevent_sunhol_consecutive",
    label: "日祝の昼夜連続勤務を禁止",
    hint: "ON で日祝の日直と当直の連続勤務をハード制約として禁止します。",
  },
  {
    key: "respect_unavailable_days",
    label: "医師の休み希望を絶対守る",
    hint: "ON で不可日・不可曜日を厳守し、OFF で optimizer 側の緩和余地を残します。",
  },
] as const satisfies ReadonlyArray<{
  key: keyof HardConstraints;
  label: string;
  hint: string;
}>;

export const fixedWeekdayLabels = ["月", "火", "水", "木", "金", "土", "日", "祝"] as const;

export const pad2 = (value: number) => String(value).padStart(2, "0");
export const toDateKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
export const parseDateKey = (value: string) => {
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const dayPickerBaseClassName = [
  "w-full",
  "[--rdp-day-width:2.35rem] [--rdp-day-height:2.35rem]",
  "[--rdp-day_button-width:2.35rem] [--rdp-day_button-height:2.35rem]",
  "[--rdp-months-gap:0px]",
  "sm:[--rdp-day-width:2.65rem] sm:[--rdp-day-height:2.65rem]",
  "sm:[--rdp-day_button-width:2.65rem] sm:[--rdp-day_button-height:2.65rem]",
].join(" ");

export const dayPickerClassNames = {
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
};

export const baseCalendarModifierClasses = {
  saturday:
    "[&>button]:bg-blue-50/70 [&>button]:text-blue-600 hover:[&>button]:bg-blue-100/80",
  sunday:
    "[&>button]:bg-red-50/70 [&>button]:text-red-600 hover:[&>button]:bg-red-100/80",
  today:
    "[&>button]:ring-1 [&>button]:ring-indigo-200 [&>button]:font-semibold [&>button]:text-indigo-700",
  outside: "[&>button]:bg-transparent [&>button]:text-slate-300",
  disabled:
    "[&>button]:!bg-transparent [&>button]:!text-slate-300 [&>button]:opacity-45 [&>button]:hover:bg-transparent [&>button]:hover:shadow-none",
};

export const unavailableAllModifierClass =
  "[&>button]:relative [&>button]:!border-red-400 [&>button]:!bg-red-300 [&>button]:!text-transparent [&>button]:shadow-sm hover:[&>button]:!bg-red-400 [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[11px] [&>button]:after:font-bold [&>button]:after:text-red-900 [&>button]:after:content-['[休]']";

export const unavailableDayModifierClass =
  "[&>button]:relative [&>button]:border-red-300 [&>button]:text-transparent [&>button]:bg-[linear-gradient(135deg,#fecaca_0%,#fecaca_50%,transparent_50%,transparent_100%)] [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[11px] [&>button]:after:font-bold [&>button]:after:text-red-800 [&>button]:after:content-['[日]']";

export const unavailableNightModifierClass =
  "[&>button]:relative [&>button]:border-red-300 [&>button]:text-transparent [&>button]:bg-[linear-gradient(135deg,transparent_0%,transparent_50%,#fecaca_50%,#fecaca_100%)] [&>button]:after:absolute [&>button]:after:inset-0 [&>button]:after:flex [&>button]:after:items-center [&>button]:after:justify-center [&>button]:after:text-[11px] [&>button]:after:font-bold [&>button]:after:text-red-800 [&>button]:after:content-['[当]']";

export const getTargetShiftSummaryLabel = (targetShift: TargetShift | null) => {
  if (targetShift === "all") return "終日休み";
  if (targetShift === "day") return "日直のみ休み";
  if (targetShift === "night") return "当直のみ休み";
  return "設定なし";
};

export const getAnchorPosition = (target: HTMLElement, container: HTMLElement | null) => {
  const targetRect = target.getBoundingClientRect();
  const containerRect = container?.getBoundingClientRect();
  return {
    top: targetRect.bottom - (containerRect?.top ?? 0) + 8,
    left: targetRect.left - (containerRect?.left ?? 0) + targetRect.width / 2,
  };
};

export const getFixedWeekdayButtonTone = (weekday: number, targetShift: TargetShift | null) => {
  const isSun = weekday === 6;
  const isHoliday = weekday === 7;
  const isSat = weekday === 5;
  const isHolidayLike = isSun || isHoliday;

  if (isHolidayLike) {
    if (targetShift === "all") return "border-red-400 bg-red-300 text-red-900";
    if (targetShift === "day") return "border-red-300 text-red-800 bg-[linear-gradient(135deg,#fecaca_0%,#fecaca_50%,transparent_50%,transparent_100%)]";
    if (targetShift === "night") return "border-red-300 text-red-800 bg-[linear-gradient(135deg,transparent_0%,transparent_50%,#fecaca_50%,#fecaca_100%)]";
    return "border-red-200 bg-red-50 text-red-400 hover:bg-red-100";
  }

  if (targetShift === "all") {
    if (isSat) return "border-blue-700 bg-blue-600 text-white";
    return "border-gray-900 bg-gray-900 text-white";
  }

  if (targetShift === "day") return "border-amber-300 bg-amber-50 text-amber-900";
  if (targetShift === "night") return "border-sky-300 bg-sky-50 text-sky-900";
  if (isSat) return "border-blue-200 bg-blue-50 text-blue-500 hover:bg-blue-100";
  return "border-gray-200 bg-white text-gray-500 hover:bg-gray-50";
};

export const getFixedWeekdayButtonLabel = (targetShift: TargetShift | null) => {
  if (targetShift === "all") return "[休]";
  if (targetShift === "day") return "[日]";
  if (targetShift === "night") return "[当]";
  return "";
};
