"use client";

import { useServerHealthMonitor } from "../hooks/useServerHealthMonitor";

export default function ServerStatusBanner() {
  const { status } = useServerHealthMonitor();

  if (status === "hidden") return null;

  const isBooting = status === "booting";

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50">
      <div
        className={`rounded-full border px-4 py-2 text-sm font-semibold shadow-lg transition-all duration-500 ${
          isBooting
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}
      >
        {isBooting
          ? "\u{1F504} \u30B5\u30FC\u30D0\u30FC\u30FBDB\u306B\u63A5\u7D9A\u4E2D...\uFF08\u6700\u59271\u5206\u7A0B\u5EA6\uFF09"
          : "\u2705 \u30B5\u30FC\u30D0\u30FC\u63A5\u7D9A\u6E08\u307F"}
      </div>
    </div>
  );
}
