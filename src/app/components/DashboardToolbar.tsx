"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, Undo2, Redo2, ChevronDown, Shield, Lock, Unlock, FileSpreadsheet, ImagePlus } from "lucide-react";

type DashboardToolbarProps = {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  isLoading: boolean;
  isOverrideMode: boolean;
  onToggleOverrideMode: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenSettings: () => void;
  onGenerate: () => void;
  onRegenerateUnlocked: () => void;
  lockedShiftCount: number;
  activeDoctorsCount: number;
  onLockAll: () => void;
  onUnlockAll: () => void;
  hasShifts: boolean;
  // 保存
  onSaveToDB: () => void;
  isSaving: boolean;
  onSaveDraft: () => void;
  isDraftSaving: boolean;
  // ドロップダウン内
  onLoadDraft: () => void;
  isDraftLoading: boolean;
  draftSavedAt: string | null;
  onLoadConfirmedForEdit: () => void;
  isLoadingConfirmed: boolean;
  onClearUnlocked: () => void;
  // 白紙作成
  onCreateBlank: () => void;
  hasSchedule: boolean;
  // 画像取込
  onOpenImport?: () => void;
};

export default function DashboardToolbar({
  year,
  month,
  onYearChange,
  onMonthChange,
  isLoading,
  isOverrideMode,
  onToggleOverrideMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenSettings,
  onGenerate,
  onRegenerateUnlocked,
  lockedShiftCount,
  activeDoctorsCount,
  onLockAll,
  onUnlockAll,
  hasShifts,
  onSaveToDB,
  isSaving,
  onSaveDraft,
  isDraftSaving,
  onLoadDraft,
  isDraftLoading,
  draftSavedAt,
  onLoadConfirmedForEdit,
  isLoadingConfirmed,
  onClearUnlocked,
  onCreateBlank,
  hasSchedule,
  onOpenImport,
}: DashboardToolbarProps) {
  const [isGenMenuOpen, setIsGenMenuOpen] = useState(false);
  const genMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (genMenuRef.current && !genMenuRef.current.contains(event.target as Node)) {
        setIsGenMenuOpen(false);
      }
    };
    if (isGenMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isGenMenuOpen]);

  const currentYear = new Date().getFullYear();
  const hasLocks = lockedShiftCount > 0;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
      {/* Year/Month selector */}
      <div className="flex items-center gap-1">
        <select
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="rounded border border-gray-200 bg-white px-2 py-1 text-sm font-semibold text-gray-700"
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          className="rounded border border-gray-200 bg-white px-2 py-1 text-sm font-semibold text-gray-700"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m}月</option>
          ))}
        </select>
      </div>

      {/* Settings button */}
      <button
        type="button"
        onClick={onOpenSettings}
        className="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
      >
        <Settings className="h-3.5 w-3.5" />
        設定
      </button>

      {/* Generate split button + dropdown */}
      <div ref={genMenuRef} className="relative">
        <div className="flex">
          <button
            type="button"
            onClick={hasLocks ? onRegenerateUnlocked : onGenerate}
            disabled={isLoading || activeDoctorsCount === 0 || isOverrideMode}
            className="rounded-l-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isLoading ? "生成中..." : hasLocks ? "▶ 再生成" : "▶ 生成"}
          </button>
          <button
            type="button"
            onClick={() => setIsGenMenuOpen(!isGenMenuOpen)}
            disabled={isLoading || isOverrideMode}
            className="rounded-r-md border-l border-blue-500 bg-blue-600 px-1.5 py-1.5 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
        {isGenMenuOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            {/* 生成系 */}
            <button
              type="button"
              onClick={() => { onRegenerateUnlocked(); setIsGenMenuOpen(false); }}
              disabled={isLoading || lockedShiftCount === 0}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              未固定枠を再生成
            </button>
            <button
              type="button"
              onClick={() => { onGenerate(); setIsGenMenuOpen(false); }}
              disabled={isLoading || activeDoctorsCount === 0}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              全体を自動生成
            </button>
            {/* 読み込み系 */}
            <hr className="my-1 border-gray-100" />
            <button
              type="button"
              onClick={() => { onLoadDraft(); setIsGenMenuOpen(false); }}
              disabled={isLoading || isDraftLoading || !draftSavedAt}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {isDraftLoading ? "読込中..." : "仮保存を読み込む"}
              {draftSavedAt && (
                <span className="ml-1 text-gray-400">
                  ({new Date(draftSavedAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => { onLoadConfirmedForEdit(); setIsGenMenuOpen(false); }}
              disabled={isLoading || isLoadingConfirmed}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {isLoadingConfirmed ? "読込中..." : "確定済みを読み込む"}
            </button>
            {/* クリア系 */}
            <hr className="my-1 border-gray-100" />
            <button
              type="button"
              onClick={() => { onClearUnlocked(); setIsGenMenuOpen(false); }}
              disabled={!hasSchedule || lockedShiftCount === 0}
              className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              未固定枠をクリア
            </button>
          </div>
        )}
      </div>

      {/* Blank schedule */}
      <button
        type="button"
        onClick={onCreateBlank}
        disabled={isLoading || isOverrideMode}
        className="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        title="白紙のシフトを作成"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        白紙作成
      </button>

      {/* Image import */}
      {onOpenImport && (
        <button
          type="button"
          onClick={onOpenImport}
          className="flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-bold text-purple-700 transition hover:bg-purple-100"
          title="ファイルから当直表を取り込む"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          取込
        </button>
      )}

      {/* Override mode */}
      <button
        type="button"
        onClick={onToggleOverrideMode}
        className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-bold transition ${
          isOverrideMode
            ? "border-amber-300 bg-amber-100 text-amber-800"
            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
        }`}
        title="強制配置モード: 制約チェックを無効にして配置"
      >
        <Shield className="h-3.5 w-3.5" />
        強制
      </button>

      {/* Lock toggle */}
      {hasLocks ? (
        <button
          type="button"
          onClick={onUnlockAll}
          className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100"
          title="すべての固定を解除"
        >
          <Lock className="h-3.5 w-3.5" />
          <span className="tabular-nums">{lockedShiftCount}</span>
          <span className="inline">固定中</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onLockAll}
          disabled={!hasShifts}
          className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs font-bold text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          title="すべてのシフトを固定"
        >
          <Unlock className="h-3.5 w-3.5" />
          <span className="inline">全固定</span>
        </button>
      )}

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded-md border border-gray-200 p-1.5 text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          title="元に戻す"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="rounded-md border border-gray-200 p-1.5 text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          title="やり直し"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Save buttons */}
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isDraftSaving || !hasSchedule}
          className="rounded-md border border-green-600 px-3 py-1.5 text-xs font-bold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDraftSaving ? "保存中..." : "仮保存"}
        </button>
        <button
          type="button"
          onClick={onSaveToDB}
          disabled={isSaving || !hasSchedule}
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "確定中..." : "確定保存"}
        </button>
      </div>
    </div>
  );
}
