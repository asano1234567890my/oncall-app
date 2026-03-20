"use client";

import { Trash2, Lock, Unlock } from "lucide-react";
import type { DragEvent } from "react";
import type { DoctorScoreEntry } from "../types/dashboard";

type DoctorPaletteProps = {
  scoreEntries: DoctorScoreEntry[];
  getDoctorName: (doctorId: string | null | undefined) => string;
  highlightedDoctorId: string | null;
  dragSourceType: "calendar" | "list" | null;
  scoreMin: number;
  scoreMax: number;
  onDoctorListDragStart: (event: DragEvent<HTMLElement>, doctorId: string | null) => void;
  onClearDragState: () => void;
  onToggleHighlightedDoctor: (doctorId: string | null | undefined) => void;
  onTrashDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onTrashDrop: (event: DragEvent<HTMLDivElement>) => void;
  onLockAll: () => void;
  onUnlockAll: () => void;
  lockedShiftCount: number;
  hasShifts: boolean;
};

const formatScore = (score: number | null) => (score === null ? "-" : score.toFixed(1));

export default function DoctorPalette({
  scoreEntries,
  getDoctorName,
  highlightedDoctorId,
  dragSourceType,
  scoreMin,
  scoreMax,
  onDoctorListDragStart,
  onClearDragState,
  onToggleHighlightedDoctor,
  onTrashDragOver,
  onTrashDrop,
  onLockAll,
  onUnlockAll,
  lockedShiftCount,
  hasShifts,
}: DoctorPaletteProps) {
  const getBarPercent = (score: number) => {
    if (scoreMax <= scoreMin) return 50;
    return Math.min(100, Math.max(0, ((score - scoreMin) / (scoreMax - scoreMin)) * 100));
  };

  const getBarColor = (tone: DoctorScoreEntry["tone"]) => {
    if (tone === "danger") return "bg-red-500";
    if (tone === "warn") return "bg-orange-400";
    if (tone === "good") return "bg-green-500";
    return "bg-blue-500";
  };

  const getScoreTextClass = (tone: DoctorScoreEntry["tone"]) => {
    if (tone === "danger") return "text-red-600";
    if (tone === "warn") return "text-orange-500";
    if (tone === "good") return "text-green-600";
    return "text-gray-700";
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="text-sm font-bold text-gray-700">医師パレット</div>

      {/* Doctor cards */}
      <div className="flex flex-col gap-2">
        {scoreEntries.map((entry) => {
          const isHighlighted = entry.doctorId === highlightedDoctorId;
          return (
            <button
              key={entry.doctorId}
              type="button"
              draggable
              onDragStart={(event) => onDoctorListDragStart(event, entry.doctorId)}
              onDragEnd={onClearDragState}
              onClick={() => onToggleHighlightedDoctor(entry.doctorId)}
              className={`flex flex-col gap-1.5 rounded-lg border p-2.5 text-left transition cursor-grab active:cursor-grabbing ${
                isHighlighted
                  ? "border-blue-400 bg-blue-50 ring-1 ring-blue-300"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
              }`}
              title={`ドラッグでシフト配置 / クリックでハイライト\nMin ${formatScore(entry.min)} / Target ${formatScore(entry.target)} / Max ${formatScore(entry.max)}`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-semibold text-gray-800">{getDoctorName(entry.doctorId)}</span>
                <span className={`shrink-0 text-sm font-bold tabular-nums ${getScoreTextClass(entry.tone)}`}>
                  {formatScore(entry.score)}<span className="text-gray-400">/</span>{formatScore(entry.max)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all ${getBarColor(entry.tone)}`}
                  style={{ width: `${getBarPercent(entry.score)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Trash zone */}
      <div
        data-touch-drop-target="trash"
        onDragOver={onTrashDragOver}
        onDrop={onTrashDrop}
        className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-3 text-sm font-bold transition ${
          dragSourceType === "calendar"
            ? "border-red-400 bg-red-50 text-red-700"
            : "border-gray-300 bg-gray-50 text-gray-400"
        }`}
      >
        <Trash2 className="h-4 w-4" />
        <span>ドロップで解除</span>
      </div>

      {/* Lock controls */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onLockAll}
          disabled={!hasShifts}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Lock className="h-3.5 w-3.5" />
          全ロック
        </button>
        <button
          type="button"
          onClick={onUnlockAll}
          disabled={lockedShiftCount === 0}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Unlock className="h-3.5 w-3.5" />
          全解除
        </button>
      </div>
    </div>
  );
}
