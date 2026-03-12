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
        <div className="mt-2 text-[11px] text-gray-500">
          各医師の Min / Max / 目標値に加えて、医師別不可日設定と個別不可曜日の設定もまとめて保存できます。
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-orange-100 bg-orange-50 p-3 shadow-sm md:mb-5 md:p-4">
        <h3 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-bold text-orange-800 md:text-base">
          <span>医師別スコア設定</span>
          <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-normal text-orange-600 md:py-1 md:text-xs">
            個別のスコア上限下限と目標スコアを設定できます。
          </span>
        </h3>

        <div className="overflow-x-auto rounded-lg border bg-white pb-1">
          <table className="w-full min-w-[31rem] table-fixed text-center text-[11px] md:min-w-full md:text-[12px]">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="w-32 border-b px-2 py-2 text-left whitespace-nowrap md:px-3">医師</th>
                <th className="w-28 border-b px-2 py-2 whitespace-nowrap md:px-3">Min</th>
                <th className="w-28 border-b px-2 py-2 whitespace-nowrap md:px-3">Max</th>
                <th className="w-28 border-b px-2 py-2 whitespace-nowrap md:px-3">目標</th>
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
                      inputClassName="w-[3.4rem] text-[12px] md:w-12"
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
                      inputClassName="w-[3.4rem] text-[12px] md:w-12"
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
                      inputClassName="w-[3.4rem] bg-blue-50 text-[12px] md:w-12"
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
