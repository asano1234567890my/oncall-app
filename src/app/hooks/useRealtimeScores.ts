import { useEffect, useMemo, useRef } from "react";
import type { Doctor, DoctorScoreEntry, ScheduleRow } from "../types/dashboard";

type UseRealtimeScoresParams = {
  activeDoctors: Doctor[];
  schedule: ScheduleRow[];
  year: number;
  month: number;
  holidaySet: Set<string>;
  manualHolidaySetInMonth: Set<string>;
  holidayWorkdayOverrides: Set<string>;
  scoreMin: number;
  scoreMax: number;
  minScoreMap: Record<string, number>;
  maxScoreMap: Record<string, number>;
  targetScoreMap: Record<string, number>;
};

const HISTORY_LIMIT = 8;
const SCORE_DAY_WEIGHT = 0.5;
const SCORE_SATURDAY_NIGHT = 1.5;
const SCORE_SUNHOL_NIGHT = 1.0;
const SCORE_WEEKDAY_NIGHT = 1.0;

const cloneSchedule = (rows: ScheduleRow[]) => rows.map((row) => ({ ...row }));
const formatDayKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const isFiniteNumber = (value: number | undefined) => typeof value === "number" && Number.isFinite(value);

export function useRealtimeScores({
  activeDoctors,
  schedule,
  year,
  month,
  holidaySet,
  manualHolidaySetInMonth,
  holidayWorkdayOverrides,
  scoreMin,
  scoreMax,
  minScoreMap,
  maxScoreMap,
  targetScoreMap,
}: UseRealtimeScoresParams) {
  const previousScheduleRef = useRef<ScheduleRow[] | null>(null);
  const historyRef = useRef<ScheduleRow[][]>([]);

  useEffect(() => {
    const nextSnapshot = cloneSchedule(schedule);
    const prevSnapshot = previousScheduleRef.current;

    if (prevSnapshot) {
      const prevKey = JSON.stringify(prevSnapshot);
      const nextKey = JSON.stringify(nextSnapshot);
      if (prevKey !== nextKey) {
        historyRef.current = [...historyRef.current, cloneSchedule(prevSnapshot)].slice(-HISTORY_LIMIT);
      }
    }

    previousScheduleRef.current = nextSnapshot;
  }, [schedule]);

  const liveScores = useMemo(() => {
    const totals: Record<string, number> = {};

    activeDoctors.forEach((doctor) => {
      totals[doctor.id] = 0;
    });

    schedule.forEach((row) => {
      const dayKey = formatDayKey(year, month, row.day);
      const weekday = new Date(year, month - 1, row.day).getDay();
      const isSunday = weekday === 0;
      const isSaturday = weekday === 6;
      const isHoliday = holidaySet.has(dayKey) && !holidayWorkdayOverrides.has(dayKey);
      const isManualHoliday = manualHolidaySetInMonth.has(dayKey);
      const isSundayOrHoliday = isSunday || isHoliday || isManualHoliday;

      if (row.day_shift) {
        totals[row.day_shift] = (totals[row.day_shift] ?? 0) + (isSundayOrHoliday ? SCORE_DAY_WEIGHT : 0);
      }

      if (row.night_shift) {
        const nightWeight = isSundayOrHoliday
          ? SCORE_SUNHOL_NIGHT
          : isSaturday
            ? SCORE_SATURDAY_NIGHT
            : SCORE_WEEKDAY_NIGHT;
        totals[row.night_shift] = (totals[row.night_shift] ?? 0) + nightWeight;
      }
    });

    return totals;
  }, [activeDoctors, schedule, year, month, holidaySet, manualHolidaySetInMonth, holidayWorkdayOverrides]);

  const scoreEntries = useMemo<DoctorScoreEntry[]>(() => {
    return activeDoctors.map((doctor) => {
      const score = Number((liveScores[doctor.id] ?? 0).toFixed(1));
      const min = isFiniteNumber(minScoreMap[doctor.id]) ? minScoreMap[doctor.id] : scoreMin;
      const max = isFiniteNumber(maxScoreMap[doctor.id]) ? maxScoreMap[doctor.id] : scoreMax;
      const target = isFiniteNumber(targetScoreMap[doctor.id]) ? targetScoreMap[doctor.id] : null;
      const targetGap = target === null ? null : Math.abs(score - target);

      let tone: DoctorScoreEntry["tone"] = "default";
      if (score < min || score > max) {
        tone = "danger";
      } else if (targetGap !== null && targetGap >= 1.5) {
        tone = "warn";
      } else if (targetGap !== null && targetGap <= 0.5) {
        tone = "good";
      }

      return {
        doctorId: doctor.id,
        score,
        min,
        max,
        target,
        tone,
      };
    });
  }, [activeDoctors, liveScores, minScoreMap, maxScoreMap, targetScoreMap, scoreMin, scoreMax]);

  return {
    liveScores,
    scoreEntries,
  };
}
