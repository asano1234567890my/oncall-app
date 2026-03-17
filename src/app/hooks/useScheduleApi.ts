import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "react-hot-toast";
import type {
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
  filterUnavailableDateEntriesByMonth,
  normalizeFixedUnavailableWeekdayEntries,
  normalizeUnavailableDateEntries,
} from "../utils/unavailableSettings";

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
  targetScoreMap: Record<string, number>;
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
  setTargetScoreMap: Dispatch<SetStateAction<Record<string, number>>>;
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

  const applyUnavailableDaysFromDoctors = (docs: Doctor[]) => {
    const nextUnavailable: UnavailableDateMap = {};
    const nextFixedWeekdays: FixedUnavailableWeekdayMap = {};

    docs.forEach((doc) => {
      const datesFromResponse = Array.isArray(doc.unavailable_dates)
        ? doc.unavailable_dates.map((date) => ({ date: String(date), target_shift: "all" as const }))
        : [];
      const list = doc.unavailable_days ?? [];
      const datesFromEntries = [] as UnavailableDateMap[string];
      const weekdays = [] as FixedUnavailableWeekdayMap[string];

      list.forEach((entry) => {
        if (entry.is_fixed === false) {
          if (!entry.date) return;
          datesFromEntries.push({
            date: String(entry.date),
            target_shift: entry.target_shift ?? "all",
          });
          return;
        }

        if (entry.day_of_week !== null && entry.day_of_week !== undefined) {
          weekdays.push({
            day_of_week: entry.day_of_week,
            target_shift: entry.target_shift ?? "all",
          });
        }
      });

      const unavailableDates = normalizeUnavailableDateEntries([...datesFromResponse, ...datesFromEntries]);
      const fixedWeekdays = normalizeFixedUnavailableWeekdayEntries([...(doc.fixed_weekdays ?? []), ...weekdays]);

      if (unavailableDates.length > 0) nextUnavailable[doc.id] = unavailableDates;
      if (fixedWeekdays.length > 0) nextFixedWeekdays[doc.id] = fixedWeekdays;
    });

    setUnavailableMap(nextUnavailable);
    setFixedUnavailableWeekdaysMap(nextFixedWeekdays);
  };

  const applyScoresFromDoctors = (docs: Doctor[]) => {
    const initMin: Record<string, number> = {};
    const initMax: Record<string, number> = {};
    const initTarget: Record<string, number> = {};

    docs.forEach((doc) => {
      if (doc.min_score !== null && doc.min_score !== undefined) initMin[doc.id] = doc.min_score;
      if (doc.max_score !== null && doc.max_score !== undefined) initMax[doc.id] = doc.max_score;
      if (doc.target_score !== null && doc.target_score !== undefined) initTarget[doc.id] = doc.target_score;
    });

    setMinScoreMap(initMin);
    setMaxScoreMap(initMax);
    setTargetScoreMap(initTarget);
  };

  const formatHardConstraintsForOptimize = () => ({
    interval_days: sanitizeConstraintValue(hardConstraints.interval_days),
    max_weekend_holiday_works: sanitizeConstraintValue(hardConstraints.max_weekend_holiday_works),
    max_saturday_nights: sanitizeConstraintValue(hardConstraints.max_saturday_nights),
    max_sunhol_days: sanitizeConstraintValue(hardConstraints.max_sunhol_days),
    max_sunhol_works: sanitizeConstraintValue(hardConstraints.max_sunhol_works),
    prevent_sunhol_consecutive: Boolean(hardConstraints.prevent_sunhol_consecutive),
    respect_unavailable_days: Boolean(hardConstraints.respect_unavailable_days),
  });

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

  const fetchDoctors = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/doctors/`);

      if (!res.ok) return;

      const data: Doctor[] = await res.json();
      setDoctors(data);

      const firstActiveDoctor = data.find((doc) => doc.is_active !== false);
      setSelectedDoctorId((prev) => prev || firstActiveDoctor?.id || "");

      applyUnavailableDaysFromDoctors(data);
      applyScoresFromDoctors(data);
    } catch (err) {
      console.error("医師リストの取得に失敗しました", err);
    }
  };

  useEffect(() => {
    void fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAllDoctorsSettings = async () => {
    if (activeDoctors.length === 0) return;

    setIsBulkSavingDoctors(true);
    setError("");
    setSaveMessage("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const tasks = activeDoctors.map((doc) => {
        const fixedWeekdays = normalizeFixedUnavailableWeekdayEntries(fixedUnavailableWeekdaysMap[doc.id] ?? []);
        const unavailableDays = filterUnavailableDateEntriesByMonth(
          normalizeUnavailableDateEntries(unavailableMap[doc.id] ?? []),
          doctorUnavailableYear,
          doctorUnavailableMonth
        ).map((entry) => ({
          date: entry.date,
          target_shift: entry.target_shift,
        }));

        const payload = {
          min_score: minScoreMap[doc.id] ?? null,
          max_score: maxScoreMap[doc.id] ?? null,
          target_score: targetScoreMap[doc.id] ?? null,
          fixed_weekdays: fixedWeekdays.map((entry) => ({
            day_of_week: entry.day_of_week,
            target_shift: entry.target_shift,
          })),
          unavailable_days: unavailableDays,
          unavailable_year: doctorUnavailableYear,
          unavailable_month: doctorUnavailableMonth,
        };

        return fetch(`${apiUrl}/api/doctors/${doc.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(async (res) => {
          const payload = await readOptionalJson<MessageResponse>(res);

          if (!res.ok) {
            const message = getResponseMessage(payload, `医師設定の保存に失敗しました: ${doc.name}`);
            throw new Error(message);
          }
        });
      });

      await Promise.all(tasks);
      const successMessage = "全員の休み希望・スコア設定を保存しました";
      setSaveMessage(successMessage);
      toast.success(successMessage);
      await fetchDoctors();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "全員の設定保存に失敗しました";
      setError(message);
      toast.error(message);
    } finally {
      setIsBulkSavingDoctors(false);
    }
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
    setSaveMessage("");

    try {
      const daysInMonth = new Date(year, month, 0).getDate();
      const activeCount = activeDoctors.length;

      if (activeCount === 0) {
        throw new Error("有効な医師がいないため、自動生成できません");
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
      const formattedTargetScore = filterRecordByActiveDoctors(targetScoreMap);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/optimize/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          objective_weights: objectiveWeights,
          hard_constraints: formattedHardConstraints,
          locked_shifts: lockedShifts,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "自動生成に失敗しました");
      }

      const data = await res.json();
      const nextSchedule = normalizeScheduleRows((data.schedule ?? []) as ScheduleRow[]);
      commitScheduleFrom(scheduleBeforeGenerate, nextSchedule);
      setScores(data.scores ?? {});
    } catch (err: unknown) {
      setSchedule(scheduleBeforeGenerate);
      setError(err instanceof Error ? err.message : "自動生成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToDB = async () => {
    setIsSaving(true);
    setSaveMessage("");
    setError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/schedule/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      markScheduleClean(schedule);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    error,
    isLoading,
    isSaving,
    isDeletingMonthSchedule,
    isBulkSavingDoctors,
    saveMessage,
    saveAllDoctorsSettings,
    handleDeleteMonthSchedule,
    handleGenerate,
    handleSaveToDB,
  };
}
