"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Crumb = { href: string; label: string };

function buildCrumbs(pathname: string): Crumb[] {
  if (pathname === "/") return [{ href: "/", label: "当直表作成" }];

  if (pathname.startsWith("/admin/doctors")) {
    return [
      { href: "/", label: "当直表作成" },
      { href: "/admin/doctors", label: "医師管理" },
    ];
  }

  if (pathname.startsWith("/view")) {
    return [
      { href: "/", label: "当直表作成" },
      { href: "/view", label: "当直表を見る" },
    ];
  }

  return [{ href: "/", label: "当直表作成" }];
}

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const crumbs = buildCrumbs(pathname);
  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b">
      <div className="max-w-5xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* 左：タイトル＋パンくず */}
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="font-extrabold text-gray-800 whitespace-nowrap">
                🏥 oncall-app
              </div>

              <nav className="hidden sm:flex items-center gap-2 text-xs text-gray-500 min-w-0">
                {crumbs.map((c, idx) => (
                  <span key={c.href} className="flex items-center gap-2 min-w-0">
                    {idx !== 0 && <span className="text-gray-300">/</span>}
                    <Link
                      href={c.href}
                      className="hover:text-gray-800 truncate"
                      title={c.label}
                    >
                      {c.label}
                    </Link>
                  </span>
                ))}
              </nav>
            </div>

            <div className="sm:hidden text-[10px] text-gray-500 mt-1 truncate">
              {crumbs.map((c, idx) => (idx === 0 ? c.label : ` / ${c.label}`)).join("")}
            </div>
          </div>

          {/* 右：ナビ＋戻る */}
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-2">
              <Link
                href="/"
                className={`px-3 py-1.5 rounded text-sm font-bold border transition ${
                  pathname === "/"
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                当直表作成
              </Link>
              <Link
                href="/admin/doctors"
                className={`px-3 py-1.5 rounded text-sm font-bold border transition ${
                  pathname.startsWith("/admin/doctors")
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                医師管理
              </Link>
              <Link
                href="/view"
                className={`px-3 py-1.5 rounded text-sm font-bold border transition ${
                  pathname.startsWith("/view")
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                当直表を見る
              </Link>
            </nav>

            {!isHome && (
              <button
                type="button"
                onClick={() => router.back()}
                className="px-3 py-1.5 rounded text-sm font-bold border bg-white text-gray-700 hover:bg-gray-50"
                title="前の画面へ戻る"
              >
                ← 戻る
              </button>
            )}
          </div>
        </div>

        <div className="md:hidden mt-3 flex gap-2">
          <Link
            href="/"
            className={`flex-1 text-center px-3 py-2 rounded text-xs font-bold border ${
              pathname === "/"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700"
            }`}
          >
            作成
          </Link>
          <Link
            href="/admin/doctors"
            className={`flex-1 text-center px-3 py-2 rounded text-xs font-bold border ${
              pathname.startsWith("/admin/doctors")
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700"
            }`}
          >
            医師
          </Link>
          <Link
            href="/view"
            className={`flex-1 text-center px-3 py-2 rounded text-xs font-bold border ${
              pathname.startsWith("/view")
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700"
            }`}
          >
            閲覧
          </Link>
        </div>
      </div>
    </header>
  );
}