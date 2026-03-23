"use client";

import { useState } from "react";
import { Download, Trash2, AlertTriangle } from "lucide-react";
import { getAuthHeaders, useAuth } from "../../hooks/useAuth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function AccountActions() {
  const { auth, logout } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/export`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${auth.hospitalName || "hospital"}_export.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      window.alert("エクスポートに失敗しました。");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePassword) {
      setDeleteError("パスワードを入力してください");
      return;
    }
    setIsDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/account`, {
        method: "DELETE",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setDeleteError(data?.detail || "削除に失敗しました");
        return;
      }
      logout();
    } catch {
      setDeleteError("削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* データエクスポート */}
      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-2">データエクスポート</h3>
        <p className="text-xs text-gray-500 mb-2">
          医師情報・スケジュール・設定をJSON形式でダウンロードします。
        </p>
        <button
          onClick={() => { void handleExport(); }}
          disabled={isExporting}
          className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          {isExporting ? "エクスポート中..." : "データをダウンロード"}
        </button>
      </div>

      <hr className="border-gray-200" />

      {/* アカウント削除 */}
      <div>
        <h3 className="text-sm font-bold text-red-600 mb-2">アカウント削除</h3>
        {!showDeleteConfirm ? (
          <>
            <p className="text-xs text-gray-500 mb-2">
              アカウントと全データを完全に削除します。この操作は取り消せません。
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              アカウントを削除する
            </button>
          </>
        ) : (
          <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                <p className="font-bold mb-1">本当に削除しますか？</p>
                <p className="text-xs">全ての医師情報・スケジュール・設定が完全に削除されます。この操作は取り消せません。</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-red-700 mb-1">
                確認のためパスワードを入力
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full rounded-md border border-red-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="パスワード"
              />
            </div>
            {deleteError && (
              <p className="text-xs text-red-600 font-bold">{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { void handleDelete(); }}
                disabled={isDeleting}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? "削除中..." : "完全に削除する"}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); setDeleteError(""); }}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
