// src/app/admin/doctors/page.tsx
"use client";

import { useEffect, useState } from "react";

type Doctor = {
  id: string;
  name: string;
  access_token?: string; // ✅ magic link用（バックエンド返却想定）
};

const getApiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function DoctorManagerPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // ✅ コピー完了フィードバック
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchDoctors = async () => {
    const apiUrl = getApiBase();
    const res = await fetch(`${apiUrl}/api/doctors`);
    if (res.ok) setDoctors(await res.json());
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleAdd = async () => {
    if (!newName) return;
    const apiUrl = getApiBase();
    await fetch(`${apiUrl}/api/doctors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setNewName("");
    fetchDoctors();
  };

  const handleUpdate = async (id: string) => {
    const apiUrl = getApiBase();
    await fetch(`${apiUrl}/api/doctors/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    setEditingId(null);
    fetchDoctors();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("本当に削除しますか？")) return;
    const apiUrl = getApiBase();
    await fetch(`${apiUrl}/api/doctors/${id}`, { method: "DELETE" });
    fetchDoctors();
  };

  const copyEntryUrl = async (doc: Doctor) => {
    if (!doc.access_token) return;

    const url = `${window.location.origin}/entry/${doc.access_token}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // フォールバック（環境によってclipboardが使えない場合）
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }

      setCopiedId(doc.id);
      window.setTimeout(() => setCopiedId((prev) => (prev === doc.id ? null : prev)), 1500);
    } catch (e) {
      console.error(e);
      alert("コピーに失敗しました（ブラウザ権限をご確認ください）");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* ✅ 親カード：はみ出し防止 */}
      <div className="max-w-2xl mx-auto bg-white p-4 sm:p-6 w-full overflow-hidden rounded-xl shadow-md border border-gray-200">
        <h1 className="text-xl md:text-2xl font-bold mb-6 border-b pb-2 text-gray-800">👨‍⚕️ 医師マスタ管理</h1>

        {/* ✅ 新規追加：要件どおり（スマホ縦 / PC横） */}
        <div className="mb-8 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto">
            <input
              type="text"
              placeholder="新しい医師の氏名"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="w-full sm:w-auto whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded font-bold transition-colors shadow-sm"
            >
              追加
            </button>
          </div>
        </div>

        {/* 一覧 */}
        <div className="space-y-3">
          {doctors.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded hover:bg-gray-50"
            >
              <div className="min-w-0 w-full">
                {editingId === doc.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="font-medium text-gray-700 truncate">{doc.name}</div>
                )}

                {doc.access_token ? (
                  <div className="text-[11px] text-gray-400 mt-1 truncate">/entry/{doc.access_token}</div>
                ) : (
                  <div className="text-[11px] text-amber-600 mt-1">
                    ※ access_token が未設定です（バックエンド返却を確認）
                  </div>
                )}
              </div>

              {/* ✅ ボタン群：モバイルは縦で安全に */}
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => copyEntryUrl(doc)}
                  disabled={!doc.access_token}
                  className={`w-full sm:w-auto whitespace-nowrap px-4 py-2 rounded font-bold border transition-colors
                    ${
                      copiedId === doc.id
                        ? "bg-emerald-600 text-white border-emerald-700"
                        : !doc.access_token
                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200"
                    }`}
                >
                  {copiedId === doc.id ? "コピーしました" : "入力用URLをコピー"}
                </button>

                {editingId === doc.id ? (
                  <button
                    type="button"
                    onClick={() => handleUpdate(doc.id)}
                    className="w-full sm:w-auto whitespace-nowrap text-green-700 font-bold bg-green-100 hover:bg-green-200 px-4 py-2 rounded transition-colors"
                  >
                    保存
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(doc.id);
                      setEditName(doc.name);
                    }}
                    className="w-full sm:w-auto whitespace-nowrap text-blue-700 font-bold bg-blue-100 hover:bg-blue-200 px-4 py-2 rounded transition-colors"
                  >
                    編集
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  className="w-full sm:w-auto whitespace-nowrap text-red-700 font-bold bg-red-100 hover:bg-red-200 px-4 py-2 rounded transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}