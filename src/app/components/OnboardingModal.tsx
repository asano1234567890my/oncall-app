// src/app/components/OnboardingModal.tsx — オンボーディング説明モーダル
"use client";

import type { OnboardingSection } from "../hooks/useOnboarding";

type OnboardingModalProps = {
  section: OnboardingSection | null;
  onDismiss: () => void;
};

const CONTENT: Record<OnboardingSection, { title: string; lines: string[] }> = {
  "shift-scores": {
    title: "シフトスコアについて",
    lines: [
      "シフトの種類ごとに負担度（スコア）を設定できます。平日当直 = 1.0 が基準です。",
      "たとえば土曜当直を1.5にすると、平日当直1.5回分の負担として計算されます。",
      "まずは初期値のままでOKです。病院の実情に合わせて調整してください。",
    ],
  },
  rules: {
    title: "基本ルールについて",
    lines: [
      "ここでは、必ず守らなければならないルール（ハード制約）を設定します。",
      "「当直間隔」は連続勤務を防ぐ最低限の休み日数、「上限回数」は1ヶ月に入れる当直の最大数です。",
      "ルールが厳しすぎると解が見つからないことがあります。まずは初期値で試してみましょう。",
    ],
  },
  weights: {
    title: "優先度の調整について",
    lines: [
      "ここでは「できれば守りたいルール」の強さを調整します。",
      "数値が大きいほど優先されます。例えば「土曜回数の平準化」を上げると、土曜当直が特定の人に偏りにくくなります。",
      "まずはデフォルトのままでOKです。生成結果を見て気になる点があれば微調整してください。",
    ],
  },
  "doctor-manage": {
    title: "医師の管理について",
    lines: [
      "ここで当直に参加する医師の追加・名前変更・削除ができます。",
      "各医師の「共有」ボタンから、休み希望の入力用リンクをURLコピー・LINE・メール・QRコードで送れます。上部の「まとめて共有」で全員分の一括コピーやQRカード印刷も可能です。",
      "共有したリンクから医師が入力した休み希望は、自動でこちらに反映されます。手動で転記する必要はありません。",
      "「ロック」をONにすると、その医師の入力を締め切れます。上部の「全員ロック」「全員解除」で一括操作もできます。",
    ],
  },
  doctors: {
    title: "不可日設定について",
    lines: [
      "医師ごとに「この日は当直に入れない」という不可日を設定できます。",
      "カレンダーの日付をタップすると不可日になります。もう一度タップすると「日直のみ不可」「当直のみ不可」も選べます。",
      "下のボタンで曜日ごとの固定休み（毎週水曜は不可、など）も設定できます。",
      "医師管理画面から各医師専用の入力リンクを発行できます。リンクを共有すれば、医師が自分のスマホから直接休み希望を登録でき、こちらの画面にも自動で反映されます。",
      "設定後は右上の「保存」ボタンを押してください。保存しないと変更は反映されません。",
    ],
  },
  "doctor-scores": {
    title: "スコア設定について",
    lines: [
      "医師ごとに1ヶ月の当直回数の目安を設定できます。",
      "「Min」は最低回数、「Max」は上限回数、「目標」は理想の回数です。スコア1.0 = 平日当直1回分に相当します。",
      "目標を0にすると全体の公平配分が優先されます。ベテランの負担を減らしたい場合などに活用してください。",
    ],
  },
  holidays: {
    title: "祝日・休日設定について",
    lines: [
      "日本の祝日は自動で反映されます。それ以外の休日（お盆・年末年始など）はカレンダーをタップして追加できます。",
      "祝日をタップすると「平日扱い」に切り替わります。再度タップすると元に戻ります。",
      "休日は日直（午前）＋当直（夜間）の両枠が生成されます。変更後は「保存」を忘れずに。",
    ],
  },
  previous: {
    title: "前月の勤務実績について",
    lines: [
      "先月末の当直データを入力すると、月をまたいだ連続勤務を防ぐことができます。",
      "例えば先月末に当直した医師は、翌月初日の当直に入らないよう自動で考慮されます。",
      "保存済みのスケジュールがあれば自動で読み込まれます。手動での修正も可能です。",
    ],
  },
  generate: {
    title: "シフトが生成されました！",
    lines: [
      "設定に基づいて最適なシフトが自動で作られました。",
      "下部のスコア表で医師ごとの負担バランスを確認できます。数値が近いほど公平な配分です。",
      "気になる箇所があれば、手動で入れ替えたり、設定を調整して再生成することもできます。",
    ],
  },
  dnd: {
    title: "手動調整について",
    lines: [
      "医師名をタップするとその医師の全配置日がハイライトされ、制約違反があれば色分けで確認できます。",
      "もう一度タップすると操作メニューが開き、変更・入れ替え・外す・ロックができます。",
      "ロックした枠は再生成しても固定されます。一部を固定してから「再生成」を押すと、残りだけが最適化されます。",
      "ルール違反がある場合は警告が表示されます。「強制」モードをONにすると、警告を無視して配置できます。",
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
