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
    const res = await fetch(`${apiUrl}/api/doctors/`);
    if (res.ok) setDoctors(await res.json());
  };

  useEffect(() => { fetchDoctors(); }, []);

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
    // 💡 修正: スマホ時は p-4 にして余白を減らす
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* 💡 修正: スマホ時は p-4 に */}
      <div className="max-w-2xl mx-auto bg-white p-4 md:p-8 rounded-xl shadow-md">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 border-b pb-2">👨‍⚕️ 医師マスタ管理</h1>

        {/* 新規追加 */}
        {/* 💡 修正: flex-wrap を追加し、ボタンがはみ出さないように調整 */}
        <div className="flex flex-wrap md:flex-nowrap gap-2 mb-6 bg-blue-50 p-3 md:p-4 rounded-lg">
          <input
            type="text" placeholder="新しい医師の氏名" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 min-w-[150px] p-2 border rounded"
          />
          <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold whitespace-nowrap transition-colors">追加</button>
        </div>

        {/* 一覧 */}
        <div className="space-y-2 md:space-y-3">
          {doctors.map((doc) => (
            // 💡 修正: スマホ用に flex-wrap を追加、余白を調整
            <div key={doc.id} className="flex flex-wrap items-center justify-between p-2 md:p-3 border rounded hover:bg-gray-50 gap-2">
              {editingId === doc.id ? (
                <input
                  type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 min-w-[120px] p-1 border rounded"
                />
              ) : (
                <span className="font-medium text-gray-700 text-sm md:text-base">{doc.name}</span>
              )}

              <div className="flex gap-2 shrink-0">
                {editingId === doc.id ? (
                  <button onClick={() => handleUpdate(doc.id)} className="text-green-600 text-sm font-bold bg-green-50 px-2 py-1 rounded">保存</button>
                ) : (
                  <button onClick={() => { setEditingId(doc.id); setEditName(doc.name); }} className="text-blue-600 text-sm bg-blue-50 px-2 py-1 rounded">編集</button>
                )}
                <button onClick={() => handleDelete(doc.id)} className="text-red-500 text-sm bg-red-50 px-2 py-1 rounded">削除</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}