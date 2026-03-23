"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";

type CardData = { name: string; token: string; qrDataUrl: string };

function QrPrintContent() {
  const searchParams = useSearchParams();
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const names = searchParams.getAll("n");
      const tokens = searchParams.getAll("t");
      if (names.length === 0 || names.length !== tokens.length) {
        setLoading(false);
        return;
      }

      const QRCode = (await import("qrcode")).default;
      const results: CardData[] = [];
      for (let i = 0; i < names.length; i++) {
        const url = `${window.location.origin}/entry/${tokens[i]}`;
        const qrDataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 });
        results.push({ name: names[i], token: tokens[i], qrDataUrl });
      }
      setCards(results);
      setLoading(false);
    })();
  }, [searchParams]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">QRコード生成中...</div>;
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-500">データがありません</p>
        <a href="/app" className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors">トップに戻る</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Print button (hidden when printing) */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-gray-600">{cards.length}名分のQRカード</p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
        >
          <Printer className="h-4 w-4" />
          印刷する
        </button>
      </div>

      {/* Cards grid — 2 columns, each card is a cut-out */}
      <div className="grid grid-cols-2 gap-0 p-4 print:p-0">
        {cards.map((card, i) => (
          <div
            key={i}
            className="border border-dashed border-gray-300 print:border-gray-400 p-4 flex flex-col items-center justify-center"
            style={{ pageBreakInside: "avoid", minHeight: "14rem" }}
          >
            <p className="text-base font-bold text-gray-800 mb-2">{card.name} 先生</p>
            <img src={card.qrDataUrl} alt={`QR: ${card.name}`} className="w-32 h-32" />
            <p className="mt-2 text-[10px] text-gray-400 text-center max-w-[12rem] break-all">
              {typeof window !== "undefined" ? `${window.location.origin}/entry/${card.token}` : ""}
            </p>
            <p className="mt-1.5 text-xs text-gray-600 text-center">
              QRコードを読み取って
              <br />
              不可日を入力してください
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QrPrintPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-500">読み込み中...</div>}>
      <QrPrintContent />
    </Suspense>
  );
}
