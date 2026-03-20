// src/app/components/MobileActionSheet.tsx — モバイル用ボトムシート（セルタップで表示）
"use client";

import { useCallback, useMemo, useState } from "react";
import { Lock, LockOpen, Repeat2, Trash2, UserPlus, X } from "lucide-react";
import type { DoctorScoreEntry, ShiftType } from "../types/dashboard";
import { getShiftKey } from "../hooks/useScheduleConstraints";

type DoctorConstraintInfo = {
  doctorId: string;
  name: string;
  score: number;
  target: number | null;
  tone: DoctorScoreEntry["tone"];
  constraintMessage: string | null;
};

type Props = {
  isOpen: boolean;
  day: number;
  shiftType: ShiftType;
  currentDoctorId: string | null;
  currentDoctorName: string;
  isLocked: boolean;
  isHolidayLike: boolean;
  month: number;
  doctorOptions: DoctorConstraintInfo[];
  onAssign: (doctorId: string) => void;
  onClear: () => void;
  onSwap: () => void;
  onToggleLock: () => void;
  onClose: () => void;
};

export default function MobileActionSheet({
  isOpen,
  day,
  shiftType,
  currentDoctorId,
  currentDoctorName,
  isLocked,
  isHolidayLike,
  month,
  doctorOptions,
  onAssign,
  onClear,
  onSwap,
  onToggleLock,
  onClose,
}: Props) {
  const [showDoctorList, setShowDoctorList] = useState(false);

  // Reset doctor list view when sheet opens/closes
  const handleClose = useCallback(() => {
    setShowDoctorList(false);
    onClose();
  }, [onClose]);

  const handleAssign = useCallback((doctorId: string) => {
    setShowDoctorList(false);
    onAssign(doctorId);
  }, [onAssign]);

  const shiftLabel = shiftType === "day" ? "日直" : "当直";
  const hasDoctor = Boolean(currentDoctorId);

  // Sort doctors: placeable first (sorted by score asc), then blocked
  const sortedDoctors = useMemo(() => {
    const placeable = doctorOptions.filter((d) => !d.constraintMessage);
    const blocked = doctorOptions.filter((d) => d.constraintMessage);
    placeable.sort((a, b) => a.score - b.score);
    return [...placeable, ...blocked];
  }, [doctorOptions]);

  const fmt = (v: number | null) => (v === null ? "--" : v.toFixed(1));
  const toneClass = (t: DoctorScoreEntry["tone"]) =>
    t === "danger" ? "text-red-600" : t === "warn" ? "text-orange-500" : t === "good" ? "text-green-600" : "text-gray-700";

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]" onClick={handleClose} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[201] animate-slide-up">
        <div className="mx-auto max-w-lg rounded-t-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <span className="text-sm font-bold text-gray-900">{month}月{day}日</span>
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                shiftType === "day"
                  ? "bg-orange-50 text-orange-700"
                  : "bg-indigo-50 text-indigo-700"
              }`}>{shiftLabel}</span>
              {isLocked && (
                <span className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                  <Lock className="mr-0.5 inline h-3 w-3" />固定
                </span>
              )}
            </div>
            <button type="button" onClick={handleClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Current doctor display */}
          {hasDoctor && !showDoctorList && (
            <div className="border-b border-gray-50 px-4 py-2.5">
              <div className="text-xs text-gray-500">現在の担当</div>
              <div className="text-base font-bold text-gray-900">{currentDoctorName}</div>
            </div>
          )}

          {/* Actions for occupied cells */}
          {hasDoctor && !showDoctorList && (
            <div className="grid grid-cols-2 gap-2 px-4 py-3">
              <ActionButton
                icon={<UserPlus className="h-4 w-4" />}
                label="変更"
                color="blue"
                onClick={() => setShowDoctorList(true)}
                disabled={isLocked}
              />
              <ActionButton
                icon={<Repeat2 className="h-4 w-4" />}
                label="入替え"
                color="violet"
                onClick={() => { handleClose(); onSwap(); }}
                disabled={isLocked}
              />
              <ActionButton
                icon={<Trash2 className="h-4 w-4" />}
                label="解除"
                color="red"
                onClick={() => { handleClose(); onClear(); }}
                disabled={isLocked}
              />
              <ActionButton
                icon={isLocked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                label={isLocked ? "固定解除" : "固定"}
                color="amber"
                onClick={() => { onToggleLock(); handleClose(); }}
              />
            </div>
          )}

          {/* Doctor selection list (for empty cells or "change" action) */}
          {(!hasDoctor || showDoctorList) && (
            <div className="px-4 pt-2 pb-3">
              {showDoctorList && (
                <button
                  type="button"
                  onClick={() => setShowDoctorList(false)}
                  className="mb-2 text-xs font-bold text-blue-600"
                >
                  &larr; 戻る
                </button>
              )}
              <div className="mb-2 text-xs font-bold text-gray-500">
                医師を選択
              </div>
              <div className="max-h-[45dvh] space-y-1 overflow-y-auto">
                {sortedDoctors.map((doc) => {
                  const isBlocked = Boolean(doc.constraintMessage);
                  const isCurrent = doc.doctorId === currentDoctorId;
                  return (
                    <button
                      key={doc.doctorId}
                      type="button"
                      disabled={isBlocked || isCurrent}
                      onClick={() => handleAssign(doc.doctorId)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        isBlocked
                          ? "cursor-not-allowed bg-gray-50 opacity-50"
                          : isCurrent
                            ? "cursor-default bg-blue-50 ring-1 ring-blue-200"
                            : "bg-white hover:bg-gray-50 active:bg-gray-100"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-bold ${isBlocked ? "text-gray-400" : "text-gray-900"}`}>
                          {doc.name}
                          {isCurrent && <span className="ml-1.5 text-xs font-normal text-blue-500">(現在)</span>}
                        </div>
                        {isBlocked && doc.constraintMessage && (
                          <div className="mt-0.5 text-[11px] text-red-400 leading-tight">{doc.constraintMessage}</div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`text-sm font-bold ${toneClass(doc.tone)}`}>{fmt(doc.score)}</div>
                        {doc.target !== null && (
                          <div className="text-[10px] text-gray-400">目標 {fmt(doc.target)}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom safe area padding */}
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </div>
      </div>
    </>
  );
}

function ActionButton({
  icon,
  label,
  color,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  color: "blue" | "violet" | "red" | "amber";
  onClick: () => void;
  disabled?: boolean;
}) {
  const colorMap = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 active:bg-blue-100",
    violet: "border-violet-200 bg-violet-50 text-violet-700 active:bg-violet-100",
    red: "border-red-200 bg-red-50 text-red-700 active:bg-red-100",
    amber: "border-amber-200 bg-amber-50 text-amber-700 active:bg-amber-100",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-30 ${colorMap[color]}`}
    >
      {icon}
      {label}
    </button>
  );
}
