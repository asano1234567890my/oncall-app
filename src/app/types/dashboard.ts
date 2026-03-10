export type TargetShift = "all" | "day" | "night";

export type UnavailableDayRecord = {
  date: string | null;
  day_of_week: number | null;
  weekday?: number | null;
  is_fixed: boolean;
  target_shift: TargetShift;
};

export type UnavailableDateEntry = {
  date: string;
  target_shift: TargetShift;
};

export type FixedUnavailableWeekdayEntry = {
  day_of_week: number;
  weekday?: number | null;
  target_shift: TargetShift;
};

export type Doctor = {
  id: string;
  name: string;
  is_active?: boolean;
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
  max_sunhol_days: number;
  max_sunhol_works: number;
  prevent_sunhol_consecutive: boolean;
  respect_unavailable_days: boolean;
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

export type ObjectiveWeights = {
  gap5: number;
  soft_unavailable: number;
  sat_consec: number;
  weekend_hol_3rd: number;
  gap6: number;
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
  max_sunhol_days: 2,
  max_sunhol_works: 3,
  prevent_sunhol_consecutive: true,
  respect_unavailable_days: true,
};

export const DEFAULT_OBJECTIVE_WEIGHTS: ObjectiveWeights = {
  gap5: 100,
  soft_unavailable: 100,
  sat_consec: 80,
  weekend_hol_3rd: 80,
  gap6: 50,
  month_fairness: 50,
  target: 30,
  score_balance: 10,
  sunhol_fairness: 10,
  past_sat_gap: 10,
  past_sunhol_gap: 5,
};
