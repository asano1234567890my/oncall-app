"use client";

import { AlertTriangle } from "lucide-react";

type Props = {
  mismatchDays: { day: number; ymd: string }[];
  onAddHolidays: () => void;
  onSaveCustomHolidays: () => void;
  isSaving: boolean;
};

export default function HolidayMismatchBanner({ mismatchDays, onAddHolidays, onSaveCustomHolidays, isSaving }: Props) {
  if (mismatchDays.length === 0) return null;

  const dayList = mismatchDays.map((m) => `${m.day}日`).join("、");

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800">
          <p className="font-bold">日直データがありますが、祝日に設定されていない日があります</p>
          <p className="mt-0.5 text-amber-600">{dayList}</p>
          <p className="mt-1 text-[10px] text-amber-600">
            祝日に追加しないと、日直セルが表示されず保存時にデータが消失する可能性があります。
          </p>
        </div>
      </div>
      <div className="flex gap-2 ml-6">
        <button
          onClick={() => { onAddHolidays(); onSaveCustomHolidays(); }}
          disabled={isSaving}
          className="rounded-md bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? "保存中..." : "祝日に追加して保存"}
        </button>
      </div>
    </div>
  );
}
