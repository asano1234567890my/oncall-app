"use client";

import StepperNumberInput from "../inputs/StepperNumberInput";
import type { HardConstraints } from "../../types/dashboard";
import { hardConstraintNumberInputs, hardConstraintToggleInputs } from "./shared";

type RulesConfigProps = {
  isOpen: boolean;
  hardConstraints: HardConstraints;
  onClose: () => void;
  onReset: () => void;
  onHardConstraintChange: (key: keyof HardConstraints, value: number | boolean) => void;
};

export default function RulesConfig({
  isOpen,
  hardConstraints,
  onClose,
  onReset,
  onHardConstraintChange,
}: RulesConfigProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
      <div className="flex max-h-[85dvh] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-2xl sm:max-h-[90vh]">
        <div className="flex items-start justify-between gap-4 border-b border-indigo-100 bg-indigo-50 px-4 py-4 sm:px-5">
          <div>
            <h3 className="text-base font-bold text-gray-900">ルール（ハード制約）設定</h3>
            <p className="mt-1 text-xs text-gray-500">数値は 0 で OFF、トグルは hard constraint として optimize に送信します。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50"
            >
              既定値に戻す
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50"
            >
              閉じる
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {hardConstraintNumberInputs.map((constraint) => {
              const value = typeof hardConstraints[constraint.key] === "number" ? hardConstraints[constraint.key] : 0;
              return (
                <label key={constraint.key} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-1 text-[11px] font-bold text-gray-700">{constraint.label}</div>
                  <div className="mb-2 text-[11px] text-gray-500">{constraint.hint}</div>
                  <div className="flex items-center gap-2">
                    <StepperNumberInput
                      value={value}
                      onCommit={(nextValue) => onHardConstraintChange(constraint.key, nextValue)}
                      fallbackValue={value}
                      min={constraint.min}
                      max={constraint.max}
                      step={constraint.step}
                      inputMode="numeric"
                      inputClassName="text-sm font-bold"
                    />
                    <span className="shrink-0 text-xs font-bold text-gray-500">{constraint.unit}</span>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="space-y-3">
            {hardConstraintToggleInputs.map((constraint) => {
              const enabled = Boolean(hardConstraints[constraint.key]);
              return (
                <div
                  key={constraint.key}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-800">{constraint.label}</div>
                    <div className="mt-1 text-[11px] text-gray-500">{constraint.hint}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onHardConstraintChange(constraint.key, !enabled)}
                    className={`inline-flex h-10 min-w-28 items-center justify-center rounded-full border px-4 text-xs font-bold transition ${
                      enabled ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                  >
                    {enabled ? "ON" : "OFF"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
