// src/app/admin/doctors/page.tsx
"use client";

import { useState, useEffect } from "react";

export default function DoctorManagerPage() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchDoctors = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    try {
      const res = await fetch(`${apiUrl}/api/doctors/`);
      if (res.ok) setDoctors(await res.json());
    } catch (error) {
      console.error("Failed to fetch doctors:", error);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleAdd = async () => {
    if (!newName) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    await fetch(`${apiUrl}/api/doctors/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setNewName("");
    fetchDoctors();
  };

  const handleUpdate = async (id: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    await fetch(`${apiUrl}/api/doctors/${id}`, { method: "DELETE" });
    fetchDoctors();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* ✅ 親カード：padding + overflowで“はみ出し”を物理的に封じる */}
      <div className="max-w-2xl mx-auto bg-white p-4 sm:p-6 md:p-8 w-full overflow-hidden rounded-xl shadow-md border border-gray-200">
        <h1 className="text-xl md:text-2xl font-bold mb-6 border-b pb-2 text-gray-800">
          👨‍⚕️ 医師マスタ管理
        </h1>

        {/* ✅ 新規追加エリア：指定クラスでスマホ縦 / PC横 */}
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

        {/* 一覧エリア */}
        <div className="space-y-3">
          {doctors.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50 gap-3"
            >
              {editingId === doc.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full sm:flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="font-bold text-gray-700 text-base">
                  {doc.name}
                </span>
              )}

              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                {editingId === doc.id ? (
                  <button
                    type="button"
                    onClick={() => handleUpdate(doc.id)}
                    className="flex-1 sm:flex-none text-green-700 font-bold bg-green-100 hover:bg-green-200 px-4 py-2 rounded transition-colors"
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
                    className="flex-1 sm:flex-none text-blue-700 font-bold bg-blue-100 hover:bg-blue-200 px-4 py-2 rounded transition-colors"
                  >
                    編集
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  className="flex-1 sm:flex-none text-red-700 font-bold bg-red-100 hover:bg-red-200 px-4 py-2 rounded transition-colors"
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