"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuthHeaders } from "../hooks/useAuth";

type BillingStatus = {
  plan: "free" | "pro";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_expires_at: string | null;
};

export default function BillingSection() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHidden, setIsHidden] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) {
      setIsLoading(false);
      setIsHidden(true);
      return;
    }
    fetch(`${apiUrl}/api/billing/status`, { headers })
      .then((res) => {
        if (res.status === 503) {
          setIsHidden(true);
          return null;
        }
        if (!res.ok) {
          setIsHidden(true);
          return null;
        }
        return res.json();
      })
      .then((data: BillingStatus | null) => {
        if (data) setStatus(data);
      })
      .catch(() => {
        setIsHidden(true);
      })
      .finally(() => setIsLoading(false));
  }, [apiUrl]);

  const handleCheckout = useCallback(async () => {
    setIsRedirecting(true);
    try {
      const res = await fetch(`${apiUrl}/api/billing/checkout`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { checkout_url: string };
      window.location.href = data.checkout_url;
    } catch {
      setIsRedirecting(false);
      alert("チェックアウトの開始に失敗しました。しばらくしてから再度お試しください。");
    }
  }, [apiUrl]);

  const handlePortal = useCallback(async () => {
    setIsRedirecting(true);
    try {
      const res = await fetch(`${apiUrl}/api/billing/portal`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { portal_url: string };
      window.location.href = data.portal_url;
    } catch {
      setIsRedirecting(false);
      alert("ポータルの表示に失敗しました。しばらくしてから再度お試しください。");
    }
  }, [apiUrl]);

  if (isHidden || (!isLoading && !status)) return null;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
          プラン情報を取得中...
        </div>
      </div>
    );
  }

  const isPro = status!.plan === "pro";
  const expiresAt = status!.plan_expires_at
    ? new Date(status!.plan_expires_at).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
        <span aria-hidden="true">&#x1F4B3;</span>
        プラン管理
      </h3>
      <div className="mt-3 space-y-3">
        {isPro ? (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                Pro
              </span>
              <span className="text-sm text-gray-700">Pro プラン</span>
              <span className="text-green-500 text-sm">&#x2713;</span>
            </div>
            {expiresAt && (
              <p className="text-xs text-gray-500">
                次の更新日: {expiresAt}
              </p>
            )}
            <button
              onClick={() => { void handlePortal(); }}
              disabled={isRedirecting}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {isRedirecting ? "移動中..." : "プラン・お支払い管理"}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                Free
              </span>
              <span className="text-sm text-gray-700">無料プラン</span>
            </div>
            <p className="text-xs text-gray-500">20人以下・全機能利用可能</p>
            <button
              onClick={() => { void handleCheckout(); }}
              disabled={isRedirecting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isRedirecting ? "移動中..." : "\u2728 Pro にアップグレード"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
