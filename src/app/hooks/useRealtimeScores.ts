import { useMemo } from "react";
import type { Doctor, DoctorScoreEntry, ScheduleRow, ShiftScores } from "../types/dashboard";
import { DEFAULT_SHIFT_SCORES } from "../types/dashboard";

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
  shiftScores: ShiftScores;
  minScoreMap: Record<string, number>;
  maxScoreMap: Record<string, number>;
  targetScoreMap: Record<string, number | null>;
  externalDoctorIds?: Set<string>;
};

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
  shiftScores,
  minScoreMap,
  maxScoreMap,
  targetScoreMap,
  externalDoctorIds,
}: UseRealtimeScoresParams) {
  const liveScores = useMemo(() => {
    const ss = shiftScores ?? DEFAULT_SHIFT_SCORES;
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
        totals[row.day_shift] = (totals[row.day_shift] ?? 0) + (isSundayOrHoliday ? ss.holiday_day : 0);
      }

      if (row.night_shift) {
        // Combined detection: holiday night without a day shift → score as day + night
        const isCombinedHoliday = isSundayOrHoliday && !row.day_shift;
        const nightWeight = isSundayOrHoliday
          ? (isCombinedHoliday ? ss.holiday_day + ss.holiday_night : ss.holiday_night)
          : isSaturday
            ? ss.saturday_night
            : ss.weekday_night;
        totals[row.night_shift] = (totals[row.night_shift] ?? 0) + nightWeight;
      }
    });

    return totals;
  }, [activeDoctors, schedule, year, month, holidaySet, manualHolidaySetInMonth, holidayWorkdayOverrides, shiftScores]);

  const scoreEntries = useMemo<DoctorScoreEntry[]>(() => {
    return activeDoctors.map((doctor) => {
      const score = Number((liveScores[doctor.id] ?? 0).toFixed(1));
      const min = isFiniteNumber(minScoreMap[doctor.id]) ? minScoreMap[doctor.id] : scoreMin;
      const max = isFiniteNumber(maxScoreMap[doctor.id]) ? maxScoreMap[doctor.id] : scoreMax;
      const rawTarget = targetScoreMap[doctor.id];
      const target = rawTarget != null && isFiniteNumber(rawTarget) ? rawTarget : null;
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

  const externalScoreTotal = useMemo(() => {
    if (!externalDoctorIds || externalDoctorIds.size === 0) return 0;
    let total = 0;
    for (const [id, score] of Object.entries(liveScores)) {
      if (externalDoctorIds.has(id)) total += score;
    }
    return Number(total.toFixed(1));
  }, [liveScores, externalDoctorIds]);

  return {
    liveScores,
    scoreEntries,
    externalScoreTotal,
  };
}
