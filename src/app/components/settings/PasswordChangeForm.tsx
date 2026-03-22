"use client";

import { useState } from "react";
import { getAuthHeaders } from "../../hooks/useAuth";

export default function PasswordChangeForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (next !== confirm) { setError("新しいパスワードが一致しません"); return; }
    if (next.length < 8) { setError("8文字以上必要です"); return; }
    setIsSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/auth/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = (data as Record<string, unknown>)?.detail;
        throw new Error(typeof detail === "string" ? detail : "変更に失敗しました");
      }
      setSuccess("パスワードを変更しました");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "変更に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">現在のパスワード</label>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <button type="submit" disabled={isSaving}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {isSaving ? "変更中..." : "変更する"}
      </button>
    </form>
  );
}
