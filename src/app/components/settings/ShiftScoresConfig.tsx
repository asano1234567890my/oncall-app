"use client";

import StepperNumberInput from "../inputs/StepperNumberInput";
import type { ShiftScores } from "../../types/dashboard";
import { DEFAULT_SHIFT_SCORES } from "../../types/dashboard";
import SettingsModalPortal from "./SettingsModalPortal";

const SHIFT_SCORE_ITEMS: {
  key: keyof ShiftScores;
  label: string;
  hint: string;
  editable: boolean;
}[] = [
  {
    key: "weekday_night",
    label: "平日 当直",
    hint: "基準値（固定）。他のスコアはこれを1.0として相対的に設定します。",
    editable: false,
  },
  {
    key: "saturday_night",
    label: "土曜 当直",
    hint: "土曜夜の当直スコア。平日より重い場合は1.0以上に。",
    editable: true,
  },
  {
    key: "holiday_day",
    label: "日祝 日直",
    hint: "日曜・祝日の日直（午前）スコア。",
    editable: true,
  },
  {
    key: "holiday_night",
    label: "日祝 当直",
    hint: "日曜・祝日の当直（夜間）スコア。",
    editable: true,
  },
];

type ShiftScoresConfigProps = {
  isOpen: boolean;
  shiftScores: ShiftScores;
  isSaving?: boolean;
  saveMessage?: string;
  onClose: () => void;
  onReset: () => void;
  onSave?: () => void;
  onShowGuide?: () => void;
  onShiftScoreChange: (key: keyof ShiftScores, value: number) => void;
};

export default function ShiftScoresConfig({
  isOpen,
  shiftScores,
  isSaving = false,
  saveMessage = "",
  onClose,
  onReset,
  onSave,
  onShowGuide,
  onShiftScoreChange,
}: ShiftScoresConfigProps) {
  return (
    <SettingsModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
        <div className="flex max-h-[85dvh] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-2xl sm:max-h-[90vh]">
          <div className="flex items-start justify-between gap-4 border-b border-amber-100 bg-amber-50 px-4 py-4 sm:px-5">
            <div>
              <h3 className="text-base font-bold text-gray-900">シフトスコア</h3>
              <p className="mt-1 text-xs text-gray-500">シフト種別ごとの負担度を設定します。平日当直 = 1.0 を基準に調整してください。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onSave && (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSaving}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "保存中..." : "保存"}
                </button>
              )}
              <button
                type="button"
                onClick={onReset}
                className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-50"
              >
                既定値に戻す
              </button>
              {onShowGuide && (
                <button type="button" onClick={onShowGuide} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">?</button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50"
              >
                閉じる
              </button>
              {saveMessage && (
                <span className="text-xs font-bold text-emerald-700">{saveMessage}</span>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
            {SHIFT_SCORE_ITEMS.map((item) => (
              <div key={item.key} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="mb-1 text-[11px] font-bold text-gray-700">{item.label}</div>
                <div className="mb-2 text-[11px] text-gray-500">{item.hint}</div>
                {item.editable ? (
                  <StepperNumberInput
                    value={shiftScores[item.key]}
                    onCommit={(v) => onShiftScoreChange(item.key, v)}
                    fallbackValue={DEFAULT_SHIFT_SCORES[item.key]}
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    inputMode="decimal"
                    inputClassName="text-sm font-bold"
                  />
                ) : (
                  <div className="text-sm font-bold text-gray-500">{shiftScores[item.key].toFixed(1)}（固定）</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SettingsModalPortal>
  );
}
