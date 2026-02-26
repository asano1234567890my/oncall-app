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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-white p-4 md:p-8 rounded-xl shadow-md">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 border-b pb-2">👨‍⚕️ 医師マスタ管理</h1>

        {/* 新規追加エリア */}
        {/* ✅ 修正: スマホは縦並び(flex-col)、PCは横並び(md:flex-row)に完全分離 */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-3 mb-6 bg-blue-50 p-3 md:p-4 rounded-lg">
          <input
            type="text" 
            placeholder="新しい医師の氏名" 
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full md:flex-1 p-2 border rounded"
          />
          {/* ✅ 修正: スマホではボタンも幅いっぱい(w-full)にして押しやすく */}
          <button 
            onClick={handleAdd} 
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold transition-colors"
          >
            追加
          </button>
        </div>

        {/* 一覧エリア */}
        <div className="space-y-2 md:space-y-3">
          {doctors.map((doc) => (
            // ✅ 修正: スマホ時は縦に並べて、要素同士がぶつからないように
            <div key={doc.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 border rounded hover:bg-gray-50 gap-2 md:gap-4">
              
              {editingId === doc.id ? (
                <input
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full md:flex-1 p-2 border rounded"
                />
              ) : (
                <span className="font-bold text-gray-700 text-base">{doc.name}</span>
              )}

              {/* ✅ 修正: ボタン群もスマホ時は幅いっぱい(w-full)に広がり、半分ずつの大きさ(flex-1)になるように調整 */}
              <div className="flex gap-2 w-full md:w-auto shrink-0 mt-1 md:mt-0">
                {editingId === doc.id ? (
                  <button 
                    onClick={() => handleUpdate(doc.id)} 
                    className="flex-1 md:flex-none text-green-700 font-bold bg-green-100 hover:bg-green-200 px-4 py-2 rounded transition-colors"
                  >
                    保存
                  </button>
                ) : (
                  <button 
                    onClick={() => { setEditingId(doc.id); setEditName(doc.name); }} 
                    className="flex-1 md:flex-none text-blue-700 font-bold bg-blue-100 hover:bg-blue-200 px-4 py-2 rounded transition-colors"
                  >
                    編集
                  </button>
                )}
                <button 
                  onClick={() => handleDelete(doc.id)} 
                  className="flex-1 md:flex-none text-red-700 font-bold bg-red-100 hover:bg-red-200 px-4 py-2 rounded transition-colors"
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