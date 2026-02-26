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
    await fetch(`http://127.0.0.1:8000/api/doctors/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    setEditingId(null);
    fetchDoctors();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("本当に削除しますか？")) return;
    await fetch(`http://127.0.0.1:8000/api/doctors/${id}`, { method: "DELETE" });
    fetchDoctors();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-md">
        <h1 className="text-2xl font-bold mb-6 border-b pb-2">👨‍⚕️ 医師マスタ管理</h1>

        {/* 新規追加 */}
        <div className="flex gap-2 mb-8 bg-blue-50 p-4 rounded-lg">
          <input
            type="text" placeholder="新しい医師の氏名" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 p-2 border rounded"
          />
          <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded font-bold">追加</button>
        </div>

        {/* 一覧 */}
        <div className="space-y-3">
          {doctors.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
              {editingId === doc.id ? (
                <input
                  type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 p-1 border rounded mr-2"
                />
              ) : (
                <span className="font-medium text-gray-700">{doc.name}</span>
              )}

              <div className="flex gap-2">
                {editingId === doc.id ? (
                  <button onClick={() => handleUpdate(doc.id)} className="text-green-600 text-sm font-bold">保存</button>
                ) : (
                  <button onClick={() => { setEditingId(doc.id); setEditName(doc.name); }} className="text-blue-600 text-sm">編集</button>
                )}
                <button onClick={() => handleDelete(doc.id)} className="text-red-500 text-sm">削除</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}