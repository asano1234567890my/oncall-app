// src/app/page.tsx
"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Loader2 } from "lucide-react";
import { GenerationSettingsPanel, DoctorSettingsPanel } from "./components/SettingsPanel";
import ScheduleBoard from "./components/ScheduleBoard";
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

type ShiftType = "day" | "night";

type ScheduleRow = {
  day: number;
  day_shift?: string | null;
  night_shift?: string | null;
  is_holiday?: boolean;
  is_sunhol?: boolean;
};

type DragPayload = {
  day: number;
  shiftType: ShiftType;
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
  const defaultTargetMonth = getDefaultTargetMonth();
  const [year, setYear] = useState<number>(defaultTargetMonth.year);
  const [month, setMonth] = useState<number>(defaultTargetMonth.month);

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
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [scores, setScores] = useState<Record<string, number | string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false); // ※シフト保存用
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [isDeletingMonthSchedule, setIsDeletingMonthSchedule] = useState<boolean>(false);

  const [lockedShiftKeys, setLockedShiftKeys] = useState<Set<string>>(() => new Set());
  const [dragSourceKey, setDragSourceKey] = useState<string | null>(null);
  const [dragNotice, setDragNotice] = useState<string>("");
  const [draggingDoctorId, setDraggingDoctorId] = useState<string | null>(null);
  const [highlightedDoctorId, setHighlightedDoctorId] = useState<string | null>(null);
  const [invalidHoverShiftKey, setInvalidHoverShiftKey] = useState<string | null>(null);
  const [hoverErrorMessage, setHoverErrorMessage] = useState<string>("");
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
  const getShiftKey = (day: number, shiftType: ShiftType) => `${day}_${shiftType}`;

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

  const getScheduleDoctorId = (day: number, shiftType: ShiftType) => {
    const row = schedule.find((r) => r.day === day);
    if (!row) return null;
    return shiftType === "day" ? row.day_shift ?? null : row.night_shift ?? null;
  };

  const isShiftLocked = (day: number, shiftType: ShiftType) => lockedShiftKeys.has(getShiftKey(day, shiftType));

  const getWeekdayPy = (y: number, m: number, d: number) => (new Date(y, m - 1, d).getDay() + 6) % 7;

  const getShiftDoctorIdFromRow = (row: ScheduleRow, shiftType: ShiftType) => (shiftType === "day" ? row.day_shift ?? null : row.night_shift ?? null);

  const toggleHighlightedDoctor = (doctorId: string | null | undefined) => {
    if (!doctorId) return;
    setHighlightedDoctorId((prev) => (prev === doctorId ? null : doctorId));
  };

  const isDoctorManuallyUnavailableOnDay = (doctorId: string | null | undefined, day: number) => {
    if (!doctorId) return false;
    return (unavailableMap[doctorId] || []).includes(day);
  };

  const isDoctorFixedUnavailableOnDay = (doctorId: string | null | undefined, day: number) => {
    if (!doctorId) return false;
    const weekdayPy = getWeekdayPy(year, month, day);
    return (fixedUnavailableWeekdaysMap[doctorId] || []).includes(weekdayPy);
  };

  const isDoctorBlockedByManualConstraints = (doctorId: string | null | undefined, day: number) =>
    isDoctorManuallyUnavailableOnDay(doctorId, day) || isDoctorFixedUnavailableOnDay(doctorId, day);

  const isHighlightedDoctorBlockedDay = (day: number) => isDoctorBlockedByManualConstraints(highlightedDoctorId, day);

  const setHoverErrorState = (shiftKey: string | null, message = "") => {
    setInvalidHoverShiftKey(shiftKey);
    setHoverErrorMessage(message);
  };

  const parseDragPayload = (raw: string | null): DragPayload | null => {
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<DragPayload>;
      if (typeof parsed.day !== "number") return null;
      if (parsed.shiftType !== "day" && parsed.shiftType !== "night") return null;
      return { day: parsed.day, shiftType: parsed.shiftType };
    } catch {
      return null;
    }
  };

  const getPlacementConstraintMessage = (
    doctorId: string | null | undefined,
    day: number,
    shiftType: ShiftType,
    options?: {
      scheduleRows?: ScheduleRow[];
      ignoreShiftKeys?: Set<string>;
    }
  ) => {
    if (!doctorId) return null;

    const scheduleRows = options?.scheduleRows ?? schedule;
    const ignoreShiftKeys = options?.ignoreShiftKeys ?? new Set<string>();
    const doctorName = getDoctorName(doctorId);

    if (shiftType === "day" && !isHolidayLikeDay(day).isHolidayLike) {
      return "平日の日直には配置できません";
    }

    if (isDoctorManuallyUnavailableOnDay(doctorId, day)) {
      return `${doctorName}先生は${month}月${day}日を個別不可申請しています`;
    }

    if (isDoctorFixedUnavailableOnDay(doctorId, day)) {
      const weekdayPy = getWeekdayPy(year, month, day);
      return `${doctorName}先生は${pyWeekdaysJp[weekdayPy]}曜日を固定不可に設定しています`;
    }

    const prevMonthWorkedDays = prevMonthWorkedDaysMap[doctorId] || [];
    const hasBlockedPrevMonthGap = prevMonthWorkedDays.some((workedDay) => {
      const gapFromPrevMonth = day + (prevMonthLastDay - workedDay);
      return gapFromPrevMonth <= 3;
    });
    if (hasBlockedPrevMonthGap) {
      return `${doctorName}先生は4日間隔が空いていません`;
    }

    const row = scheduleRows.find((entry) => entry.day === day);
    const oppositeShiftType: ShiftType = shiftType === "day" ? "night" : "day";
    const oppositeShiftKey = getShiftKey(day, oppositeShiftType);
    const oppositeDoctorId = row && !ignoreShiftKeys.has(oppositeShiftKey) ? getShiftDoctorIdFromRow(row, oppositeShiftType) : null;
    if (oppositeDoctorId && oppositeDoctorId === doctorId) {
      return "同じ日に日直と当直へ同じ医師は配置できません";
    }

    for (const rowEntry of scheduleRows) {
      for (const candidateShiftType of ["day", "night"] as const) {
        const shiftKey = getShiftKey(rowEntry.day, candidateShiftType);
        if (ignoreShiftKeys.has(shiftKey)) continue;

        const assignedDoctorId = getShiftDoctorIdFromRow(rowEntry, candidateShiftType);
        if (assignedDoctorId !== doctorId) continue;

        if (Math.abs(rowEntry.day - day) <= 3) {
          return `${doctorName}先生は4日間隔が空いていません`;
        }
      }
    }

    if (shiftType === "night" && getWeekday(year, month, day) === "土") {
      const alreadyHasSaturdayNight = scheduleRows.some((rowEntry) => {
        const shiftKey = getShiftKey(rowEntry.day, "night");
        if (ignoreShiftKeys.has(shiftKey)) return false;
        return getWeekday(year, month, rowEntry.day) === "土" && (rowEntry.night_shift ?? null) === doctorId;
      });

      if (alreadyHasSaturdayNight) {
        return `${doctorName}先生の土曜当直は月1回までです`;
      }
    }

    return null;
  };

  const formatConstraintForTooltip = (doctorId: string, message: string) => {
    const doctorName = getDoctorName(doctorId);
    const prefixWithHa = `${doctorName}先生は`;
    const prefixWithNo = `${doctorName}先生の`;

    if (message.startsWith(prefixWithHa)) {
      return `【${doctorName}先生】${message.slice(prefixWithHa.length)}`;
    }
    if (message.startsWith(prefixWithNo)) {
      return `【${doctorName}先生】${message.slice(prefixWithNo.length)}`;
    }
    return `【${doctorName}先生】${message}`;
  };

  const getSwapConstraintMessage = (
    sourceDoctorId: string | null | undefined,
    fromDay: number,
    fromType: ShiftType,
    toDay: number,
    toType: ShiftType,
    options?: {
      scheduleRows?: ScheduleRow[];
    }
  ) => {
    if (!sourceDoctorId) return null;

    const scheduleRows = options?.scheduleRows ?? schedule;
    const messages: string[] = [];
    const sourceIgnoreShiftKeys = new Set<string>([getShiftKey(fromDay, fromType)]);
    const sourceMessage = getPlacementConstraintMessage(sourceDoctorId, toDay, toType, {
      scheduleRows,
      ignoreShiftKeys: sourceIgnoreShiftKeys,
    });

    if (sourceMessage) {
      messages.push(formatConstraintForTooltip(sourceDoctorId, sourceMessage));
    }

    const targetRow = scheduleRows.find((row) => row.day === toDay);
    const targetDoctorId = targetRow ? getShiftDoctorIdFromRow(targetRow, toType) : null;

    if (targetDoctorId && targetDoctorId !== sourceDoctorId) {
      const targetIgnoreShiftKeys = new Set<string>([getShiftKey(toDay, toType)]);
      const targetMessage = getPlacementConstraintMessage(targetDoctorId, fromDay, fromType, {
        scheduleRows,
        ignoreShiftKeys: targetIgnoreShiftKeys,
      });

      if (targetMessage) {
        messages.push(formatConstraintForTooltip(targetDoctorId, targetMessage));
      }
    }

    if (messages.length === 0) return null;
    return Array.from(new Set(messages)).join("\n");
  };

  const clearDragState = () => {
    setDragSourceKey(null);
    setDraggingDoctorId(null);
    setHoverErrorState(null);
  };

  const handleDisabledDayDragOver = (event: DragEvent<HTMLDivElement>, day: number) => {
    if (!draggingDoctorId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "none";
    setHoverErrorState(getShiftKey(day, "day"), "平日の日直には配置できません");
  };

  const handleDisabledDayDragLeave = (day: number) => {
    const shiftKey = getShiftKey(day, "day");
    if (invalidHoverShiftKey === shiftKey) {
      setHoverErrorState(null);
    }
  };

  const handleShiftDragOver = (
    event: DragEvent<HTMLDivElement>,
    day: number,
    shiftType: ShiftType,
    locked: boolean,
    isHolidayLike: boolean
  ) => {
    if (!draggingDoctorId) return;

    const shiftKey = getShiftKey(day, shiftType);
    if (locked) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "none";
      setHoverErrorState(shiftKey, "ロック済みのため移動できません");
      return;
    }

    if (shiftType === "day" && !isHolidayLike) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "none";
      setHoverErrorState(shiftKey, "平日の日直には配置できません");
      return;
    }

    const sourcePayload = parseDragPayload(dragSourceKey);
    const constraintMessage = sourcePayload
      ? getSwapConstraintMessage(draggingDoctorId, sourcePayload.day, sourcePayload.shiftType, day, shiftType)
      : getPlacementConstraintMessage(draggingDoctorId, day, shiftType);

    event.preventDefault();
    if (constraintMessage) {
      event.dataTransfer.dropEffect = "none";
      setHoverErrorState(shiftKey, constraintMessage);
      return;
    }

    event.dataTransfer.dropEffect = "move";
    setHoverErrorState(null);
  };

  const handleShiftDragLeave = (day: number, shiftType: ShiftType) => {
    const shiftKey = getShiftKey(day, shiftType);
    if (invalidHoverShiftKey === shiftKey) {
      setHoverErrorState(null);
    }
  };

  const handleShiftDrop = (
    event: DragEvent<HTMLDivElement>,
    toDay: number,
    toType: ShiftType,
    locked: boolean,
    isHolidayLike: boolean
  ) => {
    event.preventDefault();

    if (locked) {
      setDragNotice("ロック済みのため移動できません");
      clearDragState();
      return;
    }

    if (toType === "day" && !isHolidayLike) {
      setDragNotice("平日の日直には配置できません");
      clearDragState();
      return;
    }

    const parsed = parseDragPayload(event.dataTransfer.getData("text/plain") || dragSourceKey);
    if (!parsed) {
      setDragNotice("ドラッグ情報の読み取りに失敗しました。もう一度お試しください。");
      clearDragState();
      return;
    }

    try {
      const doctorId = draggingDoctorId ?? getScheduleDoctorId(parsed.day, parsed.shiftType);
      const constraintMessage = getSwapConstraintMessage(doctorId, parsed.day, parsed.shiftType, toDay, toType);
      if (constraintMessage) {
        setDragNotice(constraintMessage);
        return;
      }

      moveOrSwapShift(parsed.day, parsed.shiftType, toDay, toType);
    } finally {
      clearDragState();
    }
  };

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

  const normalizeScheduleRows = (rows: ScheduleRow[]) =>
    rows.map((row) => ({
      ...row,
      day_shift: row.day_shift ?? null,
      night_shift: row.night_shift ?? null,
      is_sunhol: Boolean(row.is_sunhol) || isHolidayLikeDay(row.day).isHolidayLike,
    }));

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

  const moveOrSwapShift = (fromDay: number, fromType: ShiftType, toDay: number, toType: ShiftType) => {
    if (fromDay === toDay && fromType === toType) return;
    if (isShiftLocked(fromDay, fromType) || isShiftLocked(toDay, toType)) return;

    setSchedule((prev) => {
      const next = prev.map((row) => ({ ...row }));
      const fromRow = next.find((row) => row.day === fromDay);
      const toRow = next.find((row) => row.day === toDay);
      if (!fromRow || !toRow) return prev;

      const fromField = fromType === "day" ? "day_shift" : "night_shift";
      const toField = toType === "day" ? "day_shift" : "night_shift";
      const fromDoctorId = fromRow[fromField] ?? null;
      const toDoctorId = toRow[toField] ?? null;
      if (!fromDoctorId) return prev;

      const moveTargetConflict = getSwapConstraintMessage(fromDoctorId, fromDay, fromType, toDay, toType, {
        scheduleRows: next,
      });
      if (moveTargetConflict) {
        setDragNotice(moveTargetConflict);
        return prev;
      }

      fromRow[fromField] = toDoctorId;
      toRow[toField] = fromDoctorId;
      setDragNotice("");
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
  useEffect(() => {
    if (!dragNotice) return;

    const timeoutId = window.setTimeout(() => {
      setDragNotice("");
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [dragNotice]);

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
      setSchedule(normalizeScheduleRows((data.schedule ?? []) as ScheduleRow[]));
      setScores(data.scores);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "最適化に失敗しました");
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
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

  const daysInMonth = getDaysInMonth(year, month);

  const handleScoreMinChange = (value: number) => setScoreMin(value);
  const handleScoreMaxChange = (value: number) => setScoreMax(value);
  const handleYearChange = (value: number) => setYear(value);
  const handleMonthChange = (value: number) => setMonth(value);
  const handleSelectedDoctorChange = (doctorId: string) => setSelectedDoctorId(doctorId);
  const handlePrevMonthLastDayChange = (value: number) => setPrevMonthLastDay(value);

  const handleHolidayOverrideToggle = (ymd: string) => {
    setDisabledHolidaySetYear((prev) => {
      const next = new Set(prev);
      if (next.has(ymd)) next.delete(ymd);
      else next.add(ymd);
      return next;
    });
  };

  const handleMinScoreChange = (doctorId: string, value: string) => {
    setMinScoreMap({ ...minScoreMap, [doctorId]: parseFloat(value) });
  };

  const handleMaxScoreChange = (doctorId: string, value: string) => {
    setMaxScoreMap({ ...maxScoreMap, [doctorId]: parseFloat(value) });
  };

  const handleTargetScoreChange = (doctorId: string, value: string) => {
    setTargetScoreMap({ ...targetScoreMap, [doctorId]: parseFloat(value) });
  };

  const handleShiftDragStart = (
    event: DragEvent<HTMLElement>,
    day: number,
    shiftType: "day" | "night",
    doctorId: string | null | undefined
  ) => {
    const payload = JSON.stringify({ day, shiftType });
    event.dataTransfer.setData("text/plain", payload);
    event.dataTransfer.effectAllowed = "move";
    setDragSourceKey(payload);
    setDraggingDoctorId(doctorId ?? null);
    setHoverErrorState(null);
  };

  const scheduleColumns = useMemo(() => {
    if (schedule.length === 0) return [];
    const splitIndex = Math.ceil(schedule.length / 2);
    return [schedule.slice(0, splitIndex), schedule.slice(splitIndex)].filter((rows) => rows.length > 0);
  }, [schedule]);

  return (
    <div className="min-h-screen bg-gray-50 p-2 md:p-8 font-sans">
      <main className="w-full max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-3 md:p-6 xl:p-8">
        <h1 className="text-xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-8 border-b pb-4">🏥 当直表 自動生成ダッシュボード</h1>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(340px,0.98fr)_minmax(0,1.32fr)] lg:items-start mb-4 md:mb-6">
          <GenerationSettingsPanel
            isLoading={isLoading}
            isLoadingCustom={isLoadingCustom}
            customError={customError}
            scoreMin={scoreMin}
            scoreMax={scoreMax}
            objectiveWeights={objectiveWeights}
            weightChanges={weightChanges}
            isWeightsOpen={isWeightsOpen}
            year={year}
            month={month}
            numDoctors={numDoctors}
            activeDoctors={activeDoctors}
            holidayMap={holidayMap}
            holidayWorkdayOverrides={holidayWorkdayOverrides}
            daysInMonth={daysInMonth}
            selectedDoctorId={selectedDoctorId}
            unavailableMap={unavailableMap}
            fixedUnavailableWeekdaysMap={fixedUnavailableWeekdaysMap}
            pyWeekdays={pyWeekdays}
            pyWeekdaysJp={pyWeekdaysJp}
            prevMonthLastDay={prevMonthLastDay}
            prevMonthTailDays={prevMonthTailDays}
            prevMonthWorkedDaysMap={prevMonthWorkedDaysMap}
            onScoreMinChange={handleScoreMinChange}
            onScoreMaxChange={handleScoreMaxChange}
            onToggleWeights={() => setIsWeightsOpen((value) => !value)}
            onResetWeights={() => setObjectiveWeights(DEFAULT_OBJECTIVE_WEIGHTS)}
            onCloseWeights={() => setIsWeightsOpen(false)}
            onWeightChange={setWeight}
            onYearChange={handleYearChange}
            onMonthChange={handleMonthChange}
            isHolidayLikeDay={isHolidayLikeDay}
            onToggleHoliday={toggleHoliday}
            onToggleHolidayOverride={handleHolidayOverrideToggle}
            onSelectedDoctorChange={handleSelectedDoctorChange}
            onToggleAllUnavailable={toggleAllUnavailable}
            onToggleUnavailable={toggleUnavailable}
            onToggleFixedWeekday={toggleFixedWeekday}
            onPrevMonthLastDayChange={handlePrevMonthLastDayChange}
            onTogglePrevMonthWorkedDay={togglePrevMonthWorkedDay}
            onGenerate={handleGenerate}
          />

          <div className="relative min-w-0">
            {isLoading && (
              <div className="absolute inset-0 z-20 rounded-lg bg-white/70 backdrop-blur-[1px] flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl border border-blue-100 bg-white shadow-xl px-4 py-6 md:px-6">
                  <div className="flex flex-col items-center text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
                    <div className="text-base md:text-lg font-bold text-gray-800">当直表を生成中です</div>
                    <div className="mt-2 text-sm text-gray-500">AIが勤務条件をもとに候補を計算しています。</div>
                    <div className="mt-4 w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full w-1/2 bg-blue-500 animate-pulse rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DoctorSettingsPanel
              isBulkSavingDoctors={isBulkSavingDoctors}
              activeDoctors={activeDoctors}
              minScoreMap={minScoreMap}
              maxScoreMap={maxScoreMap}
              targetScoreMap={targetScoreMap}
              satPrevMap={satPrevMap}
              scoreMin={scoreMin}
              scoreMax={scoreMax}
              onSaveAllDoctorsSettings={saveAllDoctorsSettings}
              onMinScoreChange={handleMinScoreChange}
              onMaxScoreChange={handleMaxScoreChange}
              onTargetScoreChange={handleTargetScoreChange}
              onToggleSatPrev={toggleSatPrev}
            />

            <ScheduleBoard
              isLoading={isLoading}
              dragNotice={dragNotice}
              error={error}
              schedule={schedule}
              scheduleColumns={scheduleColumns}
              scores={scores}
              getDoctorName={getDoctorName}
              highlightedDoctorId={highlightedDoctorId}
              year={year}
              month={month}
              holidaySet={holidaySet}
              manualHolidaySetInMonth={manualHolidaySetInMonth}
              toYmd={toYmd}
              getWeekday={getWeekday}
              isHighlightedDoctorBlockedDay={isHighlightedDoctorBlockedDay}
              isShiftLocked={isShiftLocked}
              invalidHoverShiftKey={invalidHoverShiftKey}
              hoverErrorMessage={hoverErrorMessage}
              onHandleShiftDragOver={handleShiftDragOver}
              onHandleShiftDragLeave={handleShiftDragLeave}
              onHandleShiftDrop={handleShiftDrop}
              onHandleDisabledDayDragOver={handleDisabledDayDragOver}
              onHandleDisabledDayDragLeave={handleDisabledDayDragLeave}
              onShiftDragStart={handleShiftDragStart}
              onToggleHighlightedDoctor={toggleHighlightedDoctor}
              onClearDragState={clearDragState}
              onToggleShiftLock={toggleShiftLock}
              onDeleteMonthSchedule={handleDeleteMonthSchedule}
              isDeletingMonthSchedule={isDeletingMonthSchedule}
              onSaveToDB={handleSaveToDB}
              isSaving={isSaving}
              saveMessage={saveMessage}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
