"use client";

import { useState } from "react";

const INITIAL_DOCTORS = Array.from({ length: 15 }, (_, i) => `医師${i + 1}`);

export default function HomePage() {
  const [doctors, setDoctors] = useState<string[]>(INITIAL_DOCTORS);
  const [rules, setRules] = useState({
    noConsecutiveOncall: true,
    maxPerWeek: false,
    balanceWeekend: false,
  });

  const handleDoctorChange = (index: number, value: string) => {
    setDoctors((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleToggleRule = (key: keyof typeof rules) => {
    setRules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = () => {
    // TODO: 後でバックエンド連携して当直表を生成
    console.log("generate oncall table with:", { doctors, rules });
    alert("当直表生成ロジックは今後実装します。（データはコンソールに出力中）");
  };

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-5xl px-4">
        {/* ヘッダー */}
        <header className="mb-10">
          <p className="text-sm font-semibold text-sky-600">oncall-app</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            医師当直表の自動最適化
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
            医師の希望やルールを入力すると、AI が当直表を自動で提案します。
            まずは医師情報と当直ルールを設定してください。
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[2fr,1.4fr]">
          {/* 医師一覧セクション */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  医師一覧（最大15名）
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  実際に当直表に登場する医師名を入力してください。空欄の行は無視されます。
                </p>
              </div>
            </div>

            <div className="mt-5 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {doctors.map((name, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                >
                  <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) =>
                      handleDoctorChange(index, e.target.value)
                    }
                    placeholder={`医師${index + 1} の名前`}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-0 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ルール ＋ 生成ボタンセクション */}
          <section className="flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                当直ルール
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                まずは基本的なルールだけを設定します。詳細な制約は後で追加できます。
              </p>

              <div className="mt-4 space-y-3 text-sm text-slate-800">
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 hover:border-sky-200">
                  <input
                    type="checkbox"
                    checked={rules.noConsecutiveOncall}
                    onChange={() => handleToggleRule("noConsecutiveOncall")}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div>
                    <p className="font-medium">連続当直を禁止する</p>
                    <p className="text-xs text-slate-500">
                      同じ医師が2日連続で当直にならないようにします。
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 hover:border-sky-200">
                  <input
                    type="checkbox"
                    checked={rules.maxPerWeek}
                    onChange={() => handleToggleRule("maxPerWeek")}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div>
                    <p className="font-medium">1週間あたりの当直回数に上限を設ける</p>
                    <p className="text-xs text-slate-500">
                      週に一定回数以上は当直が入らないようにします（詳細設定は後で追加）。
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 hover:border-sky-200">
                  <input
                    type="checkbox"
                    checked={rules.balanceWeekend}
                    onChange={() => handleToggleRule("balanceWeekend")}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div>
                    <p className="font-medium">休日・祝日の当直をなるべく均等にする</p>
                    <p className="text-xs text-slate-500">
                      特定の医師に休日当直が偏らないようにします。
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={handleGenerate}
                className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              >
                当直表を生成する
              </button>
              <p className="mt-2 text-xs text-slate-500">
                まだ仮のボタンです。後のフェーズで Python / OR-Tools と連携して実際に当直表を生成します。
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
