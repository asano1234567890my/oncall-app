"use client";

import { Trash2 } from "lucide-react";
import type { DragEvent, TouchEvent } from "react";
import type { DoctorScoreEntry, ScheduleRow, ShiftType, SwapSource } from "../types/dashboard";
import ScheduleCell from "./schedule/ScheduleCell";
import ScheduleValidationAlert from "./schedule/ScheduleValidationAlert";

type ScheduleBoardProps = {
  isLoading: boolean;
  toastMessage: string | null;
  hoverErrorMessage: string | null;
  dragSourceType: "calendar" | "list" | null;
  error: string;
  schedule: ScheduleRow[];
  scheduleColumns: ScheduleRow[][];
  scoreEntries: DoctorScoreEntry[];
  getDoctorName: (doctorId: string | null | undefined) => string;
  highlightedDoctorId: string | null;
  selectedManualDoctorId: string | null;
  isEraseSelectionActive: boolean;
  year: number;
  month: number;
  holidaySet: Set<string>;
  manualHolidaySetInMonth: Set<string>;
  toYmd: (year: number, month: number, day: number) => string;
  getWeekday: (year: number, month: number, day: number) => string;
  isHighlightedDoctorBlockedDay: (day: number) => boolean;
  isHighlightedDoctorBlockedShift: (day: number, shiftType: ShiftType) => boolean;
  isShiftLocked: (day: number, shiftType: ShiftType) => boolean;
  invalidHoverShiftKey: string | null;
  touchHoverShiftKey: string | null;
  isSwapMode: boolean;
  isOverrideMode: boolean;
  swapSource: SwapSource | null;
  isSwapSourceSelected: (day: number, shiftType: ShiftType) => boolean;
  getSwapViolation: (day: number, shiftType: ShiftType) => string | null;
  onHandleShiftDragOver: (
    event: DragEvent<HTMLDivElement>,
    day: number,
    shiftType: ShiftType,
    locked: boolean,
    isHolidayLike: boolean
  ) => void;
  onHandleShiftDragLeave: (day: number, shiftType: ShiftType) => void;
  onHandleShiftDrop: (
    event: DragEvent<HTMLDivElement>,
    day: number,
    shiftType: ShiftType,
    locked: boolean,
    isHolidayLike: boolean
  ) => void;
  onHandleDisabledDayDragOver: (event: DragEvent<HTMLDivElement>, day: number) => void;
  onHandleDisabledDayDragLeave: (day: number) => void;
  onShiftDragStart: (
    event: DragEvent<HTMLElement>,
    day: number,
    shiftType: ShiftType,
    doctorId: string | null | undefined
  ) => void;
  onDoctorListDragStart: (event: DragEvent<HTMLElement>, doctorId: string | null) => void;
  onShiftTouchStart: (
    event: TouchEvent<HTMLElement>,
    day: number,
    shiftType: ShiftType,
    doctorId: string | null | undefined
  ) => void;
  onDoctorListTouchStart: (event: TouchEvent<HTMLElement>, doctorId: string | null) => void;
  onTouchDragMove: (event: TouchEvent<HTMLElement>) => void;
  onTouchDragEnd: (event: TouchEvent<HTMLElement>) => void;
  onTouchDragCancel: () => void;
  onShiftTap: (day: number, shiftType: ShiftType, locked: boolean, isHolidayLike: boolean) => void;
  onSwapButtonPress: (day: number, shiftType: ShiftType, locked: boolean, isHolidayLike: boolean) => void;
  onCancelSwapSelection: () => void;
  onToggleHighlightedDoctor: (doctorId: string | null | undefined) => void;
  onSelectManualDoctor: (doctorId: string) => void;
  onToggleEraseSelection: () => void;
  onClearDragState: () => void;
  onToggleShiftLock: (day: number, shiftType: ShiftType) => void;
  onToggleSwapMode: () => void;
  onToggleOverrideMode: () => void;
  onLockAll: () => void;
  onUnlockAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onRegenerateUnlocked: () => void;
  onTrashDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onTrashDrop: (event: DragEvent<HTMLDivElement>) => void;
  lockedShiftCount: number;
  onDeleteMonthSchedule: () => void;
  isDeletingMonthSchedule: boolean;
  onSaveToDB: () => void;
  onForceSaveToDB: () => void;
  onDismissSaveValidation: () => void;
  isSaving: boolean;
  saveMessage: string;
  saveValidationMessages: string[];
  // 仮保存
  isDraftSaving?: boolean;
  isDraftLoading?: boolean;
  draftSavedAt?: string | null;
  draftMessage?: string;
  onSaveDraft?: () => void;
  onLoadDraft?: () => void;
};

export default function ScheduleBoard({
  isLoading,
  toastMessage,
  hoverErrorMessage,
  dragSourceType,
  error,
  schedule,
  scheduleColumns,
  scoreEntries,
  getDoctorName,
  highlightedDoctorId,
  selectedManualDoctorId,
  isEraseSelectionActive,
  year,
  month,
  holidaySet,
  manualHolidaySetInMonth,
  toYmd,
  getWeekday,
  isHighlightedDoctorBlockedDay,
  isHighlightedDoctorBlockedShift,
  isShiftLocked,
  invalidHoverShiftKey,
  touchHoverShiftKey,
  isSwapMode,
  isOverrideMode,
  swapSource,
  isSwapSourceSelected,
  getSwapViolation,
  onHandleShiftDragOver,
  onHandleShiftDragLeave,
  onHandleShiftDrop,
  onHandleDisabledDayDragOver,
  onHandleDisabledDayDragLeave,
  onShiftDragStart,
  onDoctorListDragStart,
  onShiftTouchStart,
  onDoctorListTouchStart,
  onTouchDragMove,
  onTouchDragEnd,
  onTouchDragCancel,
  onShiftTap,
  onSwapButtonPress,
  onCancelSwapSelection,
  onToggleHighlightedDoctor,
  onSelectManualDoctor,
  onToggleEraseSelection,
  onClearDragState,
  onToggleShiftLock,
  onToggleSwapMode,
  onToggleOverrideMode,
  onLockAll,
  onUnlockAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRegenerateUnlocked,
  onTrashDragOver,
  onTrashDrop,
  lockedShiftCount,
  onDeleteMonthSchedule,
  isDeletingMonthSchedule,
  onSaveToDB,
  onForceSaveToDB,
  onDismissSaveValidation,
  isSaving,
  saveMessage,
  saveValidationMessages,
  isDraftSaving,
  isDraftLoading,
  draftSavedAt,
  draftMessage,
  onSaveDraft,
  onLoadDraft,
}: ScheduleBoardProps) {
  const highlightedDoctorName = highlightedDoctorId ? getDoctorName(highlightedDoctorId) : null;
  const manualSelectionLabel = selectedManualDoctorId ? getDoctorName(selectedManualDoctorId) : null;
  const swapSourceLabel = swapSource
    ? `${swapSource.day}日 ${swapSource.shiftType === "day" ? "日直" : "当直"} ${getDoctorName(swapSource.doctorId)}`
    : null;

  const formatScore = (score: number | null) => (score === null ? "-" : score.toFixed(1));

  const getScoreTextClass = (tone: DoctorScoreEntry["tone"]) => {
    if (tone === "danger") return "text-red-600";
    if (tone === "warn") return "text-orange-500";
    if (tone === "good") return "text-green-600";
    return "text-gray-700";
  };

  const getScoreChipClass = (isSelected: boolean, variant: "doctor" | "erase" = "doctor") => {
    const base = isSelected
      ? "border-sky-300 bg-sky-50 ring-1 ring-sky-300"
      : variant === "erase"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-gray-200 bg-white text-gray-700";

    return `flex items-center gap-1 rounded border px-1 py-0.5 text-[9px] shadow-sm touch-none ${base}`;
  };

  return (
    <>
      {toastMessage ? (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-[100] w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 px-3">
          <div className="rounded-2xl bg-gray-900/90 px-6 py-4 text-center text-sm font-bold leading-snug whitespace-pre-line text-white shadow-2xl backdrop-blur sm:text-lg">
            {toastMessage}
          </div>
        </div>
      ) : null}

      {error ? <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700">{error}</div> : null}
      {!schedule.length && saveMessage ? (
        <div className="mb-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[10px] font-bold text-green-800">{saveMessage}</div>
      ) : null}
      {!schedule.length && !isLoading && !error ? (
        <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-center text-[10px] text-gray-400">
          左上の「自動生成」ボタンを押してください
        </div>
      ) : null}

      {schedule.length > 0 ? (
        <div className="animate-fade-in">
          <div className="sticky top-0 z-40 mb-2 space-y-2 bg-white/95 pb-2 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="w-full min-w-0 text-[9px] leading-tight text-gray-500">
                D&D で移動・入替・上書きできます。スマホでは [⇄] ボタンで入れ替え元/先を選び、医師や削除をタップ配置できます。
                <div className="h-4 mt-0.5 flex flex-wrap items-center gap-1.5 overflow-hidden">
                  {highlightedDoctorName && <span className="font-semibold text-sky-700">ハイライト中: {highlightedDoctorName}</span>}
                  {manualSelectionLabel && <span className="font-semibold text-emerald-700">タップ配置: {manualSelectionLabel}</span>}
                  {isEraseSelectionActive && <span className="font-semibold text-red-600">タップ削除: 削除アイテム選択中</span>}
                  {swapSourceLabel && <span className="font-semibold text-sky-700">入れ替え元: {swapSourceLabel}</span>}
                  {isOverrideMode && <span className="font-semibold text-amber-700">強制配置モード: 制約チェック無効</span>}
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-1.5 md:w-auto md:shrink-0 md:justify-end">
                <button
                  type="button"
                  onClick={onToggleOverrideMode}
                  className={`rounded-md border px-1.5 py-1 text-[9px] font-bold transition ${
                    isOverrideMode ? "border-amber-300 bg-amber-100 text-amber-800" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  強制配置モード
                </button>
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[9px] font-bold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  戻る
                </button>
                <button
                  type="button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[9px] font-bold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  進む
                </button>
                <button
                  type="button"
                  onClick={onLockAll}
                  disabled={!schedule.some((row) => row.day_shift || row.night_shift)}
                  className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-1 text-[9px] font-bold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  全ロック
                </button>
                <button
                  type="button"
                  onClick={onUnlockAll}
                  disabled={lockedShiftCount === 0}
                  className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[9px] font-bold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  全解除
                </button>
                <button
                  type="button"
                  onClick={onRegenerateUnlocked}
                  disabled={isLoading || isOverrideMode}
                  className="rounded-md border border-sky-200 bg-sky-50 px-1.5 py-1 text-[9px] font-bold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {lockedShiftCount > 0 ? "未固定枠を再生成" : "全体を自動生成"}
                </button>
                <button
                  type="button"
                  onClick={onDeleteMonthSchedule}
                  disabled={isDeletingMonthSchedule}
                  className="rounded-md border border-red-200 bg-red-50 px-1.5 py-1 text-[9px] font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeletingMonthSchedule ? "削除中" : "全削除"}
                </button>
              </div>
            </div>
            {isOverrideMode ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-800">
                強制配置モード中は制約違反を許可するため、自動生成を無効化しています。
              </div>
            ) : null}
            {swapSourceLabel ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-2 py-1 text-[9px] font-semibold text-yellow-900">
                <div>入れ替え先を選択してください</div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-yellow-800">元: {swapSourceLabel}</span>
                  <button
                    type="button"
                    onClick={onCancelSwapSelection}
                    className="rounded border border-yellow-300 bg-white px-2 py-0.5 text-[9px] font-bold text-yellow-900 transition hover:bg-yellow-100"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : null}

            <div
              data-touch-drop-target="trash"
              onDragOver={onTrashDragOver}
              onDrop={onTrashDrop}
              className={`mb-2 flex min-h-9 items-center justify-center gap-1 rounded-lg border border-dashed px-2 py-1 text-[9px] font-bold transition ${
                dragSourceType === "calendar" ? "border-red-400 bg-red-50 text-red-700" : "border-red-200 bg-red-50/70 text-red-500"
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{dragSourceType === "calendar" ? "ここにドロップでシフト解除" : "ゴミ箱へドロップでシフト解除"}</span>
              <span className="text-[8px] font-medium text-red-400">カレンダー枠のみ有効</span>
            </div>

            <div className="rounded-lg border bg-gray-50 p-1.5">
              <div className="mb-1 text-[9px] font-bold text-gray-700">医師別スコア / 手動配置</div>
              <div className="mb-2 mt-1 flex flex-wrap items-center gap-3 px-1 text-[10px]">
                <span className="text-gray-500">スコアの目安:</span>
                <span className="font-bold text-green-600">目標差0.5以内</span>
                <span className="font-bold text-gray-700">通常</span>
                <span className="font-bold text-orange-500">目標差1.5以上</span>
                <span className="font-bold text-red-600">Min / Max逸脱</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {scoreEntries.map((entry) => {
                  const isSelected = entry.doctorId === highlightedDoctorId || entry.doctorId === selectedManualDoctorId;
                  return (
                    <button
                      key={entry.doctorId}
                      type="button"
                      draggable
                      onDragStart={(event) => onDoctorListDragStart(event, entry.doctorId)}
                      onDragEnd={onClearDragState}
                      onTouchStart={(event) => onDoctorListTouchStart(event, entry.doctorId)}
                      onTouchMove={onTouchDragMove}
                      onTouchEnd={onTouchDragEnd}
                      onTouchCancel={onTouchDragCancel}
                      onClick={() => {
                        if (isSwapMode) {
                          onSelectManualDoctor(entry.doctorId);
                          return;
                        }
                        onToggleHighlightedDoctor(entry.doctorId);
                      }}
                      className={`${getScoreChipClass(isSelected)} ${!isSwapMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                      title={`クリックでハイライト / ドラッグで割り当て / Min ${formatScore(entry.min)} / Target ${formatScore(entry.target)} / Max ${formatScore(entry.max)}`}
                    >
                      <span className="max-w-[4.5rem] truncate font-semibold text-gray-700">{getDoctorName(entry.doctorId)}</span>
                      <span className={`font-bold ${getScoreTextClass(entry.tone)}`}>{formatScore(entry.score)}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => onDoctorListDragStart(event, null)}
                  onDragEnd={onClearDragState}
                  onTouchStart={(event) => onDoctorListTouchStart(event, null)}
                  onTouchMove={onTouchDragMove}
                  onTouchEnd={onTouchDragEnd}
                  onTouchCancel={onTouchDragCancel}
                  onClick={() => {
                    if (!isSwapMode) return;
                    onToggleEraseSelection();
                  }}
                  className={`${getScoreChipClass(isEraseSelectionActive, "erase")} ${isSwapMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
                  title="入れ替えモード中はタップで削除選択 / ドラッグでシフト解除"
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="font-semibold">削除</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleSwapMode}
                  className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-semibold shadow-sm touch-none transition ${
                    isSwapMode
                      ? "border-sky-300 bg-sky-50 text-sky-800 ring-1 ring-sky-300"
                      : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                  }`}
                  title="タップ配置と入れ替えモードを切り替え"
                >
                  <span>⇄</span>
                  <span>配置/入替</span>
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto -mx-3 px-3">
          <div className="min-w-[540px] grid grid-cols-2 gap-x-2 gap-y-1">
            {scheduleColumns.map((rows, index) => (
              <div key={`column-${index}`} className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
                <table className="w-full table-fixed select-none bg-white text-center text-[7px] leading-tight sm:text-[9px] md:text-[10px]">
                  <thead className="bg-gray-100 text-[7px] text-gray-600 sm:text-[8px]">
                    <tr>
                      <th className="w-5 border-b px-0 py-[2px] sm:w-7 sm:px-0.5 sm:py-0.5">日付</th>
                      <th className="w-4 border-b px-0 py-[2px] sm:w-5 sm:px-0.5 sm:py-0.5">曜</th>
                      <th className="border-b bg-orange-50 px-0 py-[2px] sm:px-0.5 sm:py-0.5">日直</th>
                      <th className="border-b bg-indigo-50 px-0 py-[2px] sm:px-0.5 sm:py-0.5">当直</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <ScheduleCell
                        key={`column-${index}-${row.day}`}
                        row={row}
                        columnKey={`column-${index}`}
                        year={year}
                        month={month}
                        holidaySet={holidaySet}
                        manualHolidaySetInMonth={manualHolidaySetInMonth}
                        toYmd={toYmd}
                        getWeekday={getWeekday}
                        getDoctorName={getDoctorName}
                        highlightedDoctorId={highlightedDoctorId}
                        hoverErrorMessage={hoverErrorMessage}
                        isHighlightedDoctorBlockedDay={isHighlightedDoctorBlockedDay}
                        isHighlightedDoctorBlockedShift={isHighlightedDoctorBlockedShift}
                        isShiftLocked={isShiftLocked}
                        invalidHoverShiftKey={invalidHoverShiftKey}
                        touchHoverShiftKey={touchHoverShiftKey}
                        isSwapMode={isSwapMode}
                        isSwapSourceSelected={isSwapSourceSelected}
                        getSwapViolation={getSwapViolation}
                        onHandleShiftDragOver={onHandleShiftDragOver}
                        onHandleShiftDragLeave={onHandleShiftDragLeave}
                        onHandleShiftDrop={onHandleShiftDrop}
                        onHandleDisabledDayDragOver={onHandleDisabledDayDragOver}
                        onHandleDisabledDayDragLeave={onHandleDisabledDayDragLeave}
                        onShiftDragStart={onShiftDragStart}
                        onShiftTouchStart={onShiftTouchStart}
                        onTouchDragMove={onTouchDragMove}
                        onTouchDragEnd={onTouchDragEnd}
                        onTouchDragCancel={onTouchDragCancel}
                        onShiftTap={onShiftTap}
                        onSwapButtonPress={onSwapButtonPress}
                        onToggleHighlightedDoctor={onToggleHighlightedDoctor}
                        onClearDragState={onClearDragState}
                        onToggleShiftLock={onToggleShiftLock}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          </div>

          <div className="mt-2 flex flex-col items-center gap-1">
            <ScheduleValidationAlert messages={saveValidationMessages} onDismiss={onDismissSaveValidation} onForceSave={onForceSaveToDB} />
            <div className="flex w-full gap-1.5">
              {onSaveDraft && (
                <button type="button" onClick={onSaveDraft} disabled={isDraftSaving}
                  className="flex-1 rounded-full border border-green-600 px-3 py-1.5 text-[10px] font-bold text-green-700 transition hover:bg-green-50 disabled:opacity-60">
                  {isDraftSaving ? "仮保存中..." : "仮保存"}
                </button>
              )}
              <button type="button" onClick={onSaveToDB} disabled={isSaving}
                className="flex-1 rounded-full bg-green-600 px-3 py-1.5 text-[10px] font-bold text-white shadow transition hover:bg-green-700 disabled:opacity-60">
                {isSaving ? "確定中..." : "確定保存"}
              </button>
            </div>
            {draftSavedAt && onLoadDraft && (
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span>仮保存あり ({new Date(draftSavedAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })})</span>
                <button type="button" onClick={onLoadDraft} disabled={isDraftLoading}
                  className="font-bold text-blue-600 underline hover:text-blue-800">{isDraftLoading ? "読込中..." : "読み込む"}</button>
              </div>
            )}
            {draftMessage ? <div className="text-[10px] font-bold text-blue-700">{draftMessage}</div> : null}
            {saveMessage ? <div className="text-[10px] font-bold text-green-800">保存結果: {saveMessage}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
