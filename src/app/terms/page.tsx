import Link from "next/link";
import { Hospital } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <Hospital className="h-5 w-5 text-blue-600" />シフらく
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">利用規約</h1>

        <div className="space-y-8 text-sm leading-relaxed text-gray-700">
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">第1条（適用）</h2>
            <p>本規約は、シフらく（以下「本サービス」）の利用に関する条件を定めるものです。利用者は、本サービスを利用することにより、本規約に同意したものとみなされます。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">第2条（サービスの内容）</h2>
            <p>本サービスは、病院の当直・日直スケジュールの自動生成および管理を支援するWebアプリケーションです。以下の機能を提供します。</p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>最適化アルゴリズムによるスケジュール自動生成</li>
              <li>スケジュールの手動編集・調整</li>
              <li>医師ごとの勤務不可日の登録・管理</li>
              <li>スケジュールの保存・閲覧</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">第3条（アカウント）</h2>
            <ol className="mt-2 list-decimal pl-6 space-y-1">
              <li>利用者は、正確な情報を登録してアカウントを作成するものとします。</li>
              <li>アカウント情報（パスワード含む）の管理は利用者の責任とし、第三者への貸与・共有は禁止します。</li>
              <li>アカウントの不正使用により生じた損害について、本サービスは責任を負いません。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">第4条（禁止事項）</h2>
            <p>利用者は、以下の行為を行ってはなりません。</p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>本サービスの不正アクセスまたはシステムへの攻撃</li>
              <li>他の利用者のデータへの不正アクセス</li>
              <li>本サービスの機能を利用した迷惑行為</li>
              <li>その他、法令または公序良俗に反する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">第5条（免責事項）</h2>
            <ol className="mt-2 list-decimal pl-6 space-y-1">
              <li>本サービスが生成するスケジュールは、最適化アルゴリズムに基づく提案であり、最終的な勤務表の決定は利用者の責任において行うものとします。</li>
              <li>本サービスの利用により生じた直接的・間接的な損害について、運営者は一切の責任を負いません。</li>
              <li>システムの障害・メンテナンス等により、一時的にサービスが利用できない場合があります。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">第6条（サービスの変更・停止）</h2>
            <p>運営者は、事前の通知なく本サービスの内容を変更、または提供を停止することができるものとします。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">第7条（データの取り扱い）</h2>
            <ol className="mt-2 list-decimal pl-6 space-y-1">
              <li>利用者が登録したデータの取り扱いについては、プライバシーポリシーに定めるとおりとします。</li>
              <li>アカウント削除時には、関連するすべてのデータが削除されます。削除後のデータ復旧はできません。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">第8条（知的財産権）</h2>
            <p>本サービスに関するすべての知的財産権は運営者に帰属します。利用者は、本サービスのコンテンツを無断で複製・転載・配布することはできません。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">第9条（規約の変更）</h2>
            <p>運営者は、必要に応じて本規約を変更することができます。変更後の規約は、本ページに掲載した時点で効力を持ちます。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">第10条（準拠法・管轄）</h2>
            <p>本規約は日本法に準拠し、本サービスに関する紛争については、運営者の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。</p>
          </section>

          <p className="text-xs text-gray-400 pt-4">最終更新日: 2026年3月22日</p>
        </div>
      </main>

      <footer className="border-t bg-white px-4 py-8">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-400">
          <div className="mb-2 flex items-center justify-center gap-4">
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">プライバシーポリシー</Link>
            <span>|</span>
            <span className="font-medium text-gray-500">利用規約</span>
            <span>|</span>
            <Link href="/tokushoho" className="hover:text-gray-600 transition-colors">特定商取引法に基づく表記</Link>
          </div>
          &copy; {new Date().getFullYear()} シフらく. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
