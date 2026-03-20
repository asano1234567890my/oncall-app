"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, Undo2, Redo2, ChevronDown, Shield } from "lucide-react";

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
  onDeleteMonthSchedule: () => void;
  isDeletingMonthSchedule: boolean;
  lockedShiftCount: number;
  activeDoctorsCount: number;
  // 保存
  onSaveToDB: () => void;
  isSaving: boolean;
  onSaveDraft: () => void;
  isDraftSaving: boolean;
  onLoadDraft: () => void;
  isDraftLoading: boolean;
  draftSavedAt: string | null;
  // 確定読み込み
  onLoadConfirmedForEdit: () => void;
  isLoadingConfirmed: boolean;
  hasSchedule: boolean;
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
  onDeleteMonthSchedule,
  isDeletingMonthSchedule,
  lockedShiftCount,
  activeDoctorsCount,
  onSaveToDB,
  isSaving,
  onSaveDraft,
  isDraftSaving,
  onLoadDraft,
  isDraftLoading,
  draftSavedAt,
  onLoadConfirmedForEdit,
  isLoadingConfirmed,
  hasSchedule,
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

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
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

      {/* Generate dropdown */}
      <div ref={genMenuRef} className="relative">
        <div className="flex">
          <button
            type="button"
            onClick={onGenerate}
            disabled={isLoading || activeDoctorsCount === 0 || isOverrideMode}
            className="rounded-l-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isLoading ? "生成中..." : "▶ 生成"}
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
          <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={() => { onGenerate(); setIsGenMenuOpen(false); }}
              disabled={isLoading || activeDoctorsCount === 0}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              全体を自動生成
            </button>
            <button
              type="button"
              onClick={() => { onRegenerateUnlocked(); setIsGenMenuOpen(false); }}
              disabled={isLoading || lockedShiftCount === 0}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              未固定枠のみ再生成
            </button>
            <button
              type="button"
              onClick={() => { onLoadConfirmedForEdit(); setIsGenMenuOpen(false); }}
              disabled={isLoading || isLoadingConfirmed}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {isLoadingConfirmed ? "読込中..." : "確定済みシフトを修正"}
            </button>
            <hr className="my-1 border-gray-100" />
            <button
              type="button"
              onClick={() => { onDeleteMonthSchedule(); setIsGenMenuOpen(false); }}
              disabled={isDeletingMonthSchedule}
              className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {isDeletingMonthSchedule ? "削除中..." : "全削除"}
            </button>
          </div>
        )}
      </div>

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
        {draftSavedAt && (
          <button
            type="button"
            onClick={onLoadDraft}
            disabled={isDraftLoading}
            className="text-xs font-semibold text-blue-600 underline hover:text-blue-800 disabled:opacity-50"
          >
            {isDraftLoading ? "読込中..." : "仮保存を読込"}
          </button>
        )}
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
