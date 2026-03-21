import { parseISO } from "date-fns";

﻿import type { HardConstraints, ObjectiveWeights, TargetShift } from "../../types/dashboard";

export type WeightChangeSummary = {
  isDefault: boolean;
  changedCount: number;
  top: string[];
};

/** 旧: 個別ウェイト一覧（/app 用に残す） */
export const weightInputs = [
  { key: "gap5", label: "間隔ルール+1日のペナルティ", min: 0, max: 200, step: 5, hint: "勤務間隔ルールの直上を抑制" },
  { key: "soft_unavailable", label: "不可日の回避優先度", min: 0, max: 200, step: 5, hint: "不可日を守れない場合の回避強度" },
  { key: "sat_consec", label: "2か月連続土曜回避", min: 0, max: 200, step: 5, hint: "連続土曜抑制" },
  { key: "sat_month_fairness", label: "同月の土曜回数平準化", min: 0, max: 200, step: 5, hint: "土曜回数の均等化" },
  { key: "weekend_hol_3rd", label: "土日祝合算3回目ペナルティ", min: 0, max: 200, step: 5, hint: "土日祝回数抑制" },
  { key: "gap6", label: "間隔ルール+2日のペナルティ", min: 0, max: 200, step: 5, hint: "より余裕のある間隔を促進" },
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

/** 新: 4軸グループ（/dashboard 用） */
export type WeightChildMeta = {
  key: keyof ObjectiveWeights;
  ratio: number;
  label: string;
  hint: string;
};

export type WeightGroup = {
  id: string;
  label: string;
  hint: string;
  primaryKey: keyof ObjectiveWeights;
  childMapping: Partial<Record<keyof ObjectiveWeights, number>>;
  /** 子要素のメタデータ（比率調整UI用）。未定義のグループは比率調整不可 */
  children?: WeightChildMeta[];
  min: number;
  max: number;
  step: number;
};

export const weightGroups: WeightGroup[] = [
  {
    id: "target_score",
    label: "目標スコアへの近さ",
    hint: "各医師の目標スコアに寄せます。目標が全員同じなら公平性と同義です。",
    primaryKey: "target",
    childMapping: { target: 1.0, score_balance: 0.3 },
    min: 0, max: 200, step: 5,
  },
  {
    id: "weekend_holiday_fairness",
    label: "土日祝の均等化",
    hint: "土日祝シフトの回数を医師間で均等にします。過去数か月の実績も考慮します。",
    primaryKey: "sunhol_fairness",
    childMapping: {
      sunhol_fairness: 1.0, sat_month_fairness: 1.0,
      past_sunhol_gap: 0.5, past_sat_gap: 0.5,
    },
    children: [
      { key: "sunhol_fairness", ratio: 1.0, label: "当月の日祝回数バランス", hint: "今月の日祝シフト回数を医師間で均等にします" },
      { key: "sat_month_fairness", ratio: 1.0, label: "当月の土曜回数バランス", hint: "今月の土曜当直回数を医師間で均等にします" },
      { key: "past_sunhol_gap", ratio: 0.5, label: "過去の日祝実績バランス", hint: "過去数か月の日祝シフト累積回数の差を縮めます" },
      { key: "past_sat_gap", ratio: 0.5, label: "過去の土曜実績バランス", hint: "過去数か月の土曜当直累積回数の差を縮めます" },
    ],
    min: 0, max: 200, step: 5,
  },
];

/** 子要素の比率オーバーライド（グループID → キー → 比率） */
export type WeightRatioOverrides = Partial<Record<string, Partial<Record<keyof ObjectiveWeights, number>>>>;

/** グループスライダーの値からObjectiveWeightsを一括生成 */
export function expandWeightGroups(
  currentWeights: ObjectiveWeights,
  groupId: string,
  newValue: number,
  ratioOverrides?: WeightRatioOverrides,
): ObjectiveWeights {
  const group = weightGroups.find((g) => g.id === groupId);
  if (!group) return currentWeights;
  const overrides = ratioOverrides?.[groupId];
  const next = { ...currentWeights };
  for (const [key, defaultRatio] of Object.entries(group.childMapping)) {
    const k = key as keyof ObjectiveWeights;
    const ratio = overrides?.[k] ?? (defaultRatio as number);
    next[k] = Math.round(newValue * ratio);
  }
  return next;
}

export type WeightMeta = {
  label: string;
  hint: string;
  inactive: boolean;
  inactiveReason?: string;
};

export function getWeightMeta(
  key: keyof ObjectiveWeights,
  base: { label: string; hint: string },
  hardConstraints: HardConstraints
): WeightMeta {
  const intervalDays = hardConstraints.interval_days ?? 4;
  const base_ = intervalDays > 0 ? intervalDays : 4;

  switch (key) {
    case "gap5":
      return {
        label: `勤務間隔ルール+1日（${base_ + 1}日間隔）のペナルティ`,
        hint: "ハード制約の間隔直上をソフト抑制",
        inactive: false,
      };
    case "gap6":
      return {
        label: `勤務間隔ルール+2日（${base_ + 2}日間隔）のペナルティ`,
        hint: "より余裕のある間隔を促進",
        inactive: false,
      };
    case "soft_unavailable": {
      const inactive = hardConstraints.respect_unavailable_days !== false;
      return {
        label: base.label,
        hint: base.hint,
        inactive,
        inactiveReason: inactive
          ? "「不可日を絶対守る」がONのため、ハード制約として強制されています"
          : undefined,
      };
    }
    case "weekend_hol_3rd": {
      const cap = hardConstraints.max_weekend_holiday_works;
      const inactive = typeof cap === "number" && cap > 0 && cap <= 2;
      return {
        label: base.label,
        hint: base.hint,
        inactive,
        inactiveReason: inactive
          ? `土日祝合算上限が${cap}回（ハード制約）のため、3回目に到達できません`
          : undefined,
      };
    }
    case "sat_month_fairness": {
      const cap = hardConstraints.max_saturday_nights;
      const inactive = typeof cap === "number" && cap === 1;
      return {
        label: base.label,
        hint: base.hint,
        inactive,
        inactiveReason: inactive
          ? "土曜夜間上限が1回のため、月内ギャップは常に1（定数）で最適化に影響しません"
          : undefined,
      };
    }
    default:
      return { label: base.label, hint: base.hint, inactive: false };
  }
}

export const hardConstraintNumberInputs = [
  { key: "interval_days", label: "勤務間隔", min: 0, max: 10, step: 1, unit: "日", hint: "0で制限なし / 既定4" },
  {
    key: "max_weekend_holiday_works",
    label: "土日祝の合算勤務上限",
    min: 1,
    max: 10,
    step: 1,
    unit: "回",
    hint: "既定3",
  },
  {
    key: "max_saturday_nights",
    label: "土曜当直上限",
    min: 1,
    max: 10,
    step: 1,
    unit: "回",
    hint: "既定1",
  },
  {
    key: "max_sunhol_days",
    label: "日祝・日直上限",
    min: 1,
    max: 10,
    step: 1,
    unit: "回",
    hint: "既定2",
  },
  {
    key: "max_sunhol_works",
    label: "日祝勤務上限",
    min: 1,
    max: 10,
    step: 1,
    unit: "回",
    hint: "既定3",
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
    key: "respect_unavailable_days",
    label: "不可日を絶対守る",
    hint: "ON で不可日・不可曜日をハード制約として厳守します。OFF にすると「不可日の回避優先度」の重みに応じてソフト回避になります。",
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

const dayPickerClassNamesBase = {
  root: "w-full",
  months: "block w-full max-w-none",
  month: "w-full space-y-3",
  month_caption: "flex min-w-0 items-center justify-center text-center",
  caption_label: "truncate px-3 text-base font-bold tracking-tight text-slate-900",
  month_grid: "w-full table-fixed border-collapse",
  weekdays: "border-b border-slate-200/80",
  weekday: "pb-2 text-center text-[11px] font-medium tracking-[0.18em] text-slate-400",
  week: "border-b border-slate-100 last:border-b-0",
  day: "p-0 text-center align-middle",
  day_button:
    "mx-auto my-1 flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-sm font-medium text-slate-700 transition hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
};

/** ナビ非表示（ダッシュボード等、外部で月を制御する場合） */
export const dayPickerClassNames = {
  ...dayPickerClassNamesBase,
  nav: "hidden",
};

/** ナビ表示（ドロワー内など、カレンダー単体で月移動させたい場合） */
export const dayPickerWithNavClassNames = {
  ...dayPickerClassNamesBase,
  nav: "flex items-center gap-1",
  button_previous: "inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-100 transition-colors",
  button_next: "inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-100 transition-colors",
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
