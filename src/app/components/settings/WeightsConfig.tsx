"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import StepperNumberInput from "../inputs/StepperNumberInput";
import type { HardConstraints, ObjectiveWeights } from "../../types/dashboard";
import SettingsModalPortal from "./SettingsModalPortal";
import { getWeightMeta, weightInputs, weightGroups, expandWeightGroups } from "./shared";
import { Info } from "lucide-react";
import type { WeightGroup, WeightRatioOverrides, WeightChildMeta } from "./shared";

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
  /** 比率オーバーライド */
  ratioOverrides?: WeightRatioOverrides;
  onRatioOverridesChange?: (overrides: WeightRatioOverrides) => void;
};

// ── 子要素の比率スライダー ──
function ChildRatioSlider({
  child,
  currentRatio,
  parentValue,
  onChange,
}: {
  child: WeightChildMeta;
  currentRatio: number;
  parentValue: number;
  onChange: (ratio: number) => void;
}) {
  const effectiveValue = Math.round(parentValue * currentRatio);

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-700">{child.label}</span>
        <span className="text-[11px] tabular-nums text-gray-500">
          比率 {currentRatio.toFixed(1)} → 実効値 <span className="font-bold text-gray-700">{effectiveValue}</span>
        </span>
      </div>
      <div className="text-[10px] text-gray-400 mb-2">{child.hint}</div>
      <input
        type="range"
        value={currentRatio}
        onChange={(e) => onChange(Number(e.target.value))}
        min={0}
        max={1}
        step={0.1}
        className="w-full accent-blue-600"
      />
      <div className="mt-0.5 flex justify-between text-[10px] text-gray-400">
        <span>0.0</span>
        <span>1.0</span>
      </div>
    </div>
  );
}

// ── グループスライダー（?ボタン・説明パネル・比率調整付き） ──
function GroupedSlider({
  group,
  value,
  onChange,
  ratioOverrides,
  onRatioChange,
}: {
  group: WeightGroup;
  value: number;
  onChange: (groupId: string, newValue: number) => void;
  ratioOverrides?: WeightRatioOverrides;
  onRatioChange?: (groupId: string, key: keyof ObjectiveWeights, ratio: number) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [expandedChild, setExpandedChild] = useState<keyof ObjectiveWeights | null>(null);
  const hasChildren = group.children && group.children.length > 0;

  const getCurrentRatio = (child: WeightChildMeta): number => {
    return ratioOverrides?.[group.id]?.[child.key] ?? child.ratio;
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
      <div className="mb-3 space-y-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold text-gray-800">{group.label}</div>
          {hasChildren && (
            <button
              type="button"
              onClick={() => { setShowDetail(!showDetail); setExpandedChild(null); }}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 text-[10px] font-bold text-gray-400 transition hover:bg-white hover:text-gray-600"
            >
              ?
            </button>
          )}
        </div>
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

      {/* ── 説明パネル ── */}
      {hasChildren && showDetail && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-white p-3">
          <div className="mb-2 text-xs text-gray-600">
            「{group.label}」は内部で{group.children!.length}つの要素に分かれています。
            各要素の比率を変えたい場合はタップしてください。
          </div>
          <div className="space-y-1.5">
            {group.children!.map((child) => {
              const ratio = getCurrentRatio(child);
              const isExpanded = expandedChild === child.key;
              const effectiveValue = Math.round(value * ratio);

              return (
                <div key={child.key}>
                  <button
                    type="button"
                    onClick={() => setExpandedChild(isExpanded ? null : child.key)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-700">{child.label}</span>
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] tabular-nums font-semibold text-gray-500">
                        ×{ratio.toFixed(1)} → {effectiveValue}
                      </span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div className="mt-1.5 ml-1">
                      <ChildRatioSlider
                        child={child}
                        currentRatio={ratio}
                        parentValue={value}
                        onChange={(newRatio) => onRatioChange?.(group.id, child.key, newRatio)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-[10px] text-gray-400">
            比率 × 上のスライダー値 = 実際の重み。比率1.0で親と同じ値になります。
          </div>
        </div>
      )}
    </div>
  );
}

// ── 勤務間隔のゆとり: +N日入力 + ?説明 ──
function IdealGapExtraInput({
  extra,
  hardInterval,
  onChange,
}: {
  extra: number;
  hardInterval: number;
  onChange: (value: number) => void;
}) {
  const [showExplain, setShowExplain] = useState(false);
  const base = hardInterval > 0 ? hardInterval : 4;
  const ideal = base + extra;

  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-gray-700">理想の追加日数</span>
        <button
          type="button"
          onClick={() => setShowExplain(!showExplain)}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 text-[10px] font-bold text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        >
          ?
        </button>
      </div>
      <div className="flex items-center gap-3">
        <StepperNumberInput
          value={extra}
          onCommit={onChange}
          fallbackValue={3}
          min={0}
          max={7}
          step={1}
          inputMode="numeric"
          inputClassName="text-sm font-bold w-12"
          buttonClassName="h-8 w-8 text-sm"
        />
        <span className="text-xs text-gray-500">
          +{extra}日（ハード{base}日 → 理想{ideal}日）
        </span>
      </div>
      {showExplain && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
            <div className="text-[11px] text-gray-600 space-y-1.5">
              <p>
                ハード制約の勤務間隔（{base}日）は絶対に守られます。
                この設定では、さらに<strong>+{extra}日</strong>までの間隔にグラデーションでペナルティをかけます。
              </p>
              <p>ハード制約に近いほどペナルティが重く、理想間隔に近づくほど軽くなります。</p>
              {extra > 0 && (
                <div className="rounded border border-blue-100 bg-white p-2">
                  <div className="text-[10px] font-bold text-gray-500 mb-1">ペナルティのイメージ:</div>
                  {Array.from({ length: extra }, (_, i) => {
                    const gap = base + i + 1;
                    const pct = Math.round(((extra - i) / extra) * 100);
                    return (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span className="w-16 text-gray-600">{gap}日間隔:</span>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right tabular-nums text-gray-500">{pct}%</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span className="w-16">{ideal + 1}日以上:</span>
                    <span>ペナルティなし</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
  ratioOverrides,
  onRatioOverridesChange,
}: WeightsConfigProps) {
  const handleGroupChange = (groupId: string, newValue: number) => {
    if (onSetWeights) {
      onSetWeights(expandWeightGroups(objectiveWeights, groupId, newValue, ratioOverrides));
    }
  };

  const handleRatioChange = (groupId: string, key: keyof ObjectiveWeights, ratio: number) => {
    if (!onRatioOverridesChange || !onSetWeights) return;
    const next: WeightRatioOverrides = {
      ...ratioOverrides,
      [groupId]: { ...ratioOverrides?.[groupId], [key]: ratio },
    };
    onRatioOverridesChange(next);
    // 比率変更後、現在の親スライダー値で子要素を再計算
    const group = weightGroups.find((g) => g.id === groupId);
    if (group) {
      onSetWeights(expandWeightGroups(objectiveWeights, groupId, objectiveWeights[group.primaryKey], next));
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
                /* ── グループモード（3軸） ── */
                <>
                  {weightGroups.map((group) => (
                    <div key={group.id}>
                      <GroupedSlider
                        group={group}
                        value={objectiveWeights[group.primaryKey]}
                        onChange={handleGroupChange}
                        ratioOverrides={ratioOverrides}
                        onRatioChange={handleRatioChange}
                      />
                      {/* 勤務間隔のゆとり: +N日ステッパー */}
                      {group.id === "ideal_gap" && (
                        <IdealGapExtraInput
                          extra={objectiveWeights.ideal_gap_extra}
                          hardInterval={hardConstraints.interval_days}
                          onChange={(v) => onSetWeights?.({ ...objectiveWeights, ideal_gap_extra: v })}
                        />
                      )}
                    </div>
                  ))}
                </>
              ) : (
                /* ── 個別モード（/app: 12個） ── */
                <>
                  {weightInputs
                    .map((weight) => ({ weight, meta: getWeightMeta(weight.key, weight, hardConstraints) }))
                    .filter(({ meta }) => !meta.inactive)
                    .map(({ weight, meta }) => (
                      <div key={weight.key}>
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
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
                        {weight.key === "ideal_gap_weight" && (
                          <IdealGapExtraInput
                            extra={objectiveWeights.ideal_gap_extra}
                            hardInterval={hardConstraints.interval_days}
                            onChange={(v) => onWeightChange?.("ideal_gap_extra", v)}
                          />
                        )}
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
