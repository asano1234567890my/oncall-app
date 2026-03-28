import Link from "next/link";
import { Hospital } from "lucide-react";

export default function PrivacyPolicyPage() {
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
        <h1 className="text-2xl font-bold text-gray-900 mb-8">プライバシーポリシー</h1>

        <div className="space-y-8 text-sm leading-relaxed text-gray-700">
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">1. 基本方針</h2>
            <p>シフらく（以下「本サービス」）は、利用者の個人情報の保護を重要な責務と認識し、適切な管理・保護に努めます。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">2. 収集する情報</h2>
            <p>本サービスでは、以下の情報を収集します。</p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li><span className="font-medium">アカウント情報:</span> 病院名、パスワード（ハッシュ化して保存）</li>
              <li><span className="font-medium">医師情報:</span> 氏名、経験年数、勤務不可日</li>
              <li><span className="font-medium">シフトデータ:</span> 当直・日直の配置情報</li>
              <li><span className="font-medium">利用ログ:</span> アクセス日時、操作履歴（サービス改善目的）</li>
              <li><span className="font-medium">利用状況データ:</span> 機能の利用回数（スケジュール生成回数、出力回数等）、ログイン日時</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">3. 利用目的</h2>
            <p>収集した情報は、以下の目的にのみ利用します。</p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>当直・日直スケジュールの自動生成および管理</li>
              <li>アカウントの認証・管理</li>
              <li>サービスの改善・機能追加</li>
              <li>お問い合わせへの対応</li>
              <li>利用プランの管理・課金処理</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">4. 第三者提供</h2>
            <p>利用者の個人情報を、本人の同意なく第三者に提供することはありません。ただし、法令に基づく開示要請があった場合を除きます。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">5. データの保管</h2>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>データはクラウドデータベース（Neon PostgreSQL）に暗号化通信（TLS）で保存されます</li>
              <li>パスワードは bcrypt でハッシュ化され、平文では保存されません</li>
              <li>病院ごとにデータは完全に分離されており、他の病院のデータにアクセスすることはできません</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">6. データの削除</h2>
            <p>利用者はアカウントの削除を申請することができます。アカウント削除時には、関連するすべてのデータ（医師情報、シフトデータ、設定情報）が完全に削除されます。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">7. Cookieについて</h2>
            <p>本サービスでは、認証トークンの保持にブラウザのローカルストレージを使用します。トラッキング目的のCookieは使用しません。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">8. ポリシーの変更</h2>
            <p>本ポリシーの内容は、法令の変更やサービスの更新に伴い、事前の通知なく変更されることがあります。変更後のポリシーは本ページに掲載した時点で効力を持ちます。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">9. お問い合わせ</h2>
            <p>個人情報の取り扱いに関するお問い合わせは、サービス内のお問い合わせ機能よりご連絡ください。</p>
          </section>

          <p className="text-xs text-gray-400 pt-4">最終更新日: 2026年3月28日</p>
        </div>
      </main>

      <footer className="border-t bg-white px-4 py-8">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-400">
          <div className="mb-2 flex items-center justify-center gap-4">
            <span className="font-medium text-gray-500">プライバシーポリシー</span>
            <span>|</span>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">利用規約</Link>
          </div>
          &copy; {new Date().getFullYear()} シフらく. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
