export type TargetShift = "all" | "day" | "night";

export type UnavailableDayRecord = {
  date: string | null;
  day_of_week: number | null;
  weekday?: number | null;
  is_fixed: boolean;
  target_shift: TargetShift;
  is_soft_penalty?: boolean;
};

export type UnavailableDateEntry = {
  date: string;
  target_shift: TargetShift;
  is_soft_penalty?: boolean;
};

export type FixedUnavailableWeekdayEntry = {
  day_of_week: number;
  weekday?: number | null;
  target_shift: TargetShift;
  is_soft_penalty?: boolean;
};

export type Doctor = {
  id: string;
  name: string;
  is_active?: boolean;
  is_external?: boolean;
  access_token?: string;
  min_score?: number | null;
  max_score?: number | null;
  target_score?: number | null;
  unavailable_dates?: string[];
  unavailable_days?: UnavailableDayRecord[];
  fixed_weekdays?: FixedUnavailableWeekdayEntry[];
};

export type UnavailableDateMap = Record<string, UnavailableDateEntry[]>;
export type FixedUnavailableWeekdayMap = Record<string, FixedUnavailableWeekdayEntry[]>;

export type ShiftType = "day" | "night";

export type ScheduleRow = {
  day: number;
  day_shift?: string | null;
  night_shift?: string | null;
  is_holiday?: boolean;
  is_sunhol?: boolean;
};

export type DragPayload = {
  day: number;
  shiftType: ShiftType;
};

export type LockedShiftPayload = {
  date: string;
  shift_type: ShiftType;
  doctor_id: string;
};

export type PreviousMonthShift = {
  date: string;
  shift_type: ShiftType;
  doctor_id: string;
};

export type HardConstraints = {
  interval_days: number;
  max_weekend_holiday_works: number;
  max_saturday_nights: number;
  max_sunhol_days?: number | null;
  max_sunhol_works?: number | null;
  prevent_sunhol_consecutive: boolean;
  respect_unavailable_days: boolean;
  holiday_shift_mode: "combined" | "split";
  external_slot_count: number;
  external_fixed_dates: ExternalFixedDate[];
  internal_fixed_dates: ExternalFixedDate[];
  internal_day_count: number;
  external_input_mode: "external" | "internal";
};

export type ExternalFixedDate = {
  date: string;
  target_shift: "all" | "day" | "night";
};

export type SwapSource = {
  day: number;
  shiftType: ShiftType;
  doctorId: string;
};

export type HolidayLikeDayInfo = {
  ymd: string;
  wd: string;
  isSun: boolean;
  isAutoHoliday: boolean;
  isManualHoliday: boolean;
  isHolidayLike: boolean;
};

export type ScoreTone = "default" | "good" | "warn" | "danger";

export type DoctorScoreEntry = {
  doctorId: string;
  score: number;
  min: number;
  max: number;
  target: number | null;
  tone: ScoreTone;
};

export type ConstraintDiagnostic = {
  id: string;
  name_ja: string;
  current_value?: string | null;
  suggestion_ja?: string | null;
};

export type DiagnosticInfo = {
  pre_check_errors: ConstraintDiagnostic[];
};

// P1-2 Phase 2: Constraint Diagnosis
export type ConflictGroup = {
  group_id: string;
  category: string;
  doctor_name?: string | null;
  description_ja: string;
};

export type SolvableRemoval = {
  group_id: string;
  category: string;
  doctor_name?: string | null;
  description_ja: string;
  is_admin_setting?: boolean;
  set_number?: number;
  set_size?: number;
};

export type DiagnoseResult = {
  conflict_groups: ConflictGroup[];
  specific_violations: string[];
  solvable_removals: SolvableRemoval[];
  human_insights: string[];
  ai_explanation?: string | null;
};

export type DiagnoseResponse = {
  success: boolean;
  phase_completed: number;
  result?: DiagnoseResult | null;
  error?: string | null;
};

export type ObjectiveWeights = {
  ideal_gap_weight: number;
  ideal_gap_extra: number;
  soft_unavailable: number;
  sat_consec: number;
  sat_month_fairness: number;
  weekend_hol_3rd: number;
  month_fairness: number;
  target: number;
  score_balance: number;
  sunhol_fairness: number;
  past_sat_gap: number;
  past_sunhol_gap: number;
};

export const DEFAULT_HARD_CONSTRAINTS: HardConstraints = {
  interval_days: 4,
  max_weekend_holiday_works: 3,
  max_saturday_nights: 1,
  max_sunhol_days: null,
  max_sunhol_works: null,
  prevent_sunhol_consecutive: true,
  respect_unavailable_days: true,
  holiday_shift_mode: "split",
  external_slot_count: 0,
  external_fixed_dates: [],
  internal_fixed_dates: [],
  internal_day_count: 8,
  external_input_mode: "external",
};

export type ShiftScores = {
  weekday_night: number;
  saturday_night: number;
  holiday_day: number;
  holiday_night: number;
};

export const DEFAULT_SHIFT_SCORES: ShiftScores = {
  weekday_night: 1.0,
  saturday_night: 1.5,
  holiday_day: 0.5,
  holiday_night: 1.0,
};

export const DEFAULT_OBJECTIVE_WEIGHTS: ObjectiveWeights = {
  // 軸1: 目標スコアへの近さ（primaryKey: target = 100）
  target: 100,
  score_balance: 30,
  // 軸2: 土日祝の均等化（primaryKey: sunhol_fairness = 100）
  sunhol_fairness: 100,
  sat_month_fairness: 100,
  past_sunhol_gap: 50,
  past_sat_gap: 50,
  // 軸3: 勤務間隔のゆとり
  ideal_gap_weight: 100,
  ideal_gap_extra: 3,
  // 不活化（将来バックエンド再設計時に廃止予定）
  month_fairness: 0,
  sat_consec: 0,
  weekend_hol_3rd: 0,
  soft_unavailable: 0,
};
