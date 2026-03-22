"use client";

import { RefreshCw, CheckCircle } from "lucide-react";
import { useServerHealthMonitor } from "../hooks/useServerHealthMonitor";

export default function ServerStatusBanner() {
  const { status } = useServerHealthMonitor();

  if (status === "hidden") return null;

  const isBooting = status === "booting";

  return (
    <div className="pointer-events-none fixed inset-x-4 top-20 z-50 md:inset-x-auto md:right-4">
      <div
        className={`mx-auto flex max-w-sm items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-center text-sm font-semibold shadow-lg transition-all duration-500 md:max-w-none ${
          isBooting
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}
      >
        {isBooting ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            サーバー・DBに接続中...（最大1分程度）
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4" />
            サーバー接続済み
          </>
        )}
      </div>
    </div>
  );
}
