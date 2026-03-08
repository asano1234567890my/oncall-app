// src/app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, Unlock } from "lucide-react";
import { getDefaultTargetMonth } from "./utils/dateUtils";
import { useHolidays } from "./hooks/useHolidays";
import { useCustomHolidays } from "./hooks/useCustomHolidays";

type Doctor = {
  id: string;
  name: string;
  is_active?: boolean;

  // スコア（DB: float | null）
  min_score?: number | null;
  max_score?: number | null;
  target_score?: number | null;

  // ✅ DBの不可日（固定/単発）: unavailable_days
  unavailable_days?: {
    date: string | null; // "YYYY-MM-DD" or null
    day_of_week: number | null; // 0-6 or null
    is_fixed: boolean;
  }[];
};

type ObjectiveWeights = {
  // 既存互換用
  month_fairness: number;
  past_sat_gap: number;
  past_sunhol_gap: number;

  // 統合版
  gap5: number;
  pre_clinic: number;
  sat_consec: number;
  sunhol_3rd: number;
  gap6: number;
  score_balance: number;
  target: number;
};

const DEFAULT_OBJECTIVE_WEIGHTS: ObjectiveWeights = {
  month_fairness: 100,
  past_sat_gap: 10,
  past_sunhol_gap: 5,

  gap5: 100,
  pre_clinic: 100,
  sat_consec: 80,
  sunhol_3rd: 80,
  gap6: 50,
  score_balance: 30,
  target: 10,
};

export default function DashboardPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);

  const [numDoctors, setNumDoctors] = useState<number>(0);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // 手動休日（臨時休）: 当月の「日番号」だけ（表示/UI用）
  const [holidays, setHolidays] = useState<number[]>([]);

  // 祝日無効化（祝日→平日扱い）: "YYYY-MM-DD"（年単位）
  const [holidayWorkdayOverrides, setHolidayWorkdayOverrides] = useState<Set<string>>(() => new Set());

  // 仕様の主要条件（表示＋API送信に使う）
  const [scoreMin, setScoreMin] = useState<number>(0.5);
  const [scoreMax, setScoreMax] = useState<number>(4.5);

  // ✅ objectiveWeights を State 化
  const [objectiveWeights, setObjectiveWeights] = useState<ObjectiveWeights>(DEFAULT_OBJECTIVE_WEIGHTS);

  const setWeight = (key: keyof ObjectiveWeights, value: number) => {
    const v = Number.isFinite(value) ? Math.round(value) : 0;
    setObjectiveWeights((prev) => ({ ...prev, [key]: v }));
  };

  // シフト結果・状態管理
  const [schedule, setSchedule] = useState<any[]>([]);
  const [scores, setScores] = useState<any>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false); // ※シフト保存用
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [isDeletingMonthSchedule, setIsDeletingMonthSchedule] = useState<boolean>(false);

  const [lockedShiftKeys, setLockedShiftKeys] = useState<Set<string>>(() => new Set());
  const [dragSourceKey, setDragSourceKey] = useState<string | null>(null);

  // ✅ 要件①：全員一括保存用 state
  const [isBulkSavingDoctors, setIsBulkSavingDoctors] = useState<boolean>(false);

  // ✅ 重みスライダーの表示/非表示（UIのみ）
  const [isWeightsOpen, setIsWeightsOpen] = useState(false);

  // =========================================================
  // ✅ UUIDネイティブ化：選択医師は index ではなく doctor.id を保持
  // =========================================================
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");

  // 医師ごとの休み希望管理用（UUIDキー）
  const [unavailableMap, setUnavailableMap] = useState<Record<string, number[]>>({});
  const [fixedUnavailableWeekdaysMap, setFixedUnavailableWeekdaysMap] = useState<Record<string, number[]>>({});

  // ✅ 月跨ぎ4日間隔（前月末勤務）
  const calcPrevMonthLastDay = (y: number, m: number) => new Date(y, m - 1, 0).getDate();
  const [prevMonthLastDay, setPrevMonthLastDay] = useState<number>(() => calcPrevMonthLastDay(year, month));
  const [prevMonthWorkedDaysMap, setPrevMonthWorkedDaysMap] = useState<Record<string, number[]>>({});

  // ✨ 個別スコア・条件設定用 State（UUIDキー）
  const [minScoreMap, setMinScoreMap] = useState<Record<string, number>>({});
  const [maxScoreMap, setMaxScoreMap] = useState<Record<string, number>>({});
  const [targetScoreMap, setTargetScoreMap] = useState<Record<string, number>>({});
  const [satPrevMap, setSatPrevMap] = useState<Record<string, boolean>>({});

  // =========================================================
  // ✅ ヘルパー
  // =========================================================
  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

  const weekdaysJp = ["日", "月", "火", "水", "木", "金", "土"];
  const getWeekday = (y: number, m: number, day: number) => weekdaysJp[new Date(y, m - 1, day).getDay()];

  const pyWeekdaysJp = ["月", "火", "水", "木", "金", "土", "日"];
  const pyWeekdays = [0, 1, 2, 3, 4, 5, 6];

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const toYmd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
  const getShiftKey = (day: number, shiftType: "day" | "night") => `${day}_${shiftType}`;

  // =========================================================
  // ✅ 祝日設定（手動/override）のlocalStorage永続化（ブラウザ内のみ）
  // =========================================================
  const manualHolidayStorageKey = (y: number, m: number) => `oncall.holidays.manual.${y}-${pad2(m)}`;
  const overrideHolidayStorageKey = (y: number) => `oncall.holidays.override.${y}`;

  // 年月が変わったら、その年月の保存データをロードする
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1) 手動（臨時休）: 月単位
    try {
      const raw = window.localStorage.getItem(manualHolidayStorageKey(year, month));
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const next = arr.map((x) => Number(x)).filter((n) => Number.isFinite(n));
          setHolidays(next);
        }
      } else {
        // 保存がない月は空にする（必要なら [29] に戻すなど運用に合わせてOK）
        setHolidays([]);
      }
    } catch {
      // 何もしない
    }

    // 2) override（祝日→平日扱い）: 年単位
    try {
      const raw = window.localStorage.getItem(overrideHolidayStorageKey(year));
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const prefix = `${year}-`;
          setHolidayWorkdayOverrides(new Set(arr.map(String).filter((s) => s.startsWith(prefix))));
        }
      } else {
        setHolidayWorkdayOverrides(new Set());
      }
    } catch {
      // 何もしない
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  // 手動（臨時休）を保存：月単位
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(manualHolidayStorageKey(year, month), JSON.stringify(holidays));
    } catch {
      // 何もしない
    }
  }, [holidays, year, month]);

  // override（祝日→平日扱い）を保存：年単位
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Setは直接保存できないので配列化して保存
      const arr = Array.from(holidayWorkdayOverrides);
      window.localStorage.setItem(overrideHolidayStorageKey(year), JSON.stringify(arr));
    } catch {
      // 何もしない
    }
  }, [holidayWorkdayOverrides, year]);
  
  // =========================================================
  // ✅ 表示専用：doctor UUID -> name（レンダリング高速化）
  // =========================================================
  const doctorNameById = useMemo(() => {
    const map: Record<string, string> = {};
    doctors.forEach((d) => {
      map[d.id] = d.name;
    });
    return map;
  }, [doctors]);

  const getDoctorName = (doctorId: string | null | undefined) => {
    if (!doctorId) return "-";
    return doctorNameById[doctorId] ?? "不明";
  };

  const activeDoctors = useMemo(() => doctors.filter((doc) => doc.is_active !== false), [doctors]);
  const activeDoctorIds = useMemo(() => activeDoctors.map((doc) => doc.id), [activeDoctors]);

  const filterRecordByActiveDoctors = <T,>(input: Record<string, T>) => {
    const next: Record<string, T> = {};
    activeDoctorIds.forEach((id) => {
      if (Object.prototype.hasOwnProperty.call(input, id)) {
        next[id] = input[id];
      }
    });
    return next;
  };

  const isActiveDoctorId = (doctorId: string | null | undefined) => {
    if (!doctorId) return false;
    return activeDoctorIds.includes(doctorId);
  };

  const getScheduleDoctorId = (day: number, shiftType: "day" | "night") => {
    const row = schedule.find((r) => r.day === day);
    if (!row) return null;
    return shiftType === "day" ? row.day_shift ?? null : row.night_shift ?? null;
  };

  const isShiftLocked = (day: number, shiftType: "day" | "night") => lockedShiftKeys.has(getShiftKey(day, shiftType));

    // =========================================================
  // ✅ 祝日（自動取得）: 年単位で取得し、月表示ではSet/Mapを参照
  // =========================================================
    // ✅ 自動祝日（国民の祝日）
    const { holidayMap, holidaySet } = useHolidays(year);

    // ✅ 手動休日＋祝日無効化（DB永続化）
    const {
      manualSet: manualHolidaySetYear,
      setManualSet: setManualHolidaySetYear,
      disabledSet: disabledHolidaySetYear,
      setDisabledSet: setDisabledHolidaySetYear,
      isLoadingCustom,
      customError,
    } = useCustomHolidays(year);
  
    // DBの年データを、画面用Stateへ同期
    useEffect(() => {
      // 祝日無効化（年）
      setHolidayWorkdayOverrides(new Set(disabledHolidaySetYear));
    }, [disabledHolidaySetYear]);
  
    // 当月の手動休日（days）へ同期（年Set → 月days）
    useEffect(() => {
      const mm = pad2(month);
      const prefix = `${year}-${mm}-`;
    
      const nextDays = Array.from(
        new Set(
          Array.from(manualHolidaySetYear)
            .filter((ymd) => ymd.startsWith(prefix))
            .map((ymd) => Number(ymd.slice(-2)))
            .filter((dd) => Number.isFinite(dd))
        )
      ).sort((a, b) => a - b);
    
      // ✅ ここがポイント：同じ配列ならsetしない（無限ループ防止）
      setHolidays((prev) => {
        if (prev.length === nextDays.length && prev.every((v, i) => v === nextDays[i])) {
          return prev;
        }
        return nextDays;
      });
    }, [manualHolidaySetYear, year, month]);

  

  const autoHolidayDaysInMonth = useMemo(() => {
    // この月の祝日（dateのDDだけ抽出）
    const mm = pad2(month);
    const prefix = `${year}-${mm}-`;
    const days: number[] = [];

    for (const ymd of holidaySet) {
      if (!ymd.startsWith(prefix)) continue;
      const dd = Number(ymd.slice(-2));
      if (Number.isFinite(dd)) days.push(dd);
    }

    return Array.from(new Set(days)).sort((a, b) => a - b);
  }, [holidaySet, year, month, pad2]);

  const manualHolidaySetInMonth = useMemo(() => {
    // 既存の holidays: number[]（臨時休）を "YYYY-MM-DD" に変換してSet化
    const s = new Set<string>();
    for (const d of holidays) {
      s.add(toYmd(year, month, d));
    }
    return s;
  }, [holidays, year, month]);

  const isHolidayLikeDay = (day: number) => {
    const ymd = toYmd(year, month, day);
    const wd = getWeekday(year, month, day);
    const isSun = wd === "日";
    const isAutoHoliday = holidaySet.has(ymd);
    const isManualHoliday = manualHolidaySetInMonth.has(ymd);
    return { ymd, wd, isSun, isAutoHoliday, isManualHoliday, isHolidayLike: isSun || isAutoHoliday || isManualHoliday };
  };

  // =========================================================
  // ✅ 重要：DBの unavailable_days をフロントの Map State に復元（UUIDキー）
  // =========================================================
  const applyUnavailableDaysFromDoctors = (docs: Doctor[]) => {
    const nextUnavailable: Record<string, number[]> = {};
    const nextFixedWeekdays: Record<string, number[]> = {};

    docs.forEach((doc) => {
      const list = doc.unavailable_days ?? [];
      const days: number[] = [];
      const weekdays: number[] = [];

      list.forEach((u) => {
        if (u.is_fixed === false) {
          if (u.date) {
            const dd = Number(u.date.slice(-2)); // "YYYY-MM-DD" -> DD
            if (Number.isFinite(dd)) days.push(dd);
          }
        } else {
          if (u.day_of_week !== null && u.day_of_week !== undefined) {
            weekdays.push(u.day_of_week);
          }
        }
      });

      if (days.length > 0) nextUnavailable[doc.id] = Array.from(new Set(days)).sort((a, b) => a - b);
      if (weekdays.length > 0) nextFixedWeekdays[doc.id] = Array.from(new Set(weekdays)).sort((a, b) => a - b);
    });

    setUnavailableMap(nextUnavailable);
    setFixedUnavailableWeekdaysMap(nextFixedWeekdays);
  };

  // =========================================================
  // ✅ 医師データ（スコア）を UUID-map に初期マッピング
  // =========================================================
  const applyScoresFromDoctors = (docs: Doctor[]) => {
    const initMin: Record<string, number> = {};
    const initMax: Record<string, number> = {};
    const initTarget: Record<string, number> = {};

    docs.forEach((doc) => {
      const id = doc.id;
      if (doc.min_score !== null && doc.min_score !== undefined) initMin[id] = doc.min_score;
      if (doc.max_score !== null && doc.max_score !== undefined) initMax[id] = doc.max_score;
      if (doc.target_score !== null && doc.target_score !== undefined) initTarget[id] = doc.target_score;
    });

    setMinScoreMap(initMin);
    setMaxScoreMap(initMax);
    setTargetScoreMap(initTarget);
  };

  // =========================================================
  // ✅ 医師リストの取得（GET）…一括保存でも再利用するため関数化
  // =========================================================
  const fetchDoctors = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/doctors/`);

      if (res.ok) {
        const data: Doctor[] = await res.json();
        setDoctors(data);
        const activeCount = data.filter((doc) => doc.is_active !== false).length;
        setNumDoctors(activeCount);

        // ✅ 初期選択：未選択なら先頭の医師を選ぶ（UUID）
        const firstActiveDoctor = data.find((doc) => doc.is_active !== false);
        setSelectedDoctorId((prev) => prev || firstActiveDoctor?.id || "");

        // ✅ DBの不可日を復元
        applyUnavailableDaysFromDoctors(data);

        // ✅ DBのスコアを復元
        applyScoresFromDoctors(data);
      }
    } catch (err) {
      console.error("医師リストの取得に失敗:", err);
    }
  };

  // active doctors 更新後、選択IDが消えていたら先頭に戻す（安全策）
  useEffect(() => {
    setNumDoctors(activeDoctors.length);
    if (activeDoctors.length === 0) {
      setSelectedDoctorId("");
      return;
    }
    if (!selectedDoctorId || !activeDoctors.some((d) => d.id === selectedDoctorId)) {
      setSelectedDoctorId(activeDoctors[0]?.id || "");
    }
  }, [activeDoctors, selectedDoctorId]);

  // =========================================================
  // ✅ 医師リストの初期取得（GET）
  // =========================================================
  useEffect(() => {
    void fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    // =========================================================
  // ✅ TODO2：初回ロード時は「翌月」を初期表示にする（クライアントで1回だけ）
  // =========================================================
  useEffect(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1); // 翌月の1日
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1); // 1-12
  }, []);

  // 年月が変わったら「前月最終日」を自動更新
  useEffect(() => {
    const last = calcPrevMonthLastDay(year, month);
    setPrevMonthLastDay(last);
    setPrevMonthWorkedDaysMap({});
  }, [year, month]);

  // =========================================================
  // UI操作系
  // =========================================================
  const toggleHoliday = (day: number) => {
    const ymd = toYmd(year, month, day);
    const isSun = getWeekday(year, month, day) === "日";
    if (isSun) return; // 日曜はUI上もトグル不可の方針
  
    setManualHolidaySetYear((prev) => {
      const next = new Set(prev);
      if (next.has(ymd)) next.delete(ymd);
      else next.add(ymd);
      return next;
    });
  };

  const toggleUnavailable = (doctorId: string, day: number) => {
    if (!doctorId) return;
    setUnavailableMap((prev) => {
      const currentDays = prev[doctorId] || [];
      const newDays = currentDays.includes(day) ? currentDays.filter((d) => d !== day) : [...currentDays, day].sort((a, b) => a - b);
      return { ...prev, [doctorId]: newDays };
    });
  };

  const toggleAllUnavailable = () => {
    if (!selectedDoctorId) return;

    setUnavailableMap((prev) => {
      const currentDays = prev[selectedDoctorId] || [];
      const daysInMonth = getDaysInMonth(year, month);

      const newDays = currentDays.length > 0 ? [] : Array.from({ length: daysInMonth }, (_, i) => i + 1);
      return { ...prev, [selectedDoctorId]: newDays };
    });
  };

  const toggleFixedWeekday = (doctorId: string, weekdayPy: number) => {
    if (!doctorId) return;
    setFixedUnavailableWeekdaysMap((prev) => {
      const current = prev[doctorId] || [];
      const next = current.includes(weekdayPy) ? current.filter((w) => w !== weekdayPy) : [...current, weekdayPy].sort((a, b) => a - b);
      return { ...prev, [doctorId]: next };
    });
  };

  const togglePrevMonthWorkedDay = (doctorId: string, prevDay: number) => {
    if (!doctorId) return;
    setPrevMonthWorkedDaysMap((prev) => {
      const current = prev[doctorId] || [];
      const next = current.includes(prevDay) ? current.filter((d) => d !== prevDay) : [...current, prevDay].sort((a, b) => a - b);
      return { ...prev, [doctorId]: next };
    });
  };

  const toggleSatPrev = (doctorId: string) => {
    if (!doctorId) return;
    setSatPrevMap((prev) => ({ ...prev, [doctorId]: !prev[doctorId] }));
  };

  // =========================================================
  // ✅ 保存：医師設定（スコア＋休み希望）をまとめてPUT
  //   ※既存ロジックは残す（破壊しない）
  // =========================================================
  const saveDoctorSettings = async (docIdx: number) => {
    const doc = doctors[docIdx];
    if (!doc) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const fixedWeekdays = fixedUnavailableWeekdaysMap[doc.id] ?? [];

      // unavailableMap: [1,5,12] -> unavailable_dates: ["YYYY-MM-01", ...]
      const unavailableDays = unavailableMap[doc.id] ?? [];
      const unavailableDates = unavailableDays.map((day) => toYmd(year, month, day));

      const payload = {
        min_score: minScoreMap[doc.id] ?? null,
        max_score: maxScoreMap[doc.id] ?? null,
        target_score: targetScoreMap[doc.id] ?? null,

        fixed_weekdays: fixedWeekdays,
        unavailable_dates: unavailableDates,
      };

      const res = await fetch(`${apiUrl}/api/doctors/${doc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "医師設定の保存に失敗しました");
      }

      // ✅ 返却Doctorを採用し、doctors と map を同時に復元
      const updated: Doctor = await res.json().catch(() => doc);

      setDoctors((prev) => prev.map((d, i) => (i === docIdx ? { ...d, ...updated } : d)));

      // ✅ PUT後にDBの unavailable_days からUI Stateを復元（その医師だけ）
      {
        const list = updated.unavailable_days ?? [];
        const days: number[] = [];
        const weekdays: number[] = [];

        list.forEach((u) => {
          if (u.is_fixed === false) {
            if (u.date) {
              const dd = Number(u.date.slice(-2));
              if (Number.isFinite(dd)) days.push(dd);
            }
          } else {
            if (u.day_of_week !== null && u.day_of_week !== undefined) {
              weekdays.push(u.day_of_week);
            }
          }
        });

        const nextDays = Array.from(new Set(days)).sort((a, b) => a - b);
        const nextWeekdays = Array.from(new Set(weekdays)).sort((a, b) => a - b);

        setUnavailableMap((prev) => ({ ...prev, [updated.id]: nextDays }));
        setFixedUnavailableWeekdaysMap((prev) => ({ ...prev, [updated.id]: nextWeekdays }));
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "医師設定の保存に失敗しました";
      setError(message);
    }
  };

  // =========================================================
  // ✅ 要件①：全員の休み希望を一括保存（Promise.all）
  // =========================================================
  const saveAllDoctorsSettings = async () => {
    if (activeDoctors.length === 0) return;

    setIsBulkSavingDoctors(true);
    setError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const tasks = activeDoctors.map((doc) => {
        const fixedWeekdays = fixedUnavailableWeekdaysMap[doc.id] ?? [];

        const unavailableDays = unavailableMap[doc.id] ?? [];
        const unavailableDates = unavailableDays.map((day) => toYmd(year, month, day));

        const payload = {
          min_score: minScoreMap[doc.id] ?? null,
          max_score: maxScoreMap[doc.id] ?? null,
          target_score: targetScoreMap[doc.id] ?? null,

          fixed_weekdays: fixedWeekdays,
          unavailable_dates: unavailableDates,
        };

        return fetch(`${apiUrl}/api/doctors/${doc.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const msg = errData.detail || `医師設定の保存に失敗: ${doc.name}`;
            throw new Error(msg);
          }
          return res.json().catch(() => doc);
        });
      });

      await Promise.all(tasks);

      alert("✅ 全員の休み希望（スコア含む）を保存しました。");
      await fetchDoctors();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "全員の保存に失敗しました";
      setError(message);
      alert(`❌ 保存に失敗しました：${message}`);
    } finally {
      setIsBulkSavingDoctors(false);
    }
  };
  const toggleShiftLock = (day: number, shiftType: "day" | "night") => {
    const doctorId = getScheduleDoctorId(day, shiftType);
    if (!doctorId) return;

    const key = getShiftKey(day, shiftType);
    setLockedShiftKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const moveOrSwapShift = (fromDay: number, fromType: "day" | "night", toDay: number, toType: "day" | "night") => {
    if (fromDay === toDay && fromType === toType) return;
    if (isShiftLocked(fromDay, fromType) || isShiftLocked(toDay, toType)) return;

    setSchedule((prev) => {
      const next = prev.map((r) => ({ ...r }));
      const fromRow = next.find((r) => r.day === fromDay);
      const toRow = next.find((r) => r.day === toDay);
      if (!fromRow || !toRow) return prev;

      const fromField = fromType === "day" ? "day_shift" : "night_shift";
      const toField = toType === "day" ? "day_shift" : "night_shift";

      const fromDoctorId = fromRow[fromField] ?? null;
      const toDoctorId = toRow[toField] ?? null;
      if (!fromDoctorId) return prev;

      fromRow[fromField] = toDoctorId;
      toRow[toField] = fromDoctorId;

      const hasConflict = [fromRow, toRow].some((row) => row.day_shift && row.night_shift && row.day_shift === row.night_shift);
      if (hasConflict) {
        setError("同一日の日直と当直に同じ医師は設定できません");
        return prev;
      }

      return next;
    });
  };

  const handleDeleteMonthSchedule = async () => {
    if (!confirm(`${year}年${month}月のシフトを全削除します。よろしいですか？`)) return;

    setIsDeletingMonthSchedule(true);
    setError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/schedule/${year}/${month}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "月間シフトの削除に失敗しました");
      }

      setSchedule([]);
      setScores({});
      setLockedShiftKeys(new Set());
      setSaveMessage("");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "月間シフトの削除に失敗しました";
      setError(message);
    } finally {
      setIsDeletingMonthSchedule(false);
    }
  };

  useEffect(() => {
    setLockedShiftKeys(new Set());
  }, [year, month]);

  useEffect(() => {
    setLockedShiftKeys((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();

      prev.forEach((key) => {
        const [dayStr, shiftTypeRaw] = key.split("_");
        const day = Number(dayStr);
        const shiftType = shiftTypeRaw === "day" || shiftTypeRaw === "night" ? shiftTypeRaw : null;
        if (!shiftType || !Number.isFinite(day)) return;

        const row = schedule.find((r) => r.day === day);
        if (!row) return;
        const doctorId = shiftType === "day" ? row.day_shift ?? null : row.night_shift ?? null;
        if (doctorId) next.add(key);
      });

      if (next.size === prev.size) return prev;
      return next;
    });
  }, [schedule]);

  // =========================================================
  // ✨ シフト自動生成
  // =========================================================
  const handleGenerate = async () => {
    setIsLoading(true);
    setError("");
    setSaveMessage("");

    try {
      const daysInMonth = getDaysInMonth(year, month);
      const activeCount = activeDoctorIds.length;

      if (activeCount === 0) {
        throw new Error("アクティブな医師がいないため最適化できません");
      }

// 手動（臨時休）
const manual = holidays.filter((d) => d >= 1 && d <= daysInMonth);

// 自動（祝日）: override（平日扱い）された日は除外
const auto = autoHolidayDaysInMonth
  .filter((d) => d >= 1 && d <= daysInMonth)
  .filter((d) => !holidayWorkdayOverrides.has(toYmd(year, month, d)));

// 既存方針：日曜はUIでも選べない＆日曜扱いが別ロジックのため、holiday payload には入れない
const nonSunday = (d: number) => getWeekday(year, month, d) !== "日";

// 合成（重複排除）
const validHolidays = Array.from(new Set([...manual, ...auto].filter(nonSunday))).sort((a, b) => a - b);

      // ✅ UUIDキーは元々stringなので変換不要（念のためシャローコピー）
      const formattedUnavailable: Record<string, number[]> = filterRecordByActiveDoctors(unavailableMap);
      const formattedFixedWeekdays: Record<string, number[]> = filterRecordByActiveDoctors(fixedUnavailableWeekdaysMap);
      const formattedPrevMonthWorked: Record<string, number[]> = filterRecordByActiveDoctors(prevMonthWorkedDaysMap);

      const formattedMinScore: Record<string, number> = filterRecordByActiveDoctors(minScoreMap);
      const formattedMaxScore: Record<string, number> = filterRecordByActiveDoctors(maxScoreMap);
      const formattedTargetScore: Record<string, number> = filterRecordByActiveDoctors(targetScoreMap);
      const formattedSatPrev: Record<string, boolean> = filterRecordByActiveDoctors(satPrevMap);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const lockedShifts = Array.from(lockedShiftKeys)
        .map((key) => {
          const [dayStr, shiftTypeRaw] = key.split("_");
          const day = Number(dayStr);
          const shiftType = shiftTypeRaw === "day" || shiftTypeRaw === "night" ? shiftTypeRaw : null;
          if (!shiftType || !Number.isFinite(day)) return null;

          const doctorId = getScheduleDoctorId(day, shiftType);
          if (!isActiveDoctorId(doctorId)) return null;

          return {
            date: toYmd(year, month, day),
            shift_type: shiftType,
            doctor_id: doctorId,
          };
        })
        .filter((item): item is { date: string; shift_type: "day" | "night"; doctor_id: string } => item !== null);
      const res = await fetch(`${apiUrl}/api/optimize/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: year,
          month: month,
          num_doctors: activeDoctors.length,
          holidays: validHolidays,

          unavailable: formattedUnavailable,
          fixed_unavailable_weekdays: formattedFixedWeekdays,
          prev_month_last_day: prevMonthLastDay,
          prev_month_worked_days: formattedPrevMonthWorked,
          score_min: scoreMin,
          score_max: scoreMax,

          // ✨ 個別設定データを送信（UUIDキー）
          min_score_by_doctor: formattedMinScore,
          max_score_by_doctor: formattedMaxScore,
          target_score_by_doctor: formattedTargetScore,
          sat_prev: formattedSatPrev,

          // 既存のバックエンド互換用（必要なら残す）
          past_sat_counts: new Array(activeCount).fill(0),
          past_sunhol_counts: new Array(activeCount).fill(0),
          past_total_scores: {},

          objective_weights: objectiveWeights,
          locked_shifts: lockedShifts,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "最適化に失敗しました");
      }

      const data = await res.json();
      setSchedule(data.schedule);
      setScores(data.scores);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 💾 データベースへ保存（シフト）
  const handleSaveToDB = async () => {
    setIsSaving(true);
    setSaveMessage("");
    setError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/schedule/save/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month,
          num_doctors: activeDoctors.length,
          schedule: schedule.map((s) => ({
            day: s.day,
            day_shift: s.day_shift,
            night_shift: s.night_shift,
          })),
        }),
      });

      if (!res.ok) throw new Error("保存に失敗しました");

      const data = await res.json();
      setSaveMessage(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const prevMonthTailDays = (() => {
    const last = prevMonthLastDay;
    const start = Math.max(1, last - 3);
    const days: number[] = [];
    for (let d = start; d <= last; d++) days.push(d);
    return days;
  })();

  // =========================================================
  // ✅ 要件②：重み設定のサマリー表示用
  // =========================================================
  const weightChanges = useMemo(() => {
    const keys = Object.keys(DEFAULT_OBJECTIVE_WEIGHTS) as (keyof ObjectiveWeights)[];
    const changed = keys
      .map((k) => ({ key: k, base: DEFAULT_OBJECTIVE_WEIGHTS[k], now: objectiveWeights[k] }))
      .filter((x) => x.base !== x.now);

    const isDefault = changed.length === 0;

    // 表示は多すぎると邪魔なので最大3件
    const top = changed.slice(0, 3).map((c) => `${String(c.key)}:${c.now}`);
    return { isDefault, changedCount: changed.length, top };
  }, [objectiveWeights]);

  return (
    <div className="min-h-screen bg-gray-50 p-2 md:p-8 font-sans">
      <main className="w-full max-w-5xl mx-auto bg-white rounded-xl shadow-lg p-4 md:p-8">
        <h1 className="text-xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-8 border-b pb-4">🏥 当直表 自動生成ダッシュボード</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-4 md:mb-8">
          {/* --- 左側：条件設定フォーム --- */}
          <div
  className={`bg-blue-50 p-6 rounded-lg border border-blue-100 col-span-1 h-fit relative transition ${
    isLoading ? "opacity-80" : "opacity-100"
  }`}
>
          {isLoading && (
  <div className="absolute inset-0 z-10 rounded-lg bg-white/50 backdrop-blur-[1px] pointer-events-auto flex items-start justify-center p-4">
    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 shadow-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>生成中は入力を一時ロックしています</span>
    </div>
  </div>
)}
         <h2 className="text-xl font-bold text-blue-800 mb-4">⚙️ 生成条件</h2>

            {/* ✅ 休日設定（DB同期）の状態表示 */}
{(isLoadingCustom || customError) && (
  <div
    className={`mb-3 rounded-lg border px-3 py-2 text-[12px] font-bold ${
      customError ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-blue-50 border-blue-200 text-blue-700"
    }`}
  >
    {customError ? `休日設定の同期エラー: ${customError}` : "休日設定を同期中..."}
  </div>
)}

            {/* 主要条件表示 */}
            <div className="mb-6 p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
              <div className="text-sm font-bold text-gray-700 mb-2 text-center">📌 適用中の主要条件</div>

              <ul className="text-xs text-gray-700 space-y-1.5">
                <li className="flex gap-2">
                  <span className="font-bold text-blue-700 shrink-0">ハード</span>
                  <span>4日間隔(月跨ぎ含) / 土曜月1回 / 日祝同日禁止 / 日直上限2回 / 研究日・前日禁止</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-700 shrink-0">スコア</span>
                  <span>
                    共通範囲: {scoreMin} 〜 {scoreMax} <span className="text-[10px] text-orange-600">(個別設定優先)</span>
                  </span>
                </li>

                <li className="flex gap-2 items-start">
                  <span className="font-bold text-blue-700 shrink-0">重み</span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      {/* 左：サマリー（バッジ群） */}
                      <span className="flex flex-wrap items-center gap-1">
                        {weightChanges.isDefault ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            現在：標準設定
                          </span>
                        ) : (
                          <>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              変更あり：{weightChanges.changedCount}件
                            </span>
                            {weightChanges.top.map((t) => (
                              <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                                {t}
                              </span>
                            ))}
                          </>
                        )}
                      </span>

                      {/* 右：赤丸エリアの【設定】ボタン */}
                      <button
                        type="button"
                        onClick={() => setIsWeightsOpen((v) => !v)}
                        className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-[0.99] transition"
                      >
                        設定
                      </button>
                    </div>

                    {/* クリックで開く：重み調整パネル（ここにスライダーを格納） */}
                    {isWeightsOpen && (
                      <div className="mt-3 rounded-lg border border-blue-100 bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
                          <div className="text-[12px] font-bold text-blue-800">⚙️ 最適化の詳細設定（重み調整）</div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setObjectiveWeights(DEFAULT_OBJECTIVE_WEIGHTS)}
                              className="text-[10px] font-bold text-blue-700 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 bg-white"
                              title="重みだけ初期値に戻します"
                            >
                              初期値
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsWeightsOpen(false)}
                              className="text-[10px] font-bold text-gray-600 hover:text-gray-800 px-2 py-1 rounded border border-gray-200 bg-white"
                            >
                              閉じる
                            </button>
                          </div>
                        </div>

                        <div className="p-3 space-y-3">
                          {(
                            [
                              { key: "gap5", label: "5日間隔回避", min: 0, max: 200, step: 5, hint: "最大級" },
                              { key: "pre_clinic", label: "外来前日回避", min: 0, max: 200, step: 5, hint: "最大級" },
                              { key: "sunhol_3rd", label: "日祝3回目回避", min: 0, max: 200, step: 5, hint: "次点" },
                              { key: "sat_consec", label: "連続土曜回避", min: 0, max: 200, step: 5, hint: "次点" },
                              { key: "gap6", label: "6日間隔回避", min: 0, max: 200, step: 5, hint: "次点" },
                              { key: "score_balance", label: "スコア公平性", min: 0, max: 200, step: 5, hint: "中" },
                              { key: "target", label: "個別ターゲット", min: 0, max: 200, step: 5, hint: "弱" },
                            ] as const
                          ).map((w) => (
                            <div key={w.key} className="rounded-lg border border-gray-100 p-3">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                  <div className="text-[12px] font-bold text-gray-700 truncate">
                                    {w.label}
                                    <span className="ml-2 text-[10px] font-bold text-gray-400">{w.hint}</span>
                                  </div>
                                </div>

                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={objectiveWeights[w.key]}
                                  onChange={(e) => setWeight(w.key, Number(e.target.value))}
                                  className="w-20 p-2 text-sm font-bold text-center border rounded bg-gray-50"
                                  min={w.min}
                                  max={w.max}
                                  step={w.step}
                                />
                              </div>

                              <input
                                type="range"
                                value={objectiveWeights[w.key]}
                                onChange={(e) => setWeight(w.key, Number(e.target.value))}
                                min={w.min}
                                max={w.max}
                                step={w.step}
                                className="w-full accent-blue-600"
                              />

                              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                <span>{w.min}</span>
                                <span>{w.max}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </li>

                <li className="flex gap-2">
                  <span className="font-bold text-blue-700 shrink-0">目的</span>
                  <span>
                    ５日間隔 ({objectiveWeights.gap5}) ✕外来前日({objectiveWeights.pre_clinic}) ✕日祝３回目回避({objectiveWeights.sunhol_3rd})✕連続土曜(
                    {objectiveWeights.sat_consec}) ✕ ６日間隔({objectiveWeights.gap6}) ✕ スコア公平({objectiveWeights.score_balance})
                  </span>
                </li>
              </ul>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">score_min</label>
                  <input type="number" step="0.1" value={scoreMin} onChange={(e) => setScoreMin(Number(e.target.value))} className="border rounded p-2 w-full text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">score_max</label>
                  <input type="number" step="0.1" value={scoreMax} onChange={(e) => setScoreMax(Number(e.target.value))} className="border rounded p-2 w-full text-sm" />
                </div>
              </div>
              <div className="mt-2 text-[10px] text-gray-500">人数が少ない月は score_max を上げないと解なしになりやすいです。</div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">年</label>
                <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="border rounded p-2 w-full" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">月</label>
                <input type="number" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border rounded p-2 w-full" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-1">医師の人数</label>
              <div className="flex items-center gap-2">
                <input type="number" value={numDoctors} readOnly className="border rounded p-2 w-full bg-gray-100 text-gray-500 cursor-not-allowed" />
                <span className="text-sm font-bold text-blue-600">人</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {activeDoctors.map((doc) => (
                  <span key={doc.id} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                    {doc.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-4 md:mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">共通の祝日設定</label>
              <div className="flex flex-wrap gap-2">
              {Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1).map((day) => {
  const { ymd, isSun, isAutoHoliday, isManualHoliday } = isHolidayLikeDay(day);

  // 手動（臨時休）
  const isSelectedManual = isManualHoliday;

  // 自動祝日を「平日扱い」にする例外
  const isAutoHolidayOverridden = isAutoHoliday && holidayWorkdayOverrides.has(ymd);
  const isAutoHolidayEffective = isAutoHoliday && !isAutoHolidayOverridden;

  // 日曜は従来通り無効（触らせない）
  const disabled = isSun;

  const title =
    isAutoHoliday
      ? `祝日：${holidayMap[ymd]?.name || ""}${isAutoHolidayOverridden ? "（平日扱い）" : ""}`
      : isSun
      ? "日曜"
      : isSelectedManual
      ? "臨時休（手動）"
      : "";

  const onClick = () => {
    if (isSun) return;

    // 自動祝日：平日扱いトグル
    if (isAutoHoliday) {
      setDisabledHolidaySetYear((prev) => {
        const next = new Set(prev);
        if (next.has(ymd)) next.delete(ymd);
        else next.add(ymd);
        return next;
      });
      return;
    }

    // 通常日：従来通り手動休日（臨時休）トグル
    toggleHoliday(day);
  };

  return (
    <button
      key={day}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-8 h-8 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
        // 自動祝日（休日扱い）
        isAutoHolidayEffective
          ? "bg-red-100 text-red-700 border border-red-200"
          // 自動祝日（平日扱いにした）
          : isAutoHolidayOverridden
          ? "bg-white text-gray-700 border border-red-200"
          // 手動（臨時休）
          : isSelectedManual
          ? "bg-red-500 text-white"
          // 日曜
          : isSun
          ? "bg-red-50 text-red-300"
          : "bg-white border text-gray-600"
      }`}
    >
      {day}
    </button>
  );
})}
              </div>
            </div>

            {/* 個別休み希望 */}
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-white rounded-lg border border-blue-100 shadow-sm relative">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-bold text-gray-700 text-center flex-grow pl-10">👨‍⚕️ 個別休み希望</label>
                <button
                  type="button"
                  onClick={toggleAllUnavailable}
                  className="text-[10px] text-gray-400 hover:text-red-600 border border-transparent hover:border-red-200 rounded px-1.5 py-1 transition-all"
                  title="1日でも不可日があればクリア、なければ月間すべて不可日にします"
                >
                  ↺ 一括クリア/一括選択
                </button>
              </div>

              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(String(e.target.value))}
                className="w-full p-2 mb-4 border rounded font-bold text-blue-700 bg-blue-50 outline-none"
              >
                {activeDoctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} 先生
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap gap-1 justify-center">
              {Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1).map((day) => {
  const isSelected = (unavailableMap[selectedDoctorId] || []).includes(day);
  return (
    <button
      key={day}
      type="button"
      onClick={() => toggleUnavailable(selectedDoctorId, day)}
      className={`w-7 h-7 rounded text-[10px] font-bold transition-all ${
        isSelected ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
      }`}
    >
      {day}
    </button>
  );
})}
              </div>

              <div className="mt-2 flex justify-between items-center text-[9px]">
                <span className="text-transparent">ダミー</span>
                <span className="text-indigo-500 font-bold">選択中: {unavailableMap[selectedDoctorId]?.length || 0} 日</span>
                <span className="text-transparent">ダミー</span>
              </div>
            </div>

            {/* 固定不可曜日（毎週固定） */}
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 mb-3 text-center">📅 固定不可曜日 一括入力</label>

              <div className="text-[10px] text-gray-500 text-center mb-3">各医師の「毎週入れない曜日」をチェックしてください。</div>

              <div className="overflow-x-auto">
                <div className="min-w-[200px]">
                  <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 items-center mb-2">
                    <div className="text-[11px] font-bold text-gray-600">医師</div>
                    {pyWeekdays.map((pyWd) => {
                      const label = pyWeekdaysJp[pyWd];
                      const isSun = pyWd === 6;
                      const isSat = pyWd === 5;
                      return (
                        <div
                          key={pyWd}
                          className={`text-[11px] font-bold text-center rounded py-1 border ${
                            isSun
                              ? "bg-red-50 text-red-500 border-red-100"
                              : isSat
                              ? "bg-blue-50 text-blue-600 border-blue-100"
                              : "bg-gray-50 text-gray-700 border-gray-100"
                          }`}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1">
                    {activeDoctors.map((doc) => (
                      <div key={doc.id} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 items-center">
                        <button
                          type="button"
                          onClick={() => setSelectedDoctorId(doc.id)}
                          className={`text-left text-[11px] font-bold px-2 py-2 rounded border truncate transition ${
                            selectedDoctorId === doc.id ? "bg-blue-600 text-white border-blue-700" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {doc.name}
                        </button>

                        {pyWeekdays.map((pyWd) => {
                          const selected = (fixedUnavailableWeekdaysMap[doc.id] || []).includes(pyWd);
                          const isSun = pyWd === 6;
                          const isSat = pyWd === 5;

                          return (
                            <button
                              key={`${doc.id}-${pyWd}`}
                              type="button"
                              onClick={() => toggleFixedWeekday(doc.id, pyWd)}
                              className={`h-9 rounded border text-[12px] font-bold transition ${
                                selected
                                  ? isSun
                                    ? "bg-red-500 text-white border-red-600"
                                    : isSat
                                    ? "bg-blue-600 text-white border-blue-700"
                                    : "bg-gray-900 text-white border-gray-900"
                                  : isSun
                                  ? "bg-red-50 text-red-400 border-red-200 hover:bg-red-100"
                                  : isSat
                                  ? "bg-blue-50 text-blue-500 border-blue-200 hover:bg-blue-100"
                                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              {selected ? "×" : ""}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[10px] text-center text-gray-500">
                選択中:{" "}
                <span className="font-bold text-gray-700">{activeDoctors.find((d) => d.id === selectedDoctorId)?.name || "未選択"}</span> ／ 固定不可:{" "}
                {(fixedUnavailableWeekdaysMap[selectedDoctorId] || []).length === 0
                  ? "なし"
                  : (fixedUnavailableWeekdaysMap[selectedDoctorId] || [])
                      .slice()
                      .sort((a, b) => a - b)
                      .map((wd) => pyWeekdaysJp[wd])
                      .join(" / ")}
              </div>
            </div>

            {/* 月跨ぎ4日間隔 */}
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 mb-3 text-center">⏮️ 前月末勤務</label>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">前月の最終日</label>
                  <input type="number" value={prevMonthLastDay} onChange={(e) => setPrevMonthLastDay(Number(e.target.value))} className="border rounded p-2 w-full text-sm" />
                </div>
                <div className="text-[10px] text-gray-500 flex items-end">※年月変更時は自動計算されます</div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[200px]">
                  <div className="grid grid-cols-[90px_repeat(4,1fr)] gap-1 items-center mb-2">
                    <div className="text-[11px] font-bold text-gray-600">医師</div>
                    {prevMonthTailDays.map((d) => (
                      <div key={d} className="text-[11px] font-bold text-center rounded py-1 border bg-gray-50 text-gray-700 border-gray-100">
                        {d}日
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    {activeDoctors.map((doc) => (
                      <div key={doc.id} className="grid grid-cols-[90px_repeat(4,1fr)] gap-1 items-center">
                        <div className="text-left text-[11px] font-bold px-2 py-2 rounded border bg-white text-gray-700 border-gray-200 truncate">{doc.name}</div>

                        {prevMonthTailDays.map((d) => {
                          const selected = (prevMonthWorkedDaysMap[doc.id] || []).includes(d);
                          return (
                            <button
                              key={`${doc.id}-prev-${d}`}
                              type="button"
                              onClick={() => togglePrevMonthWorkedDay(doc.id, d)}
                              className={`h-9 rounded border text-[12px] font-bold transition ${
                                selected ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              {selected ? "×" : ""}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button
  onClick={handleGenerate}
  disabled={isLoading || activeDoctors.length === 0}
  className={`w-full min-h-12 px-4 py-3 rounded font-bold text-white shadow-md transition flex items-center justify-center gap-2 ${
    isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
  }`}
>
  {isLoading ? (
    <>
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>生成中...</span>
    </>
  ) : (
    <span>✨ シフトを自動生成</span>
  )}
</button>
          </div>

          {/* --- 右側：結果表示エリア --- */}
          <div className="col-span-1 md:col-span-2 relative"></div><div className="col-span-1 md:col-span-2">
          {isLoading && (
  <div className="absolute inset-0 z-20 rounded-lg bg-white/70 backdrop-blur-[1px] flex items-center justify-center p-4">
    <div className="w-full max-w-md rounded-2xl border border-blue-100 bg-white shadow-xl px-4 py-6 md:px-6">
      <div className="flex flex-col items-center text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
        <div className="text-base md:text-lg font-bold text-gray-800">当直表を生成中です</div>
        <div className="mt-2 text-sm text-gray-500">
          AIが勤務条件をもとに候補を計算しています。
        </div>
        <div className="mt-4 w-full h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full w-1/2 bg-blue-500 animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  </div>
)}
            {/* ✅ 要件①：大きな一括保存ボタン（押しやすい位置） */}
            <div className="mb-4 md:mb-6">
              <button
                type="button"
                onClick={saveAllDoctorsSettings}
                disabled={isBulkSavingDoctors || activeDoctors.length === 0}
                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition ${isBulkSavingDoctors ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"}`}
                title="全医師のスコア設定＋休み希望（単発/固定）をまとめて保存します"
              >
                {isBulkSavingDoctors ? "保存中..." : "💾 全員の休み希望を一括保存"}
              </button>
              <div className="mt-2 text-[11px] text-gray-500">※ 現在の「スコア設定（Min/Max/目標）」「固定不可曜日」「個別不可日」を全員分まとめて保存します。</div>
            </div>

            {/* 医師別スコア設定 */}
            <div className="bg-orange-50 p-3 md:p-6 rounded-lg border border-orange-100 shadow-sm mb-4 md:mb-6">
              <h3 className="text-md font-bold text-orange-800 mb-3 flex flex-wrap items-center gap-2">
                <span>🎯 医師別 スコア設定</span>
                <span className="text-xs font-normal text-orange-600 bg-orange-100 px-2 py-1 rounded">※空欄は全体設定を適用</span>
                <span className="text-xs font-normal text-gray-500 bg-white px-2 py-1 rounded border border-orange-200">※保存は上の「一括保存」ボタン</span>
              </h3>

              <div className="overflow-x-auto bg-white border rounded-lg">
                <table className="min-w-full text-center text-[12px]">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      <th className="py-2 px-2 border-b text-left">医師名</th>
                      <th className="py-2 px-2 border-b">Min</th>
                      <th className="py-2 px-2 border-b">Max</th>
                      <th className="py-2 px-2 border-b">目標</th>
                      <th className="py-2 px-2 border-b text-orange-700">前月土曜当直</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDoctors.map((doc) => (
                      <tr key={doc.id} className="border-b hover:bg-gray-50">
                        <td className="py-1 px-2 text-left font-bold text-gray-700 whitespace-nowrap">{doc.name}</td>

                        <td className="py-1 px-2">
                          <input
                            type="number"
                            step="0.5"
                            className="w-12 md:w-14 border rounded p-1 text-center"
                            value={minScoreMap[doc.id] === undefined ? "" : minScoreMap[doc.id]}
                            onChange={(e) => setMinScoreMap({ ...minScoreMap, [doc.id]: parseFloat(e.target.value) })}
                            placeholder={String(scoreMin)}
                          />
                        </td>

                        <td className="py-1 px-2">
                          <input
                            type="number"
                            step="0.5"
                            className="w-12 md:w-14 border rounded p-1 text-center"
                            value={maxScoreMap[doc.id] === undefined ? "" : maxScoreMap[doc.id]}
                            onChange={(e) => setMaxScoreMap({ ...maxScoreMap, [doc.id]: parseFloat(e.target.value) })}
                            placeholder={String(scoreMax)}
                          />
                        </td>

                        <td className="py-1 px-2">
                          <input
                            type="number"
                            step="0.5"
                            className="w-12 md:w-16 border rounded p-1 text-center bg-blue-50"
                            value={targetScoreMap[doc.id] === undefined ? "" : targetScoreMap[doc.id]}
                            onChange={(e) => setTargetScoreMap({ ...targetScoreMap, [doc.id]: parseFloat(e.target.value) })}
                            placeholder="任意"
                          />
                        </td>

                        <td className="py-1 px-2">
                          <button
                            type="button"
                            onClick={() => toggleSatPrev(doc.id)}
                            className={`px-2 py-1 rounded text-[10px] font-bold border ${
                              satPrevMap[doc.id] ? "bg-orange-500 text-white border-orange-600" : "bg-white text-gray-400 border-gray-200"
                            }`}
                          >
                            {satPrevMap[doc.id] ? "連続回避" : "なし"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && <div className="bg-red-100 text-red-700 p-3 mb-4 md:mb-6 rounded border-l-4 border-red-500">{error}</div>}

            {!schedule.length && !isLoading && !error && (
              <div className="flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-gray-300 rounded-lg text-gray-400 bg-gray-50 p-4 text-center">
                左下の「生成ボタン」を押してください
              </div>
            )}

            {schedule.length > 0 && (
              <div className="animate-fade-in">
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-xs text-gray-500">シフトをドラッグして移動/入れ替えできます。ロック済みコマは移動されません。</div>
                  <button
                    type="button"
                    onClick={handleDeleteMonthSchedule}
                    disabled={isDeletingMonthSchedule}
                    className="w-full md:w-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeletingMonthSchedule ? "削除中..." : "この月のシフトを全削除"}
                  </button>
                </div>

                <div className="bg-gray-50 p-3 md:p-4 rounded-lg border mb-4 md:mb-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">⚖️ 負担スコア</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(scores).map(([doctorId, score]) => (
                      <div key={doctorId} className="bg-white px-2 py-1 rounded border text-xs shadow-sm flex items-center">
                        <span className="text-gray-500 mr-1 md:mr-2">{getDoctorName(doctorId)}</span>
                        <span className="font-bold">{String(score)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border shadow-sm">
                  <table className="min-w-full bg-white text-center text-sm">
                    <thead className="bg-gray-100 whitespace-nowrap">
                      <tr>
                        <th className="py-2 px-2 md:px-3 border-b">日付</th>
                        <th className="py-2 px-2 md:px-3 border-b">曜日</th>
                        <th className="py-2 px-2 md:px-3 border-b bg-orange-50">日直</th>
                        <th className="py-2 px-2 md:px-3 border-b bg-indigo-50">当直</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((row) => {
                        const wd = getWeekday(year, month, row.day);
                        const isSun = wd === "日";
                        const isSat = wd === "土";
                        const ymd = toYmd(year, month, row.day);
const isAutoHoliday = holidaySet.has(ymd);
const isManualHoliday = manualHolidaySetInMonth.has(ymd);
const isHolidayLike = row.is_holiday || isSun || isAutoHoliday || isManualHoliday;
                        const dayLocked = isShiftLocked(row.day, "day");
                        const nightLocked = isShiftLocked(row.day, "night");
                        return (
                          <tr key={row.day} className={`border-b ${isHolidayLike ? "bg-red-50" : isSat ? "bg-blue-50" : ""}`}>
                            <td className="py-2 px-2 md:px-3 whitespace-nowrap">{row.day}日</td>
                            <td className={`py-2 px-2 md:px-3 font-bold ${isSun ? "text-red-500" : isSat ? "text-blue-500" : ""}`}>{wd}</td>`r`n                            <td className="py-2 px-2 md:px-3">
                              <div
                                onDragOver={(e) => {
                                  if (!dayLocked) e.preventDefault();
                                }}
                                onDrop={(e) => {
                                  if (dayLocked) return;
                                  e.preventDefault();
                                  const raw = e.dataTransfer.getData("text/plain") || dragSourceKey;
                                  if (!raw) return;
                                  try {
                                    const parsed = JSON.parse(raw) as { day: number; shiftType: "day" | "night" };
                                    moveOrSwapShift(parsed.day, parsed.shiftType, row.day, "day");
                                  } catch {
                                    // no-op
                                  }
                                  setDragSourceKey(null);
                                }}
                                className={`min-h-10 rounded-lg border p-1 flex items-center justify-between gap-1 ${
                                  dayLocked ? "border-amber-300 bg-amber-50" : "border-transparent"
                                }`}
                              >
                                {row.day_shift !== null && row.day_shift !== undefined ? (
                                  <span
                                    draggable={!dayLocked}
                                    onDragStart={(e) => {
                                      const payload = JSON.stringify({ day: row.day, shiftType: "day" as const });
                                      e.dataTransfer.setData("text/plain", payload);
                                      e.dataTransfer.effectAllowed = "move";
                                      setDragSourceKey(payload);
                                    }}
                                    onDragEnd={() => setDragSourceKey(null)}
                                    className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap cursor-grab active:cursor-grabbing ${
                                      dayLocked ? "bg-amber-100 text-amber-900" : "bg-orange-100 text-orange-800"
                                    }`}
                                  >
                                    {getDoctorName(row.day_shift)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleShiftLock(row.day, "day")}
                                  disabled={!row.day_shift}
                                  className="p-1 rounded border border-gray-200 bg-white text-gray-500 hover:text-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={dayLocked ? "ロック解除" : "ロック"}
                                >
                                  {dayLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </td>
                            <td className="py-2 px-2 md:px-3">
                              <div
                                onDragOver={(e) => {
                                  if (!nightLocked) e.preventDefault();
                                }}
                                onDrop={(e) => {
                                  if (nightLocked) return;
                                  e.preventDefault();
                                  const raw = e.dataTransfer.getData("text/plain") || dragSourceKey;
                                  if (!raw) return;
                                  try {
                                    const parsed = JSON.parse(raw) as { day: number; shiftType: "day" | "night" };
                                    moveOrSwapShift(parsed.day, parsed.shiftType, row.day, "night");
                                  } catch {
                                    // no-op
                                  }
                                  setDragSourceKey(null);
                                }}
                                className={`min-h-10 rounded-lg border p-1 flex items-center justify-between gap-1 ${
                                  nightLocked ? "border-amber-300 bg-amber-50" : "border-transparent"
                                }`}
                              >
                                {row.night_shift !== null && row.night_shift !== undefined ? (
                                  <span
                                    draggable={!nightLocked}
                                    onDragStart={(e) => {
                                      const payload = JSON.stringify({ day: row.day, shiftType: "night" as const });
                                      e.dataTransfer.setData("text/plain", payload);
                                      e.dataTransfer.effectAllowed = "move";
                                      setDragSourceKey(payload);
                                    }}
                                    onDragEnd={() => setDragSourceKey(null)}
                                    className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap cursor-grab active:cursor-grabbing ${
                                      nightLocked ? "bg-amber-100 text-amber-900" : "bg-indigo-100 text-indigo-800"
                                    }`}
                                  >
                                    {getDoctorName(row.night_shift)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleShiftLock(row.day, "night")}
                                  disabled={!row.night_shift}
                                  className="p-1 rounded border border-gray-200 bg-white text-gray-500 hover:text-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={nightLocked ? "ロック解除" : "ロック"}
                                >
                                  {nightLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex flex-col items-center">
                  <button
                    onClick={handleSaveToDB}
                    disabled={isSaving}
                    className="px-6 py-3 md:px-8 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold shadow-lg transform hover:scale-105 transition w-full md:w-auto"
                  >
                    {isSaving ? "保存中..." : "💾 このシフトを確定・保存する"}
                  </button>
                  {saveMessage && <div className="mt-4 text-green-800 font-bold">🎉 {saveMessage}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
