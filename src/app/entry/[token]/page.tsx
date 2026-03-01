// src/app/entry/[token]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type PublicDoctor = {
  name: string;
  unavailable_dates?: string[]; // "YYYY-MM-DD"
  fixed_weekdays?: number[]; // 0=Mon ... 6=Sun（Python想定）
};

const getApiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const weekdayLabels = [
  { py: 0, label: "月" },
  { py: 1, label: "火" },
  { py: 2, label: "水" },
  { py: 3, label: "木" },
  { py: 4, label: "金" },
  { py: 5, label: "土" },
  { py: 6, label: "日" },
];

const uniqSort = (arr: string[]) => Array.from(new Set(arr.filter(Boolean))).sort();

export default function EntryPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [doctor, setDoctor] = useState<PublicDoctor | null>(null);
  const [invalid, setInvalid] = useState(false);

  const [fixedWeekdays, setFixedWeekdays] = useState<number[]>([]);
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [dateToAdd, setDateToAdd] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const title = useMemo(() => {
    if (!doctor) return "休み希望入力";
    return `${doctor.name} 先生の休み希望入力`;
  }, [doctor]);

  const fetchDoctor = async () => {
    if (!token) return;

    setIsLoading(true);
    setInvalid(false);
    setMessage("");

    try {
      const res = await fetch(`${getApiBase()}/api/public/doctors/${token}`, { cache: "no-store" });

      if (res.status === 404) {
        setInvalid(true);
        setDoctor(null);
        return;
      }
      if (!res.ok) throw new Error("取得に失敗しました");

      const data: PublicDoctor = await res.json();
      setDoctor(data);

      setFixedWeekdays(Array.from(new Set(data.fixed_weekdays ?? [])).sort((a, b) => a - b));
      setUnavailableDates(uniqSort(data.unavailable_dates ?? []));
    } catch (e) {
      console.error(e);
      setMessage("読み込みに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const toggleWeekday = (py: number) => {
    setFixedWeekdays((prev) => {
      const next = prev.includes(py) ? prev.filter((x) => x !== py) : [...prev, py];
      return next.sort((a, b) => a - b);
    });
  };

  const addDate = () => {
    if (!dateToAdd) return;
    setUnavailableDates((prev) => uniqSort([...prev, dateToAdd]));
    setDateToAdd("");
  };

  const removeDate = (ymd: string) => {
    setUnavailableDates((prev) => prev.filter((d) => d !== ymd));
  };

  const handleSave = async () => {
    if (!token) return;

    setIsSaving(true);
    setMessage("");

    try {
      const payload = {
        unavailable_dates: uniqSort(unavailableDates),
        fixed_weekdays: Array.from(new Set(fixedWeekdays)).sort((a, b) => a - b),
      };

      const res = await fetch(`${getApiBase()}/api/public/doctors/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 404) {
        setInvalid(true);
        setDoctor(null);
        return;
      }
      if (!res.ok) throw new Error("保存に失敗しました");

      setMessage("保存しました");
      await fetchDoctor(); // ✅ 最新に同期
    } catch (e) {
      console.error(e);
      setMessage("保存に失敗しました。通信状況をご確認ください。");
    } finally {
      setIsSaving(false);
    }
  };

  if (invalid) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-sm border p-6 text-center">
          <div className="text-lg font-bold text-gray-800">無効なURLです</div>
          <div className="text-sm text-gray-500 mt-2">URLをご確認ください。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="w-full max-w-md mx-auto p-4 pb-28">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-lg font-bold text-gray-800">{title}</div>
          <div className="text-xs text-gray-500 mt-1">ログイン不要で、この先生の休み希望のみ入力できます。</div>

          {isLoading ? (
            <div className="mt-6 text-sm text-gray-500">読み込み中...</div>
          ) : (
            <>
              {/* 固定不可曜日 */}
              <section className="mt-6">
                <div className="text-sm font-bold text-gray-700">固定不可曜日</div>
                <div className="text-xs text-gray-500 mt-1">毎週入れない曜日を選択してください。</div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  {weekdayLabels.map((w) => {
                    const selected = fixedWeekdays.includes(w.py);
                    const isSun = w.py === 6;
                    const isSat = w.py === 5;

                    return (
                      <button
                        key={w.py}
                        type="button"
                        onClick={() => toggleWeekday(w.py)}
                        className={`w-full rounded-lg border px-3 py-3 text-sm font-bold transition
                          ${
                            selected
                              ? isSun
                                ? "bg-red-500 text-white border-red-600"
                                : isSat
                                ? "bg-blue-600 text-white border-blue-700"
                                : "bg-gray-900 text-white border-gray-900"
                              : isSun
                              ? "bg-red-50 text-red-500 border-red-200"
                              : isSat
                              ? "bg-blue-50 text-blue-600 border-blue-200"
                              : "bg-white text-gray-700 border-gray-200"
                          }`}
                      >
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 個別不可日 */}
              <section className="mt-8">
                <div className="text-sm font-bold text-gray-700">個別不可日</div>
                <div className="text-xs text-gray-500 mt-1">単発の休み希望日を追加してください。</div>

                <div className="mt-3 flex flex-col sm:flex-row gap-3 w-full">
                  <input
                    type="date"
                    value={dateToAdd}
                    onChange={(e) => setDateToAdd(e.target.value)}
                    className="w-full border rounded-lg p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addDate}
                    disabled={!dateToAdd}
                    className="w-full sm:w-auto whitespace-nowrap rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-3 disabled:opacity-50"
                  >
                    追加
                  </button>
                </div>

                {unavailableDates.length === 0 ? (
                  <div className="mt-3 text-sm text-gray-400">まだ登録されていません</div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {unavailableDates.map((d) => (
                      <div key={d} className="flex items-center justify-between gap-3 bg-gray-50 border rounded-lg p-3">
                        <div className="text-sm font-bold text-gray-700">{d}</div>
                        <button
                          type="button"
                          onClick={() => removeDate(d)}
                          className="whitespace-nowrap text-sm font-bold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-2 rounded-lg"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {message && (
                <div
                  className={`mt-6 rounded-lg border p-3 text-sm font-bold ${
                    message === "保存しました"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  {message}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* 下部固定：保存ボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t">
        <div className="w-full max-w-md mx-auto p-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 disabled:opacity-50"
          >
            {isSaving ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}