export type Doctor = {
  id: string;
  name: string;
  is_active?: boolean;
  min_score?: number | null;
  max_score?: number | null;
  target_score?: number | null;
  unavailable_days?: {
    date: string | null;
    day_of_week: number | null;
    is_fixed: boolean;
  }[];
};

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
  month_fairness: number;
  past_sat_gap: number;
  past_sunhol_gap: number;
  gap5: number;
  sat_consec: number;
  sunhol_3rd: number;
  gap6: number;
  score_balance: number;
  target: number;
};

export const DEFAULT_OBJECTIVE_WEIGHTS: ObjectiveWeights = {
  month_fairness: 100,
  past_sat_gap: 10,
  past_sunhol_gap: 5,
  gap5: 100,
  sat_consec: 80,
  sunhol_3rd: 80,
  gap6: 50,
  score_balance: 30,
  target: 10,
};


