"use client";

import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenDoctorManage: () => void;
};

export default function InfeasibleGuideModal({ open, onClose, onOpenSettings, onOpenDoctorManage }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-800">解が見つからない場合の対処法</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 text-xs text-gray-600">
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="font-bold text-green-800 mb-1">1. ハード制約を緩和する</p>
            <p className="text-green-700 mb-2">勤務間隔・土日祝上限・土曜上限・スコア上限を調整します。</p>
            <button
              onClick={() => { onClose(); onOpenSettings(); }}
              className="w-full rounded-lg border border-green-300 bg-white py-2 text-xs font-bold text-green-700 hover:bg-green-50 transition"
            >
              設定パネルを開く
            </button>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="font-bold text-amber-800 mb-1">2. 不可日の上限を設定する</p>
            <p className="text-amber-700 mb-2">医師ごとに月あたりの不可日数を制限できます。</p>
            <button
              onClick={() => { onClose(); onOpenDoctorManage(); }}
              className="w-full rounded-lg border border-amber-300 bg-white py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 transition"
            >
              医師管理を開く
            </button>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="font-bold text-gray-700 mb-1">3. 全体をソフト化する（最終手段）</p>
            <p className="text-gray-500 mb-2">不可日をなるべく尊重しつつ、必要時は無視して生成します。</p>
            <button
              onClick={() => { onClose(); onOpenDoctorManage(); }}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 transition"
            >
              医師管理で一括ソフト化
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
