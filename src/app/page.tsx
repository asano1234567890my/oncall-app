// src/app/page.tsx — ランディングページ（LP）
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./hooks/useAuth";

export default function LandingPage() {
  const router = useRouter();
  const { auth, isLoading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (auth.isAuthenticated) {
      router.replace("/dashboard");
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
          <span className="text-lg font-extrabold text-gray-800">🏥 シフらく</span>
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
            あとはドラッグ&ドロップで微調整するだけ。
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
              emoji="⚖️"
              title="誰かに偏ってしまう"
              description="当直回数・スコアを自動で公平に配分。手動で調整する必要はありません。"
            />
            <PainCard
              emoji="📅"
              title="希望日の調整が大変"
              description="医師ごとに専用リンクを発行。各自がスマホで不可日を入力できます。"
            />
            <PainCard
              emoji="🔄"
              title="作り直しが面倒"
              description="ドラッグ&ドロップで即修正。ロック機能で確定済み枠を保護しながら再生成できます。"
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
              title="人数とルールを入力"
              description="医師の人数・当直間隔・上限回数などを設定します。初回は質問形式でガイドします。"
            />
            <StepCard
              number={2}
              title="自動生成ボタンを押す"
              description="AI最適化エンジンが制約を満たす最適なシフトを自動で生成します。"
            />
            <StepCard
              number={3}
              title="手動で微調整"
              description="生成されたシフトをドラッグ&ドロップで調整。確定したらDBに保存できます。"
            />
          </div>
        </div>
      </section>

      {/* ────────── デモセクション（プレースホルダー） ────────── */}
      <section id="demo" className="bg-white px-4 py-16 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl font-bold text-gray-800 md:text-2xl mb-4">
            今すぐ試してみる
          </h2>
          <p className="text-gray-600 mb-8">
            登録不要で当直表の自動生成を体験できます。
          </p>
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-12">
            <p className="text-gray-400 text-sm">
              デモ機能は近日公開予定です
            </p>
            <Link
              href="/register"
              className="mt-6 inline-block rounded-xl bg-blue-600 px-8 py-3 text-base font-bold text-white shadow-lg hover:bg-blue-700 transition-colors"
            >
              無料で始める
            </Link>
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

function PainCard({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
      <div className="text-3xl mb-3">{emoji}</div>
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
