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
          title="全医師の Min / Max / 目標値と不可設定を保存します。"
        >
          {isBulkSavingDoctors ? "保存中..." : "全員の設定を保存"}
        </button>
        <div className="mt-2 text-[11px] text-gray-500">各医師の Min / Max / 目標値をまとめて調整し、そのまま保存できます。</div>
      </div>

      <div className="mb-4 rounded-lg border border-orange-100 bg-orange-50 p-2 shadow-sm md:mb-5 md:p-4">
        <h3 className="mb-2 flex flex-wrap items-center gap-1.5 text-sm font-bold text-orange-800 md:mb-3 md:gap-2 md:text-base">
          <span>医師別スコア設定</span>
          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-normal text-orange-600 md:px-2 md:py-1 md:text-xs">個別 min / max / target</span>
        </h3>

        <div className="rounded-lg border bg-white">
          <table className="w-full table-fixed text-center text-[10px] md:text-[12px]">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="w-[4.75rem] border-b px-1 py-1 text-left whitespace-nowrap md:w-32 md:px-3 md:py-2">医師</th>
                <th className="border-b px-1 py-1 whitespace-nowrap md:px-2 md:py-2">Min</th>
                <th className="border-b px-1 py-1 whitespace-nowrap md:px-2 md:py-2">Max</th>
                <th className="border-b px-1 py-1 whitespace-nowrap md:px-2 md:py-2">目標</th>
              </tr>
            </thead>
            <tbody>
              {activeDoctors.map((doctor) => (
                <tr key={doctor.id} className="border-b hover:bg-gray-50">
                  <td className="px-1 py-1 text-left font-bold text-gray-700 md:px-3 md:py-2">
                    <div className="truncate whitespace-nowrap" title={doctor.name}>
                      {doctor.name}
                    </div>
                  </td>
                  <td className="px-1 py-1 md:px-2 md:py-2">
                    <StepperNumberInput
                      value={minScoreMap[doctor.id] ?? scoreMin}
                      onCommit={(value) => onMinScoreChange(doctor.id, value)}
                      fallbackValue={scoreMin}
                      step={0.5}
                      inputMode="decimal"
                      className="mx-auto justify-center whitespace-nowrap"
                      inputClassName="w-12 text-[11px]"
                      buttonClassName="h-7 w-7 text-xs md:h-8 md:w-8 md:text-sm"
                    />
                  </td>
                  <td className="px-1 py-1 md:px-2 md:py-2">
                    <StepperNumberInput
                      value={maxScoreMap[doctor.id] ?? scoreMax}
                      onCommit={(value) => onMaxScoreChange(doctor.id, value)}
                      fallbackValue={scoreMax}
                      step={0.5}
                      inputMode="decimal"
                      className="mx-auto justify-center whitespace-nowrap"
                      inputClassName="w-12 text-[11px]"
                      buttonClassName="h-7 w-7 text-xs md:h-8 md:w-8 md:text-sm"
                    />
                  </td>
                  <td className="px-1 py-1 md:px-2 md:py-2">
                    <StepperNumberInput
                      value={targetScoreMap[doctor.id] ?? 0}
                      onCommit={(value) => onTargetScoreChange(doctor.id, value)}
                      fallbackValue={0}
                      step={0.5}
                      inputMode="decimal"
                      className="mx-auto justify-center whitespace-nowrap"
                      inputClassName="w-12 bg-blue-50 text-[11px]"
                      buttonClassName="h-7 w-7 text-xs md:h-8 md:w-8 md:text-sm"
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