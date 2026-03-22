// src/app/page.tsx — ランディングページ（LP）
"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Hospital, Scale, Calendar, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InlineDemo from "./components/InlineDemo";
import { useAuth, getAuthHeaders } from "./hooks/useAuth";

export default function LandingPage() {
  const router = useRouter();
  const { auth, isLoading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (auth.isAuthenticated) {
      // Check user's default page preference
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      fetch(`${apiUrl}/api/settings/kv/default_page`, { headers: getAuthHeaders() })
        .then((res) => res.json())
        .then((data: unknown) => {
          const value = (data as Record<string, unknown>)?.value;
          router.replace(value === "/dashboard" ? "/dashboard" : "/app");
        })
        .catch(() => router.replace("/app"));
    } else {
      setReady(true);
    }
  }, [auth.isAuthenticated, isLoading, router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* ────────── ヘッダー ────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between sm:px-4 sm:py-3">
          <span className="flex items-center gap-1.5 text-base font-extrabold text-gray-800 sm:text-lg"><Hospital className="h-5 w-5 text-blue-600" />シフらく</span>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors sm:px-4 sm:py-2 sm:text-sm"
            >
              ログイン
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors sm:px-4 sm:py-2 sm:text-sm"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </header>

      {/* ────────── ヒーローセクション ────────── */}
      <section className="px-3 pt-12 pb-14 sm:px-4 md:pt-24 md:pb-28">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight md:text-5xl leading-tight">
            当直表づくり、
            <br />
            まだExcelですか？
          </h1>
          <p className="mt-4 text-sm text-gray-600 sm:text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            条件を入れるだけで公平な当直表を自動作成。
            <br />
            スマホでもPCでも使えます。
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="w-full sm:w-auto rounded-xl bg-blue-600 px-8 py-3 text-base font-bold text-white shadow-lg hover:bg-blue-700 transition-colors"
            >
              無料で始める
            </Link>
            <Link
              href="#demo"
              className="w-full sm:w-auto rounded-xl border-2 border-blue-600 px-8 py-3 text-base font-bold text-blue-600 hover:bg-blue-50 transition-colors"
            >
              デモを試す
            </Link>
          </div>
        </div>
      </section>

      {/* ────────── ペインポイント ────────── */}
      <section className="bg-white px-3 py-10 sm:px-4 md:py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-lg font-bold text-gray-800 sm:text-xl md:text-2xl mb-6 md:mb-10">
            こんなお悩み、ありませんか？
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <PainCard
              icon={Scale}
              title="特定の人に偏る"
              description="当直回数・曜日の偏りを自動で均等に配分します。"
            />
            <PainCard
              icon={Calendar}
              title="希望日の収集が大変"
              description="医師ごとの専用リンクを送るだけ。各自のスマホで不可日を入力できます。"
            />
            <PainCard
              icon={RefreshCw}
              title="直すと別が崩れる"
              description="ルール違反を自動で検知。一部を固定したまま残りだけ再作成できます。"
            />
          </div>
        </div>
      </section>

      {/* ────────── 3ステップ ────────── */}
      <section className="px-3 py-10 sm:px-4 md:py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-lg font-bold text-gray-800 sm:text-xl md:text-2xl mb-6 md:mb-10">
            3ステップで完成
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <StepCard
              number={1}
              title="人数とルールを設定"
              description="医師の人数・当直間隔・上限回数などを、かんたんな質問形式で設定できます。"
            />
            <StepCard
              number={2}
              title="ボタンひとつで自動作成"
              description="ルールに沿った公平なシフトを数秒で自動作成します。"
            />
            <StepCard
              number={3}
              title="調整して保存"
              description="ルール違反を自動チェックしながら入れ替え。確定した枠だけ残して再作成もできます。"
            />
          </div>
        </div>
      </section>

      {/* ────────── デモセクション ────────── */}
      <section id="demo" className="bg-white px-3 py-10 sm:px-4 md:py-20">
        <div className="max-w-xl mx-auto">
          <h2 className="text-lg font-bold text-gray-800 sm:text-xl md:text-2xl mb-3 text-center">
            まずは試してみる
          </h2>
          <p className="text-sm text-gray-600 sm:text-base mb-6 text-center leading-relaxed">
            登録不要で体験できます。ルールを設定して自動生成をお試しください。
          </p>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
            <InlineDemo />
          </div>
        </div>
      </section>

      {/* ────────── 最下部CTA ────────── */}
      <section className="px-3 py-10 sm:px-4 md:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-lg font-bold text-gray-800 sm:text-xl md:text-2xl mb-3">
            さあ、当直表作りをラクにしよう
          </h2>
          <p className="text-sm text-gray-600 sm:text-base mb-6">
            無料でアカウントを作成して、今すぐ使い始められます。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="w-full sm:w-auto rounded-xl bg-blue-600 px-8 py-3 text-base font-bold text-white shadow-lg hover:bg-blue-700 transition-colors"
            >
              無料で始める
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto rounded-xl border-2 border-gray-300 px-8 py-3 text-base font-bold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              ログイン
            </Link>
          </div>
        </div>
      </section>

      {/* ────────── フッター ────────── */}
      <footer className="border-t bg-white px-4 py-8">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} シフらく. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

/* ────────── サブコンポーネント ────────── */

function PainCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-center sm:p-6">
      <div className="mb-2 flex justify-center"><Icon className="h-7 w-7 text-blue-600 sm:h-8 sm:w-8" /></div>
      <h3 className="text-sm font-bold text-gray-800 mb-1.5 sm:text-base sm:mb-2">{title}</h3>
      <p className="text-xs text-gray-600 leading-relaxed sm:text-sm">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white sm:mb-4 sm:h-12 sm:w-12 sm:text-lg">
        {number}
      </div>
      <h3 className="text-sm font-bold text-gray-800 mb-1.5 sm:text-base sm:mb-2">{title}</h3>
      <p className="text-xs text-gray-600 leading-relaxed sm:text-sm">{description}</p>
    </div>
  );
}
