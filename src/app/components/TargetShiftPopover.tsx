"use client";

import { useEffect, useRef } from "react";
import type { TargetShift } from "../types/dashboard";

type TargetShiftPopoverProps = {
  open: boolean;
  position: { top: number; left: number } | null;
  title: string;
  currentValue: TargetShift | null;
  onSelect: (value: TargetShift | null) => void;
  onClose: () => void;
};

const options: Array<{ value: TargetShift | null; label: string; tone: string }> = [
  { value: "all", label: "\u7d42\u65e5\u4f11\u307f", tone: "border-slate-900 bg-slate-900 text-white" },
  { value: "day", label: "\u65e5\u76f4\u306e\u307f\u4f11\u307f", tone: "border-amber-300 bg-amber-50 text-amber-900" },
  { value: "night", label: "\u5f53\u76f4\u306e\u307f\u4f11\u307f", tone: "border-sky-300 bg-sky-50 text-sky-900" },
  { value: null, label: "\u4f11\u307f\u306a\u3057", tone: "border-gray-200 bg-white text-gray-700" },
];

export default function TargetShiftPopover({
  open,
  position,
  title,
  currentValue,
  onSelect,
  onClose,
}: TargetShiftPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || !position) return null;

  return (
    <div
      ref={ref}
      className="absolute z-20 w-56 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
      style={{ top: position.top, left: position.left }}
    >
      <div className="mb-2 text-[11px] font-bold text-slate-700">{title}</div>
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
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-bold transition ${
                isActive ? `${option.tone} shadow-sm` : "border-gray-200 bg-white text-gray-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span>{option.label}</span>
              {isActive ? <span className="text-[10px] uppercase tracking-[0.24em]">ON</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
