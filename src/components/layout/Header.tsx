"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  Bell,
  Search,
  LogOut,
  Settings,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

interface HeaderProps {
  pageTitle?: string;
  userName?: string;
  userEmail?: string;
  onMenuToggle?: () => void;
}

export function Header({
  pageTitle = "Workspace",
  userName = "User",
  userEmail = "user@workmate.ai",
  onMenuToggle,
}: HeaderProps) {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4 md:px-8">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-lg font-bold tracking-tight text-[#172B4D]">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Right: Search, Notifications, Profile */}
      <div className="flex items-center gap-3">
        {/* Quick Search */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search workspace (Phase 1)..."
            className="h-9 w-60 rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] pl-9 pr-3 text-xs text-[#172B4D] placeholder-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-hidden"
          />
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-lg z-50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-xs text-[#172B4D]">
                  Notifications
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                  0 Unread
                </span>
              </div>
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-xs font-medium text-slate-700">
                  All caught up!
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No new system or workflow alerts.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200" />

        {/* User Profile Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4F46E5] text-xs font-bold text-white shadow-xs">
              {initials}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-xs font-semibold text-[#172B4D] leading-tight">
                {userName}
              </p>
              <p className="text-[11px] text-[#64748B] leading-none mt-0.5 max-w-[120px] truncate">
                {userEmail}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden md:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[#E2E8F0] bg-white py-1.5 shadow-lg z-50">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="text-xs font-bold text-[#172B4D]">{userName}</p>
                <p className="text-[11px] text-[#64748B] truncate">{userEmail}</p>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    router.push("/settings");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  <span>Workspace Settings</span>
                </button>
              </div>

              <div className="border-t border-slate-100 py-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
