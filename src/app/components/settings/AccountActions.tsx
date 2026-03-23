"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Copy, ArrowRightLeft } from "lucide-react";
import { getAuthHeaders, useAuth } from "../../hooks/useAuth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function AccountActions() {
  const { logout } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // 引き継ぎ
  const [transferCode, setTransferCode] = useState("");
  const [transferExpiry, setTransferExpiry] = useState("");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);

  const handleGenerateTransferCode = async () => {
    if (!window.confirm("引き継ぎコードを発行しますか？\nこのコードを使うと、別のアカウントにデータを丸ごとコピーできます。")) return;
    setIsGeneratingCode(true);
    setTransferCode("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/transfer-code`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setTransferCode(data.code);
      setTransferExpiry(data.expires_at);
    } catch {
      window.alert("コードの生成に失敗しました。");
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCopyCode = async () => {
    if (!transferCode) return;
    await navigator.clipboard.writeText(transferCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleTransferImport = async () => {
    if (!importCode.trim()) {
      setImportError("コードを入力してください");
      return;
    }
    if (!window.confirm("既存のデータは全て置き換えられます。\nこの操作は取り消せません。本当に取り込みますか？")) return;
    if (!window.confirm("最終確認: 現在の医師・スケジュール・設定が全て上書きされます。よろしいですか？")) return;
    setIsImporting(true);
    setImportError("");
    setImportMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/transfer-import`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ code: importCode.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setImportError(data?.detail || "取り込みに失敗しました");
        return;
      }
      setImportMessage(data?.message || "データを取り込みました");
      setImportCode("");
    } catch {
      setImportError("取り込みに失敗しました");
    } finally {
      setIsImporting(false);
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
      {/* データ引き継ぎ */}
      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
          <ArrowRightLeft className="h-4 w-4" />
          データ引き継ぎ
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          別のアカウントにデータを丸ごと移行できます。
        </p>

        {/* コード生成 */}
        <div className="mb-3">
          <p className="text-xs font-bold text-gray-700 mb-1.5">このアカウントのデータを渡す</p>
          <button
            onClick={() => { void handleGenerateTransferCode(); }}
            disabled={isGeneratingCode}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isGeneratingCode ? "生成中..." : "引き継ぎコードを発行"}
          </button>
          {transferCode && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-2">
                <code className="text-lg font-bold tracking-wider text-gray-800">{transferCode}</code>
                <button
                  onClick={() => { void handleCopyCode(); }}
                  className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                  title="コピー"
                >
                  <Copy className="h-4 w-4" />
                </button>
                {codeCopied && <span className="text-[10px] text-green-600 font-bold">コピーしました</span>}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                有効期限: {new Date(transferExpiry).toLocaleString("ja-JP")}
              </p>
            </div>
          )}
        </div>

        {/* コード入力（取り込み） */}
        <div>
          <p className="text-xs font-bold text-gray-700 mb-1.5">別のアカウントからデータを受け取る</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={importCode}
              onChange={(e) => { setImportCode(e.target.value); setImportError(""); setImportMessage(""); }}
              placeholder="引き継ぎコードを入力"
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => { void handleTransferImport(); }}
              disabled={isImporting || !importCode.trim()}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {isImporting ? "取り込み中..." : "取り込む"}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            既存のデータは全て置き換えられます。
          </p>
          {importError && <p className="text-xs text-red-600 font-bold mt-1">{importError}</p>}
          {importMessage && <p className="text-xs text-green-600 font-bold mt-1">{importMessage}</p>}
        </div>
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
              onClick={() => { if (window.confirm("アカウントの削除に進みます。よろしいですか？")) setShowDeleteConfirm(true); }}
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
