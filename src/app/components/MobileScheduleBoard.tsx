// src/app/components/MobileScheduleBoard.tsx — モバイル専用スケジュール表（タップ→ボトムシート方式）
"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2, Lock, Shield, Sparkles } from "lucide-react";
import type { useOnCallCore } from "../hooks/useOnCallCore";
import type { DoctorScoreEntry, ShiftType } from "../types/dashboard";
import { getShiftKey } from "../hooks/useScheduleConstraints";
import MobileActionSheet from "./MobileActionSheet";
import ScheduleValidationAlert from "./schedule/ScheduleValidationAlert";

type Props = { core: ReturnType<typeof useOnCallCore>; onOpenSettings?: () => void; onShowGuide?: () => void };

type SheetTarget = { day: number; shiftType: ShiftType } | null;

export default function MobileScheduleBoard({ core, onOpenSettings, onShowGuide }: Props) {
  const {
    schedule, scoreEntries, year, month,
    holidaySet, manualHolidaySetInMonth, toYmd, getWeekday, getDoctorName,
    activeDoctors,
    isShiftLocked, swapSource, isOverrideMode,
    lockedShiftKeys,
    toggleShiftLock, handleToggleOverrideMode,
    handleLockAll, handleUnlockAll, handleGenerateWithGuard,
    handleDeleteMonthSchedule, isDeletingMonthSchedule,
    handleSaveWithValidation, handleForceSaveToDB, handleDismissSaveValidation,
    isSaving, saveMessage, saveValidationMessages, isLoading, error, diagnostics,
    isDiagnosing, diagnoseResult, handleDiagnose,
    placeDoctorInShift, removeDoctorFromShift, startSwapFrom, executeSwapTo,
    cancelSwapSelection, getPlacementConstraintMessage, getSwapViolation,
    highlightedDoctorId, toggleHighlightedDoctor,
    getHighlightedViolation,
    changedShiftKeys,
  } = core;

  const [sheetTarget, setSheetTarget] = useState<SheetTarget>(null);

  // --- Cell tap handler ---
  // 1st tap: highlight doctor (show all assignments + constraint violations)
  // 2nd tap on same highlighted cell: open action sheet
  const handleCellTap = useCallback((day: number, shiftType: ShiftType) => {
    // If in swap mode (source selected), execute swap
    if (swapSource) {
      executeSwapTo(day, shiftType);
      return;
    }

    // Find the doctor in this cell
    const row = schedule.find((r) => r.day === day);
    const doctorId = row ? (shiftType === "day" ? row.day_shift : row.night_shift) : null;

    // If this cell's doctor is already highlighted → open action sheet
    if (doctorId && doctorId === highlightedDoctorId) {
      setSheetTarget({ day, shiftType });
      return;
    }

    // If empty cell is tapped → open action sheet directly (to assign a doctor)
    if (!doctorId) {
      setSheetTarget({ day, shiftType });
      return;
    }

    // Otherwise → highlight this doctor (1st tap)
    toggleHighlightedDoctor(doctorId, day, shiftType);
  }, [swapSource, executeSwapTo, schedule, highlightedDoctorId, toggleHighlightedDoctor]);

  // --- Action sheet callbacks ---
  const sheetRow = sheetTarget ? schedule.find((r) => r.day === sheetTarget.day) : null;
  const sheetDoctorId = sheetTarget && sheetRow
    ? (sheetTarget.shiftType === "day" ? sheetRow.day_shift : sheetRow.night_shift) ?? null
    : null;
  const sheetIsLocked = sheetTarget ? isShiftLocked(sheetTarget.day, sheetTarget.shiftType) : false;
  const sheetIsHL = sheetTarget ? (() => {
    const ymd = toYmd(year, month, sheetTarget.day);
    const wd = getWeekday(year, month, sheetTarget.day);
    return wd === "日" || holidaySet.has(ymd) || manualHolidaySetInMonth.has(ymd);
  })() : false;

  // Build doctor constraint info for the action sheet
  const doctorOptions = useMemo(() => {
    if (!sheetTarget) return [];
    const { day, shiftType } = sheetTarget;
    const ignoreKeys = new Set([getShiftKey(day, shiftType)]);
    return activeDoctors.map((doc) => {
      const entry = scoreEntries.find((e) => e.doctorId === doc.id);
      const msg = getPlacementConstraintMessage(doc.id, day, shiftType, { ignoreShiftKeys: ignoreKeys });
      return {
        doctorId: doc.id,
        name: doc.name,
        score: entry?.score ?? 0,
        target: entry?.target ?? null,
        tone: (entry?.tone ?? "default") as DoctorScoreEntry["tone"],
        constraintMessage: msg,
      };
    });
  }, [sheetTarget, activeDoctors, scoreEntries, getPlacementConstraintMessage]);

  const handleSheetAssign = useCallback((doctorId: string) => {
    if (!sheetTarget) return;
    placeDoctorInShift(sheetTarget.day, sheetTarget.shiftType, doctorId);
    setSheetTarget(null);
  }, [sheetTarget, placeDoctorInShift]);

  const handleSheetClear = useCallback(() => {
    if (!sheetTarget) return;
    removeDoctorFromShift(sheetTarget.day, sheetTarget.shiftType);
    setSheetTarget(null);
  }, [sheetTarget, removeDoctorFromShift]);

  const handleSheetSwap = useCallback(() => {
    if (!sheetTarget) return;
    startSwapFrom(sheetTarget.day, sheetTarget.shiftType);
    setSheetTarget(null);
  }, [sheetTarget, startSwapFrom]);

  const handleSheetToggleLock = useCallback(() => {
    if (!sheetTarget) return;
    toggleShiftLock(sheetTarget.day, sheetTarget.shiftType);
  }, [sheetTarget, toggleShiftLock]);

  const handleSheetClose = useCallback(() => {
    setSheetTarget(null);
    toggleHighlightedDoctor(null);
  }, [toggleHighlightedDoctor]);

  // --- Score display ---
  const fmt = (s: number | null) => (s === null ? "--" : s.toFixed(1));
  const stClass = (t: DoctorScoreEntry["tone"]) =>
    t === "danger" ? "text-red-600" : t === "warn" ? "text-orange-500" : t === "good" ? "text-green-600" : "text-gray-700";

  const lockedCount = lockedShiftKeys.size;
  const swapLabel = swapSource
    ? `${swapSource.day}日${swapSource.shiftType === "day" ? "日直" : "当直"} ${getDoctorName(swapSource.doctorId)}`
    : null;

  // Shared diagnose button + result display
  const diagnoseUI = (
    <>
      {!diagnostics?.pre_check_errors?.length && handleDiagnose && !diagnoseResult && error && (
        <button
          type="button"
          onClick={handleDiagnose}
          disabled={isDiagnosing}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition active:bg-blue-100 disabled:opacity-50"
        >
          {isDiagnosing ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />AIが解析中...</>
          ) : (
            <><Sparkles className="h-3.5 w-3.5" />どうすれば解けるかAIに検討させる</>
          )}
        </button>
      )}
      {diagnoseResult && (
        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <p className="mb-1 font-bold flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-blue-600" />AI制約診断の結果</p>
          {diagnoseResult.specific_violations.map((v, i) => (
            <p key={i} className="ml-3 mt-0.5">・{v}</p>
          ))}
          {diagnoseResult.human_insights.length > 0 && (
            <div className="mt-2 border-t border-blue-200 pt-1.5">
              <p className="font-semibold text-blue-700">気づき</p>
              {diagnoseResult.human_insights.map((h, i) => (
                <p key={i} className="ml-3 mt-0.5 text-blue-800">・{h}</p>
              ))}
            </div>
          )}
          {diagnoseResult.ai_explanation && (
            <div className="mt-2 border-t border-blue-200 pt-1.5">
              <p className="font-semibold text-blue-700">AIからの提案</p>
              <p className="ml-3 mt-0.5 whitespace-pre-wrap text-blue-800">{diagnoseResult.ai_explanation}</p>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (!schedule.length) {
    return (
      <>
        {error && (
          <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <p className="font-bold">{error}</p>
            {diagnostics?.pre_check_errors?.map((d, i) => (
              <div key={i} className="mt-1.5 pl-2 border-l-2 border-red-300">
                <p className="font-semibold">{d.name_ja}</p>
                {d.current_value && <p className="text-red-600">{d.current_value}</p>}
                {d.suggestion_ja && <p className="text-red-500">{d.suggestion_ja}</p>}
              </div>
            ))}
            {diagnoseUI}
          </div>
        )}
        {!error && diagnoseResult && diagnoseUI}
        {saveMessage && <div className="mb-2 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-800">{saveMessage}</div>}
      </>
    );
  }

  return (
    <div className="pb-28">
      {/* Toast */}
      {core.toastMessage && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-[100] w-[min(90vw,22rem)] -translate-x-1/2 -translate-y-1/2">
          <div className="rounded-xl bg-gray-900/90 px-4 py-3 text-center text-sm font-bold whitespace-pre-line text-white shadow-xl backdrop-blur">{core.toastMessage}</div>
        </div>
      )}

      {error && (
        <div className="mb-1 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          <p className="font-bold">{error}</p>
          {diagnostics?.pre_check_errors?.map((d, i) => (
            <div key={i} className="mt-1 pl-2 border-l-2 border-red-300">
              <p className="font-semibold">{d.name_ja}</p>
              {d.current_value && <p className="text-red-600">{d.current_value}</p>}
              {d.suggestion_ja && <p className="text-red-500">{d.suggestion_ja}</p>}
            </div>
          ))}
          {diagnoseUI}
        </div>
      )}
      {!error && diagnoseResult && diagnoseUI}

      {/* Swap mode banner — fixed height to prevent layout shift */}
      <div className="mb-1 h-8 flex items-center overflow-hidden">
        {swapLabel && (
          <div className="flex w-full items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1">
            <div className="truncate text-[11px] font-bold text-violet-800">
              &#8644; 入替え先を選択: <span className="text-violet-600">{swapLabel}</span>
            </div>
            <button type="button" onClick={cancelSwapSelection} className="shrink-0 ml-2 text-[11px] font-bold text-violet-600 hover:text-violet-800">
              &#x2715;
            </button>
          </div>
        )}
      </div>

      {/* Schedule table — 2-column (前半/後半), each with 3 cols (date | day | night) */}
      <div className="-mx-4 px-4">
        <div className="grid grid-cols-2 items-start gap-x-1">
          {(() => {
            const mid = schedule.length <= 28 ? 14 : 15;
            return [schedule.slice(0, mid), schedule.slice(mid)].map((col, ci) => (
              <table key={ci} className="w-full table-fixed select-none border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-[11px] text-gray-600">
                    <th className="w-[44px] border-b px-1 py-1.5 text-left">日</th>
                    <th className="border-b bg-orange-50/60 px-1 py-1.5 text-center">日直</th>
                    <th className="border-b bg-indigo-50/60 px-1 py-1.5 text-center">当直</th>
                  </tr>
                </thead>
                <tbody>
                  {col.map((row) => {
                    const wd = getWeekday(year, month, row.day);
                    const isSun = wd === "日";
                    const isSat = wd === "土";
                    const ymd = toYmd(year, month, row.day);
                    const isHL = Boolean(row.is_sunhol ?? row.is_holiday) || isSun || holidaySet.has(ymd) || manualHolidaySetInMonth.has(ymd);
                    const rowBg = isHL ? "bg-red-50/50" : isSat ? "bg-blue-50/30" : "";
                    const dateC = isHL ? "text-red-600" : isSat ? "text-blue-700" : "text-gray-700";
                    const wdC = isHL ? "text-red-500" : isSat ? "text-blue-600" : "text-gray-500";

                    return (
                      <tr key={row.day} className={`border-b border-gray-100 ${rowBg}`}>
                        <td className="whitespace-nowrap px-1 py-1">
                          <span className={`text-xs font-bold ${dateC}`}>{row.day}</span>
                          <span className={`ml-0.5 text-[11px] font-bold ${wdC}`}>{wd}</span>
                        </td>
                        {renderCell(row.day, "day", row.day_shift, isHL, handleCellTap, getDoctorName, isShiftLocked, highlightedDoctorId, swapSource, getSwapViolation, getHighlightedViolation, changedShiftKeys)}
                        {renderCell(row.day, "night", row.night_shift, true, handleCellTap, getDoctorName, isShiftLocked, highlightedDoctorId, swapSource, getSwapViolation, getHighlightedViolation, changedShiftKeys)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ));
          })()}
        </div>
      </div>

      {/* Score summary */}
      <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-1.5">
        <div className="grid grid-cols-4 gap-1 text-[10px]">
          {scoreEntries.map((e) => (
            <div key={e.doctorId}
              onClick={() => toggleHighlightedDoctor(e.doctorId)}
              className={`flex cursor-pointer items-center justify-between rounded px-1.5 py-0.5 border transition ${
                highlightedDoctorId === e.doctorId
                  ? "border-blue-400 bg-blue-50 ring-1 ring-blue-300"
                  : "border-gray-100 bg-white active:bg-gray-50"
              }`}>
              <span className="truncate font-semibold text-gray-700 max-w-[3.5rem]">{getDoctorName(e.doctorId)}</span>
              <span className={`shrink-0 font-bold ${stClass(e.tone)}`}>{fmt(e.score)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Save area */}
      <div className="mt-3">
        <ScheduleValidationAlert messages={saveValidationMessages} onDismiss={handleDismissSaveValidation} onForceSave={handleForceSaveToDB} />
        <div className="mt-1.5 flex gap-2">
          <button type="button" onClick={() => { void core.handleSaveDraft(); }} disabled={core.isDraftSaving}
            className="flex-1 rounded-xl border border-green-600 py-3 text-sm font-bold text-green-700 transition hover:bg-green-50 disabled:opacity-60">
            {core.isDraftSaving ? "仮保存中..." : "仮保存"}
          </button>
          <button type="button" onClick={handleSaveWithValidation} disabled={isSaving}
            className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow transition hover:bg-green-700 disabled:opacity-60">
            {isSaving ? "確定中..." : "確定保存"}
          </button>
        </div>
        {core.draftSavedAt && (
          <div className="mt-1.5 flex items-center justify-center gap-2 text-xs text-gray-500">
            <span>仮保存あり ({new Date(core.draftSavedAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })})</span>
            <button type="button" onClick={() => { void core.handleLoadDraft(); }} disabled={core.isDraftLoading}
              className="font-bold text-blue-600 underline hover:text-blue-800">{core.isDraftLoading ? "読込中..." : "読み込む"}</button>
          </div>
        )}
        {core.draftMessage && <div className="mt-1 text-center text-xs font-bold text-blue-700">{core.draftMessage}</div>}
        {saveMessage && <div className="mt-1 text-center text-xs font-bold text-green-800">{saveMessage}</div>}
      </div>

      {/* Sticky bottom toolbar — 4 buttons only */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 shadow-[0_-2px_6px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-3 py-2">
          <button type="button" onClick={handleGenerateWithGuard} disabled={isLoading || isOverrideMode}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700 disabled:opacity-50">
            {isLoading ? "生成中..." : lockedCount > 0 ? "再生成" : "生成"}
          </button>
          <button type="button" onClick={handleToggleOverrideMode}
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-2.5 text-xs font-bold transition ${
              isOverrideMode ? "border-amber-300 bg-amber-100 text-amber-800" : "border-gray-200 bg-white text-gray-500 active:bg-gray-100"
            }`}>
            <Shield className="h-3.5 w-3.5" /> 強制
          </button>
          <div className="flex-1" />
          {onShowGuide && (
            <button type="button" onClick={onShowGuide}
              className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-400 hover:bg-gray-50">?</button>
          )}
          {onOpenSettings && (
            <button type="button" onClick={onOpenSettings}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-bold text-gray-600 transition active:bg-gray-100">
              設定
            </button>
          )}
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </div>

      {/* Action Sheet */}
      <MobileActionSheet
        isOpen={sheetTarget !== null}
        day={sheetTarget?.day ?? 0}
        shiftType={sheetTarget?.shiftType ?? "night"}
        currentDoctorId={sheetDoctorId}
        currentDoctorName={sheetDoctorId ? getDoctorName(sheetDoctorId) : ""}
        isLocked={sheetIsLocked}
        isHolidayLike={sheetIsHL}
        month={month}
        doctorOptions={doctorOptions}
        onAssign={handleSheetAssign}
        onClear={handleSheetClear}
        onSwap={handleSheetSwap}
        onToggleLock={handleSheetToggleLock}
        onClose={handleSheetClose}
      />
    </div>
  );
}

// --- Cell renderer ---

function renderCell(
  day: number,
  shiftType: ShiftType,
  doctorId: string | null | undefined,
  enabled: boolean,
  onTap: (day: number, shiftType: ShiftType) => void,
  getDoctorName: (id: string | null | undefined) => string,
  isShiftLocked: (day: number, st: ShiftType) => boolean,
  highlightedDoctorId: string | null,
  swapSource: { day: number; shiftType: ShiftType; doctorId: string } | null,
  getSwapViolation: (day: number, st: ShiftType) => string | null,
  getHighlightedViolation: (day: number, st: ShiftType) => string | null,
  changedShiftKeys?: Set<string>,
) {
  const locked = isShiftLocked(day, shiftType);
  const isDocHighlighted = Boolean(doctorId && highlightedDoctorId && doctorId === highlightedDoctorId);
  const isSwapSource = swapSource?.day === day && swapSource?.shiftType === shiftType;
  const swapViolation = swapSource ? getSwapViolation(day, shiftType) : null;
  const highlightViolation = highlightedDoctorId ? getHighlightedViolation(day, shiftType) : null;
  const isHighlightOk = Boolean(highlightedDoctorId && !highlightViolation && !isDocHighlighted);
  const isChanged = changedShiftKeys?.has(`${day}_${shiftType}`) ?? false;

  if (!enabled) {
    return (
      <td className="px-1 py-1 text-center text-[11px] text-gray-300">-</td>
    );
  }

  const bgClass = isSwapSource
    ? "bg-blue-100 ring-2 ring-inset ring-blue-400"
    : swapViolation
      ? "bg-red-50 ring-1 ring-inset ring-red-300"
      : isDocHighlighted
        ? "bg-blue-100 ring-2 ring-inset ring-blue-400"
        : highlightViolation
          ? "bg-red-50/50"
          : isHighlightOk
            ? "bg-green-50/50"
            : locked
              ? "bg-amber-50/50"
              : swapSource
                ? "bg-green-50/50"
                : "";

  const textColor = isSwapSource
    ? "text-blue-700 font-black"
    : swapViolation
      ? "text-red-400"
      : doctorId
        ? isDocHighlighted
          ? "text-blue-700 font-black"
          : highlightViolation
            ? "text-red-400"
            : shiftType === "day" ? "text-orange-800" : "text-indigo-800"
        : highlightViolation
          ? "text-red-300"
          : "text-gray-400";

  return (
    <td className={`px-0.5 py-0.5 ${bgClass}${isChanged ? " animate-[undoFlash_1.5s_ease-out]" : ""}`}>
      <button
        type="button"
        onClick={() => onTap(day, shiftType)}
        className={`flex w-full items-center justify-center gap-0.5 rounded px-1 py-1 text-xs font-bold transition active:bg-gray-100 ${textColor}`}
      >
        <span className="truncate">{doctorId ? getDoctorName(doctorId) : "-"}</span>
        {locked && <Lock className="h-2.5 w-2.5 shrink-0 text-amber-500" />}
      </button>
    </td>
  );
}

function Repeat2Icon() {
  return <span className="mr-1 inline-block text-violet-600">&#8644;</span>;
}
