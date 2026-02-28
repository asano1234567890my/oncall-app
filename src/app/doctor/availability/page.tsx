"use client";

import { useEffect, useMemo, useState , KeyboardEvent } from "react";

type Doctor = {
  id: string;
  name: string;
  // バックエンドから他プロパティが多数来ても壊れないようにする
  [key: string]: any;
};

function getApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  return envUrl && envUrl.trim().length > 0 ? envUrl : "http://127.0.0.1:8000";
}

export default function DoctorsPage() {
  // ========================
  // MUST KEEP state names
  // ========================
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // UI補助
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 二重送信防止（対象ボタンだけ止める）
  const [isAdding, setIsAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const apiUrl = useMemo(() => getApiUrl(), []);

  // ========================
  // A. GET doctors
  // ========================
  const fetchDoctors = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiUrl}/api/doctors/`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`GET failed: ${res.status}`);
      }
      const data = (await res.json()) as Doctor[];
      setDoctors(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "一覧取得に失敗しました");
      setDoctors([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========================
  // B. POST add
  // ========================
  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;

    setIsAdding(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiUrl}/api/doctors/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        throw new Error(`POST failed: ${res.status}`);
      }
      setNewName("");
      await fetchDoctors();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "追加に失敗しました");
    } finally {
      setIsAdding(false);
    }
  };

  // ========================
  // C. PUT update name
  // ========================
  const startEdit = (d: Doctor) => {
    setEditingId(d.id);
    setEditName(d.name ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleUpdate = async (id: string) => {
    const name = editName.trim();
    if (!name) return;

    setUpdatingId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiUrl}/api/doctors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        throw new Error(`PUT failed: ${res.status}`);
      }
      cancelEdit();
      await fetchDoctors();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "更新に失敗しました");
    } finally {
      setUpdatingId(null);
    }
  };

  // ========================
  // D. DELETE
  // ========================
  const handleDelete = async (id: string) => {
    const ok = confirm("本当に削除しますか？");
    if (!ok) return;

    setDeletingId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiUrl}/api/doctors/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`DELETE failed: ${res.status}`);
      }
      // 編集中の対象を消した場合の安全策
      if (editingId === id) cancelEdit();
      await fetchDoctors();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  const onAddKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void handleAdd();
  };

  const onEditKeyDown = (e: KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === "Enter") void handleUpdate(id);
    if (e.key === "Escape") cancelEdit();
  };

  return (
    <div className="w-full overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight sm:text-xl">医師マスタ管理</h1>
            <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
              一覧の追加・編集・削除を行います（モバイル対応）
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchDoctors()}
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium shadow-sm disabled:opacity-50"
            >
              再読込
            </button>
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Add form */}
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <label className="block text-xs font-medium text-neutral-600">新規医師名</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={onAddKeyDown}
                placeholder="例）山田 太郎"
                className="mt-1 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
              />
            </div>

            <div className="flex gap-2 sm:pt-5">
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={isAdding || newName.trim().length === 0}
                className="inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 sm:w-auto"
              >
                {isAdding ? "追加中…" : "追加"}
              </button>
              <button
                type="button"
                onClick={() => setNewName("")}
                disabled={isAdding || newName.length === 0}
                className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium shadow-sm disabled:opacity-50 sm:w-auto"
              >
                クリア
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">
              医師一覧{" "}
              <span className="font-normal text-neutral-500">({doctors.length})</span>
            </div>
            {isLoading && <div className="text-xs text-neutral-500">読み込み中…</div>}
          </div>

          {/* Cards */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:gap-3">
            {doctors.map((d) => {
              const isEditing = editingId === d.id;
              const isBusy =
                isAdding || updatingId === d.id || deletingId === d.id || isLoading;

              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left: name / edit */}
                    <div className="min-w-0 flex-1">
                      {!isEditing ? (
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="min-w-0 flex-1 break-words text-sm font-semibold">
                              {d.name}
                            </div>
                          </div>
                          <div className="mt-1 break-all text-[11px] text-neutral-500">
                            ID: {d.id}
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <label className="block text-xs font-medium text-neutral-600">
                            医師名（編集）
                          </label>
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => onEditKeyDown(e, d.id)}
                            className="mt-1 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                            autoFocus
                          />
                          <div className="mt-1 text-[11px] text-neutral-500">
                            Enterで保存 / Escでキャンセル
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: actions */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                      {!isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(d)}
                            disabled={isBusy}
                            className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium shadow-sm disabled:opacity-50 sm:w-auto"
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(d.id)}
                            disabled={isBusy}
                            className="inline-flex w-full items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm disabled:opacity-50 sm:w-auto"
                          >
                            {deletingId === d.id ? "削除中…" : "削除"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleUpdate(d.id)}
                            disabled={updatingId === d.id || editName.trim().length === 0}
                            className="inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 sm:w-auto"
                          >
                            {updatingId === d.id ? "保存中…" : "保存"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={updatingId === d.id}
                            className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium shadow-sm disabled:opacity-50 sm:w-auto"
                          >
                            キャンセル
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {!isLoading && doctors.length === 0 && (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
                医師がまだ登録されていません。上のフォームから追加してください。
              </div>
            )}
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 text-xs text-neutral-500">
          ※ API Base URL: <span className="break-all">{apiUrl}</span>
        </div>
      </div>
    </div>
  );
}