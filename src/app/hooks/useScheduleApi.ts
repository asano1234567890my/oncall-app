import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "react-hot-toast";
import type {
  DiagnoseResponse,
  DiagnoseResult,
  DiagnosticInfo,
  Doctor,
  FixedUnavailableWeekdayMap,
  HardConstraints,
  HolidayLikeDayInfo,
  LockedShiftPayload,
  ObjectiveWeights,
  PreviousMonthShift,
  ScheduleRow,
  UnavailableDateMap,
} from "../types/dashboard";
import {
  normalizeFixedUnavailableWeekdayEntries,
  normalizeUnavailableDateEntries,
} from "../utils/unavailableSettings";
import { useDoctorSettings } from "./useDoctorSettings";
import { getAuthHeaders } from "./useAuth";

type UseScheduleApiParams = {
  year: number;
  month: number;
  activeDoctors: Doctor[];
  holidays: number[];
  autoHolidayDaysInMonth: number[];
  holidayWorkdayOverrides: Set<string>;
  prevMonthLastDay: number;
  scoreMin: number;
  scoreMax: number;
  objectiveWeights: ObjectiveWeights;
  hardConstraints: HardConstraints;
  unavailableMap: UnavailableDateMap;
  fixedUnavailableWeekdaysMap: FixedUnavailableWeekdayMap;
  doctorUnavailableYear: number;
  doctorUnavailableMonth: number;
  previousMonthShifts: PreviousMonthShift[];
  minScoreMap: Record<string, number>;
  maxScoreMap: Record<string, number>;
  targetScoreMap: Record<string, number | null>;
  schedule: ScheduleRow[];
  setSchedule: (nextSchedule: ScheduleRow[]) => void;
  commitSchedule: (nextSchedule: ScheduleRow[]) => void;
  commitScheduleFrom: (baseSchedule: ScheduleRow[], nextSchedule: ScheduleRow[]) => void;
  setScores: Dispatch<SetStateAction<Record<string, number | string>>>;
  setDoctors: Dispatch<SetStateAction<Doctor[]>>;
  setSelectedDoctorId: Dispatch<SetStateAction<string>>;
  setUnavailableMap: Dispatch<SetStateAction<UnavailableDateMap>>;
  setFixedUnavailableWeekdaysMap: Dispatch<SetStateAction<FixedUnavailableWeekdayMap>>;
  setMinScoreMap: Dispatch<SetStateAction<Record<string, number>>>;
  setMaxScoreMap: Dispatch<SetStateAction<Record<string, number>>>;
  setTargetScoreMap: Dispatch<SetStateAction<Record<string, number | null>>>;
  toYmd: (year: number, month: number, day: number) => string;
  getWeekday: (year: number, month: number, day: number) => string;
  isHolidayLikeDay: (day: number) => HolidayLikeDayInfo;
  filterRecordByActiveDoctors: <T>(input: Record<string, T>) => Record<string, T>;
  buildLockedShiftsPayload: () => LockedShiftPayload[];
  lockedShiftKeys: Set<string>;
  markScheduleClean: (rows?: ScheduleRow[]) => void;
};

type MessageResponse = {
  detail?: string;
  message?: string;
};

const cloneSchedule = (rows: ScheduleRow[]) => rows.map((row) => ({ ...row }));
const pad2 = (value: number) => String(value).padStart(2, "0");
const sanitizeConstraintValue = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);

const readOptionalJson = async <T>(response: Response): Promise<T | null> => {
  const body = await response.text();

  if (!body.trim()) {
    return null;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
};

const getResponseMessage = (payload: MessageResponse | null, fallback: string) =>
  payload?.message || payload?.detail || fallback;

export function useScheduleApi({
  year,
  month,
  activeDoctors,
  holidays,
  autoHolidayDaysInMonth,
  holidayWorkdayOverrides,
  prevMonthLastDay,
  scoreMin,
  scoreMax,
  objectiveWeights,
  hardConstraints,
  unavailableMap,
  fixedUnavailableWeekdaysMap,
  doctorUnavailableYear,
  doctorUnavailableMonth,
  previousMonthShifts,
  minScoreMap,
  maxScoreMap,
  targetScoreMap,
  schedule,
  setSchedule,
  commitSchedule,
  commitScheduleFrom,
  setScores,
  setDoctors,
  setSelectedDoctorId,
  setUnavailableMap,
  setFixedUnavailableWeekdaysMap,
  setMinScoreMap,
  setMaxScoreMap,
  setTargetScoreMap,
  toYmd,
  getWeekday,
  isHolidayLikeDay,
  filterRecordByActiveDoctors,
  buildLockedShiftsPayload,
  lockedShiftKeys,
  markScheduleClean,
}: UseScheduleApiParams) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingMonthSchedule, setIsDeletingMonthSchedule] = useState(false);
  const [isBulkSavingDoctors, setIsBulkSavingDoctors] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<DiagnoseResult | null>(null);

  // Reset transient state when year/month changes
  useEffect(() => {
    setError("");
    setDiagnostics(null);
    setDiagnoseResult(null);
    setSaveMessage("");
  }, [year, month]);

  const { getUnsavedDoctorNames, saveAllDoctorsSettings, refetchDoctors } = useDoctorSettings({
    activeDoctors,
    unavailableMap,
    fixedUnavailableWeekdaysMap,
    minScoreMap,
    maxScoreMap,
    targetScoreMap,
    doctorUnavailableYear,
    doctorUnavailableMonth,
    setDoctors,
    setSelectedDoctorId,
    setUnavailableMap,
    setFixedUnavailableWeekdaysMap,
    setMinScoreMap,
    setMaxScoreMap,
    setTargetScoreMap,
    setIsBulkSavingDoctors,
    setError,
    setSaveMessage,
  });

  const normalizeScheduleRows = (rows: ScheduleRow[]) =>
    rows.map((row) => ({
      ...row,
      day_shift: row.day_shift ?? null,
      night_shift: row.night_shift ?? null,
      is_sunhol: Boolean(row.is_sunhol) || isHolidayLikeDay(row.day).isHolidayLike,
    }));

  const clearUnlockedSchedule = (rows: ScheduleRow[]) =>
    rows.map((row) => ({
      ...row,
      day_shift: lockedShiftKeys.has(`${row.day}_day`) ? row.day_shift ?? null : null,
      night_shift: lockedShiftKeys.has(`${row.day}_night`) ? row.night_shift ?? null : null,
    }));

  const formatUnavailableForOptimize = (input: UnavailableDateMap) => {
    const filtered = filterRecordByActiveDoctors(input);
    const prefix = `${year}-${pad2(month)}-`;
    const next: Record<
      string,
      { date: number; target_shift: "all" | "day" | "night"; is_soft_penalty: false }[]
    > = {};

    Object.entries(filtered).forEach(([doctorId, entries]) => {
      const unavailableEntries = normalizeUnavailableDateEntries(entries ?? [])
        .filter((entry) => entry.date.startsWith(prefix))
        .map((entry) => ({
          date: Number.parseInt(entry.date.slice(-2), 10),
          target_shift: entry.target_shift,
          is_soft_penalty: false as const,
        }))
        .filter((entry) => Number.isFinite(entry.date));

      if (unavailableEntries.length > 0) {
        next[doctorId] = unavailableEntries;
      }
    });

    return next;
  };

  const formatFixedWeekdaysForOptimize = (input: FixedUnavailableWeekdayMap) => {
    const filtered = filterRecordByActiveDoctors(input);
    const next: Record<
      string,
      { day_of_week: number; target_shift: "all" | "day" | "night"; is_soft_penalty: false }[]
    > = {};

    Object.entries(filtered).forEach(([doctorId, entries]) => {
      const weekdayEntries = normalizeFixedUnavailableWeekdayEntries(entries ?? [])
        .map((entry) => ({
          day_of_week: entry.day_of_week,
          target_shift: entry.target_shift,
          is_soft_penalty: false as const,
        }))
        .filter((entry) => entry.day_of_week >= 0 && entry.day_of_week <= 7);

      if (weekdayEntries.length > 0) {
        next[doctorId] = weekdayEntries;
      }
    });

    return next;
  };

  const formatHardConstraintsForOptimize = () => {
    // 勤務日数モード: internal_fixed_dates の補集合を external_fixed_dates として送信
    let extDates = (hardConstraints.external_fixed_dates ?? []).map((e) => ({ date: e.date, target_shift: e.target_shift }));
    if (hardConstraints.external_input_mode === "internal") {
      const internalFixedDates = hardConstraints.internal_fixed_dates ?? [];
      if (internalFixedDates.length > 0) {
        // カレンダーで勤務日が指定されている場合: 補集合を外部日として送信
        const internalDates = new Set(internalFixedDates.map((e) => e.date));
        const daysInMonth = new Date(year, month, 0).getDate();
        const pad = (n: number) => String(n).padStart(2, "0");
        extDates = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${pad(month)}-${pad(d)}`;
          if (!internalDates.has(dateStr)) {
            extDates.push({ date: dateStr, target_shift: "all" });
          }
        }
      } else {
        // カレンダー未操作: 日別指定なし、external_slot_countだけで制御
        extDates = [];
      }
    }
    return {
      interval_days: sanitizeConstraintValue(hardConstraints.interval_days),
      max_weekend_holiday_works: sanitizeConstraintValue(hardConstraints.max_weekend_holiday_works),
      max_saturday_nights: sanitizeConstraintValue(hardConstraints.max_saturday_nights),
      max_sunhol_days: hardConstraints.max_sunhol_days ?? null,
      max_sunhol_works: hardConstraints.max_sunhol_works ?? null,
      prevent_sunhol_consecutive: Boolean(hardConstraints.prevent_sunhol_consecutive),
      respect_unavailable_days: Boolean(hardConstraints.respect_unavailable_days),
      holiday_shift_mode: hardConstraints.holiday_shift_mode ?? "split",
      external_slot_count: hardConstraints.external_input_mode === "internal"
        ? Math.max(0, new Date(year, month, 0).getDate() - (hardConstraints.internal_day_count ?? 8))
        : (hardConstraints.external_slot_count ?? 0),
      external_fixed_dates: extDates,
    };
  };

  const formatPreviousMonthShiftsForOptimize = () => {
    const activeDoctorIds = new Set(activeDoctors.map((doctor) => doctor.id));
    const seen = new Set<string>();

    return previousMonthShifts
      .filter(
        (entry) =>
          activeDoctorIds.has(entry.doctor_id) &&
          (entry.shift_type === "day" || entry.shift_type === "night") &&
          /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
      )
      .filter((entry) => {
        const key = entry.date + "_" + entry.shift_type + "_" + entry.doctor_id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => {
        if (left.date !== right.date) return left.date.localeCompare(right.date);
        if (left.shift_type !== right.shift_type) return left.shift_type === "day" ? -1 : 1;
        return left.doctor_id.localeCompare(right.doctor_id);
      });
  };

  const handleDeleteMonthSchedule = async () => {
    if (!confirm(`${year}年${month}月の未固定シフトを画面上でクリアします。よろしいですか？`)) return;

    setIsDeletingMonthSchedule(true);
    setError("");

    try {
      const clearedSchedule = clearUnlockedSchedule(schedule);
      commitSchedule(clearedSchedule);
      setScores({});
      setSaveMessage("画面上のシフトをクリアしました（※まだ保存されていません）");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "画面上のシフトクリアに失敗しました");
    } finally {
      setIsDeletingMonthSchedule(false);
    }
  };

  const handleGenerate = async () => {
    const scheduleBeforeGenerate = cloneSchedule(schedule);

    setIsLoading(true);
    setError("");
    setDiagnostics(null);
    setDiagnoseResult(null);
    setSaveMessage("");

    try {
      const daysInMonth = new Date(year, month, 0).getDate();
      const activeCount = activeDoctors.length;

      if (activeCount === 0) {
        throw new Error("有効な医師がいないため、自動生成できません");
      }

      // 前月データがDBにない場合の警告
      if (previousMonthShifts.length === 0) {
        const proceed = window.confirm(
          "前月の当直表がまだ読み込まれていません。\n\n" +
          "月またぎでの連続当直を防ぐには、先に前月の当直表を保存してください。\n\n" +
          "このまま生成しますか？"
        );
        if (!proceed) {
          setIsLoading(false);
          return;
        }
      }

      const lockedShifts = buildLockedShiftsPayload();
      setSchedule(clearUnlockedSchedule(scheduleBeforeGenerate));

      const manual = holidays.filter((day) => day >= 1 && day <= daysInMonth);
      const auto = autoHolidayDaysInMonth
        .filter((day) => day >= 1 && day <= daysInMonth)
        .filter((day) => !holidayWorkdayOverrides.has(toYmd(year, month, day)));
      const nonSunday = (day: number) => getWeekday(year, month, day) !== "日";
      const validHolidays = Array.from(new Set([...manual, ...auto].filter(nonSunday))).sort((a, b) => a - b);

      const formattedUnavailable = formatUnavailableForOptimize(unavailableMap);
      const formattedFixedWeekdays = formatFixedWeekdaysForOptimize(fixedUnavailableWeekdaysMap);
      const formattedPreviousMonthShifts = formatPreviousMonthShiftsForOptimize();
      const formattedHardConstraints = formatHardConstraintsForOptimize();
      const formattedMinScore = filterRecordByActiveDoctors(minScoreMap);
      const formattedMaxScore = filterRecordByActiveDoctors(maxScoreMap);
      const formattedTargetScore = Object.fromEntries(
        Object.entries(filterRecordByActiveDoctors(targetScoreMap)).filter(([, v]) => v != null && v > 0),
      );

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/optimize/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          year,
          month,
          num_doctors: activeCount,
          holidays: validHolidays,
          unavailable: formattedUnavailable,
          fixed_unavailable_weekdays: formattedFixedWeekdays,
          prev_month_last_day: prevMonthLastDay,
          prev_month_worked_days: {},
          previous_month_shifts: formattedPreviousMonthShifts,
          score_min: scoreMin,
          score_max: scoreMax,
          min_score_by_doctor: formattedMinScore,
          max_score_by_doctor: formattedMaxScore,
          target_score_by_doctor: formattedTargetScore,
          past_sat_counts: new Array(activeCount).fill(0),
          past_sunhol_counts: new Array(activeCount).fill(0),
          past_total_scores: {},
          objective_weights: Object.fromEntries(
            Object.entries(objectiveWeights).filter(([, v]) => v != null)
          ),
          hard_constraints: formattedHardConstraints,
          locked_shifts: lockedShifts,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail = data.detail;
        const msg = typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join("; ")
            : "自動生成に失敗しました";
        throw new Error(msg);
      }

      // Handle success=false (diagnostics / solver failure)
      if (data.success === false) {
        if (data.diagnostics) {
          setDiagnostics(data.diagnostics as DiagnosticInfo);
        }
        throw new Error(data.message || "スケジュールを生成できませんでした");
      }

      const nextSchedule = normalizeScheduleRows((data.schedule ?? []) as ScheduleRow[]);
      commitScheduleFrom(scheduleBeforeGenerate, nextSchedule);
      setScores(data.scores ?? {});

      // 生成時に外部医師がDBに作成される可能性があるため、医師リストを再取得
      void refetchDoctors();

      // Show warning if soft unavailable days were violated
      if (Array.isArray(data.soft_unavail_violations) && data.soft_unavail_violations.length > 0) {
        const violations = data.soft_unavail_violations as { doctor_name: string; day: number; shift_type: string }[];
        const byDoctor = new Map<string, string[]>();
        for (const v of violations) {
          const label = v.shift_type === "day" ? "日直" : v.shift_type === "night" ? "当直" : "当直";
          const entry = `${v.day}日(${label})`;
          const list = byDoctor.get(v.doctor_name) || [];
          list.push(entry);
          byDoctor.set(v.doctor_name, list);
        }
        const lines = Array.from(byDoctor.entries()).map(
          ([name, days]) => `${name}: ${days.join("・")}`
        );
        toast(
          `不可希望を守れなかった医師:\n${lines.join("\n")}`,
          { icon: "⚠️", duration: 8000 }
        );
      }
    } catch (err: unknown) {
      setSchedule(scheduleBeforeGenerate);
      setError(err instanceof Error ? err.message : "自動生成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiagnose = async () => {
    setIsDiagnosing(true);
    setDiagnoseResult(null);

    try {
      const daysInMonth = new Date(year, month, 0).getDate();
      const activeCount = activeDoctors.length;

      if (activeCount === 0) {
        throw new Error("有効な医師がいません");
      }

      const lockedShifts = buildLockedShiftsPayload();

      const manual = holidays.filter((day) => day >= 1 && day <= daysInMonth);
      const auto = autoHolidayDaysInMonth
        .filter((day) => day >= 1 && day <= daysInMonth)
        .filter((day) => !holidayWorkdayOverrides.has(toYmd(year, month, day)));
      const nonSunday = (day: number) => getWeekday(year, month, day) !== "日";
      const validHolidays = Array.from(new Set([...manual, ...auto].filter(nonSunday))).sort((a, b) => a - b);

      const formattedUnavailable = formatUnavailableForOptimize(unavailableMap);
      const formattedFixedWeekdays = formatFixedWeekdaysForOptimize(fixedUnavailableWeekdaysMap);
      const formattedPreviousMonthShifts = formatPreviousMonthShiftsForOptimize();
      const formattedHardConstraints = formatHardConstraintsForOptimize();
      const formattedMinScore = filterRecordByActiveDoctors(minScoreMap);
      const formattedMaxScore = filterRecordByActiveDoctors(maxScoreMap);
      const formattedTargetScore = Object.fromEntries(
        Object.entries(filterRecordByActiveDoctors(targetScoreMap)).filter(([, v]) => v != null && v > 0),
      );

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/optimize/diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          year,
          month,
          num_doctors: activeCount,
          holidays: validHolidays,
          unavailable: formattedUnavailable,
          fixed_unavailable_weekdays: formattedFixedWeekdays,
          prev_month_last_day: prevMonthLastDay,
          prev_month_worked_days: {},
          previous_month_shifts: formattedPreviousMonthShifts,
          score_min: scoreMin,
          score_max: scoreMax,
          min_score_by_doctor: formattedMinScore,
          max_score_by_doctor: formattedMaxScore,
          target_score_by_doctor: formattedTargetScore,
          past_sat_counts: new Array(activeCount).fill(0),
          past_sunhol_counts: new Array(activeCount).fill(0),
          past_total_scores: {},
          objective_weights: Object.fromEntries(
            Object.entries(objectiveWeights).filter(([, v]) => v != null)
          ),
          hard_constraints: formattedHardConstraints,
          locked_shifts: lockedShifts,
        }),
      });

      const data: DiagnoseResponse = await res.json().catch(() => ({ success: false, phase_completed: 0 }));

      if (!res.ok) {
        throw new Error("診断に失敗しました");
      }

      if (data.result) {
        setDiagnoseResult(data.result);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "診断に失敗しました");
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleSaveToDB = async () => {
    setSaveMessage("");
    setError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      // 既存データの確認（2-1 + 2-2）— 全スロットnullなら未作成扱い
      const checkRes = await fetch(`${apiUrl}/api/schedule/${year}/${month}`, { headers: getAuthHeaders() });
      if (checkRes.ok) {
        const existing: unknown = await checkRes.json();
        if (Array.isArray(existing) && existing.some((row: Record<string, unknown>) => row.day_shift != null || row.night_shift != null)) {
          const confirmed = window.confirm(
            `${year}年${month}月のシフトはすでに登録されています。\n上書きすると過去シフトの記録が変わり、スコア計算にも影響します。\n続行しますか？`
          );
          if (!confirmed) return;
        }
      }

      setIsSaving(true);
      const res = await fetch(`${apiUrl}/api/schedule/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          year,
          month,
          num_doctors: activeDoctors.length,
          schedule: schedule.map((row) => ({
            day: row.day,
            day_shift: row.day_shift,
            night_shift: row.night_shift,
          })),
        }),
      });

      const payload = await readOptionalJson<MessageResponse>(res);

      if (!res.ok) {
        throw new Error(getResponseMessage(payload, "保存に失敗しました"));
      }

      setSaveMessage(getResponseMessage(payload, "保存しました"));
      setTimeout(() => setSaveMessage(""), 3000);
      markScheduleClean(schedule);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    error,
    diagnostics,
    diagnoseResult,
    isDiagnosing,
    isLoading,
    isSaving,
    getUnsavedDoctorNames,
    isDeletingMonthSchedule,
    isBulkSavingDoctors,
    saveMessage,
    saveAllDoctorsSettings,
    handleDeleteMonthSchedule,
    handleGenerate,
    handleDiagnose,
    handleSaveToDB,
    refetchDoctors,
  };
}
