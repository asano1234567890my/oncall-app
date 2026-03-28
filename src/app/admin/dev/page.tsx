"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeaders, useAuth } from "../../hooks/useAuth";

const API = () => process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ── Types ──

type HospitalRow = {
  id: string;
  name: string;
  email: string | null;
  is_superadmin: boolean;
  created_at: string | null;
  last_login_at: string | null;
  internal_doctors: number;
  external_doctors: number;
  monthly_generates: number;
};

type UsageSummary = {
  total_hospitals: number;
  active_hospitals_30d: number;
  generating_hospitals_this_month: number;
  monthly_event_counts: Record<string, number>;
  avg_generates_per_active: number;
  avg_generates_per_save: number;
};

type HospitalDetail = {
  hospital: {
    id: string;
    name: string;
    email: string | null;
    created_at: string | null;
    last_login_at: string | null;
  };
  doctors: {
    id: string;
    name: string;
    is_active: boolean;
    is_locked: boolean;
    is_external: boolean;
  }[];
  event_counts: Record<string, number>;
  recent_events: {
    event_type: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }[];
};

type InsightsSummary = {
  total: number;
  by_category: { category: string; count: number }[];
  feature_requests: {
    summary: string;
    count: number;
    latest: string;
  }[];
};

type InsightRow = {
  id: string;
  hospital_id: string;
  hospital_name: string;
  category: string;
  summary: string;
  feature_request: string | null;
  user_message: string;
  created_at: string;
};

// ── Helpers ──

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const fmtDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const EVENT_LABELS: Record<string, string> = {
  generate: "生成",
  diagnose: "診断",
  schedule_save: "確定保存",
  draft_save: "仮保存",
  export_pdf: "PDF出力",
  export_xlsx: "Excel出力",
  ai_parse_image: "AI画像取込",
  ai_parse_doctors: "AI医師取込",
  login: "ログイン",
  register: "新規登録",
  public_schedule_view: "当直表閲覧",
  ical_subscribe: "カレンダー同期",
  shared_entry_access: "共有入力",
};

type MonthlyData = {
  year: number;
  month: number;
  label: string;
  event_counts: Record<string, number>;
};

type GenerateRatio = {
  hospital_id: string;
  hospital_name: string;
  generates: number;
  saves: number;
  ratio: number | null;
};

// ── Guide Insights constants ──

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  usage_question:  { label: "使い方",   color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  troubleshooting: { label: "トラブル", color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  feature_request: { label: "改修要望", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  workflow_advice: { label: "運用相談", color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  general:         { label: "その他",   color: "text-gray-700",   bg: "bg-gray-50",   border: "border-gray-200" },
};

const ALL_CATEGORIES = ["usage_question", "troubleshooting", "feature_request", "workflow_advice", "general"] as const;

// ── Component ──

export default function AdminDevPage() {
  const { auth, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [hospitals, setHospitals] = useState<HospitalRow[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"created_at" | "monthly_generates" | "last_login_at">("created_at");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HospitalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [ratios, setRatios] = useState<GenerateRatio[]>([]);

  // Guide Insights state
  const [insightsSummary, setInsightsSummary] = useState<InsightsSummary | null>(null);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);

  // ── Fetch data ──

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      const [hRes, sRes, mRes, rRes, giSumRes, giListRes] = await Promise.all([
        fetch(`${API()}/api/admin/hospitals`, { headers }),
        fetch(`${API()}/api/admin/usage/summary`, { headers }),
        fetch(`${API()}/api/admin/usage/monthly?months=6`, { headers }),
        fetch(`${API()}/api/admin/usage/generate-ratio`, { headers }),
        fetch(`${API()}/api/admin/guide-insights/summary?days=90`, { headers }),
        fetch(`${API()}/api/admin/guide-insights?days=90&limit=200`, { headers }),
      ]);
      if (hRes.status === 403 || sRes.status === 403) {
        router.replace("/app");
        return;
      }
      if (hRes.status === 401 || sRes.status === 401) {
        router.replace("/login");
        return;
      }
      if (!hRes.ok || !sRes.ok) {
        setError("データの取得に失敗しました");
        return;
      }
      setHospitals(await hRes.json());
      setSummary(await sRes.json());
      if (mRes.ok) setMonthly(await mRes.json());
      if (rRes.ok) setRatios(await rRes.json());
      if (giSumRes.ok) setInsightsSummary(await giSumRes.json());
      if (giListRes.ok) setInsights(await giListRes.json());
    } catch {
      setError("サーバーに接続できません");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Re-fetch insights when category filter changes
  const fetchInsights = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const categoryParam = selectedCategory !== "all" ? `&category=${selectedCategory}` : "";
      const res = await fetch(
        `${API()}/api/admin/guide-insights?days=90&limit=200${categoryParam}`,
        { headers }
      );
      if (res.ok) setInsights(await res.json());
    } catch {
      // silently fail — insights are supplementary
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (authLoading) return;
    if (!auth.isAuthenticated) {
      router.replace("/login");
      return;
    }
    fetchData();
  }, [authLoading, auth.isAuthenticated, router, fetchData]);

  // Re-fetch when category changes (skip initial mount — fetchData handles it)
  useEffect(() => {
    if (!loading && auth.isAuthenticated) {
      fetchInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // ── Detail expand ──

  const toggleDetail = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API()}/api/admin/usage/hospital/${id}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setDetail(await res.json());
      }
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Filter & sort ──

  const filtered = hospitals
    .filter(
      (h) =>
        !search ||
        h.name.toLowerCase().includes(search.toLowerCase()) ||
        (h.email && h.email.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortKey === "monthly_generates") return b.monthly_generates - a.monthly_generates;
      if (sortKey === "last_login_at") {
        return (b.last_login_at || "").localeCompare(a.last_login_at || "");
      }
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

  // ── Render ──

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800">
            Dev Admin
          </h1>
          <button
            onClick={() => router.push("/app")}
            className="text-sm text-blue-600 hover:underline"
          >
            &larr; アプリに戻る
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ── Summary Cards ── */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="総アカウント" value={summary.total_hospitals} />
            <SummaryCard label="アクティブ(30日)" value={summary.active_hospitals_30d} />
            <SummaryCard
              label="月間生成回数"
              value={summary.monthly_event_counts.generate || 0}
            />
            <SummaryCard
              label="生成/確定 比率"
              value={summary.avg_generates_per_save ? `${summary.avg_generates_per_save}x` : "—"}
            />
          </div>
        )}

        {/* ── Event counts table ── */}
        {summary && Object.keys(summary.monthly_event_counts).length > 0 && (
          <div className="bg-white rounded-lg border p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">今月のイベント数</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {Object.entries(summary.monthly_event_counts)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                    <span className="text-gray-600">{EVENT_LABELS[type] || type}</span>
                    <span className="font-mono font-semibold">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Monthly trend table ── */}
        {monthly.length > 0 && (
          <div className="bg-white rounded-lg border p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">月別推移</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="text-left py-1.5 pr-3">月</th>
                    {["generate", "schedule_save", "diagnose", "export_pdf", "export_xlsx", "ai_parse_image", "login"].map(
                      (t) => (
                        <th key={t} className="text-center py-1.5 px-2">
                          {EVENT_LABELS[t] || t}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.label} className="border-t border-gray-100">
                      <td className="py-1.5 pr-3 font-medium text-gray-700">{m.label}</td>
                      {["generate", "schedule_save", "diagnose", "export_pdf", "export_xlsx", "ai_parse_image", "login"].map(
                        (t) => (
                          <td key={t} className="text-center py-1.5 px-2 font-mono">
                            {m.event_counts[t] || 0}
                          </td>
                        )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Generate / Save ratio (for pricing) ── */}
        {ratios.length > 0 && (
          <div className="bg-white rounded-lg border p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">
              生成/確定 比率（アカウント別・直近90日）
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              1つの当直表を完成させるのに何回生成しているか。課金ラインの根拠データ。
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b">
                    <th className="text-left py-1.5">施設名</th>
                    <th className="text-center py-1.5">生成回数</th>
                    <th className="text-center py-1.5">確定回数</th>
                    <th className="text-center py-1.5">比率</th>
                  </tr>
                </thead>
                <tbody>
                  {ratios.map((r) => (
                    <tr key={r.hospital_id} className="border-t border-gray-100">
                      <td className="py-1.5 text-gray-700">{r.hospital_name}</td>
                      <td className="py-1.5 text-center font-mono">{r.generates}</td>
                      <td className="py-1.5 text-center font-mono">{r.saves}</td>
                      <td className="py-1.5 text-center font-mono font-semibold">
                        {r.ratio !== null ? `${r.ratio}x` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Hospital list ── */}
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              アカウント一覧 ({filtered.length})
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-40"
              />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="created_at">登録日順</option>
                <option value="monthly_generates">生成回数順</option>
                <option value="last_login_at">最終ログイン順</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2">施設名</th>
                  <th className="px-4 py-2 hidden sm:table-cell">メアド</th>
                  <th className="px-4 py-2">登録日</th>
                  <th className="px-4 py-2 text-center">医師数</th>
                  <th className="px-4 py-2">最終ログイン</th>
                  <th className="px-4 py-2 text-center">月間生成</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <HospitalTableRow
                    key={h.id}
                    hospital={h}
                    isExpanded={expandedId === h.id}
                    detail={expandedId === h.id ? detail : null}
                    detailLoading={expandedId === h.id && detailLoading}
                    onToggle={() => toggleDetail(h.id)}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      該当するアカウントがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── AIガイド分析 ── */}
        <GuideInsightsSection
          insightsSummary={insightsSummary}
          insights={insights}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          expandedInsightId={expandedInsightId}
          onToggleInsight={(id) => setExpandedInsightId(expandedInsightId === id ? null : id)}
        />
      </div>
    </div>
  );
}

// ── Sub-components ──

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-lg border px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
    </div>
  );
}

function HospitalTableRow({
  hospital: h,
  isExpanded,
  detail,
  detailLoading,
  onToggle,
}: {
  hospital: HospitalRow;
  isExpanded: boolean;
  detail: HospitalDetail | null;
  detailLoading: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-t hover:bg-blue-50/30 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-2 font-medium text-gray-800">
          {h.name}
          {h.is_superadmin && (
            <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
              admin
            </span>
          )}
        </td>
        <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">
          {h.email || "—"}
        </td>
        <td className="px-4 py-2 text-gray-500">{fmtDate(h.created_at)}</td>
        <td className="px-4 py-2 text-center text-gray-700">
          {h.internal_doctors}
          {h.external_doctors > 0 && (
            <span className="text-gray-400 text-xs ml-0.5">(+{h.external_doctors})</span>
          )}
        </td>
        <td className="px-4 py-2 text-gray-500">{fmtDateTime(h.last_login_at)}</td>
        <td className="px-4 py-2 text-center font-mono font-semibold text-gray-700">
          {h.monthly_generates}
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr>
          <td colSpan={6} className="bg-gray-50 px-4 py-4">
            {detailLoading ? (
              <p className="text-gray-400 text-sm">読み込み中...</p>
            ) : detail ? (
              <HospitalDetailPanel detail={detail} />
            ) : null}
          </td>
        </tr>
      )}
    </>
  );
}

function HospitalDetailPanel({ detail }: { detail: HospitalDetail }) {
  return (
    <div className="space-y-4">
      {/* Event counts */}
      {Object.keys(detail.event_counts).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase">直近90日のイベント</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(detail.event_counts)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 bg-white border rounded px-2 py-1 text-xs"
                >
                  <span className="text-gray-600">{EVENT_LABELS[type] || type}</span>
                  <span className="font-mono font-bold">{count}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Doctors */}
      {detail.doctors.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase">
            医師一覧 ({detail.doctors.filter((d) => d.is_active && !d.is_external).length}名 +
            外部{detail.doctors.filter((d) => d.is_external).length}名)
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {detail.doctors
              .filter((d) => d.is_active)
              .map((d) => (
                <span
                  key={d.id}
                  className={`text-xs px-2 py-0.5 rounded ${
                    d.is_external
                      ? "bg-orange-50 text-orange-600 border border-orange-200"
                      : d.is_locked
                        ? "bg-gray-200 text-gray-600"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}
                >
                  {d.name}
                  {d.is_locked && " (locked)"}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Recent events */}
      {detail.recent_events.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase">直近イベント</h3>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left pr-3 pb-1">日時</th>
                  <th className="text-left pr-3 pb-1">種別</th>
                  <th className="text-left pb-1">詳細</th>
                </tr>
              </thead>
              <tbody>
                {detail.recent_events.map((e, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="pr-3 py-1 text-gray-500 whitespace-nowrap">
                      {fmtDateTime(e.created_at)}
                    </td>
                    <td className="pr-3 py-1 text-gray-700">
                      {EVENT_LABELS[e.event_type] || e.event_type}
                    </td>
                    <td className="py-1 text-gray-400 font-mono">
                      {e.metadata ? JSON.stringify(e.metadata) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Guide Insights Section ──

function CategoryBadge({ category }: { category: string }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
  return (
    <span
      className={`inline-flex items-center text-xs px-2 py-0.5 rounded border ${config.bg} ${config.color} ${config.border}`}
    >
      {config.label}
    </span>
  );
}

function GuideInsightsSection({
  insightsSummary,
  insights,
  selectedCategory,
  onCategoryChange,
  expandedInsightId,
  onToggleInsight,
}: {
  insightsSummary: InsightsSummary | null;
  insights: InsightRow[];
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  expandedInsightId: string | null;
  onToggleInsight: (id: string) => void;
}) {
  if (!insightsSummary && insights.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">AIガイド分析</h2>

      {/* ── Category Summary Cards ── */}
      {insightsSummary && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-500">質問総数（直近90日）</p>
              <p className="text-2xl font-bold text-gray-800">{insightsSummary.total}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              const entry = insightsSummary.by_category.find((c) => c.category === cat);
              const count = entry?.count || 0;
              return (
                <div
                  key={cat}
                  className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${config.bg} ${config.border}`}
                >
                  <span className={`font-medium ${config.color}`}>{config.label}</span>
                  <span className={`font-mono font-bold ${config.color}`}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Feature Request Ranking ── */}
      {insightsSummary && insightsSummary.feature_requests.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">改修要望ランキング</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left py-1.5">要望内容</th>
                  <th className="text-center py-1.5">件数</th>
                  <th className="text-left py-1.5">最新日時</th>
                </tr>
              </thead>
              <tbody>
                {insightsSummary.feature_requests.map((fr, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1.5 text-gray-700">{fr.summary}</td>
                    <td className="py-1.5 text-center font-mono font-semibold">{fr.count}</td>
                    <td className="py-1.5 text-gray-500">{fmtDateTime(fr.latest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Question Log ── */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            質問ログ ({insights.length})
          </h3>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="all">すべてのカテゴリ</option>
            {ALL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_CONFIG[cat].label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-2">日時</th>
                <th className="px-4 py-2">病院名</th>
                <th className="px-4 py-2">カテゴリ</th>
                <th className="px-4 py-2">要約</th>
              </tr>
            </thead>
            <tbody>
              {insights.map((row) => (
                <InsightTableRow
                  key={row.id}
                  row={row}
                  isExpanded={expandedInsightId === row.id}
                  onToggle={() => onToggleInsight(row.id)}
                />
              ))}
              {insights.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    質問データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InsightTableRow({
  row,
  isExpanded,
  onToggle,
}: {
  row: InsightRow;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-t hover:bg-blue-50/30 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
          {fmtDateTime(row.created_at)}
        </td>
        <td className="px-4 py-2 text-gray-700">{row.hospital_name}</td>
        <td className="px-4 py-2">
          <CategoryBadge category={row.category} />
        </td>
        <td className="px-4 py-2 text-gray-700">{row.summary}</td>
      </tr>

      {/* Expanded: show user_message */}
      {isExpanded && (
        <tr>
          <td colSpan={4} className="bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">ユーザーの質問:</p>
            <div className="bg-gray-100 rounded px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
              {row.user_message}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
