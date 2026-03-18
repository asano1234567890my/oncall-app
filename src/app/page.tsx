// src/app/page.tsx
// フェーズ1b でランディングページに置き換え予定
// 現在は認証状態に応じてリダイレクト
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "./hooks/useAuth";

export default function RootPage() {
  const router = useRouter();
  const { auth, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (auth.isAuthenticated) {
      // 認証済み → ダッシュボード（/app 実装後はそちらへ変更）
      router.replace("/dashboard");
    } else {
      // 未認証 → ログイン画面
      router.replace("/login");
    }
  }, [auth.isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );
}
