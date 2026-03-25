// src/app/components/settings/DoctorManageDrawer.tsx — 医師の追加・名前変更・削除・ロック・共有
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lock, Unlock, Loader2, Copy, Check, Share2, Printer, QrCode, X, Upload } from "lucide-react";
import { toast } from "react-hot-toast";
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

const getDoctorUrl = (token: string) =>
  typeof window !== "undefined" ? `${window.location.origin}/entry/${token}` : `/entry/${token}`;

// ── QR code generation (dynamic import to keep bundle small) ──
async function generateQrDataUrl(text: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, { width: 256, margin: 2 });
}

// ── Share dropdown for individual doctor ──
function DoctorShareDropdown({ doctor, onError }: { doctor: Doctor; onError: (msg: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  if (!doctor.access_token) return null;
  const url = getDoctorUrl(doctor.access_token);
  const msg = `${doctor.name}先生\n不可日の入力をお願いします。\n${url}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-200 transition-colors"
      >
        <Share2 className="h-3 w-3" />
        共有
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            onClick={async () => {
              try {
                await copyText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch { onError("コピーに失敗しました"); }
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "コピー済み" : "URLをコピー"}
          </button>
          <a
            href={`https://line.me/R/share?text=${encodeURIComponent(msg)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            onClick={() => setIsOpen(false)}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.81 2 10.5c0 2.9 1.93 5.45 4.83 6.91l-.58 3.43a.3.3 0 0 0 .42.34l4-2.08c.43.06.87.1 1.33.1 5.52 0 10-3.81 10-8.5S17.52 2 12 2z"/></svg>
            LINEで送る
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent(`不可日入力のお願い（${doctor.name}先生）`)}&body=${encodeURIComponent(msg)}`}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            onClick={() => setIsOpen(false)}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            メールで送る
          </a>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            onClick={async () => {
              setIsOpen(false);
              try {
                const dataUrl = await generateQrDataUrl(url);
                setQrDataUrl(dataUrl);
              } catch { onError("QRコードの生成に失敗しました"); }
            }}
          >
            <QrCode className="h-3.5 w-3.5" />
            QRコードを表示
          </button>
        </div>
      )}
      {/* QR modal */}
      {qrDataUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setQrDataUrl(null)}>
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-gray-800 mb-3">{doctor.name}先生</p>
            <img src={qrDataUrl} alt="QR Code" className="mx-auto w-48 h-48" />
            <p className="mt-3 text-[10px] text-gray-400 break-all">{url}</p>
            <button onClick={() => setQrDataUrl(null)} className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200">
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bulk share dropdown ──
function BulkShareDropdown({ doctors, onError }: { doctors: Doctor[]; onError: (msg: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const docsWithToken = doctors.filter((d) => d.access_token);
  if (docsWithToken.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <Share2 className="h-3.5 w-3.5" />
        まとめて共有
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            onClick={async () => {
              if (!window.confirm(
                "⚠️ 各URLにアクセスすると、その医師の不可日を編集できます。\n\nURLの取り扱いには十分ご注意ください。\n共有先を間違えると、他の医師の予定を変更されるおそれがあります。\n\n全員のURLをコピーしますか？"
              )) return;
              const lines = docsWithToken.map((d) => `${d.name}: ${getDoctorUrl(d.access_token!)}`);
              try {
                await copyText(lines.join("\n"));
                setCopied(true);
                setTimeout(() => { setCopied(false); setIsOpen(false); }, 1500);
              } catch { onError("コピーに失敗しました"); }
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "コピー済み" : "全員のURLを一括コピー"}
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            onClick={() => {
              setIsOpen(false);
              // Open QR print page in new tab
              const params = docsWithToken.map((d) => `n=${encodeURIComponent(d.name)}&t=${encodeURIComponent(d.access_token!)}`).join("&");
              const printUrl = `/report/qr-print?${params}`;
              window.open(printUrl, "_blank");
            }}
          >
            <Printer className="h-3.5 w-3.5" />
            QRカードを印刷
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ──
export default function DoctorManageDrawer({ isOpen, onClose, onDoctorsChanged, onShowGuide }: DoctorManageDrawerProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [lockingId, setLockingId] = useState<string | null>(null);

  // 医師への案内メッセージ
  const [doctorMessage, setDoctorMessage] = useState("");
  const [doctorMessageSaved, setDoctorMessageSaved] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);

  // 不可日の上限
  const [unavailLimit, setUnavailLimit] = useState<string>("");
  const [unavailLimitSaved, setUnavailLimitSaved] = useState<string>("");
  const [savingLimit, setSavingLimit] = useState(false);

  // 不可日の制限（折りたたみ）
  const [showUnavailSettings, setShowUnavailSettings] = useState(false);

  // ファイル取込
  const [importStep, setImportStep] = useState<"idle" | "parsing" | "confirm">("idle");
  const [importNames, setImportNames] = useState<string[]>([]);
  const [importChecked, setImportChecked] = useState<Set<number>>(new Set());
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Fetch doctor_message + unavail_day_limit
      void (async () => {
        try {
          const [msgRes, limitRes] = await Promise.all([
            fetch(`${apiBase()}/api/settings/kv/doctor_message`, { headers: getAuthHeaders() }),
            fetch(`${apiBase()}/api/settings/kv/unavail_day_limit`, { headers: getAuthHeaders() }),
          ]);
          if (msgRes.ok) {
            const data = await msgRes.json();
            const val = typeof data.value === "string" ? data.value : "";
            setDoctorMessage(val);
            setDoctorMessageSaved(val);
          }
          if (limitRes.ok) {
            const data = await limitRes.json();
            const val = data.value != null ? String(data.value) : "";
            setUnavailLimit(val);
            setUnavailLimitSaved(val);
          }
        } catch { /* ignore */ }
      })();
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

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setImportError("ファイルサイズが大きすぎます（上限10MB）");
      return;
    }
    setImportStep("parsing");
    setImportError("");
    setImportNames([]);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch(`${apiBase()}/api/import/parse-doctors`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "ファイルの解析に失敗しました");
      }
      const data: { names: string[] } = await res.json();
      if (data.names.length === 0) {
        setImportError("医師名が見つかりませんでした");
        setImportStep("idle");
        return;
      }
      setImportNames(data.names);
      setImportChecked(new Set(data.names.map((_, i) => i)));
      setImportStep("confirm");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "ファイルの解析に失敗しました");
      setImportStep("idle");
    } finally {
      // reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImportConfirm = async () => {
    const selected = importNames.filter((_, i) => importChecked.has(i));
    if (selected.length === 0) return;
    setImportError("");
    try {
      const res = await fetch(`${apiBase()}/api/import/register-doctors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ names: selected }),
      });
      if (!res.ok) throw new Error("登録に失敗しました");
      const data = await res.json();
      window.alert(data.message);
      setImportStep("idle");
      setImportNames([]);
      await fetchDoctors();
      onDoctorsChanged();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "登録に失敗しました");
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
                <div className="mb-3 flex gap-2">
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

                {/* ファイルから一括取込 */}
                <div className="mb-3">
                  {importStep === "idle" && (
                    <label className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer w-fit">
                      <Upload className="h-3.5 w-3.5" />
                      ファイルから一括取込
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.xlsx,.xls,.docx,.pdf,.txt,.csv"
                        onChange={(e) => { void handleFileImport(e); }}
                        className="hidden"
                      />
                    </label>
                  )}
                  {importStep === "parsing" && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                      ファイルを解析中...
                    </div>
                  )}
                  {importStep === "confirm" && importNames.length > 0 && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 space-y-2">
                      <p className="text-xs font-bold text-purple-800">
                        {importNames.length}名の医師名を検出しました（チェックを外すと除外）
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {importNames.map((name, i) => (
                          <label key={i} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={importChecked.has(i)}
                              onChange={() => {
                                setImportChecked((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(i)) next.delete(i); else next.add(i);
                                  return next;
                                });
                              }}
                              className="rounded border-gray-300"
                            />
                            {name}
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { void handleImportConfirm(); }}
                          disabled={importChecked.size === 0}
                          className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                          {importChecked.size}名を登録
                        </button>
                        <button
                          onClick={() => { setImportStep("idle"); setImportNames([]); setImportError(""); }}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  )}
                  {importError && <p className="mt-1 text-xs text-red-600">{importError}</p>}
                  {importStep === "idle" && (
                    <p className="mt-1 text-[10px] text-gray-400">画像・Excel・Word・PDF・テキストに対応</p>
                  )}
                </div>

                {/* まとめて共有 + 一括ロック/解除 */}
                {activeDoctors.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    <BulkShareDropdown doctors={activeDoctors} onError={setError} />
                    {activeDoctors.some((d) => !d.is_locked) && (
                      <button
                        onClick={async () => {
                          if (!window.confirm("全員の入力をロックしますか？")) return;
                          setError("");
                          try {
                            const res = await fetch(`${apiBase()}/api/doctors/bulk-lock`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                              body: JSON.stringify({ is_locked: true }),
                            });
                            if (!res.ok) throw new Error("一括ロックに失敗しました");
                            await fetchDoctors();
                            onDoctorsChanged();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "一括ロックに失敗しました");
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        全員ロック
                      </button>
                    )}
                    {activeDoctors.some((d) => d.is_locked) && (
                      <button
                        onClick={async () => {
                          if (!window.confirm("全員のロックを解除しますか？")) return;
                          setError("");
                          try {
                            const res = await fetch(`${apiBase()}/api/doctors/bulk-lock`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                              body: JSON.stringify({ is_locked: false }),
                            });
                            if (!res.ok) throw new Error("一括解除に失敗しました");
                            await fetchDoctors();
                            onDoctorsChanged();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "一括解除に失敗しました");
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <Unlock className="h-3.5 w-3.5" />
                        全員解除
                      </button>
                    )}
                  </div>
                )}

                {error && <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                {/* 医師一覧 */}
                <div className="space-y-2">
                  {activeDoctors.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-6">医師が登録されていません</p>
                  )}
                  {activeDoctors.map((doctor) => {
                    const locked = Boolean(doctor.is_locked);
                    const isLocking = lockingId === doctor.id;
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
                              <DoctorShareDropdown doctor={doctor} onError={setError} />
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

                {/* 医師への案内メッセージ */}
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-bold text-gray-600 mb-1.5">医師への案内メッセージ</div>
                  <p className="text-[10px] text-gray-400 mb-2">入力画面（マジックリンク）の上部に表示されます</p>
                  <textarea
                    value={doctorMessage}
                    onChange={(e) => setDoctorMessage(e.target.value)}
                    placeholder="例: 研究日の前日も不可曜日として申請してください。不可日は月5日までにしてください。"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                  />
                  {doctorMessage !== doctorMessageSaved && (
                    <button
                      disabled={savingMessage}
                      onClick={async () => {
                        setSavingMessage(true);
                        try {
                          const res = await fetch(`${apiBase()}/api/settings/kv/doctor_message`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                            body: JSON.stringify({ value: doctorMessage }),
                          });
                          if (res.ok) {
                            setDoctorMessageSaved(doctorMessage);
                            toast.success("保存しました");
                          }
                        } catch { /* ignore */ }
                        setSavingMessage(false);
                      }}
                      className="mt-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {savingMessage ? "保存中..." : "保存"}
                    </button>
                  )}
                </div>

                {/* 不可日の制限（折りたたみ） */}
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50">
                  <button
                    onClick={() => setShowUnavailSettings((p) => !p)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors rounded-lg"
                  >
                    <span>{showUnavailSettings ? "▼" : "▶"} 不可日の制限・解なし対策</span>
                    {unavailLimit && <span className="text-[10px] font-normal text-gray-400">上限 {unavailLimit}日</span>}
                  </button>
                  {showUnavailSettings && (
                    <div className="px-3 pb-3 space-y-3">
                      {/* 個別不可日の上限 */}
                      <div>
                        <div className="text-xs font-bold text-gray-600 mb-1">個別不可日の上限</div>
                        <p className="text-[10px] text-gray-400 mb-2">医師1人あたりの月間不可日数の上限（空欄=無制限）</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="31"
                            value={unavailLimit}
                            onChange={(e) => setUnavailLimit(e.target.value)}
                            placeholder="無制限"
                            className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-500">日 / 月</span>
                          {unavailLimit && (
                            <button
                              onClick={() => setUnavailLimit("")}
                              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[10px] text-gray-500 hover:bg-gray-100 transition-colors"
                            >
                              クリア
                            </button>
                          )}
                        </div>
                        {unavailLimit !== unavailLimitSaved && (
                          <button
                            disabled={savingLimit}
                            onClick={async () => {
                              setSavingLimit(true);
                              try {
                                const res = await fetch(`${apiBase()}/api/settings/kv/unavail_day_limit`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                                  body: JSON.stringify({ value: unavailLimit || null }),
                                });
                                if (res.ok) {
                                  setUnavailLimitSaved(unavailLimit);
                                  toast.success("保存しました");
                                }
                              } catch { /* ignore */ }
                              setSavingLimit(false);
                            }}
                            className="mt-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            {savingLimit ? "保存中..." : "保存"}
                          </button>
                        )}
                      </div>

                      {/* 一括ソフト化（最終手段） */}
                      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-2.5">
                        <div className="text-[10px] text-gray-400 mb-1.5">どうしても解が出ない場合の最終手段</div>
                        <p className="text-[10px] text-gray-400 leading-relaxed mb-2">
                          個別不可日をソフト制約に変換します。なるべく尊重されますが必要時は無視されます。固定不可曜日は変更されません。
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={async () => {
                              if (!window.confirm(
                                "⚠️ 全医師の個別不可日をソフト制約に変換します。\n\n" +
                                "・ソフト制約 = なるべく尊重するが、解なし時は無視される\n" +
                                "・固定不可曜日はハード制約のまま（変更なし）\n\n" +
                                "実行しますか？"
                              )) return;
                              try {
                                const res = await fetch(`${apiBase()}/api/doctors/bulk-soften`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                                  body: JSON.stringify({ soften: true }),
                                });
                                if (!res.ok) throw new Error("失敗しました");
                                const data = await res.json();
                                toast.success(data.message || "一括ソフト化しました");
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "一括ソフト化に失敗しました");
                              }
                            }}
                            className="rounded border border-gray-300 bg-white px-2.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                          >
                            全不可日をソフト化
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm(
                                "全医師の個別不可日をハード制約に戻します。\n（ソフト化前の状態に復元）\n\n実行しますか？"
                              )) return;
                              try {
                                const res = await fetch(`${apiBase()}/api/doctors/bulk-soften`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                                  body: JSON.stringify({ soften: false }),
                                });
                                if (!res.ok) throw new Error("失敗しました");
                                const data = await res.json();
                                toast.success(data.message || "ハード制約に復元しました");
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "復元に失敗しました");
                              }
                            }}
                            className="rounded border border-gray-300 bg-white px-2.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                          >
                            ハード制約に戻す
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

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
