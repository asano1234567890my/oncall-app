import Link from "next/link";
import { Hospital } from "lucide-react";

export default function TokushohoPage() {
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
        <h1 className="text-2xl font-bold text-gray-900 mb-8">特定商取引法に基づく表記</h1>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-200">
              <tr>
                <th className="w-1/3 bg-gray-50 px-4 py-3 text-left font-medium text-gray-700">事業者名</th>
                <td className="px-4 py-3 text-gray-700">米山 優洋</td>
              </tr>
              <tr>
                <th className="bg-gray-50 px-4 py-3 text-left font-medium text-gray-700">所在地</th>
                <td className="px-4 py-3 text-gray-700">請求があった場合に遅滞なく開示いたします</td>
              </tr>
              <tr>
                <th className="bg-gray-50 px-4 py-3 text-left font-medium text-gray-700">電話番号</th>
                <td className="px-4 py-3 text-gray-700">請求があった場合に遅滞なく開示いたします</td>
              </tr>
              <tr>
                <th className="bg-gray-50 px-4 py-3 text-left font-medium text-gray-700">メールアドレス</th>
                <td className="px-4 py-3 text-gray-700">support@shifuraku.com</td>
              </tr>
              <tr>
                <th className="bg-gray-50 px-4 py-3 text-left font-medium text-gray-700">販売価格</th>
                <td className="px-4 py-3 text-gray-700">各プランの価格はサービス内の料金ページに表示される金額に準じます（税込）</td>
              </tr>
              <tr>
                <th className="bg-gray-50 px-4 py-3 text-left font-medium text-gray-700">支払い方法</th>
                <td className="px-4 py-3 text-gray-700">クレジットカード（Stripe決済）</td>
              </tr>
              <tr>
                <th className="bg-gray-50 px-4 py-3 text-left font-medium text-gray-700">支払い時期</th>
                <td className="px-4 py-3 text-gray-700">月額プラン: 申込時に初回決済、以降毎月自動更新</td>
              </tr>
              <tr>
                <th className="bg-gray-50 px-4 py-3 text-left font-medium text-gray-700">サービス提供時期</th>
                <td className="px-4 py-3 text-gray-700">決済完了後、即時ご利用いただけます</td>
              </tr>
              <tr>
                <th className="bg-gray-50 px-4 py-3 text-left font-medium text-gray-700">解約・キャンセル</th>
                <td className="px-4 py-3 text-gray-700">アプリ内のアカウント設定からいつでも解約可能です。解約後も当月末までご利用いただけます。日割り返金はいたしません。</td>
              </tr>
              <tr>
                <th className="bg-gray-50 px-4 py-3 text-left font-medium text-gray-700">返金ポリシー</th>
                <td className="px-4 py-3 text-gray-700">デジタルサービスの性質上、原則として返金には応じかねます。ただし、サービスの重大な不具合により利用できなかった場合は個別にご相談ください。</td>
              </tr>
              <tr>
                <th className="bg-gray-50 px-4 py-3 text-left font-medium text-gray-700">動作環境</th>
                <td className="px-4 py-3 text-gray-700">インターネット接続環境およびモダンブラウザ（Chrome, Safari, Edge, Firefox の最新版）</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-blue-600 hover:underline">トップページに戻る</Link>
        </div>
      </main>
    </div>
  );
}
