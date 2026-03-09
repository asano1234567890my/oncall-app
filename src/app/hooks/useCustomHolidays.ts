"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  manual_holidays: string[];
  ignored_holidays: string[];
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

const buildSignature = (year: number, manualSet: Set<string>, disabledSet: Set<string>) =>
  JSON.stringify({
    year,
    manual: Array.from(manualSet).sort(),
    disabled: Array.from(disabledSet).sort(),
  });

const buildRequestBody = (year: number, manualSet: Set<string>, disabledSet: Set<string>): CustomHolidaysPostBody => ({
  year,
  manual_holidays: Array.from(manualSet).sort(),
  ignored_holidays: Array.from(disabledSet).sort(),
});

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
      throw new Error(`祝日設定の取得に失敗しました (year=${year})`);
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

async function persistCustomHolidays(body: CustomHolidaysPostBody): Promise<CustomHolidaysResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  const res = await fetch(`${apiUrl}/api/settings/custom_holidays`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || "祝日設定の保存に失敗しました");
  }

  return (await res.json()) as CustomHolidaysResponse;
}

export function useCustomHolidays(year: number) {
  const [manualSet, setManualSet] = useState<Set<string>>(() => new Set());
  const [disabledSet, setDisabledSet] = useState<Set<string>>(() => new Set());
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [customError, setCustomError] = useState<string>("");
  const [customSaveMessage, setCustomSaveMessage] = useState<string>("");
  const lastSavedRef = useRef<string>("");

  const currentSignature = useMemo(() => buildSignature(year, manualSet, disabledSet), [year, manualSet, disabledSet]);
  const hasUnsavedCustomChanges = currentSignature !== lastSavedRef.current;

  useEffect(() => {
    if (!hasUnsavedCustomChanges) return;
    setCustomSaveMessage("");
  }, [hasUnsavedCustomChanges]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!Number.isFinite(year) || year <= 0) return;
      setIsLoadingCustom(true);
      setCustomError("");
      setCustomSaveMessage("");

      try {
        const loaded = await fetchCustomHolidays(year);
        if (cancelled) return;

        const nextManualSet = new Set(loaded.manualSet);
        const nextDisabledSet = new Set(loaded.disabledSet);

        setManualSet(nextManualSet);
        setDisabledSet(nextDisabledSet);
        lastSavedRef.current = buildSignature(year, nextManualSet, nextDisabledSet);
      } catch (error: unknown) {
        if (cancelled) return;
        setManualSet(new Set());
        setDisabledSet(new Set());
        lastSavedRef.current = buildSignature(year, new Set<string>(), new Set<string>());
        setCustomError(getErrorMessage(error, "祝日設定の取得に失敗しました"));
      } finally {
        if (!cancelled) setIsLoadingCustom(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [year]);

  const saveCustomHolidays = async () => {
    if (!Number.isFinite(year) || year <= 0) return;
    if (!hasUnsavedCustomChanges) return;

    setIsSavingCustom(true);
    setCustomError("");
    setCustomSaveMessage("");

    try {
      const saved = await persistCustomHolidays(buildRequestBody(year, manualSet, disabledSet));
      const nextManualSet = toSet(saved.value?.manual_holidays, year);
      const nextDisabledSet = toSet(saved.value?.ignored_holidays, year);

      setManualSet(new Set(nextManualSet));
      setDisabledSet(new Set(nextDisabledSet));
      cacheByYear.set(year, {
        manualSet: new Set(nextManualSet),
        disabledSet: new Set(nextDisabledSet),
      });
      lastSavedRef.current = buildSignature(year, nextManualSet, nextDisabledSet);
      setCustomSaveMessage("祝日設定を保存しました");
    } catch (error: unknown) {
      setCustomError(getErrorMessage(error, "祝日設定の保存に失敗しました"));
    } finally {
      setIsSavingCustom(false);
    }
  };

  return {
    manualSet,
    setManualSet,
    disabledSet,
    setDisabledSet,
    isLoadingCustom,
    isSavingCustom,
    customError,
    customSaveMessage,
    hasUnsavedCustomChanges,
    saveCustomHolidays,
  };
}
