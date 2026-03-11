"use client";

import { useEffect } from "react";
import type { TargetShift } from "../types/dashboard";

type TargetShiftPopoverProps = {
  open: boolean;
  position?: { top: number; left: number } | null;
  title: string;
  currentValue: TargetShift | null;
  onSelect: (value: TargetShift | null) => void;
  onClose: () => void;
};

const options: Array<{ value: TargetShift | null; label: string; tone: string }> = [
  { value: "all", label: "終日休み", tone: "border-slate-900 bg-slate-900 text-white" },
  { value: "day", label: "日直のみ休み", tone: "border-amber-300 bg-amber-50 text-amber-900" },
  { value: "night", label: "当直のみ休み", tone: "border-sky-300 bg-sky-50 text-sky-900" },
  { value: null, label: "休みなし", tone: "border-gray-200 bg-white text-gray-700" },
];

export default function TargetShiftPopover({ open, title, currentValue, onSelect, onClose }: TargetShiftPopoverProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm border border-slate-200 bg-white p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 text-sm font-bold text-slate-800">{title}</div>
        <div className="space-y-2">
          {options.map((option) => {
            const isActive = option.value === currentValue;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  onSelect(option.value);
                  onClose();
                }}
                className={`flex w-full items-center justify-between border px-3 py-3 text-left text-sm font-bold transition ${
                  isActive ? `${option.tone} shadow-sm` : "border-gray-200 bg-white text-gray-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>{option.label}</span>
                {isActive ? <span className="text-[10px] uppercase tracking-[0.24em]">ON</span> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-50"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
