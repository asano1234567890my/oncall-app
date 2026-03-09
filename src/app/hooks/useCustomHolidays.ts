"use client";

import { useEffect, useRef, useState } from "react";

export type CustomHolidaysResponse = {
  year: number;
  key: string;
  value: {
    manual_holidays: string[];
    ignored_holidays: string[];
  };
};

export type CustomHolidaysPostBody = {
  year: number;
  value: {
    manual_holidays: string[];
    ignored_holidays: string[];
  };
};

type LoadState = {
  manualSet: Set<string>;
  disabledSet: Set<string>;
};

const cacheByYear = new Map<number, LoadState>();
const inflightByYear = new Map<number, Promise<LoadState>>();

const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const toSet = (arr: unknown, year: number) => {
  const set = new Set<string>();
  if (!Array.isArray(arr)) return set;

  const prefix = `${year}-`;
  for (const value of arr) {
    const date = String(value);
    if (date.startsWith(prefix)) set.add(date);
  }
  return set;
};

async function fetchCustomHolidays(year: number): Promise<LoadState> {
  const cached = cacheByYear.get(year);
  if (cached) return cached;

  const inflight = inflightByYear.get(year);
  if (inflight) return inflight;

  const task = (async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${apiUrl}/api/settings/custom_holidays?year=${year}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      if (res.status === 404) {
        const empty = { manualSet: new Set<string>(), disabledSet: new Set<string>() };
        cacheByYear.set(year, empty);
        return empty;
      }
      throw new Error(`custom_holidays取得に失敗しました (year=${year})`);
    }

    const data = (await res.json()) as Partial<CustomHolidaysResponse>;
    const manualSet = toSet(data.value?.manual_holidays, year);
    const disabledSet = toSet(data.value?.ignored_holidays, year);
    const next = { manualSet, disabledSet };

    cacheByYear.set(year, next);
    return next;
  })();

  inflightByYear.set(year, task);

  try {
    return await task;
  } finally {
    inflightByYear.delete(year);
  }
}

async function saveCustomHolidays(body: CustomHolidaysPostBody): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  const res = await fetch(`${apiUrl}/api/settings/custom_holidays`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || "custom_holidays保存に失敗しました");
  }
}

export function useCustomHolidays(year: number) {
  const [manualSet, setManualSet] = useState<Set<string>>(() => new Set());
  const [disabledSet, setDisabledSet] = useState<Set<string>>(() => new Set());
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [customError, setCustomError] = useState<string>("");
  const lastSavedRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!Number.isFinite(year) || year <= 0) return;
      setIsLoadingCustom(true);
      setCustomError("");

      try {
        const loaded = await fetchCustomHolidays(year);
        if (cancelled) return;

        setManualSet(new Set(loaded.manualSet));
        setDisabledSet(new Set(loaded.disabledSet));

        const signature = JSON.stringify({
          year,
          manual: Array.from(loaded.manualSet).sort(),
          disabled: Array.from(loaded.disabledSet).sort(),
        });
        lastSavedRef.current = signature;
      } catch (error: unknown) {
        if (!cancelled) setCustomError(getErrorMessage(error, "custom_holidays取得に失敗しました"));
      } finally {
        if (!cancelled) setIsLoadingCustom(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [year]);

  useEffect(() => {
    if (!Number.isFinite(year) || year <= 0) return;

    const signature = JSON.stringify({
      year,
      manual: Array.from(manualSet).sort(),
      disabled: Array.from(disabledSet).sort(),
    });

    if (signature === lastSavedRef.current) return;

    const timerId = window.setTimeout(() => {
      void (async () => {
        try {
          await saveCustomHolidays({
            year,
            value: {
              manual_holidays: Array.from(manualSet).sort(),
              ignored_holidays: Array.from(disabledSet).sort(),
            },
          });

          lastSavedRef.current = signature;
          cacheByYear.set(year, { manualSet: new Set(manualSet), disabledSet: new Set(disabledSet) });
        } catch (error: unknown) {
          setCustomError(getErrorMessage(error, "custom_holidays保存に失敗しました"));
        }
      })();
    }, 500);

    return () => window.clearTimeout(timerId);
  }, [year, manualSet, disabledSet]);

  return {
    manualSet,
    setManualSet,
    disabledSet,
    setDisabledSet,
    isLoadingCustom,
    customError,
  };
}