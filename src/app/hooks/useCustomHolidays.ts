"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type CustomHolidaysResponse = {
    year: number;
    key: string;
    value: {
      manual_holidays: string[];   // ["YYYY-MM-DD", ...]
      ignored_holidays: string[];  // ["YYYY-MM-DD", ...]  ← 祝日無効化
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

const toSet = (arr: unknown, year: number) => {
  const set = new Set<string>();
  if (!Array.isArray(arr)) return set;
  const prefix = `${year}-`;
  for (const v of arr) {
    const s = String(v);
    if (s.startsWith(prefix)) set.add(s);
  }
  return set;
};

// ⚠️ ここはバックエンド確定仕様に合わせてあります：
// GET /api/settings/custom_holidays?year=YYYY
// -> { year, key, value: { manual_holidays: string[], ignored_holidays: string[] } }
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
      // 未設定の年は空扱いで進められるようにする（404想定）
      if (res.status === 404) {
        const empty = { manualSet: new Set<string>(), disabledSet: new Set<string>() };
        cacheByYear.set(year, empty);
        return empty;
      }
      throw new Error(`custom_holidays取得に失敗しました（year=${year}）`);
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
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.detail || "custom_holidays保存に失敗しました");
    }
  }
/**
 * 年単位で「手動休日」「祝日無効化」をDBと同期する。
 * - GET: 初回/年変更時にロード（年キャッシュ）
 * - POST: 変更があれば自動保存（debounce）
 */
export function useCustomHolidays(year: number) {
  const [manualSet, setManualSet] = useState<Set<string>>(() => new Set());
  const [disabledSet, setDisabledSet] = useState<Set<string>>(() => new Set());
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [customError, setCustomError] = useState<string>("");

  const lastSavedRef = useRef<string>(""); // 変更検知（同一内容のPOSTを抑止）

  // 年ロード
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

        // 初回ロード直後は「保存済み」とみなす
        const sig = JSON.stringify({
          year,
          manual: Array.from(loaded.manualSet).sort(),
          disabled: Array.from(loaded.disabledSet).sort(),
        });
        lastSavedRef.current = sig;
      } catch (e: any) {
        if (!cancelled) setCustomError(e?.message || "custom_holidays取得に失敗しました");
      } finally {
        if (!cancelled) setIsLoadingCustom(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [year]);

  // 変更 → 自動保存（debounce）
  useEffect(() => {
    if (!Number.isFinite(year) || year <= 0) return;

    const sig = JSON.stringify({
      year,
      manual: Array.from(manualSet).sort(),
      disabled: Array.from(disabledSet).sort(),
    });

    // ロード直後 or 変化なしなら何もしない
    if (sig === lastSavedRef.current) return;

    const t = window.setTimeout(() => {
      void (async () => {
        try {
            await saveCustomHolidays({
                year,
                value: {
                  manual_holidays: Array.from(manualSet).sort(),
                  ignored_holidays: Array.from(disabledSet).sort(),
                },
              });

          // 保存成功したらシグネチャ更新
          lastSavedRef.current = sig;

          // キャッシュも更新（同年の再ロード防止）
          cacheByYear.set(year, { manualSet: new Set(manualSet), disabledSet: new Set(disabledSet) });
        } catch (e: any) {
          setCustomError(e?.message || "custom_holidays保存に失敗しました");
        }
      })();
    }, 500);

    return () => window.clearTimeout(t);
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