"use client";

import StepperNumberInput from "../inputs/StepperNumberInput";
import type { HardConstraints, ObjectiveWeights } from "../../types/dashboard";
import SettingsModalPortal from "./SettingsModalPortal";
import { getWeightMeta, weightInputs } from "./shared";

type WeightsConfigProps = {
  isOpen: boolean;
  objectiveWeights: ObjectiveWeights;
  hardConstraints: HardConstraints;
  isSaving?: boolean;
  saveMessage?: string;
  onClose: () => void;
  onReset: () => void;
  onSave?: () => void;
  onShowGuide?: () => void;
  onWeightChange: (key: keyof ObjectiveWeights, value: number) => void;
};

export default function WeightsConfig({
  isOpen,
  objectiveWeights,
  hardConstraints,
  isSaving = false,
  saveMessage = "",
  onClose,
  onReset,
  onSave,
  onShowGuide,
  onWeightChange,
}: WeightsConfigProps) {
  return (
    <SettingsModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
        <div className="flex max-h-[85dvh] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl sm:max-h-[90vh]">
          <div className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5">
            <div>
              <h3 className="text-base font-bold text-gray-900">優先度の調整</h3>
              <p className="mt-1 text-xs text-gray-500">数値が大きいほど優先されます。生成結果を見て気になる点があれば調整してください。</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {onSave && (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSaving}
                  className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {isSaving ? "保存中..." : "保存"}
                </button>
              )}
              <button
                type="button"
                onClick={onReset}
                className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50 sm:w-auto"
              >
                既定値に戻す
              </button>
              {onShowGuide && (
                <button type="button" onClick={onShowGuide} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">?</button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50 sm:w-auto"
              >
                閉じる
              </button>
            </div>
            {saveMessage && (
              <div className="mt-2 text-xs font-bold text-emerald-700 sm:mt-0">{saveMessage}</div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="space-y-3">
              {weightInputs
                .map((weight) => ({ weight, meta: getWeightMeta(weight.key, weight, hardConstraints) }))
                .filter(({ meta }) => !meta.inactive)
                .map(({ weight, meta }) => (
                  <div key={weight.key} className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
                    <div className="mb-3 space-y-1">
                      <div className="text-sm font-bold text-gray-800">{meta.label}</div>
                      <div className="text-[11px] text-gray-500">{meta.hint}</div>
                    </div>
                    <div className="mb-3 flex justify-center">
                      <StepperNumberInput
                        value={objectiveWeights[weight.key]}
                        onCommit={(value) => onWeightChange(weight.key, value)}
                        fallbackValue={objectiveWeights[weight.key]}
                        min={weight.min}
                        max={weight.max}
                        step={weight.step}
                        inputMode="numeric"
                        className="w-full max-w-xl"
                        inputClassName="px-3 text-base font-bold"
                        buttonClassName="h-10 w-10 text-base"
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

            {weightInputs.some(
              (w) => getWeightMeta(w.key, w, hardConstraints).inactive
            ) && (
              <div className="mt-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  現在のハード制約により無効
                </div>
                <div className="space-y-1">
                  {weightInputs
                    .map((weight) => ({ weight, meta: getWeightMeta(weight.key, weight, hardConstraints) }))
                    .filter(({ meta }) => meta.inactive)
                    .map(({ weight, meta }) => (
                      <div
                        key={weight.key}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-400">{meta.label}</span>
                            <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-400">
                              無効
                            </span>
                          </div>
                          {meta.inactiveReason && (
                            <div className="mt-0.5 text-[10px] text-gray-400">{meta.inactiveReason}</div>
                          )}
                        </div>
                        <span className="shrink-0 text-xs font-bold tabular-nums text-gray-400">
                          {objectiveWeights[weight.key]}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SettingsModalPortal>
  );
}