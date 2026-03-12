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

      <div className="mb-4 rounded-lg border border-orange-100 bg-orange-50 p-3 shadow-sm md:mb-5 md:p-4">
        <h3 className="mb-3 flex flex-wrap items-center gap-2 text-md font-bold text-orange-800">
          <span>医師別スコア設定</span>
          <span className="rounded bg-orange-100 px-2 py-1 text-xs font-normal text-orange-600">個別 min / max / target</span>
        </h3>

        <div className="rounded-lg border bg-white pb-1 max-md:overflow-x-auto md:w-full">
          <table className="w-max min-w-full table-fixed text-center text-[12px] md:w-full">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="border-b px-3 py-2 text-left whitespace-nowrap max-md:min-w-[120px] md:w-32">医師</th>
                <th className="border-b px-2 py-2 whitespace-nowrap max-md:min-w-[132px] md:min-w-0">Min</th>
                <th className="border-b px-2 py-2 whitespace-nowrap max-md:min-w-[132px] md:min-w-0">Max</th>
                <th className="border-b px-2 py-2 whitespace-nowrap max-md:min-w-[132px] md:min-w-0">目標</th>
              </tr>
            </thead>
            <tbody>
              {activeDoctors.map((doctor) => (
                <tr key={doctor.id} className="border-b hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2 text-left font-bold text-gray-700 max-md:min-w-[120px] md:w-32">{doctor.name}</td>
                  <td className="whitespace-nowrap px-2 py-2 max-md:min-w-[132px] md:min-w-0">
                    <StepperNumberInput
                      value={minScoreMap[doctor.id] ?? scoreMin}
                      onCommit={(value) => onMinScoreChange(doctor.id, value)}
                      fallbackValue={scoreMin}
                      step={0.5}
                      inputMode="decimal"
                      className="justify-center whitespace-nowrap max-md:!min-w-[100px] md:!min-w-0 md:w-full"
                      inputClassName="min-w-[2rem] px-1 py-1 text-[12px]"
                      buttonClassName="h-9 w-9 text-sm"
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 max-md:min-w-[132px] md:min-w-0">
                    <StepperNumberInput
                      value={maxScoreMap[doctor.id] ?? scoreMax}
                      onCommit={(value) => onMaxScoreChange(doctor.id, value)}
                      fallbackValue={scoreMax}
                      step={0.5}
                      inputMode="decimal"
                      className="justify-center whitespace-nowrap max-md:!min-w-[100px] md:!min-w-0 md:w-full"
                      inputClassName="min-w-[2rem] px-1 py-1 text-[12px]"
                      buttonClassName="h-9 w-9 text-sm"
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 max-md:min-w-[132px] md:min-w-0">
                    <StepperNumberInput
                      value={targetScoreMap[doctor.id] ?? 0}
                      onCommit={(value) => onTargetScoreChange(doctor.id, value)}
                      fallbackValue={0}
                      step={0.5}
                      inputMode="decimal"
                      className="justify-center whitespace-nowrap max-md:!min-w-[100px] md:!min-w-0 md:w-full"
                      inputClassName="min-w-[2rem] bg-blue-50 px-1 py-1 text-[12px]"
                      buttonClassName="h-9 w-9 text-sm"
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