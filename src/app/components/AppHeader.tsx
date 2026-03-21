// src/app/components/AppHeader.tsx — 管理者ページ共通ヘッダー
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  match: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "モバイル版", href: "/app", match: "/app" },
  { label: "PC版", href: "/dashboard", match: "/dashboard" },
  { label: "当直表", href: "/view", match: "/view" },
];

type AppHeaderProps = {
  hospitalName?: string | null;
  onLogout: () => void;
  /** ページ遷移前の確認（未保存チェック等）。false を返すと遷移中止 */
  onBeforeNavigate?: () => boolean;
  /** 右端に追加するボタン等 */
  rightExtra?: React.ReactNode;
};

export default function AppHeader({ hospitalName, onLogout, onBeforeNavigate, rightExtra }: AppHeaderProps) {
  const pathname = usePathname();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (pathname === href) {
      e.preventDefault();
      return;
    }
    if (onBeforeNavigate && !onBeforeNavigate()) {
      e.preventDefault();
    }
  };

  const handleLogout = () => {
    if (onBeforeNavigate && !onBeforeNavigate()) return;
    onLogout();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-1 sm:gap-5">
          <Link
            href="/app"
            onClick={(e) => handleNavClick(e, "/app")}
            className="py-3 text-base font-extrabold text-gray-800 sm:mr-1"
          >
            シフらく
          </Link>

          <nav className="flex">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.match);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`relative px-2.5 py-3 text-sm font-medium transition-colors sm:px-3 ${
                    isActive
                      ? "text-blue-700"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-blue-600" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: extras + hospital name + logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {rightExtra}
          {hospitalName && (
            <span className="hidden text-xs text-gray-400 sm:inline">{hospitalName}</span>
          )}
          <button
            onClick={handleLogout}
            className="rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}
