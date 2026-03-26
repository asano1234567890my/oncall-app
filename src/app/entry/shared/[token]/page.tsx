// src/app/entry/shared/[token]/page.tsx — 共有入力ページ（ドロップダウンで医師選択）
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, HelpCircle, Users } from "lucide-react";
import DoctorEntryForm from "../../../components/entry/DoctorEntryForm";

type SharedDoctor = {
  id: string;
  name: string;
  is_locked: boolean;
  access_token: string;
};

type SharedDoctorsResponse = {
  doctors: SharedDoctor[];
  doctor_message: string | null;
  unavail_day_limit: number | null;
};

const getApiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function SharedEntryPage() {
  const params = useParams<{ token: string }>();
  const sharedToken = params?.token;

  const [doctors, setDoctors] = useState<SharedDoctor[]>([]);
  const [selectedDoctorToken, setSelectedDoctorToken] = useState<string | null>(null);
  const [doctorMessage, setDoctorMessage] = useState<string | null>(null);
  const [unavailDayLimit, setUnavailDayLimit] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!sharedToken) return;

    const fetchDoctors = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${getApiBase()}/api/shared-entry/public/${sharedToken}/doctors`, {
          cache: "no-store",
        });
        if (res.status === 404) {
          setError("無効なURLです。管理者にお問い合わせください。");
          return;
        }
        if (!res.ok) throw new Error("読み込みに失敗しました");

        const data: SharedDoctorsResponse = await res.json();
        setDoctors(data.doctors);
        setDoctorMessage(data.doctor_message);
        setUnavailDayLimit(data.unavail_day_limit);
      } catch (e) {
        console.error(e);
        setError("読み込みに失敗しました。時間をおいて再度お試しください。");
      } finally {
        setIsLoading(false);
      }
    };
    void fetchDoctors();
  }, [sharedToken]);

  const selectedDoctor = doctors.find((d) => d.access_token === selectedDoctorToken);

  if (!sharedToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="mx-auto w-full max-w-md rounded-xl border bg-white p-6 text-center shadow-sm">
          <div className="text-lg font-bold text-gray-800">無効なURLです</div>
          <div className="mt-2 text-sm text-gray-500">URLをご確認ください。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto w-full max-w-md p-4 pb-28">
        {/* ヘッダー */}
        <div className="mb-4 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <h1 className="text-lg font-bold text-gray-800">休み希望入力</h1>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              使い方
            </button>
          </div>
          {showHelp && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-800">
              <p className="font-bold">このページの使い方</p>
              <ol className="mt-1.5 list-inside list-decimal space-y-1">
                <li>下のドロップダウンから<strong>ご自身の名前</strong>を選んでください</li>
                <li>カレンダーで<strong>当直できない日</strong>をタップして選択します</li>
                <li>毎週決まった曜日に当直できない場合は<strong>「固定不可曜日」</strong>も設定できます</li>
                <li>入力が終わったら<strong>「保存する」</strong>ボタンを押してください</li>
              </ol>
              <p className="mt-2 text-[10px] text-blue-600">※ 他の先生の入力内容は見えません。ご自身の分だけ編集できます。</p>
            </div>
          )}

          {/* 管理者からのメッセージ */}
          {doctorMessage && !isLoading && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-800 whitespace-pre-wrap">
              {doctorMessage}
            </div>
          )}

          {/* 医師選択ドロップダウン */}
          {isLoading ? (
            <div className="mt-4 text-sm text-gray-500">読み込み中...</div>
          ) : error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
              {error}
            </div>
          ) : (
            <div className="mt-4">
              <label htmlFor="doctor-select" className="block text-sm font-bold text-gray-700">
                お名前を選択してください
              </label>
              <div className="relative mt-2">
                <select
                  id="doctor-select"
                  value={selectedDoctorToken ?? ""}
                  onChange={(e) => setSelectedDoctorToken(e.target.value || null)}
                  className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-4 py-3 pr-10 text-sm font-medium text-gray-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">-- 選択してください --</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.access_token}>
                      {d.name}{d.is_locked ? "（ロック中）" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
              {doctors.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">医師が登録されていません。管理者にお問い合わせください。</p>
              )}
            </div>
          )}
        </div>

        {/* 選択された医師のカレンダー */}
        {selectedDoctor && (
          <DoctorEntryForm
            key={selectedDoctor.access_token}
            accessToken={selectedDoctor.access_token}
            showConfirmedShifts={true}
            externalDoctorMessage={doctorMessage}
            externalUnavailDayLimit={unavailDayLimit}
          />
        )}

        {/* 未選択時 */}
        {!selectedDoctorToken && !isLoading && !error && doctors.length > 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-500">
              上のドロップダウンからお名前を選択すると、<br />休み希望の入力画面が表示されます。
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
