import { useCallback, useState, type SetStateAction } from "react";
import type { ScheduleRow } from "../types/dashboard";

type UseScheduleHistoryParams = {
  initialSchedule?: ScheduleRow[];
  limit?: number;
};

type HistoryState = {
  history: ScheduleRow[][];
  currentIndex: number;
};

const cloneSchedule = (rows: ScheduleRow[]) => rows.map((row) => ({ ...row }));
const resolveNextSchedule = (next: SetStateAction<ScheduleRow[]>, prev: ScheduleRow[]) =>
  typeof next === "function" ? next(cloneSchedule(prev)) : next;
const areSchedulesEqual = (left: ScheduleRow[], right: ScheduleRow[]) => JSON.stringify(left) === JSON.stringify(right);

const createHistoryState = (schedule: ScheduleRow[] = []): HistoryState => ({
  history: [cloneSchedule(schedule)],
  currentIndex: 0,
});

const getCurrentSchedule = (state: HistoryState) => state.history[state.currentIndex] ?? [];

const trimCommittedHistory = (history: ScheduleRow[][], limit: number): HistoryState => {
  const maxSnapshots = Math.max(limit, 2);

  if (history.length <= maxSnapshots) {
    return {
      history,
      currentIndex: history.length - 1,
    };
  }

  const baseline = history[0];
  const tail = history.slice(-(maxSnapshots - 1));

  return {
    history: [baseline, ...tail],
    currentIndex: maxSnapshots - 1,
  };
};

export function useScheduleHistory({ initialSchedule = [], limit = 15 }: UseScheduleHistoryParams = {}) {
  const [state, setState] = useState<HistoryState>(() => createHistoryState(initialSchedule));

  const setSchedule = useCallback((next: SetStateAction<ScheduleRow[]>) => {
    setState((prev) => {
      const current = getCurrentSchedule(prev);
      const resolved = cloneSchedule(resolveNextSchedule(next, current));

      if (areSchedulesEqual(current, resolved)) {
        return prev;
      }

      const history = prev.history.map((snapshot, index) => (index === prev.currentIndex ? resolved : snapshot));
      return {
        history,
        currentIndex: prev.currentIndex,
      };
    });
  }, []);

  const commitSchedule = useCallback(
    (nextSchedule: ScheduleRow[]) => {
      setState((prev) => {
        const current = getCurrentSchedule(prev);
        const clonedNext = cloneSchedule(nextSchedule);

        if (areSchedulesEqual(current, clonedNext)) {
          return prev;
        }

        const history = [...prev.history.slice(0, prev.currentIndex + 1), clonedNext];
        return trimCommittedHistory(history, limit);
      });
    },
    [limit]
  );

  const commitScheduleFrom = useCallback((_: ScheduleRow[], nextSchedule: ScheduleRow[]) => {
    setState(createHistoryState(nextSchedule));
  }, []);

  const resetSchedule = useCallback((nextSchedule: ScheduleRow[] = []) => {
    setState(createHistoryState(nextSchedule));
  }, []);

  const clearHistory = useCallback(() => {
    setState((prev) => createHistoryState(getCurrentSchedule(prev)));
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex === 0) {
        return prev;
      }

      return {
        history: prev.history,
        currentIndex: prev.currentIndex - 1,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex >= prev.history.length - 1) {
        return prev;
      }

      return {
        history: prev.history,
        currentIndex: prev.currentIndex + 1,
      };
    });
  }, []);

  const schedule = getCurrentSchedule(state);

  return {
    schedule,
    setSchedule,
    commitSchedule,
    commitScheduleFrom,
    resetSchedule,
    clearHistory,
    undo,
    redo,
    canUndo: state.currentIndex > 0,
    canRedo: state.currentIndex < state.history.length - 1,
  };
}
