// src/app/components/OnboardingModal.tsx — オンボーディング説明モーダル
"use client";

import type { OnboardingSection } from "../hooks/useOnboarding";

type OnboardingModalProps = {
  section: OnboardingSection | null;
  onDismiss: () => void;
};

const CONTENT: Record<OnboardingSection, { title: string; lines: string[] }> = {
  rules: {
    title: "基本ルールについて",
    lines: [
      "ここでは、必ず守らなければならないルール（ハード制約）を設定します。",
      "当直間隔や上限回数など、シフト生成時に厳守される条件です。",
      "まずは「当直間隔」と「上限回数」から設定してみましょう。",
    ],
  },
  weights: {
    title: "優先度の調整について",
    lines: [
      "ここでは「できれば守りたいルール」の強さを調整します。",
      "数値が大きいほど、そのルールが強く考慮されます。",
      "まずはデフォルトのままで問題ありません。必要に応じて微調整してください。",
    ],
  },
  doctors: {
    title: "医師の管理について",
    lines: [
      "ここでは医師の名前・目標回数・お休みの日を設定できます。",
      "カレンダーで不可日をタップすると、その日は当直に入りません。",
      "固定の曜日休みも設定できます。",
    ],
  },
  generate: {
    title: "シフトが生成されました！",
    lines: [
      "設定に基づいて最適なシフトが自動で作られました。",
      "色分けの見方：赤系は土曜・祝日、青系は平日の当直です。",
      "スコアが表示されている場合、数値が近いほど公平な配分です。",
    ],
  },
  dnd: {
    title: "手動調整について",
    lines: [
      "シフト表の医師名をドラッグ&ドロップで入れ替えられます。",
      "ロックボタンで確定済みの枠を固定し、残りだけ再生成できます。",
      "スマホではタップして選択→タップで配置の操作も可能です。",
    ],
  },
};

export default function OnboardingModal({ section, onDismiss }: OnboardingModalProps) {
  if (!section) return null;

  const content = CONTENT[section];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-gray-800 mb-3">{content.title}</h2>
        <div className="space-y-2 mb-6">
          {content.lines.map((line, i) => (
            <p key={i} className="text-sm text-gray-600 leading-relaxed">{line}</p>
          ))}
        </div>
        <button
          onClick={onDismiss}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}
