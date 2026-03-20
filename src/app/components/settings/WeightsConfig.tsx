"use client";

import { X } from "lucide-react";
import StepperNumberInput from "../inputs/StepperNumberInput";
import type { HardConstraints, ObjectiveWeights } from "../../types/dashboard";
import SettingsModalPortal from "./SettingsModalPortal";
import { getWeightMeta, weightInputs, weightGroups, expandWeightGroups } from "./shared";
import type { WeightGroup } from "./shared";

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
  /** 個別ウェイト変更（/app 用） */
  onWeightChange?: (key: keyof ObjectiveWeights, value: number) => void;
  /** 一括ウェイト変更（/dashboard グループモード用） */
  onSetWeights?: (weights: ObjectiveWeights) => void;
  /** true でグループモード（4軸表示） */
  grouped?: boolean;
};

function GroupedSlider({
  group,
  value,
  onChange,
}: {
  group: WeightGroup;
  value: number;
  onChange: (groupId: string, newValue: number) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
      <div className="mb-3 space-y-1">
        <div className="text-sm font-bold text-gray-800">{group.label}</div>
        <div className="text-[11px] text-gray-500">{group.hint}</div>
      </div>
      <div className="mb-3 flex justify-center">
        <StepperNumberInput
          value={value}
          onCommit={(v) => onChange(group.id, v)}
          fallbackValue={value}
          min={group.min}
          max={group.max}
          step={group.step}
          inputMode="numeric"
          className="w-full max-w-xl"
          inputClassName="px-3 text-base font-bold"
          buttonClassName="h-10 w-10 text-base"
        />
      </div>
      <input
        type="range"
        value={value}
        onChange={(event) => onChange(group.id, Number(event.target.value))}
        min={group.min}
        max={group.max}
        step={group.step}
        className="w-full accent-blue-600"
      />
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>{group.min}</span>
        <span>{group.max}</span>
      </div>
    </div>
  );
}

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
  onSetWeights,
  grouped = false,
}: WeightsConfigProps) {
  const handleGroupChange = (groupId: string, newValue: number) => {
    if (onSetWeights) {
      onSetWeights(expandWeightGroups(objectiveWeights, groupId, newValue));
    }
  };

  return (
    <SettingsModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
        <div className="flex max-h-[85dvh] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl sm:max-h-[90vh]">
          <div className="flex items-start justify-between gap-2 border-b border-blue-100 bg-blue-50 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900">優先度の調整</h3>
                {onShowGuide && (
                  <button type="button" onClick={onShowGuide} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 text-[10px] font-bold text-gray-400 transition hover:bg-white hover:text-gray-600">?</button>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">数値が大きいほど優先されます</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {onSave && (
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving}
                    className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "保存中…" : "保存"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onReset}
                  className="rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-50"
                >
                  既定値に戻す
                </button>
                {saveMessage && (
                  <span className="text-xs font-bold text-emerald-700">{saveMessage}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white hover:text-gray-700"
              aria-label="閉じる"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="space-y-3">
              {grouped ? (
                /* ── グループモード（/dashboard: 4軸） ── */
                weightGroups.map((group) => (
                  <GroupedSlider
                    key={group.id}
                    group={group}
                    value={objectiveWeights[group.primaryKey]}
                    onChange={handleGroupChange}
                  />
                ))
              ) : (
                /* ── 個別モード（/app: 12個） ── */
                <>
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
                            onCommit={(value) => onWeightChange?.(weight.key, value)}
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
                          onChange={(event) => onWeightChange?.(weight.key, Number(event.target.value))}
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </SettingsModalPortal>
  );
}
