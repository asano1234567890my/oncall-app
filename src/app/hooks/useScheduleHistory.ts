import { useCallback, useState, type SetStateAction } from "react";
import type { ScheduleRow } from "../types/dashboard";

type UseScheduleHistoryParams = {
  initialSchedule?: ScheduleRow[];
  limit?: number;
};

const cloneSchedule = (rows: ScheduleRow[]) => rows.map((row) => ({ ...row }));
const resolveNextSchedule = (next: SetStateAction<ScheduleRow[]>, prev: ScheduleRow[]) =>
  typeof next === "function" ? next(cloneSchedule(prev)) : next;
const areSchedulesEqual = (left: ScheduleRow[], right: ScheduleRow[]) => JSON.stringify(left) === JSON.stringify(right);

export function useScheduleHistory({ initialSchedule = [], limit = 15 }: UseScheduleHistoryParams = {}) {
  const [schedule, setScheduleState] = useState<ScheduleRow[]>(() => cloneSchedule(initialSchedule));
  const [pastSchedules, setPastSchedules] = useState<ScheduleRow[][]>([]);
  const [futureSchedules, setFutureSchedules] = useState<ScheduleRow[][]>([]);

  const setSchedule = useCallback((next: SetStateAction<ScheduleRow[]>) => {
    setScheduleState((prev) => cloneSchedule(resolveNextSchedule(next, prev)));
  }, []);

  const commitSchedule = useCallback(
    (nextSchedule: ScheduleRow[]) => {
      const clonedNext = cloneSchedule(nextSchedule);
      if (areSchedulesEqual(schedule, clonedNext)) return;

      setPastSchedules((prev) => [...prev.slice(-(limit - 1)), cloneSchedule(schedule)]);
      setFutureSchedules([]);
      setScheduleState(clonedNext);
    },
    [limit, schedule]
  );

  const resetSchedule = useCallback((nextSchedule: ScheduleRow[] = []) => {
    setPastSchedules([]);
    setFutureSchedules([]);
    setScheduleState(cloneSchedule(nextSchedule));
  }, []);

  const clearHistory = useCallback(() => {
    setPastSchedules([]);
    setFutureSchedules([]);
  }, []);

  const undo = useCallback(() => {
    if (pastSchedules.length === 0) return;

    const previous = pastSchedules[pastSchedules.length - 1];
    setPastSchedules((prev) => prev.slice(0, -1));
    setFutureSchedules((prev) => [cloneSchedule(schedule), ...prev].slice(0, limit));
    setScheduleState(cloneSchedule(previous));
  }, [limit, pastSchedules, schedule]);

  const redo = useCallback(() => {
    if (futureSchedules.length === 0) return;

    const [next, ...rest] = futureSchedules;
    setFutureSchedules(rest);
    setPastSchedules((prev) => [...prev.slice(-(limit - 1)), cloneSchedule(schedule)]);
    setScheduleState(cloneSchedule(next));
  }, [futureSchedules, limit, schedule]);

  return {
    schedule,
    setSchedule,
    commitSchedule,
    resetSchedule,
    clearHistory,
    undo,
    redo,
    canUndo: pastSchedules.length > 0,
    canRedo: futureSchedules.length > 0,
  };
}
