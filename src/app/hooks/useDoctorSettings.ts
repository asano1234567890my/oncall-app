// src/app/hooks/useDoctorSettings.ts
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { toast } from "react-hot-toast";
import type { Doctor, FixedUnavailableWeekdayMap, UnavailableDateMap } from "../types/dashboard";
import {
  filterUnavailableDateEntriesByMonth,
  normalizeFixedUnavailableWeekdayEntries,
  normalizeUnavailableDateEntries,
} from "../utils/unavailableSettings";

type MessageResponse = {
  detail?: string;
  message?: string;
};

const readOptionalJson = async <T>(response: Response): Promise<T | null> => {
  const body = await response.text();
  if (!body.trim()) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
};

const getResponseMessage = (payload: MessageResponse | null, fallback: string) =>
  payload?.message || payload?.detail || fallback;

type UseDoctorSettingsParams = {
  activeDoctors: Doctor[];
  unavailableMap: UnavailableDateMap;
  fixedUnavailableWeekdaysMap: FixedUnavailableWeekdayMap;
  minScoreMap: Record<string, number>;
  maxScoreMap: Record<string, number>;
  targetScoreMap: Record<string, number>;
  doctorUnavailableYear: number;
  doctorUnavailableMonth: number;
  setDoctors: Dispatch<SetStateAction<Doctor[]>>;
  setSelectedDoctorId: Dispatch<SetStateAction<string>>;
  setUnavailableMap: Dispatch<SetStateAction<UnavailableDateMap>>;
  setFixedUnavailableWeekdaysMap: Dispatch<SetStateAction<FixedUnavailableWeekdayMap>>;
  setMinScoreMap: Dispatch<SetStateAction<Record<string, number>>>;
  setMaxScoreMap: Dispatch<SetStateAction<Record<string, number>>>;
  setTargetScoreMap: Dispatch<SetStateAction<Record<string, number>>>;
  setIsBulkSavingDoctors: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setSaveMessage: Dispatch<SetStateAction<string>>;
};

export function useDoctorSettings({
  activeDoctors,
  unavailableMap,
  fixedUnavailableWeekdaysMap,
  minScoreMap,
  maxScoreMap,
  targetScoreMap,
  doctorUnavailableYear,
  doctorUnavailableMonth,
  setDoctors,
  setSelectedDoctorId,
  setUnavailableMap,
  setFixedUnavailableWeekdaysMap,
  setMinScoreMap,
  setMaxScoreMap,
  setTargetScoreMap,
  setIsBulkSavingDoctors,
  setError,
  setSaveMessage,
}: UseDoctorSettingsParams) {
  // 医師設定の「最後にAPIから読み込んだ／保存した」状態を保持するref
  const committedUnavailableMapRef = useRef<UnavailableDateMap>({});
  const committedFixedWeekdaysMapRef = useRef<FixedUnavailableWeekdayMap>({});
  const committedMinScoreMapRef = useRef<Record<string, number>>({});
  const committedMaxScoreMapRef = useRef<Record<string, number>>({});
  const committedTargetScoreMapRef = useRef<Record<string, number>>({});

  // 未保存の設定変更がある医師名の一覧を返す
  const getUnsavedDoctorNames = (): string[] => {
    const names: string[] = [];
    const allDoctorIds = new Set([
      ...Object.keys(unavailableMap),
      ...Object.keys(fixedUnavailableWeekdaysMap),
      ...Object.keys(committedUnavailableMapRef.current),
      ...Object.keys(committedFixedWeekdaysMapRef.current),
      ...activeDoctors.map((d) => d.id),
    ]);

    for (const id of allDoctorIds) {
      const currentUnavail = JSON.stringify(unavailableMap[id] ?? []);
      const committedUnavail = JSON.stringify(committedUnavailableMapRef.current[id] ?? []);
      const currentFixed = JSON.stringify(fixedUnavailableWeekdaysMap[id] ?? []);
      const committedFixed = JSON.stringify(committedFixedWeekdaysMapRef.current[id] ?? []);
      const currentMin = minScoreMap[id] ?? null;
      const committedMin = committedMinScoreMapRef.current[id] ?? null;
      const currentMax = maxScoreMap[id] ?? null;
      const committedMax = committedMaxScoreMapRef.current[id] ?? null;
      const currentTarget = targetScoreMap[id] ?? null;
      const committedTarget = committedTargetScoreMapRef.current[id] ?? null;

      if (
        currentUnavail !== committedUnavail ||
        currentFixed !== committedFixed ||
        currentMin !== committedMin ||
        currentMax !== committedMax ||
        currentTarget !== committedTarget
      ) {
        const doctor = activeDoctors.find((d) => d.id === id);
        if (doctor) names.push(doctor.name);
      }
    }
    return names;
  };

  const applyUnavailableDaysFromDoctors = (docs: Doctor[]) => {
    const nextUnavailable: UnavailableDateMap = {};
    const nextFixedWeekdays: FixedUnavailableWeekdayMap = {};

    docs.forEach((doc) => {
      const datesFromResponse = Array.isArray(doc.unavailable_dates)
        ? doc.unavailable_dates.map((date) => ({ date: String(date), target_shift: "all" as const }))
        : [];
      const list = doc.unavailable_days ?? [];
      const datesFromEntries = [] as UnavailableDateMap[string];
      const weekdays = [] as FixedUnavailableWeekdayMap[string];

      list.forEach((entry) => {
        if (entry.is_fixed === false) {
          if (!entry.date) return;
          datesFromEntries.push({
            date: String(entry.date),
            target_shift: entry.target_shift ?? "all",
          });
          return;
        }

        if (entry.day_of_week !== null && entry.day_of_week !== undefined) {
          weekdays.push({
            day_of_week: entry.day_of_week,
            target_shift: entry.target_shift ?? "all",
          });
        }
      });

      const unavailableDates = normalizeUnavailableDateEntries([...datesFromResponse, ...datesFromEntries]);
      const fixedWeekdays = normalizeFixedUnavailableWeekdayEntries([...(doc.fixed_weekdays ?? []), ...weekdays]);

      if (unavailableDates.length > 0) nextUnavailable[doc.id] = unavailableDates;
      if (fixedWeekdays.length > 0) nextFixedWeekdays[doc.id] = fixedWeekdays;
    });

    setUnavailableMap(nextUnavailable);
    setFixedUnavailableWeekdaysMap(nextFixedWeekdays);
    return { nextUnavailable, nextFixedWeekdays };
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
    return { initMin, initMax, initTarget };
  };

  const fetchDoctors = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/doctors/`);

      if (!res.ok) return;

      const data: Doctor[] = await res.json();
      setDoctors(data);

      const firstActiveDoctor = data.find((doc) => doc.is_active !== false);
      setSelectedDoctorId((prev) => prev || firstActiveDoctor?.id || "");

      // fetchした時点を「保存済み」基準として正規化済みの値をそのまま保存
      const { nextUnavailable, nextFixedWeekdays } = applyUnavailableDaysFromDoctors(data);
      committedUnavailableMapRef.current = nextUnavailable;
      committedFixedWeekdaysMapRef.current = nextFixedWeekdays;

      const { initMin, initMax, initTarget } = applyScoresFromDoctors(data);
      committedMinScoreMapRef.current = initMin;
      committedMaxScoreMapRef.current = initMax;
      committedTargetScoreMapRef.current = initTarget;
    } catch (err) {
      console.error("医師リストの取得に失敗しました", err);
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
    setSaveMessage("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const tasks = activeDoctors.map((doc) => {
        const fixedWeekdays = normalizeFixedUnavailableWeekdayEntries(fixedUnavailableWeekdaysMap[doc.id] ?? []);
        const unavailableDays = filterUnavailableDateEntriesByMonth(
          normalizeUnavailableDateEntries(unavailableMap[doc.id] ?? []),
          doctorUnavailableYear,
          doctorUnavailableMonth
        ).map((entry) => ({
          date: entry.date,
          target_shift: entry.target_shift,
        }));

        const payload = {
          min_score: minScoreMap[doc.id] ?? null,
          max_score: maxScoreMap[doc.id] ?? null,
          target_score: targetScoreMap[doc.id] ?? null,
          fixed_weekdays: fixedWeekdays.map((entry) => ({
            day_of_week: entry.day_of_week,
            target_shift: entry.target_shift,
          })),
          unavailable_days: unavailableDays,
          unavailable_year: doctorUnavailableYear,
          unavailable_month: doctorUnavailableMonth,
        };

        return fetch(`${apiUrl}/api/doctors/${doc.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(async (res) => {
          const responsePayload = await readOptionalJson<MessageResponse>(res);

          if (!res.ok) {
            const message = getResponseMessage(responsePayload, `医師設定の保存に失敗しました: ${doc.name}`);
            throw new Error(message);
          }
        });
      });

      await Promise.all(tasks);
      const successMessage = "全員の休み希望・スコア設定を保存しました";
      setSaveMessage(successMessage);
      toast.success(successMessage);
      // fetchDoctors内でcommitted refsも更新される
      await fetchDoctors();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "全員の設定保存に失敗しました";
      setError(message);
      toast.error(message);
    } finally {
      setIsBulkSavingDoctors(false);
    }
  };

  return { getUnsavedDoctorNames, saveAllDoctorsSettings };
}
