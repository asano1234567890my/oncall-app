// src/app/components/MobileScheduleBoard.tsx — モバイル専用スケジュール表（コンパクト版）
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Lock, Trash2 } from "lucide-react";
import type { useOnCallCore } from "../hooks/useOnCallCore";
import type { DoctorScoreEntry, ShiftType } from "../types/dashboard";
import ScheduleValidationAlert from "./schedule/ScheduleValidationAlert";

type Props = { core: ReturnType<typeof useOnCallCore>; onOpenSettings?: () => void; onShowGuide?: () => void };

export default function MobileScheduleBoard({ core, onOpenSettings, onShowGuide }: Props) {
  const {
    schedule, scoreEntries, year, month,
    holidaySet, manualHolidaySetInMonth, toYmd, getWeekday, getDoctorName,
    highlightedDoctorId, selectedManualDoctorId, isEraseSelectionActive,
    isShiftLocked, isSwapMode, swapSource, isSwapSourceSelected, getSwapViolation, isOverrideMode,
    lockedShiftKeys, unavailableMap,
    handleShiftTap, handleSwapButtonPress, toggleHighlightedDoctor,
    selectManualDoctor, toggleEraseSelection, cancelSwapSelection,
    toggleShiftLock, toggleSwapMode, handleToggleOverrideMode,
    handleLockAll, handleUnlockAll, handleGenerateWithGuard,
    handleDeleteMonthSchedule, isDeletingMonthSchedule,
    handleSaveWithValidation, handleForceSaveToDB, handleDismissSaveValidation,
    isSaving, saveMessage, saveValidationMessages, isLoading, error,
  } = core;

  // ── 入れ替えフラッシュ ──
  const [swappedCells, setSwappedCells] = useState<Set<string>>(new Set());
  const swappedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashSwapped = useCallback((a: { day: number; st: ShiftType }, b: { day: number; st: ShiftType }) => {
    if (swappedTimer.current) clearTimeout(swappedTimer.current);
    setSwappedCells(new Set([`${a.day}-${a.st}`, `${b.day}-${b.st}`]));
    swappedTimer.current = setTimeout(() => setSwappedCells(new Set()), 1500);
  }, []);

  // handleSwapButtonPress をラップしてフラッシュを発火
  const handleSwapWithFlash = useCallback((day: number, st: ShiftType, locked: boolean, isHL: boolean) => {
    const src = swapSource;
    handleSwapButtonPress(day, st, locked, isHL);
    // swap完了判定: swapSourceがあり、別セルをタップした
    if (src && !(src.day === day && src.shiftType === st) && !locked) {
      flashSwapped({ day: src.day, st: src.shiftType }, { day, st });
    }
  }, [swapSource, handleSwapButtonPress, flashSwapped]);

  // handleShiftTap をラップ（常にハイライト + swap時フラッシュ）
  const handleTapWithHighlight = useCallback((day: number, st: ShiftType, docId: string | null | undefined, locked: boolean, isHL: boolean) => {
    // どのモードでも医師名タップでハイライト
    if (docId) toggleHighlightedDoctor(docId);

    if (isSwapMode && swapSource) {
      const src = swapSource;
      handleShiftTap(day, st, locked, isHL);
      if (!(src.day === day && src.shiftType === st) && !locked) {
        flashSwapped({ day: src.day, st: src.shiftType }, { day, st });
      }
    } else if (isSwapMode) {
      handleShiftTap(day, st, locked, isHL);
    }
  }, [isSwapMode, swapSource, handleShiftTap, flashSwapped, toggleHighlightedDoctor]);

  // ── ハイライト医師の不可日・不可曜日マップ（セル単位で target_shift 判定） ──
  // key: "YYYY-MM-DD", value: Set<"all"|"day"|"night">
  const highlightedUnavailMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    if (!highlightedDoctorId) return m;
    const add = (date: string, ts: string) => {
      let s = m.get(date);
      if (!s) { s = new Set(); m.set(date, s); }
      s.add(ts);
    };
    for (const e of (unavailableMap[highlightedDoctorId] ?? [])) {
      add(e.date, e.target_shift);
    }
    const fixedWeekdays = core.fixedUnavailableWeekdaysMap[highlightedDoctorId] ?? [];
    if (fixedWeekdays.length > 0) {
      for (let d = 1; d <= core.daysInMonth; d++) {
        const dt = new Date(year, month - 1, d);
        const pyWd = (dt.getDay() + 6) % 7;
        for (const fw of fixedWeekdays) {
          if ((fw.day_of_week ?? fw.weekday) === pyWd) {
            add(toYmd(year, month, d), fw.target_shift);
          }
        }
      }
    }
    return m;
  }, [highlightedDoctorId, unavailableMap, core.fixedUnavailableWeekdaysMap, core.daysInMonth, year, month, toYmd]);

  // セル単位の不可判定
  const isCellUnavail = (ymd: string, st: ShiftType) => {
    if (!highlightedDoctorId) return false;
    const s = highlightedUnavailMap.get(ymd);
    if (!s) return false;
    return s.has("all") || s.has(st);
  };
  const isRowUnavail = (ymd: string) => highlightedDoctorId && highlightedUnavailMap.has(ymd);

  const lockedCount = lockedShiftKeys.size;
  const fmt = (s: number | null) => (s === null ? "-" : s.toFixed(1));
  const stClass = (t: DoctorScoreEntry["tone"]) => t === "danger" ? "text-red-600" : t === "warn" ? "text-orange-500" : t === "good" ? "text-green-600" : "text-gray-700";

  const swapLabel = swapSource ? `${swapSource.day}日${swapSource.shiftType === "day" ? "日直" : "当直"} ${getDoctorName(swapSource.doctorId)}` : null;

  // セル描画
  const renderSlot = (day: number, st: ShiftType, docId: string | null | undefined, enabled: boolean, isHL: boolean, ymd: string) => {
    const locked = isShiftLocked(day, st);
    const swSel = isSwapSourceSelected(day, st);
    const isFlashing = swappedCells.has(`${day}-${st}`);
    const isDocHighlighted = Boolean(docId && highlightedDoctorId && docId === highlightedDoctorId);
    const cellUnavail = isCellUnavail(ymd, st);
    const violation = getSwapViolation(day, st);
    if (!enabled) return <td className={`px-1 py-1 text-center text-[10px] ${cellUnavail ? "bg-red-500/30" : "text-gray-300"}`}>{cellUnavail ? <span className="text-red-600 font-black">✕</span> : "-"}</td>;
    const bg = isFlashing ? "swap-flash" : swSel ? "bg-yellow-100" : violation ? "bg-red-50 ring-1 ring-inset ring-red-300" : cellUnavail ? "bg-red-500/30 ring-1 ring-inset ring-red-400" : isDocHighlighted ? "bg-blue-500/25 ring-1 ring-inset ring-blue-400" : locked ? "bg-amber-50" : "";
    return (
      <td className={`px-1 py-1 ${bg}`} title={violation ?? undefined}>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => handleTapWithHighlight(day, st, docId, locked, isHL)}
            className={`min-w-0 flex-1 truncate text-left text-[11px] font-bold ${
              violation ? "text-red-400" : isDocHighlighted ? "text-blue-700 font-black" : docId ? (st === "day" ? "text-orange-800" : "text-indigo-800") : "text-gray-400"
            }`}>
            {docId ? getDoctorName(docId) : "-"}
          </button>
          <button type="button" onClick={() => handleSwapWithFlash(day, st, locked, isHL)}
            className={`shrink-0 flex h-6 w-6 items-center justify-center rounded border text-[10px] font-bold ${
              swSel ? "border-yellow-400 bg-yellow-100 text-yellow-800" : violation ? "border-red-200 bg-red-50 text-red-400" : "border-gray-300 bg-white text-gray-500 active:bg-gray-100"
            }`}>⇄</button>
          <button type="button" onClick={() => toggleShiftLock(day, st)} disabled={!docId}
            className={`shrink-0 flex h-6 w-6 items-center justify-center rounded border disabled:opacity-20 ${
              locked ? "border-amber-400 bg-amber-100" : "border-gray-300 bg-white active:bg-gray-100"
            }`}>
            <Lock className={`h-3 w-3 ${locked ? "text-amber-600" : "text-gray-400"}`} />
          </button>
        </div>
        {violation && swapSource && (
          <div className="mt-0.5 text-[9px] leading-tight text-red-500 truncate" title={violation}>
            {violation.split("\n")[0]}
          </div>
        )}
      </td>
    );
  };

  if (!schedule.length) {
    return (
      <>
        {error && <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700">{error}</div>}
        {saveMessage && <div className="mb-2 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-bold text-green-800">{saveMessage}</div>}
      </>
    );
  }

  return (
    <div className="pb-32">
      {/* トースト */}
      {core.toastMessage && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-[100] w-[min(90vw,22rem)] -translate-x-1/2 -translate-y-1/2">
          <div className="rounded-xl bg-gray-900/90 px-4 py-3 text-center text-xs font-bold whitespace-pre-line text-white shadow-xl backdrop-blur">{core.toastMessage}</div>
        </div>
      )}

      {error && <div className="mb-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">{error}</div>}

      {/* ステータス（高さ固定でガタつき防止） */}
      <div className="mb-1 h-5 flex flex-wrap items-center gap-1 text-[10px] font-semibold overflow-hidden">
        {highlightedDoctorId && <span className="rounded bg-sky-50 border border-sky-200 px-1.5 py-0.5 text-sky-700">👁 {getDoctorName(highlightedDoctorId)} <button onClick={() => toggleHighlightedDoctor(null)} className="underline">×</button></span>}
        {selectedManualDoctorId && <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-emerald-700">配置: {getDoctorName(selectedManualDoctorId)}</span>}
        {isEraseSelectionActive && <span className="rounded bg-red-50 border border-red-200 px-1.5 py-0.5 text-red-600">削除モード</span>}
        {swapLabel && <span className="rounded bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 text-yellow-900">⇄元: {swapLabel} <button onClick={cancelSwapSelection} className="underline">×</button></span>}
        {isOverrideMode && <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-amber-800">強制配置</span>}
      </div>

      {/* シフト表（2列・最小幅確保→横スクロール） */}
      <div className="overflow-x-auto -mx-4 px-4">
      <div className="min-w-[540px] grid grid-cols-2 gap-x-1.5">
        {(() => {
          const mid = Math.ceil(schedule.length / 2);
          return [schedule.slice(0, mid), schedule.slice(mid)].map((col, ci) => (
            <table key={ci} className="w-full table-fixed select-none border-collapse text-[10px]">
              <thead>
                <tr className="bg-gray-100 text-[8px] text-gray-600">
                  <th className="w-5 border-b px-0.5 py-1">日</th>
                  <th className="w-4 border-b px-0 py-1">曜</th>
                  <th className="border-b bg-orange-50/60 px-0.5 py-1">日直</th>
                  <th className="border-b bg-indigo-50/60 px-0.5 py-1">当直</th>
                </tr>
              </thead>
              <tbody>
                {col.map((row) => {
                  const wd = getWeekday(year, month, row.day);
                  const isSun = wd === "日";
                  const isSat = wd === "土";
                  const ymd = toYmd(year, month, row.day);
                  const isHL = Boolean(row.is_sunhol ?? row.is_holiday) || isSun || holidaySet.has(ymd) || manualHolidaySetInMonth.has(ymd);
                  const rowUnavail = isRowUnavail(ymd);
                  const rowBg = rowUnavail ? "bg-red-200/40" : isHL ? "bg-red-50" : isSat ? "bg-blue-50/30" : "";
                  const dateC = rowUnavail ? "text-red-700 font-black" : isHL ? "text-red-600" : isSat ? "text-blue-700" : "text-gray-700";
                  const wdC = rowUnavail ? "text-red-600 font-black" : isHL ? "text-red-500" : isSat ? "text-blue-600" : "text-gray-500";
                  return (
                    <tr key={row.day} className={`border-b border-gray-100 ${rowBg}`}>
                      <td className={`px-0.5 py-px text-center font-bold ${dateC}`}>{row.day}</td>
                      <td className={`px-0 py-px text-center font-bold ${wdC}`}>{wd}</td>
                      {renderSlot(row.day, "day", row.day_shift, isHL, isHL, ymd)}
                      {renderSlot(row.day, "night", row.night_shift, true, isHL, ymd)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ));
        })()}
      </div>
      </div>

      {/* スコア＋保存 */}
      <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2">
        <div className="grid grid-cols-6 gap-0.5 text-[10px]">
          {scoreEntries.map((e) => (
            <div key={e.doctorId} className="flex items-center justify-between rounded bg-white px-1.5 py-0.5 border border-gray-100">
              <span className="truncate font-semibold text-gray-700 max-w-[4rem]">{getDoctorName(e.doctorId)}</span>
              <span className={`font-bold ${stClass(e.tone)}`}>{fmt(e.score)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2">
        <ScheduleValidationAlert messages={saveValidationMessages} onDismiss={handleDismissSaveValidation} onForceSave={handleForceSaveToDB} />
        <div className="mt-1 flex gap-1.5">
          <button type="button" onClick={() => { void core.handleSaveDraft(); }} disabled={core.isDraftSaving}
            className="flex-1 rounded-lg border border-green-600 py-2.5 text-xs font-bold text-green-700 transition hover:bg-green-50 disabled:opacity-60">
            {core.isDraftSaving ? "仮保存中..." : "仮保存"}
          </button>
          <button type="button" onClick={handleSaveWithValidation} disabled={isSaving}
            className="flex-1 rounded-lg bg-green-600 py-2.5 text-xs font-bold text-white shadow transition hover:bg-green-700 disabled:opacity-60">
            {isSaving ? "確定中..." : "確定保存"}
          </button>
        </div>
        {core.draftSavedAt && (
          <div className="mt-1 flex items-center justify-center gap-2 text-[10px] text-gray-500">
            <span>仮保存あり ({new Date(core.draftSavedAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })})</span>
            <button type="button" onClick={() => { void core.handleLoadDraft(); }} disabled={core.isDraftLoading}
              className="font-bold text-blue-600 underline hover:text-blue-800">{core.isDraftLoading ? "読込中..." : "読み込む"}</button>
          </div>
        )}
        {core.draftMessage && <div className="mt-1 text-center text-[10px] font-bold text-blue-700">{core.draftMessage}</div>}
        {saveMessage && <div className="mt-1 text-center text-[10px] font-bold text-green-800">{saveMessage}</div>}
      </div>

      {/* スティッキーツールバー */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 shadow-[0_-2px_6px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto max-w-lg px-2 py-1.5 space-y-1">
          {/* アクション */}
          <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
            <Btn label={isSwapMode ? "⇄ ON" : "⇄"} active={isSwapMode} onClick={toggleSwapMode} c="sky" />
            <Btn label="強制" active={isOverrideMode} onClick={handleToggleOverrideMode} c="amber" />
            <Btn label="全🔒" onClick={handleLockAll} c="amber" />
            <Btn label="全解除" disabled={lockedCount === 0} onClick={handleUnlockAll} />
            <Btn label={lockedCount > 0 ? "再生成" : "生成"} disabled={isLoading || isOverrideMode} onClick={handleGenerateWithGuard} c="blue" />
            <Btn label="全削除" disabled={isDeletingMonthSchedule} onClick={handleDeleteMonthSchedule} c="red" />
            <span className="ml-auto flex items-center gap-1">
              {onShowGuide && (
                <button type="button" onClick={onShowGuide}
                  className="rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">?</button>
              )}
              {onOpenSettings && (
                <button type="button" onClick={onOpenSettings}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-[10px] font-bold text-gray-600 active:bg-gray-100">
                  ⚙ 設定
                </button>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Btn({ label, active, disabled, onClick, c }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; c?: "sky"|"amber"|"blue"|"red" }) {
  const base = "rounded border px-1.5 py-1 transition disabled:opacity-30";
  const style = active
    ? { sky: "border-sky-400 bg-sky-100 text-sky-800", amber: "border-amber-400 bg-amber-100 text-amber-800", blue: "border-blue-400 bg-blue-100 text-blue-800", red: "border-red-400 bg-red-100 text-red-800" }[c ?? "sky"]
    : c === "red" ? "border-red-200 bg-red-50 text-red-700"
    : c === "blue" ? "border-blue-200 bg-blue-50 text-blue-700"
    : c === "amber" ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-gray-200 bg-white text-gray-600";
  return <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${style}`}>{label}</button>;
}
