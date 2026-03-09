import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type {
  Doctor,
  HolidayLikeDayInfo,
  LockedShiftPayload,
  ObjectiveWeights,
  ScheduleRow,
} from "../types/dashboard";

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
  unavailableMap: Record<string, number[]>;
  fixedUnavailableWeekdaysMap: Record<string, number[]>;
  prevMonthWorkedDaysMap: Record<string, number[]>;
  minScoreMap: Record<string, number>;
  maxScoreMap: Record<string, number>;
  targetScoreMap: Record<string, number>;
  satPrevMap: Record<string, boolean>;
  schedule: ScheduleRow[];
  setSchedule: (nextSchedule: ScheduleRow[]) => void;
  setScores: Dispatch<SetStateAction<Record<string, number | string>>>;
  setDoctors: Dispatch<SetStateAction<Doctor[]>>;
  setSelectedDoctorId: Dispatch<SetStateAction<string>>;
  setUnavailableMap: Dispatch<SetStateAction<Record<string, number[]>>>;
  setFixedUnavailableWeekdaysMap: Dispatch<SetStateAction<Record<string, number[]>>>;
  setMinScoreMap: Dispatch<SetStateAction<Record<string, number>>>;
  setMaxScoreMap: Dispatch<SetStateAction<Record<string, number>>>;
  setTargetScoreMap: Dispatch<SetStateAction<Record<string, number>>>;
  toYmd: (year: number, month: number, day: number) => string;
  getWeekday: (year: number, month: number, day: number) => string;
  isHolidayLikeDay: (day: number) => HolidayLikeDayInfo;
  filterRecordByActiveDoctors: <T>(input: Record<string, T>) => Record<string, T>;
  buildLockedShiftsPayload: () => LockedShiftPayload[];
  onResetLocks: () => void;
};

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
  unavailableMap,
  fixedUnavailableWeekdaysMap,
  prevMonthWorkedDaysMap,
  minScoreMap,
  maxScoreMap,
  targetScoreMap,
  satPrevMap,
  schedule,
  setSchedule,
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
  onResetLocks,
}: UseScheduleApiParams) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeletingMonthSchedule, setIsDeletingMonthSchedule] = useState<boolean>(false);
  const [isBulkSavingDoctors, setIsBulkSavingDoctors] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const normalizeScheduleRows = (rows: ScheduleRow[]) =>
    rows.map((row) => ({
      ...row,
      day_shift: row.day_shift ?? null,
      night_shift: row.night_shift ?? null,
      is_sunhol: Boolean(row.is_sunhol) || isHolidayLikeDay(row.day).isHolidayLike,
    }));

  const applyUnavailableDaysFromDoctors = (docs: Doctor[]) => {
    const nextUnavailable: Record<string, number[]> = {};
    const nextFixedWeekdays: Record<string, number[]> = {};

    docs.forEach((doc) => {
      const list = doc.unavailable_days ?? [];
      const days: number[] = [];
      const weekdays: number[] = [];

      list.forEach((entry) => {
        if (entry.is_fixed === false) {
          if (entry.date) {
            const day = Number(entry.date.slice(-2));
            if (Number.isFinite(day)) days.push(day);
          }
        } else if (entry.day_of_week !== null && entry.day_of_week !== undefined) {
          weekdays.push(entry.day_of_week);
        }
      });

      if (days.length > 0) nextUnavailable[doc.id] = Array.from(new Set(days)).sort((a, b) => a - b);
      if (weekdays.length > 0) nextFixedWeekdays[doc.id] = Array.from(new Set(weekdays)).sort((a, b) => a - b);
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

  const fetchDoctors = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/doctors/`);

      if (res.ok) {
        const data: Doctor[] = await res.json();
        setDoctors(data);

        const firstActiveDoctor = data.find((doc) => doc.is_active !== false);
        setSelectedDoctorId((prev) => prev || firstActiveDoctor?.id || "");

        applyUnavailableDaysFromDoctors(data);
        applyScoresFromDoctors(data);
      }
    } catch (err) {
      console.error("医師リストの取得に失敗:", err);
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

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const tasks = activeDoctors.map((doc) => {
        const fixedWeekdays = fixedUnavailableWeekdaysMap[doc.id] ?? [];
        const unavailableDays = unavailableMap[doc.id] ?? [];
        const unavailableDates = unavailableDays.map((day) => toYmd(year, month, day));

        const payload = {
          min_score: minScoreMap[doc.id] ?? null,
          max_score: maxScoreMap[doc.id] ?? null,
          target_score: targetScoreMap[doc.id] ?? null,
          fixed_weekdays: fixedWeekdays,
          unavailable_dates: unavailableDates,
        };

        return fetch(`${apiUrl}/api/doctors/${doc.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const message = errData.detail || `医師設定の保存に失敗: ${doc.name}`;
            throw new Error(message);
          }
          return res.json().catch(() => doc);
        });
      });

      await Promise.all(tasks);

      alert("✅ 全員の休み希望（スコア含む）を保存しました。");
      await fetchDoctors();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "全員の保存に失敗しました";
      setError(message);
      alert(`❌ 保存に失敗しました：${message}`);
    } finally {
      setIsBulkSavingDoctors(false);
    }
  };

  const handleDeleteMonthSchedule = async () => {
    if (!confirm(`${year}年${month}月のシフトを全削除します。よろしいですか？`)) return;

    setIsDeletingMonthSchedule(true);
    setError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/schedule/${year}/${month}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "月間シフトの削除に失敗しました");
      }

      setSchedule([]);
      setScores({});
      onResetLocks();
      setSaveMessage("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "月間シフトの削除に失敗しました");
    } finally {
      setIsDeletingMonthSchedule(false);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError("");
    setSaveMessage("");

    try {
      const daysInMonth = new Date(year, month, 0).getDate();
      const activeCount = activeDoctors.length;

      if (activeCount === 0) {
        throw new Error("アクティブな医師がいないため最適化できません");
      }

      const manual = holidays.filter((day) => day >= 1 && day <= daysInMonth);
      const auto = autoHolidayDaysInMonth
        .filter((day) => day >= 1 && day <= daysInMonth)
        .filter((day) => !holidayWorkdayOverrides.has(toYmd(year, month, day)));
      const nonSunday = (day: number) => getWeekday(year, month, day) !== "日";
      const validHolidays = Array.from(new Set([...manual, ...auto].filter(nonSunday))).sort((a, b) => a - b);

      const formattedUnavailable = filterRecordByActiveDoctors(unavailableMap);
      const formattedFixedWeekdays = filterRecordByActiveDoctors(fixedUnavailableWeekdaysMap);
      const formattedPrevMonthWorked = filterRecordByActiveDoctors(prevMonthWorkedDaysMap);
      const formattedMinScore = filterRecordByActiveDoctors(minScoreMap);
      const formattedMaxScore = filterRecordByActiveDoctors(maxScoreMap);
      const formattedTargetScore = filterRecordByActiveDoctors(targetScoreMap);
      const formattedSatPrev = filterRecordByActiveDoctors(satPrevMap);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const lockedShifts = buildLockedShiftsPayload();
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
          prev_month_worked_days: formattedPrevMonthWorked,
          score_min: scoreMin,
          score_max: scoreMax,
          min_score_by_doctor: formattedMinScore,
          max_score_by_doctor: formattedMaxScore,
          target_score_by_doctor: formattedTargetScore,
          sat_prev: formattedSatPrev,
          past_sat_counts: new Array(activeCount).fill(0),
          past_sunhol_counts: new Array(activeCount).fill(0),
          past_total_scores: {},
          objective_weights: objectiveWeights,
          locked_shifts: lockedShifts,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "最適化に失敗しました");
      }

      const data = await res.json();
      setSchedule(normalizeScheduleRows((data.schedule ?? []) as ScheduleRow[]));
      setScores(data.scores);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "最適化に失敗しました");
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
      const res = await fetch(`${apiUrl}/api/schedule/save/`, {
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

      if (!res.ok) throw new Error("保存に失敗しました");

      const data = await res.json();
      setSaveMessage(data.message);
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