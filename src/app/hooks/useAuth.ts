// src/app/hooks/useAuth.ts
"use client";

import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "oncall_token";
const HOSPITAL_ID_KEY = "oncall_hospital_id";
const HOSPITAL_NAME_KEY = "oncall_hospital_name";
const HAS_EMAIL_KEY = "oncall_has_email";

export type AuthState = {
  token: string | null;
  hospitalId: string | null;
  hospitalName: string | null;
  isAuthenticated: boolean;
  hasEmail: boolean;
};

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    token: null,
    hospitalId: null,
    hospitalName: null,
    isAuthenticated: false,
    hasEmail: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const hospitalId = localStorage.getItem(HOSPITAL_ID_KEY);
    const hospitalName = localStorage.getItem(HOSPITAL_NAME_KEY);
    const hasEmail = localStorage.getItem(HAS_EMAIL_KEY) === "true";
    if (!token) {
      setIsLoading(false);
      return;
    }
    // トークンの有効性をAPIで検証 + メアド状態を取得
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    fetch(`${apiUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.status === 401) {
          // トークン期限切れ → 自動ログアウト
          localStorage.removeItem(TOKEN_KEY);
          const hid = localStorage.getItem(HOSPITAL_ID_KEY);
          localStorage.removeItem(HOSPITAL_ID_KEY);
          localStorage.removeItem(HOSPITAL_NAME_KEY);
          localStorage.removeItem(HAS_EMAIL_KEY);
          if (hid) localStorage.removeItem(`setup_completed_${hid}`);
          localStorage.removeItem("setup_completed"); // legacy cleanup
          setAuth({ token: null, hospitalId: null, hospitalName: null, isAuthenticated: false, hasEmail: false });
        } else {
          return res.json().then((data: { has_email?: boolean }) => {
            const emailStatus = data.has_email ?? hasEmail;
            localStorage.setItem(HAS_EMAIL_KEY, String(emailStatus));
            setAuth({ token, hospitalId, hospitalName, isAuthenticated: true, hasEmail: emailStatus });
          });
        }
      })
      .catch(() => {
        // ネットワークエラー時はローカルのトークンを信用
        setAuth({ token, hospitalId, hospitalName, isAuthenticated: true, hasEmail });
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (name: string, password: string): Promise<void> => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });

    if (!res.ok) {
      const data: unknown = await res.json().catch(() => ({}));
      const detail = (data as Record<string, unknown>)?.detail;
      throw new Error(typeof detail === "string" ? detail : "ログインに失敗しました");
    }

    const data = await res.json() as { access_token: string; hospital_id: string; hospital_name: string; has_email?: boolean };
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(HOSPITAL_ID_KEY, data.hospital_id);
    localStorage.setItem(HOSPITAL_NAME_KEY, data.hospital_name);
    localStorage.setItem(HAS_EMAIL_KEY, String(data.has_email ?? false));
    setAuth({
      token: data.access_token,
      hospitalId: data.hospital_id,
      hospitalName: data.hospital_name,
      isAuthenticated: true,
      hasEmail: data.has_email ?? false,
    });
  }, []);

  const logout = useCallback(() => {
    const hid = localStorage.getItem(HOSPITAL_ID_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(HOSPITAL_ID_KEY);
    localStorage.removeItem(HOSPITAL_NAME_KEY);
    localStorage.removeItem(HAS_EMAIL_KEY);
    if (hid) localStorage.removeItem(`setup_completed_${hid}`);
    localStorage.removeItem("setup_completed"); // legacy cleanup
    setAuth({ token: null, hospitalId: null, hospitalName: null, isAuthenticated: false, hasEmail: false });
  }, []);

  return { auth, isLoading, login, logout };
}

export function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
