// src/app/entry/[token]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import "react-day-picker/dist/style.css";

type UnavailableDay = {
  date: string | null; // "YYYY-MM-DD"
  day_of_week: number | null; // 0-6
  is_fixed: boolean;
};

type PublicDoctor = {
  name: string;
  is_locked?: boolean;
  // 互換：どちらが来てもOKにする
  unavailable_dates?: string[]; // ["YYYY-MM-DD", ...]
  unavailable_days?: UnavailableDay[]; // DB互換
  fixed_weekdays?: number[];
};

const getApiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

function uniqSort(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

function toSelectedFromDoctor(data: PublicDoctor): string[] {
  // 優先：unavailable_dates
  if (Array.isArray(data.unavailable_dates) && data.unavailable_dates.length > 0) {
    return uniqSort(data.unavailable_dates);
  }
  // 次：unavailable_days（is_fixed=false の date を拾う）
  if (Array.isArray(data.unavailable_days)) {
    const dates = data.unavailable_days
      .filter((u) => u && u.is_fixed === false && typeof u.date === "string" && u.date)
      .map((u) => String(u.date));
    return uniqSort(dates);
  }
  return [];
}

export default function EntryPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const router = useRouter();

  const [doctor, setDoctor] = useState<PublicDoctor | null>(null);
  const [invalid, setInvalid] = useState(false);

  // カレンダー選択（YYYY-MM-DDの集合）
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const selectedDates = useMemo(() => {
    const list = Array.from(selectedSet).map((s) => {
      try {
        return parseISO(s);
      } catch {
        return null;
      }
    });
    return list.filter(Boolean) as Date[];
  }, [selectedSet]);

  const [month, setMonth] = useState<Date>(new Date());

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const locked = Boolean(doctor?.is_locked);

  const title = useMemo(() => {
    if (!doctor) return "休み希望入力";
    return `${doctor.name} 先生の休み希望入力`;
  }, [doctor]);

  const fetchDoctor = async () => {
    if (!token) return;

    setIsLoading(true);
    setInvalid(false);
    setMessage("");
    setError("");

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

      const selected = toSelectedFromDoctor(data);
      setSelectedSet(new Set(selected));

      if (selected.length > 0) {
        try {
          setMonth(parseISO(selected[0]));
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error(e);
      setError("読み込みに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onDayClick = (day: Date) => {
    if (locked) return;

    const key = ymd(day);
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!token) return;
    if (locked) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        unavailable_dates: uniqSort(Array.from(selectedSet)),
        fixed_weekdays: doctor?.fixed_weekdays ?? [],
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
      if (res.status === 403) {
        setError("保存できませんでした（入力期間が終了している、または権限がありません）。");
        return;
      }
      if (!res.ok) throw new Error("保存に失敗しました");

      setMessage("保存しました");
      await fetchDoctor(); // ✅ 再取得で同期
    } catch (e) {
      console.error(e);
      setError("保存に失敗しました。通信状況をご確認ください。");
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
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 w-full rounded-lg bg-gray-900 text-white font-bold py-3"
          >
            ← 戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="w-full max-w-md mx-auto p-4 pb-28">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-bold text-gray-800 truncate">{title}</div>
              <div className="text-xs text-gray-500 mt-1">ログイン不要で、この先生の休み希望のみ入力できます。</div>
            </div>
          </div>

          {/* ✅ 当直表閲覧への導線（管理画面へのリンクは一切出さない） */}
          <div className="mt-4">
            <Link
              href="/view"
              className="block w-full text-center rounded-lg border bg-white hover:bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800"
            >
              📅 確定した当直表を見る
            </Link>
            <div className="text-[11px] text-gray-500 mt-2">
              ※この画面から管理画面へは移動できません（戻る/閲覧のみ）
            </div>
          </div>

          {locked && !isLoading && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
              入力期間は終了しています（確認のみ可能です）
            </div>
          )}

          {isLoading ? (
            <div className="mt-6 text-sm text-gray-500">読み込み中...</div>
          ) : (
            <>
              <section className="mt-6">
                <div className="text-sm font-bold text-gray-700">個別不可日（カレンダー）</div>
                <div className="text-xs text-gray-500 mt-1">
                  日付をタップして選択/解除できます{locked ? "（現在はロック中）" : ""}。
                </div>

                <div className={`mt-4 rounded-xl border p-2 ${locked ? "opacity-75" : ""}`}>
                  <DayPicker
                    mode="multiple"
                    month={month}
                    onMonthChange={setMonth}
                    selected={selectedDates}
                    onDayClick={onDayClick}
                    className="w-full"
                    modifiersClassNames={{
                      selected: "bg-indigo-600 text-white",
                      today: "text-indigo-700 font-bold",
                    }}
                  />
                </div>

                <div className="mt-3 text-xs text-gray-500">
                  選択中: <span className="font-bold text-gray-800">{selectedSet.size}</span> 日
                </div>
              </section>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
                  {error}
                </div>
              )}

              {message && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                  {message}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* 下部固定：保存（ロック中はdisabled） */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t">
        <div className="w-full max-w-md mx-auto p-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving || locked}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 disabled:opacity-50"
          >
            {locked ? "ロック中（保存不可）" : isSaving ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}