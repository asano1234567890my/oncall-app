"use client";

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../../hooks/useAuth";

export default function DefaultPageSetting() {
  const [defaultPage, setDefaultPage] = useState<"/app" | "/dashboard">("/app");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    fetch(`${apiUrl}/api/settings/kv/default_page`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data: unknown) => {
        const value = (data as Record<string, unknown>)?.value;
        if (value === "/dashboard") setDefaultPage("/dashboard");
      })
      .catch(() => {});
  }, []);

  const handleToggle = async (page: "/app" | "/dashboard") => {
    setDefaultPage(page);
    setIsSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      await fetch(`${apiUrl}/api/settings/kv/default_page`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ value: page }),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h4 className="text-sm font-bold text-gray-800 mb-2">ログイン後の初期画面</h4>
      <p className="text-xs text-gray-500 mb-3">ログイン後に表示される画面を選択できます。</p>
      <div className="flex gap-2">
        <button
          onClick={() => { void handleToggle("/app"); }}
          disabled={isSaving}
          className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-bold transition-colors ${
            defaultPage === "/app"
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-gray-200 text-gray-600 hover:border-blue-200"
          }`}
        >
          モバイル版
        </button>
        <button
          onClick={() => { void handleToggle("/dashboard"); }}
          disabled={isSaving}
          className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-bold transition-colors ${
            defaultPage === "/dashboard"
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-gray-200 text-gray-600 hover:border-blue-200"
          }`}
        >
          PC版
        </button>
      </div>
    </div>
  );
}
