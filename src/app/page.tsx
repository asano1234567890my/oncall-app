// src/app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { GenerationSettingsPanel, DoctorSettingsPanel } from "./components/SettingsPanel";
import ScheduleBoard from "./components/ScheduleBoard";
import { useCustomHolidays } from "./hooks/useCustomHolidays";
import { useHolidays } from "./hooks/useHolidays";
import { useScheduleApi } from "./hooks/useScheduleApi";
import { useScheduleDnd } from "./hooks/useScheduleDnd";
import { useRealtimeScores } from "./hooks/useRealtimeScores";
import {
  DEFAULT_OBJECTIVE_WEIGHTS,
  type Doctor,
  type ObjectiveWeights,
  type ScheduleRow,
} from "./types/dashboard";
import { getDefaultTargetMonth } from "./utils/dateUtils";

export default function DashboardPage() {
  const defaultTargetMonth = getDefaultTargetMonth();
  const [year, setYear] = useState<number>(defaultTargetMonth.year);
  const [month, setMonth] = useState<number>(defaultTargetMonth.month);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [holidays, setHolidays] = useState<number[]>([]);
  const [holidayWorkdayOverrides, setHolidayWorkdayOverrides] = useState<Set<string>>(() => new Set());
  const [scoreMin, setScoreMin] = useState<number>(0.5);
  const [scoreMax, setScoreMax] = useState<number>(4.5);
  const [objectiveWeights, setObjectiveWeights] = useState<ObjectiveWeights>(DEFAULT_OBJECTIVE_WEIGHTS);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [, setScores] = useState<Record<string, number | string>>({});
  const [isWeightsOpen, setIsWeightsOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [unavailableMap, setUnavailableMap] = useState<Record<string, number[]>>({});
  const [fixedUnavailableWeekdaysMap, setFixedUnavailableWeekdaysMap] = useState<Record<string, number[]>>({});
  const [prevMonthWorkedDaysMap, setPrevMonthWorkedDaysMap] = useState<Record<string, number[]>>({});
  const [minScoreMap, setMinScoreMap] = useState<Record<string, number>>({});
  const [maxScoreMap, setMaxScoreMap] = useState<Record<string, number>>({});
  const [targetScoreMap, setTargetScoreMap] = useState<Record<string, number>>({});
  const [satPrevMap, setSatPrevMap] = useState<Record<string, boolean>>({});

  const calcPrevMonthLastDay = (y: number, m: number) => new Date(y, m - 1, 0).getDate();
  const [prevMonthLastDay, setPrevMonthLastDay] = useState<number>(() => calcPrevMonthLastDay(year, month));

  const setWeight = (key: keyof ObjectiveWeights, value: number) => {
    const nextValue = Number.isFinite(value) ? Math.round(value) : 0;
    setObjectiveWeights((prev) => ({ ...prev, [key]: nextValue }));
  };

  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const weekdaysJp = ["日", "月", "火", "水", "木", "金", "土"];
  const pyWeekdaysJp = ["月", "火", "水", "木", "金", "土", "日"];
  const pyWeekdays = [0, 1, 2, 3, 4, 5, 6];
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const toYmd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
  const getWeekday = (y: number, m: number, day: number) => weekdaysJp[new Date(y, m - 1, day).getDay()];

  const manualHolidayStorageKey = (y: number, m: number) => `oncall.holidays.manual.${y}-${pad2(m)}`;
  const overrideHolidayStorageKey = (y: number) => `oncall.holidays.override.${y}`;

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(manualHolidayStorageKey(year, month));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setHolidays(parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value)));
        }
      } else {
        setHolidays([]);
      }
    } catch {
      // no-op
    }

    try {
      const raw = window.localStorage.getItem(overrideHolidayStorageKey(year));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const prefix = `${year}-`;
          setHolidayWorkdayOverrides(new Set(parsed.map(String).filter((value) => value.startsWith(prefix))));
        }
      } else {
        setHolidayWorkdayOverrides(new Set());
      }
    } catch {
      // no-op
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(manualHolidayStorageKey(year, month), JSON.stringify(holidays));
    } catch {
      // no-op
    }
  }, [holidays, year, month]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(overrideHolidayStorageKey(year), JSON.stringify(Array.from(holidayWorkdayOverrides)));
    } catch {
      // no-op
    }
  }, [holidayWorkdayOverrides, year]);

  const doctorNameById = useMemo(() => {
    const map: Record<string, string> = {};
    doctors.forEach((doctor) => {
      map[doctor.id] = doctor.name;
    });
    return map;
  }, [doctors]);

  const getDoctorName = (doctorId: string | null | undefined) => {
    if (!doctorId) return "-";
    return doctorNameById[doctorId] ?? "不明";
  };

  const activeDoctors = useMemo(() => doctors.filter((doctor) => doctor.is_active !== false), [doctors]);
  const activeDoctorIds = useMemo(() => activeDoctors.map((doctor) => doctor.id), [activeDoctors]);
  const numDoctors = activeDoctors.length;

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

  const { holidayMap, holidaySet } = useHolidays(year);
  const {
    manualSet: manualHolidaySetYear,
    setManualSet: setManualHolidaySetYear,
    disabledSet: disabledHolidaySetYear,
    setDisabledSet: setDisabledHolidaySetYear,
    isLoadingCustom,
    customError,
  } = useCustomHolidays(year);

  useEffect(() => {
    setHolidayWorkdayOverrides(new Set(disabledHolidaySetYear));
  }, [disabledHolidaySetYear]);

  useEffect(() => {
    const prefix = `${year}-${pad2(month)}-`;
    const nextDays = Array.from(
      new Set(
        Array.from(manualHolidaySetYear)
          .filter((ymd) => ymd.startsWith(prefix))
          .map((ymd) => Number(ymd.slice(-2)))
          .filter((day) => Number.isFinite(day))
      )
    ).sort((a, b) => a - b);

    setHolidays((prev) => {
      if (prev.length === nextDays.length && prev.every((value, index) => value === nextDays[index])) {
        return prev;
      }
      return nextDays;
    });
  }, [manualHolidaySetYear, year, month]);

  const autoHolidayDaysInMonth = useMemo(() => {
    const prefix = `${year}-${pad2(month)}-`;
    const days: number[] = [];

    for (const ymd of holidaySet) {
      if (!ymd.startsWith(prefix)) continue;
      const day = Number(ymd.slice(-2));
      if (Number.isFinite(day)) days.push(day);
    }

    return Array.from(new Set(days)).sort((a, b) => a - b);
  }, [holidaySet, year, month, pad2]);

  const manualHolidaySetInMonth = useMemo(() => {
    const set = new Set<string>();
    holidays.forEach((day) => {
      set.add(toYmd(year, month, day));
    });
    return set;
  }, [holidays, year, month]);

  const isHolidayLikeDay = (day: number) => {
    const ymd = toYmd(year, month, day);
    const wd = getWeekday(year, month, day);
    const isSun = wd === "日";
    const isAutoHoliday = holidaySet.has(ymd);
    const isManualHoliday = manualHolidaySetInMonth.has(ymd);
    return { ymd, wd, isSun, isAutoHoliday, isManualHoliday, isHolidayLike: isSun || isAutoHoliday || isManualHoliday };
  };

  const { scoreEntries } = useRealtimeScores({
    activeDoctors,
    schedule,
    year,
    month,
    holidaySet,
    manualHolidaySetInMonth,
    holidayWorkdayOverrides,
    scoreMin,
    scoreMax,
    minScoreMap,
    maxScoreMap,
    targetScoreMap,
  });


  const {
    toastMessage,
    dragSourceType,
    highlightedDoctorId,
    invalidHoverShiftKey,
    lockedShiftKeys,
    isShiftLocked,
    isSwapMode,
    swapSource,
    isSwapSourceSelected,
    isHighlightedDoctorBlockedDay,
    toggleHighlightedDoctor,
    clearDragState,
    toggleSwapMode,
    handleShiftTap,
    handleDisabledDayDragOver,
    handleDisabledDayDragLeave,
    handleShiftDragOver,
    handleShiftDragLeave,
    handleShiftDrop,
    handleShiftDragStart,
    handleDoctorListDragStart,
    handleTrashDragOver,
    handleTrashDrop,
    toggleShiftLock,
    handleLockAll,
    handleUnlockAll,
    buildLockedShiftsPayload,
  } = useScheduleDnd({
    schedule,
    setSchedule,
    year,
    month,
    prevMonthLastDay,
    unavailableMap,
    fixedUnavailableWeekdaysMap,
    prevMonthWorkedDaysMap,
    getDoctorName,
    getWeekday,
    isHolidayLikeDay,
    isActiveDoctorId,
  });

  const {
    error,
    isLoading,
    isSaving,
    isDeletingMonthSchedule,
    isBulkSavingDoctors,
    saveMessage,
    saveAllDoctorsSettings,
    handleDeleteMonthSchedule,
    handleGenerate,
    handleSaveToDB,
  } = useScheduleApi({
    year,
    month,
    activeDoctors,
    holidays,
    autoHolidayDaysInMonth,
    holidayWorkdayOverrides,
    prevMonthLastDay,
    scoreMin,
    scoreMax,
    objectiveWeights,
    unavailableMap,
    fixedUnavailableWeekdaysMap,
    prevMonthWorkedDaysMap,
    minScoreMap,
    maxScoreMap,
    targetScoreMap,
    satPrevMap,
    schedule,
    setSchedule,
    setScores,
    setDoctors,
    setSelectedDoctorId,
    setUnavailableMap,
    setFixedUnavailableWeekdaysMap,
    setMinScoreMap,
    setMaxScoreMap,
    setTargetScoreMap,
    toYmd,
    getWeekday,
    isHolidayLikeDay,
    filterRecordByActiveDoctors,
    buildLockedShiftsPayload,
    onResetLocks: handleUnlockAll,
  });

  useEffect(() => {
    if (activeDoctors.length === 0) {
      setSelectedDoctorId("");
      return;
    }
    if (!selectedDoctorId || !activeDoctors.some((doctor) => doctor.id === selectedDoctorId)) {
      setSelectedDoctorId(activeDoctors[0]?.id || "");
    }
  }, [activeDoctors, selectedDoctorId]);

  useEffect(() => {
    setPrevMonthLastDay(calcPrevMonthLastDay(year, month));
    setPrevMonthWorkedDaysMap({});
  }, [year, month]);

  const toggleHoliday = (day: number) => {
    const ymd = toYmd(year, month, day);
    if (getWeekday(year, month, day) === "日") return;

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
      const nextDays = currentDays.includes(day) ? currentDays.filter((value) => value !== day) : [...currentDays, day].sort((a, b) => a - b);
      return { ...prev, [doctorId]: nextDays };
    });
  };

  const toggleAllUnavailable = () => {
    if (!selectedDoctorId) return;

    setUnavailableMap((prev) => {
      const currentDays = prev[selectedDoctorId] || [];
      const nextDays = currentDays.length > 0 ? [] : Array.from({ length: getDaysInMonth(year, month) }, (_, index) => index + 1);
      return { ...prev, [selectedDoctorId]: nextDays };
    });
  };

  const toggleFixedWeekday = (doctorId: string, weekdayPy: number) => {
    if (!doctorId) return;
    setFixedUnavailableWeekdaysMap((prev) => {
      const current = prev[doctorId] || [];
      const next = current.includes(weekdayPy) ? current.filter((value) => value !== weekdayPy) : [...current, weekdayPy].sort((a, b) => a - b);
      return { ...prev, [doctorId]: next };
    });
  };

  const togglePrevMonthWorkedDay = (doctorId: string, prevDay: number) => {
    if (!doctorId) return;
    setPrevMonthWorkedDaysMap((prev) => {
      const current = prev[doctorId] || [];
      const next = current.includes(prevDay) ? current.filter((value) => value !== prevDay) : [...current, prevDay].sort((a, b) => a - b);
      return { ...prev, [doctorId]: next };
    });
  };

  const toggleSatPrev = (doctorId: string) => {
    if (!doctorId) return;
    setSatPrevMap((prev) => ({ ...prev, [doctorId]: !prev[doctorId] }));
  };

  const weightChanges = useMemo(() => {
    const keys = Object.keys(DEFAULT_OBJECTIVE_WEIGHTS) as (keyof ObjectiveWeights)[];
    const changed = keys
      .map((key) => ({ key, base: DEFAULT_OBJECTIVE_WEIGHTS[key], now: objectiveWeights[key] }))
      .filter((item) => item.base !== item.now);

    return {
      isDefault: changed.length === 0,
      changedCount: changed.length,
      top: changed.slice(0, 3).map((item) => `${String(item.key)}:${item.now}`),
    };
  }, [objectiveWeights]);

  const daysInMonth = getDaysInMonth(year, month);
  const prevMonthTailDays = useMemo(() => {
    const start = Math.max(1, prevMonthLastDay - 3);
    const days: number[] = [];
    for (let day = start; day <= prevMonthLastDay; day++) days.push(day);
    return days;
  }, [prevMonthLastDay]);

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

  const scheduleColumns = useMemo(() => {
    if (schedule.length === 0) return [];
    const splitIndex = Math.ceil(schedule.length / 2);
    return [schedule.slice(0, splitIndex), schedule.slice(splitIndex)].filter((rows) => rows.length > 0);
  }, [schedule]);

  return (
    <div className="min-h-screen bg-gray-50 p-2 md:p-8 font-sans">
      <main className="mx-auto w-full max-w-7xl rounded-xl bg-white p-3 shadow-lg md:p-6 xl:p-8">
        <h1 className="mb-4 border-b pb-4 text-xl font-bold text-gray-800 md:mb-8 md:text-3xl">🏥 当直表 自動生成ダッシュボード</h1>

        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(340px,0.98fr)_minmax(0,1.32fr)] lg:items-start md:mb-6">
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
            onScoreMinChange={setScoreMin}
            onScoreMaxChange={setScoreMax}
            onToggleWeights={() => setIsWeightsOpen((prev) => !prev)}
            onResetWeights={() => setObjectiveWeights(DEFAULT_OBJECTIVE_WEIGHTS)}
            onCloseWeights={() => setIsWeightsOpen(false)}
            onWeightChange={setWeight}
            onYearChange={setYear}
            onMonthChange={setMonth}
            isHolidayLikeDay={isHolidayLikeDay}
            onToggleHoliday={toggleHoliday}
            onToggleHolidayOverride={handleHolidayOverrideToggle}
            onSelectedDoctorChange={setSelectedDoctorId}
            onToggleAllUnavailable={toggleAllUnavailable}
            onToggleUnavailable={toggleUnavailable}
            onToggleFixedWeekday={toggleFixedWeekday}
            onPrevMonthLastDayChange={setPrevMonthLastDay}
            onTogglePrevMonthWorkedDay={togglePrevMonthWorkedDay}
            onGenerate={handleGenerate}
          />

          <div className="relative min-w-0">
            {isLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-white/70 p-4 backdrop-blur-[1px]">
                <div className="w-full max-w-md rounded-2xl border border-blue-100 bg-white px-4 py-6 shadow-xl md:px-6">
                  <div className="flex flex-col items-center text-center">
                    <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-600" />
                    <div className="text-base font-bold text-gray-800 md:text-lg">当直表を生成中です</div>
                    <div className="mt-2 text-sm text-gray-500">AIが勤務条件をもとに候補を計算しています。</div>
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-500" />
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
              toastMessage={toastMessage}
              dragSourceType={dragSourceType}
              error={error}
              schedule={schedule}
              scheduleColumns={scheduleColumns}
              scoreEntries={scoreEntries}
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
              isSwapMode={isSwapMode}
              swapSource={swapSource}
              isSwapSourceSelected={isSwapSourceSelected}
              onHandleShiftDragOver={handleShiftDragOver}
              onHandleShiftDragLeave={handleShiftDragLeave}
              onHandleShiftDrop={handleShiftDrop}
              onHandleDisabledDayDragOver={handleDisabledDayDragOver}
              onHandleDisabledDayDragLeave={handleDisabledDayDragLeave}
              onShiftDragStart={handleShiftDragStart}
              onDoctorListDragStart={handleDoctorListDragStart}
              onShiftTap={handleShiftTap}
              onToggleHighlightedDoctor={toggleHighlightedDoctor}
              onClearDragState={clearDragState}
              onToggleShiftLock={toggleShiftLock}
              onToggleSwapMode={toggleSwapMode}
              onLockAll={handleLockAll}
              onUnlockAll={handleUnlockAll}
              onTrashDragOver={handleTrashDragOver}
              onTrashDrop={handleTrashDrop}
              lockedShiftCount={lockedShiftKeys.size}
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
