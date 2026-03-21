import { useCallback, useRef, useState } from "react";
import type { SetStateAction } from "react";
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

/** 2つのスケジュール間で変更されたセルのキー（"day_day" / "day_night"）を返す */
const computeChangedKeys = (prev: ScheduleRow[], next: ScheduleRow[]): Set<string> => {
  const keys = new Set<string>();
  const prevMap = new Map(prev.map((r) => [r.day, r]));
  const nextMap = new Map(next.map((r) => [r.day, r]));
  const allDays = new Set([...prevMap.keys(), ...nextMap.keys()]);
  for (const day of allDays) {
    const p = prevMap.get(day);
    const n = nextMap.get(day);
    if ((p?.day_shift ?? null) !== (n?.day_shift ?? null)) keys.add(`${day}_day`);
    if ((p?.night_shift ?? null) !== (n?.night_shift ?? null)) keys.add(`${day}_night`);
  }
  return keys;
};

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
  const [changedShiftKeys, setChangedShiftKeys] = useState<Set<string>>(new Set());
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashChanges = useCallback((prev: ScheduleRow[], next: ScheduleRow[]) => {
    const keys = computeChangedKeys(prev, next);
    if (keys.size === 0) return;
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setChangedShiftKeys(keys);
    highlightTimerRef.current = setTimeout(() => setChangedShiftKeys(new Set()), 1500);
  }, []);

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

        flashChanges(current, clonedNext);
        const history = [...prev.history.slice(0, prev.currentIndex + 1), clonedNext];
        return trimCommittedHistory(history, limit);
      });
    },
    [limit, flashChanges]
  );

  const commitScheduleFrom = useCallback((baseSchedule: ScheduleRow[], nextSchedule: ScheduleRow[]) => {
    setState((prev) => {
      const clonedBase = cloneSchedule(baseSchedule);
      const clonedNext = cloneSchedule(nextSchedule);

      // currentIndex までの履歴を保持し、現在のスナップショットを base で置き換え
      // （setSchedule で中間状態に書き換わっている場合があるため）
      const kept = prev.history.slice(0, prev.currentIndex);
      const history = [...kept, clonedBase, clonedNext];
      return trimCommittedHistory(history, limit);
    });
  }, [limit]);

  const resetSchedule = useCallback((nextSchedule: ScheduleRow[] = []) => {
    setState(createHistoryState(nextSchedule));
  }, []);

  const clearHistory = useCallback(() => {
    setState((prev) => createHistoryState(getCurrentSchedule(prev)));
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex === 0) return prev;
      const current = prev.history[prev.currentIndex] ?? [];
      const target = prev.history[prev.currentIndex - 1] ?? [];
      flashChanges(current, target);
      return { history: prev.history, currentIndex: prev.currentIndex - 1 };
    });
  }, [flashChanges]);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex >= prev.history.length - 1) return prev;
      const current = prev.history[prev.currentIndex] ?? [];
      const target = prev.history[prev.currentIndex + 1] ?? [];
      flashChanges(current, target);
      return { history: prev.history, currentIndex: prev.currentIndex + 1 };
    });
  }, [flashChanges]);

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
    changedShiftKeys,
  };
}
