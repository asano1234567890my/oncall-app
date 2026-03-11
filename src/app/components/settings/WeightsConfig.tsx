"use client";

import StepperNumberInput from "../inputs/StepperNumberInput";
import type { ObjectiveWeights } from "../../types/dashboard";
import { weightInputs } from "./shared";

type WeightsConfigProps = {
  isOpen: boolean;
  objectiveWeights: ObjectiveWeights;
  onClose: () => void;
  onReset: () => void;
  onWeightChange: (key: keyof ObjectiveWeights, value: number) => void;
};

export default function WeightsConfig({
  isOpen,
  objectiveWeights,
  onClose,
  onReset,
  onWeightChange,
}: WeightsConfigProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
      <div className="flex max-h-[85dvh] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl sm:max-h-[90vh]">
        <div className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5">
          <div>
            <h3 className="text-base font-bold text-gray-900">重み設定</h3>
            <p className="mt-1 text-xs text-gray-500">ペナルティ重みを調整し、optimizer の目的関数に反映します。</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onReset}
              className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50 sm:w-auto"
            >
              既定値に戻す
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50 sm:w-auto"
            >
              閉じる
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          {weightInputs.map((weight) => (
            <div key={weight.key} className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
              <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-800">{weight.label}</div>
                  <div className="text-[11px] text-gray-500">{weight.hint}</div>
                </div>
                <StepperNumberInput
                  value={objectiveWeights[weight.key]}
                  onCommit={(value) => onWeightChange(weight.key, value)}
                  fallbackValue={objectiveWeights[weight.key]}
                  min={weight.min}
                  max={weight.max}
                  step={weight.step}
                  inputMode="numeric"
                  className="w-full sm:w-28"
                  inputClassName="text-sm font-bold"
                />
              </div>
              <input
                type="range"
                value={objectiveWeights[weight.key]}
                onChange={(event) => onWeightChange(weight.key, Number(event.target.value))}
                min={weight.min}
                max={weight.max}
                step={weight.step}
                className="w-full accent-blue-600"
              />
              <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                <span>{weight.min}</span>
                <span>{weight.max}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
