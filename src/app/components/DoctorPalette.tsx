"use client";

import { Trash2, Settings2, Users } from "lucide-react";
import type { DragEvent } from "react";
import type { Doctor, DoctorScoreEntry, ScheduleRow, ShiftType } from "../types/dashboard";

type DoctorPaletteProps = {
  scoreEntries: DoctorScoreEntry[];
  getDoctorName: (doctorId: string | null | undefined) => string;
  highlightedDoctorId: string | null;
  dragSourceType: "calendar" | "list" | null;
  scoreMin: number;
  scoreMax: number;
  onDoctorListDragStart: (event: DragEvent<HTMLElement>, doctorId: string | null) => void;
  onClearDragState: () => void;
  onToggleHighlightedDoctor: (doctorId: string | null | undefined, day?: number, shiftType?: ShiftType) => void;
  onTrashDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onTrashDrop: (event: DragEvent<HTMLDivElement>) => void;
  onOpenDoctorManage?: () => void;
  externalDoctors?: Doctor[];
  externalDoctorIds?: Set<string>;
  externalScoreTotal?: number;
  externalSlotCount?: number;
  schedule?: ScheduleRow[];
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
  onOpenDoctorManage,
  externalDoctors,
  externalDoctorIds,
  externalScoreTotal,
  externalSlotCount,
  schedule,
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
    <div className="flex h-full flex-col">
      {/* Scrollable doctor list */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">医師一覧</span>
          {onOpenDoctorManage && (
            <button
              type="button"
              onClick={onOpenDoctorManage}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
              title="医師管理（追加・編集・共有・ロック）"
            >
              <Settings2 className="h-3.5 w-3.5" />
              管理
            </button>
          )}
        </div>
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
                    ? "border-blue-500 bg-blue-100 ring-2 ring-blue-400 shadow-md"
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

          {/* 外部医師エントリ — 枠数>0 または外部医師がDB上に存在する場合に表示 */}
          {((externalSlotCount ?? 0) > 0 || (externalDoctors && externalDoctors.length > 0)) && (() => {
            const isAnyExternalHighlighted = Boolean(highlightedDoctorId && externalDoctorIds?.has(highlightedDoctorId));
            // スケジュール内で使用中の外部医師IDを集計
            const usedExternalIds = new Set<string>();
            schedule?.forEach((row) => {
              if (row.day_shift && externalDoctorIds?.has(row.day_shift)) usedExternalIds.add(row.day_shift);
              if (row.night_shift && externalDoctorIds?.has(row.night_shift)) usedExternalIds.add(row.night_shift);
            });
            // シフト割当回数（日当直の日直側はnight_shiftと同一IDなので重複カウントしない）
            let assignedCount = 0;
            schedule?.forEach((row) => {
              if (row.night_shift && externalDoctorIds?.has(row.night_shift)) assignedCount++;
              else if (row.day_shift && externalDoctorIds?.has(row.day_shift)) assignedCount++;
            });
            // D&D用に未使用の外部医師IDを取得（全員使用済みなら最初のIDをフォールバック）
            const availableExternalId = externalDoctors?.find((d) => !usedExternalIds.has(d.id))?.id
              ?? externalDoctors?.[0]?.id ?? null;
            return (
              <div
                className={`flex flex-col gap-1.5 rounded-lg border p-2.5 transition ${
                  isAnyExternalHighlighted
                    ? "border-orange-500 bg-orange-100 ring-2 ring-orange-400 shadow-md"
                    : "border-orange-200 bg-orange-50 hover:border-orange-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    draggable={Boolean(availableExternalId)}
                    onDragStart={(event) => availableExternalId && onDoctorListDragStart(event, availableExternalId)}
                    onDragEnd={onClearDragState}
                    onClick={() => {
                      // ハイライト: 使用中の外部医師のいずれか（なければ最初のID）
                      const hlId = usedExternalIds.size > 0 ? [...usedExternalIds][0] : externalDoctors?.[0]?.id;
                      if (hlId) onToggleHighlightedDoctor(hlId);
                    }}
                    className={`flex items-center gap-1.5 ${availableExternalId ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                    title="ドラッグでシフト配置 / クリックで全外部医師ハイライト"
                  >
                    <Users className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-bold text-orange-800">外部医師</span>
                    {assignedCount > 0 && (
                      <span className="rounded-full bg-orange-200 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">{assignedCount}回</span>
                    )}
                  </button>
                  <span className="text-sm font-bold tabular-nums text-orange-700">
                    {(externalScoreTotal ?? 0).toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Trash zone — sticky bottom */}
      <div className="sticky bottom-0 border-t border-gray-200 bg-gray-50 p-3">
        <div
          data-touch-drop-target="trash"
          onDragOver={onTrashDragOver}
          onDrop={onTrashDrop}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-2 text-sm font-bold transition ${
            dragSourceType === "calendar"
              ? "border-red-400 bg-red-50 text-red-700"
              : "border-gray-300 bg-gray-100 text-gray-400"
          }`}
        >
          <Trash2 className="h-4 w-4" />
          <span>ドロップで解除</span>
        </div>
      </div>
    </div>
  );
}
