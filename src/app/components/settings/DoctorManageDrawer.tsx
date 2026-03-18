// src/app/components/settings/DoctorManageDrawer.tsx — 医師の追加・名前変更・削除・ロック・マジックリンク
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, Unlock, Loader2, Copy, Check } from "lucide-react";
import SettingsModalPortal from "./SettingsModalPortal";
import { getAuthHeaders } from "../../hooks/useAuth";

type Doctor = {
  id: string;
  name: string;
  is_active?: boolean;
  is_locked?: boolean;
  access_token?: string;
};

type DoctorManageDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onDoctorsChanged: () => void;
  onShowGuide?: () => void;
};

const apiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
};

export default function DoctorManageDrawer({ isOpen, onClose, onDoctorsChanged, onShowGuide }: DoctorManageDrawerProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lockingId, setLockingId] = useState<string | null>(null);

  const activeDoctors = useMemo(() =>
    doctors.filter((d) => d.is_active !== false).sort((a, b) => a.name.localeCompare(b.name, "ja", { numeric: true })),
    [doctors],
  );
  const archivedDoctors = useMemo(() => doctors.filter((d) => d.is_active === false), [doctors]);
  const [showArchived, setShowArchived] = useState(false);

  const fetchDoctors = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase()}/api/doctors`, { headers: getAuthHeaders() });
      if (res.ok) setDoctors(await res.json());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchDoctors();
      setError("");
      setEditingId(null);
      setNewName("");
    }
  }, [isOpen, fetchDoctors]);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setError("");
    try {
      const res = await fetch(`${apiBase()}/api/doctors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, unknown>)?.detail as string || "追加に失敗しました");
      }
      setNewName("");
      await fetchDoctors();
      onDoctorsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加に失敗しました");
    }
  };

  const handleUpdate = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setError("");
    try {
      const res = await fetch(`${apiBase()}/api/doctors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("名前の変更に失敗しました");
      setEditingId(null);
      setEditName("");
      await fetchDoctors();
      onDoctorsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "変更に失敗しました");
    }
  };

  const handleArchive = async (id: string) => {
    if (!window.confirm("この医師をアーカイブ（非表示）にしますか？")) return;
    setError("");
    try {
      const res = await fetch(`${apiBase()}/api/doctors/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("アーカイブに失敗しました");
      await fetchDoctors();
      onDoctorsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アーカイブに失敗しました");
    }
  };

  const handleRestore = async (id: string) => {
    setError("");
    try {
      const res = await fetch(`${apiBase()}/api/doctors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) throw new Error("復元に失敗しました");
      await fetchDoctors();
      onDoctorsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "復元に失敗しました");
    }
  };

  const handleToggleLock = async (doctor: Doctor) => {
    setLockingId(doctor.id);
    setError("");
    try {
      const res = await fetch(`${apiBase()}/api/doctors/${doctor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ is_locked: !doctor.is_locked }),
      });
      if (!res.ok) throw new Error("ロック更新に失敗しました");
      await fetchDoctors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ロック更新に失敗しました");
    } finally {
      setLockingId(null);
    }
  };

  const handleCopyLink = async (doctor: Doctor) => {
    if (!doctor.access_token) return;
    try {
      await copyText(`${window.location.origin}/entry/${doctor.access_token}`);
      setCopiedId(doctor.id);
      window.setTimeout(() => setCopiedId((prev) => (prev === doctor.id ? null : prev)), 1500);
    } catch {
      setError("コピーに失敗しました");
    }
  };

  return (
    <SettingsModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-6">
        <div className="flex max-h-[85dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl sm:max-h-[90vh]">
          {/* ヘッダー */}
          <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-4 py-4 sm:px-5">
            <h3 className="text-base font-bold text-gray-900">医師の管理</h3>
            <div className="flex items-center gap-2">
              {onShowGuide && (
                <button type="button" onClick={onShowGuide} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">?</button>
              )}
              <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50">
                閉じる
              </button>
            </div>
          </div>

          {/* コンテンツ */}
          <div className="overflow-y-auto p-4 sm:p-5">
            {isLoading && doctors.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                {/* 追加フォーム */}
                <div className="mb-4 flex gap-2">
                  <input
                    type="text"
                    placeholder="新しい医師名を入力"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => { void handleAdd(); }}
                    disabled={!newName.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    追加
                  </button>
                </div>

                {error && <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                {/* 医師一覧 */}
                <div className="space-y-2">
                  {activeDoctors.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-6">医師が登録されていません</p>
                  )}
                  {activeDoctors.map((doctor) => {
                    const locked = Boolean(doctor.is_locked);
                    const isLocking = lockingId === doctor.id;
                    const isCopied = copiedId === doctor.id;
                    return (
                      <div key={doctor.id} className="rounded-lg border border-gray-200 px-3 py-2.5">
                        {editingId === doctor.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") void handleUpdate(doctor.id); }}
                              autoFocus
                              className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button onClick={() => { void handleUpdate(doctor.id); }} className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-200">保存</button>
                            <button onClick={() => { setEditingId(null); setEditName(""); }} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200">取消</button>
                          </div>
                        ) : (
                          <>
                            {/* 名前 + ロック状態 */}
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="flex-1 truncate text-sm font-medium text-gray-700">{doctor.name}</span>
                              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                                locked ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
                              }`}>
                                {locked ? "ロック中" : "入力可"}
                              </span>
                            </div>
                            {/* ボタン行 */}
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                onClick={() => { void handleToggleLock(doctor); }}
                                disabled={isLocking}
                                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                                  locked ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                              >
                                {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                                {isLocking ? "更新中..." : locked ? "解除" : "ロック"}
                              </button>
                              <button
                                onClick={() => { void handleCopyLink(doctor); }}
                                disabled={!doctor.access_token}
                                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${
                                  isCopied ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                }`}
                              >
                                {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {isCopied ? "コピー済み" : "入力用URL"}
                              </button>
                              <button
                                onClick={() => { setEditingId(doctor.id); setEditName(doctor.name); }}
                                className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => { void handleArchive(doctor.id); }}
                                className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                              >
                                削除
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* アーカイブ済み */}
                {archivedDoctors.length > 0 && (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <button
                      onClick={() => setShowArchived((p) => !p)}
                      className="flex w-full items-center justify-between text-left text-xs font-bold text-gray-600"
                    >
                      <span>{showArchived ? "▼" : "▶"} アーカイブ済み</span>
                      <span className="text-gray-400">{archivedDoctors.length}名</span>
                    </button>
                    {showArchived && (
                      <div className="mt-2 space-y-2">
                        {archivedDoctors.map((doctor) => (
                          <div key={doctor.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                            <span className="flex-1 truncate text-sm text-gray-500">{doctor.name}</span>
                            <button
                              onClick={() => { void handleRestore(doctor.id); }}
                              className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              復元
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <p className="mt-4 text-xs text-gray-400 text-center">
                  {activeDoctors.length}名 登録中
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </SettingsModalPortal>
  );
}
