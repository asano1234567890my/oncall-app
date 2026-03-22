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
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-lg font-extrabold text-gray-800"><Hospital className="h-5 w-5 text-blue-600" />シフらく</span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              ログイン
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </header>

      {/* ────────── ヒーローセクション ────────── */}
      <section className="px-4 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight md:text-5xl leading-tight">
            当直表づくり、<br className="sm:hidden" />
            まだExcelですか？
          </h1>
          <p className="mt-4 text-base text-gray-600 md:text-lg max-w-xl mx-auto">
            条件を入れるだけで、公平な当直表を自動作成。
            <br />
            スマホでもPCでも、すぐに使えます。
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
      <section className="bg-white px-4 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-xl font-bold text-gray-800 md:text-2xl mb-10">
            こんなお悩みありませんか？
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PainCard
              icon={Scale}
              title="誰かに偏ってしまう"
              description="当直回数・曜日の偏りを自動で均等に配分します。"
            />
            <PainCard
              icon={Calendar}
              title="希望日を集めるのが大変"
              description="医師ごとの専用リンクを送るだけ。各自がスマホで不可日を入力できます。"
            />
            <PainCard
              icon={RefreshCw}
              title="直すと別の所が崩れる"
              description="1か所直すたびに別のルール違反が出る。Excelの終わらない修正ループ。"
            />
          </div>
        </div>
      </section>

      {/* ────────── 3ステップ ────────── */}
      <section className="px-4 py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-xl font-bold text-gray-800 md:text-2xl mb-10">
            3ステップでかんたん
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
              title="調整して保存・出力"
              description="ルール違反を自動チェックしながら入れ替え。確定した枠だけ残して再作成もできます。"
            />
          </div>
        </div>
      </section>

      {/* ────────── デモセクション ────────── */}
      <section id="demo" className="bg-white px-4 py-16 md:py-20">
        <div className="max-w-xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 md:text-2xl mb-4 text-center">
            今すぐ試してみる
          </h2>
          <p className="text-gray-600 mb-8 text-center">
            登録不要で当直表の自動生成を体験できます。<br className="hidden sm:inline" />
            ルールを設定して、1か月分のシフトを自動生成。
          </p>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <InlineDemo />
          </div>
        </div>
      </section>

      {/* ────────── 最下部CTA ────────── */}
      <section className="px-4 py-16 md:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl font-bold text-gray-800 md:text-2xl mb-4">
            さあ、当直表作りをラクにしよう
          </h2>
          <p className="text-gray-600 mb-8">
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

function PainCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
      <div className="mb-3 flex justify-center"><Icon className="h-8 w-8 text-blue-600" /></div>
      <h3 className="text-base font-bold text-gray-800 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
        {number}
      </div>
      <h3 className="text-base font-bold text-gray-800 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}
