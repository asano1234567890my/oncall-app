"use client";

import StepperNumberInput from "../inputs/StepperNumberInput";
import type { Doctor } from "../../types/dashboard";

type DoctorListManagerProps = {
  isBulkSavingDoctors: boolean;
  activeDoctors: Doctor[];
  minScoreMap: Record<string, number>;
  maxScoreMap: Record<string, number>;
  targetScoreMap: Record<string, number>;
  scoreMin: number;
  scoreMax: number;
  onSaveAllDoctorsSettings: () => void;
  onMinScoreChange: (doctorId: string, value: number) => void;
  onMaxScoreChange: (doctorId: string, value: number) => void;
  onTargetScoreChange: (doctorId: string, value: number) => void;
};

export default function DoctorListManager({
  isBulkSavingDoctors,
  activeDoctors,
  minScoreMap,
  maxScoreMap,
  targetScoreMap,
  scoreMin,
  scoreMax,
  onSaveAllDoctorsSettings,
  onMinScoreChange,
  onMaxScoreChange,
  onTargetScoreChange,
}: DoctorListManagerProps) {
  return (
    <>
      <div className="mb-4 md:mb-6">
        <button
          type="button"
          onClick={onSaveAllDoctorsSettings}
          disabled={isBulkSavingDoctors || activeDoctors.length === 0}
          className={`w-full rounded-xl py-3 font-bold text-white shadow-lg transition ${
            isBulkSavingDoctors ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
          title={"\u5168\u533b\u5e2b\u306e Min / Max / \u76ee\u6a19\u5024\u3068\u4e0d\u53ef\u8a2d\u5b9a\u3092\u4fdd\u5b58\u3057\u307e\u3059\u3002"}
        >
          {isBulkSavingDoctors ? "\u4fdd\u5b58\u4e2d..." : "\u5168\u54e1\u306e\u8a2d\u5b9a\u3092\u4fdd\u5b58"}
        </button>
        <div className="mt-2 text-[11px] text-gray-500">
          {"\u5404\u533b\u5e2b\u306e Min / Max / \u76ee\u6a19\u5024\u3092\u307e\u3068\u3081\u3066\u8abf\u6574\u3057\u3001\u305d\u306e\u307e\u307e\u4fdd\u5b58\u3067\u304d\u307e\u3059\u3002"}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-orange-100 bg-orange-50 p-3 shadow-sm md:mb-5 md:p-4">
        <h3 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-bold text-orange-800 md:text-base">
          <span>{"\u533b\u5e2b\u5225\u30b9\u30b3\u30a2\u8a2d\u5b9a"}</span>
          <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-normal text-orange-600 md:py-1 md:text-xs">
            {"\u500b\u5225 min / max / target"}
          </span>
        </h3>

        <div className="overflow-x-auto rounded-lg border bg-white pb-1">
          <table className="w-full min-w-[31rem] table-fixed text-center text-[11px] md:min-w-full md:text-[12px]">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="w-32 border-b px-2 py-2 text-left whitespace-nowrap md:px-3">{"\u533b\u5e2b"}</th>
                <th className="w-28 border-b px-2 py-2 whitespace-nowrap md:px-3">Min</th>
                <th className="w-28 border-b px-2 py-2 whitespace-nowrap md:px-3">Max</th>
                <th className="w-28 border-b px-2 py-2 whitespace-nowrap md:px-3">{"\u76ee\u6a19"}</th>
              </tr>
            </thead>
            <tbody>
              {activeDoctors.map((doctor) => (
                <tr key={doctor.id} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-2 text-left font-bold text-gray-700 md:px-3">
                    <div className="truncate whitespace-nowrap" title={doctor.name}>
                      {doctor.name}
                    </div>
                  </td>
                  <td className="px-2 py-2 md:px-3">
                    <StepperNumberInput
                      value={minScoreMap[doctor.id] ?? scoreMin}
                      onCommit={(value) => onMinScoreChange(doctor.id, value)}
                      fallbackValue={scoreMin}
                      step={0.5}
                      inputMode="decimal"
                      className="mx-auto justify-center whitespace-nowrap"
                      inputClassName="w-12 text-[12px]"
                      buttonClassName="h-8 w-8 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2 md:px-3">
                    <StepperNumberInput
                      value={maxScoreMap[doctor.id] ?? scoreMax}
                      onCommit={(value) => onMaxScoreChange(doctor.id, value)}
                      fallbackValue={scoreMax}
                      step={0.5}
                      inputMode="decimal"
                      className="mx-auto justify-center whitespace-nowrap"
                      inputClassName="w-12 text-[12px]"
                      buttonClassName="h-8 w-8 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2 md:px-3">
                    <StepperNumberInput
                      value={targetScoreMap[doctor.id] ?? 0}
                      onCommit={(value) => onTargetScoreChange(doctor.id, value)}
                      fallbackValue={0}
                      step={0.5}
                      inputMode="decimal"
                      className="mx-auto justify-center whitespace-nowrap"
                      inputClassName="w-12 bg-blue-50 text-[12px]"
                      buttonClassName="h-8 w-8 text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}