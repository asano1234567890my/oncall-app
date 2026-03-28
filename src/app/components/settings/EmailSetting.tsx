"use client";

import { useEffect, useState } from "react";
import { Mail, Check, Pencil } from "lucide-react";
import { getAuthHeaders } from "../../hooks/useAuth";

export default function EmailSetting() {
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    fetch(`${apiUrl}/api/auth/me`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data: { email?: string | null }) => {
        setCurrentEmail(data.email ?? null);
        if (data.email) setEmail(data.email);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/auth/email`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const detail = (data as Record<string, unknown>)?.detail;
        throw new Error(typeof detail === "string" ? detail : "保存に失敗しました");
      }

      setCurrentEmail(email);
      setIsEditing(false);
      setSuccess("メールアドレスを保存しました");
      localStorage.setItem("oncall_has_email", "true");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-sm text-gray-400">読み込み中...</div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-bold text-gray-800 mb-3">メールアドレス</h3>
      {!isEditing ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="h-4 w-4 text-gray-400 shrink-0" />
            {currentEmail ? (
              <span className="text-sm text-gray-700 truncate">{currentEmail}</span>
            ) : (
              <span className="text-sm text-gray-400">未登録</span>
            )}
          </div>
          <button
            onClick={() => { setIsEditing(true); setError(""); setSuccess(""); }}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 shrink-0"
          >
            <Pencil className="h-3 w-3" />
            {currentEmail ? "変更" : "登録"}
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => { void handleSave(e); }} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="example@hospital.jp"
              className="flex-1 min-w-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "..." : "保存"}
            </button>
            <button
              type="button"
              onClick={() => { setIsEditing(false); setEmail(currentEmail ?? ""); setError(""); }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      )}
      {success && (
        <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
          <Check className="h-3 w-3" />
          {success}
        </div>
      )}
    </div>
  );
}
