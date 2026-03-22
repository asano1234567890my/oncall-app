// src/app/components/AppHeader.tsx — 管理者ページ共通ヘッダー
"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  shortLabel: string;
  href: string;
  match: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "モバイル版", shortLabel: "モバイル", href: "/app", match: "/app" },
  { label: "PC版", shortLabel: "PC", href: "/dashboard", match: "/dashboard" },
  { label: "当直表", shortLabel: "当直表", href: "/view", match: "/view" },
];

type AppHeaderProps = {
  hospitalName?: string | null;
  onLogout?: () => void;
  /** ページ遷移前の確認（未保存チェック等）。false を返すと遷移中止 */
  onBeforeNavigate?: () => boolean;
  /** 右端に追加するボタン等 */
  rightExtra?: React.ReactNode;
  /** ログアウトボタンを非表示（アカウント設定内に格納している場合） */
  hideLogout?: boolean;
};

export default function AppHeader({ hospitalName, onLogout, onBeforeNavigate, rightExtra, hideLogout }: AppHeaderProps) {
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
    onLogout?.();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-2 sm:px-4">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-0.5 sm:gap-5">
          <Link
            href="/app"
            onClick={(e) => handleNavClick(e, "/app")}
            className="whitespace-nowrap py-3 text-sm font-extrabold text-gray-800 sm:text-base sm:mr-1"
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
                  className={`relative whitespace-nowrap px-1.5 py-3 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                    isActive
                      ? "text-blue-700"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <span className="sm:hidden">{item.shortLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-blue-600" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: extras + hospital name + logout */}
        <div className="flex items-center gap-1 sm:gap-3">
          {rightExtra}
          {hospitalName && (
            <span className="hidden text-xs text-gray-400 sm:inline">{hospitalName}</span>
          )}
          {!hideLogout && (
            <button
              onClick={handleLogout}
              className="whitespace-nowrap rounded-md px-1.5 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="ログアウト"
            >
              <LogOut className="h-4 w-4 sm:hidden" />
              <span className="hidden text-xs sm:inline">ログアウト</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
