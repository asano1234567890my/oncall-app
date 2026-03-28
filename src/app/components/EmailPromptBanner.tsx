"use client";

import { useState } from "react";
import { Mail, X, Check } from "lucide-react";
import { getAuthHeaders } from "../hooks/useAuth";

const DISMISSED_KEY = "oncall_email_banner_dismissed";

export default function EmailPromptBanner({
  hasEmail,
  onEmailRegistered,
}: {
  hasEmail: boolean;
  onEmailRegistered?: () => void;
}) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISSED_KEY) === "true"
  );
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (hasEmail || dismissed || success) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

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
        throw new Error(typeof detail === "string" ? detail : "登録に失敗しました");
      }

      setSuccess(true);
      localStorage.setItem("oncall_has_email", "true");
      localStorage.removeItem(DISMISSED_KEY);
      onEmailRegistered?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-start gap-3">
        <Mail className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          {!showForm ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-blue-800">
                メールアドレスを登録すると、メアドでもログインできるようになります。
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowForm(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
                >
                  登録する
                </button>
                <button onClick={handleDismiss} className="text-blue-400 hover:text-blue-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="example@hospital.jp"
                  className="flex-1 min-w-0 rounded-md border border-blue-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {isLoading ? "..." : "登録"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-blue-400 hover:text-blue-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
