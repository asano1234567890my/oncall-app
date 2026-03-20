"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, getAuthHeaders } from "../hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { auth, isLoading: isAuthLoading, login } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ログイン済みならリダイレクト
  useEffect(() => {
    if (isAuthLoading) return;
    if (auth.isAuthenticated) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      fetch(`${apiUrl}/api/settings/kv/default_page`, { headers: getAuthHeaders() })
        .then((res) => res.json())
        .then((data: unknown) => {
          const value = (data as Record<string, unknown>)?.value;
          router.replace(value === "/dashboard" ? "/dashboard" : "/app");
        })
        .catch(() => router.replace("/app"));
    }
  }, [auth.isAuthenticated, isAuthLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(name, password);
      // Check user's default page preference
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      let dest = "/app";
      try {
        const res = await fetch(`${apiUrl}/api/settings/kv/default_page`, { headers: getAuthHeaders() });
        const data: unknown = await res.json();
        const value = (data as Record<string, unknown>)?.value;
        if (value === "/dashboard") dest = "/dashboard";
      } catch { /* default to /app */ }
      router.push(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  // ログイン済みチェック中
  if (isAuthLoading || auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 gap-8">
      {/* ヒーローセクション */}
      <div className="text-center max-w-lg">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
          🏥 シフらく
        </h1>
        <p className="text-base font-semibold text-gray-500 mb-6">
          さくっと当直表。あとで細かく調整。
        </p>
        <ul className="text-sm text-gray-500 space-y-1.5">
          <li>当直表作成を、もっと早く、もっと公平に。</li>
          <li>AIでたたき台を作り、現場で仕上げる。</li>
          <li>希望休も固定曜日も、まとめて反映。</li>
        </ul>
      </div>

      {/* ログインカード */}
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8">
        <p className="text-sm text-gray-500 text-center mb-6">病院名とパスワードでログイン</p>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">病院名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Hospital name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          初めての方は{" "}
          <Link href="/register" className="text-blue-600 hover:underline font-medium">
            新規登録
          </Link>
        </p>
      </div>
    </div>
  );
}
