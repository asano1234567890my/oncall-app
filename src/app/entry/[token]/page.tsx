// src/app/entry/[token]/page.tsx — 個別マジックリンク入力ページ
"use client";

import { useParams, useRouter } from "next/navigation";
import DoctorEntryForm from "../../components/entry/DoctorEntryForm";

export default function EntryPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const router = useRouter();

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="mx-auto w-full max-w-md rounded-xl border bg-white p-6 text-center shadow-sm">
          <div className="text-lg font-bold text-gray-800">無効なURLです</div>
          <div className="mt-2 text-sm text-gray-500">URLをご確認ください。</div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 w-full rounded-lg bg-gray-900 py-3 font-bold text-white"
          >
            ← 戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto w-full max-w-md p-4 pb-28">
        <DoctorEntryForm accessToken={token} showConfirmedShifts={true} />
      </main>
    </div>
  );
}
