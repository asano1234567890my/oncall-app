"use client";

import { useEffect, useMemo, useState } from "react";

export type Holiday = {
  id: number;
  date: string; // "YYYY-MM-DD"
  name: string;
};

export type HolidayMap = Record<string, Holiday>; // key: "YYYY-MM-DD"

// =========================================================
// ✅ 年単位キャッシュ（不要な再フェッチ防止）
//  - module-scopeなので、同一タブ内で再利用される
//  - 同年への複数呼び出しも in-flight 共有で二重fetchを防ぐ
// =========================================================
const holidayCacheByYear = new Map<number, HolidayMap>();
const inflightByYear = new Map<number, Promise<HolidayMap>>();

async function fetchHolidayMapByYear(year: number): Promise<HolidayMap> {
  const cached = holidayCacheByYear.get(year);
  if (cached) return cached;

  const inflight = inflightByYear.get(year);
  if (inflight) return inflight;

  const task = (async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${apiUrl}/api/holidays/?year=${year}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`祝日取得に失敗しました（year=${year}）`);
    }

    const list: Holiday[] = await res.json();

    const map: HolidayMap = {};
    for (const h of list) {
      // dateは "YYYY-MM-DD" で確定
      map[h.date] = h;
    }

    holidayCacheByYear.set(year, map);
    return map;
  })();

  inflightByYear.set(year, task);

  try {
    return await task;
  } finally {
    inflightByYear.delete(year);
  }
}

export function useHolidays(year: number) {
  const [holidayMap, setHolidayMap] = useState<HolidayMap>({});
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [holidayError, setHolidayError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!Number.isFinite(year) || year <= 0) return;

      // ✅ キャッシュがあれば即反映（体感UX向上）
      const cached = holidayCacheByYear.get(year);
      if (cached) setHolidayMap(cached);

      setIsLoadingHolidays(true);
      setHolidayError("");

      try {
        const map = await fetchHolidayMapByYear(year);
        if (!cancelled) setHolidayMap(map);
      } catch (e: any) {
        if (!cancelled) setHolidayError(e?.message || "祝日取得に失敗しました");
      } finally {
        if (!cancelled) setIsLoadingHolidays(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [year]);

  const holidaySet = useMemo(() => new Set(Object.keys(holidayMap)), [holidayMap]);

  return { holidayMap, holidaySet, isLoadingHolidays, holidayError };
}