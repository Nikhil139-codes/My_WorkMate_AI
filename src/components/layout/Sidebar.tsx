"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Database,
  Video,
  Blocks,
  CheckSquare,
  BarChart3,
  Settings,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

interface SidebarProps {
  workspaceName?: string;
  userRole?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export const navigationItems = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    phase: "Phase 1",
    activeInPhase1: true,
  },
  {
    name: "AI Knowledge",
    href: "/knowledge",
    icon: MessageSquare,
    phase: "Phase 1",
    activeInPhase1: true,
  },
  {
    name: "Document Intelligence",
    href: "/documents",
    icon: FileText,
    phase: "Phase 2",
    activeInPhase1: true,
  },
  {
    name: "Data Preparation",
    href: "/data-preparation",
    icon: Database,
    phase: "Active",
    activeInPhase1: true,
  },
  {
    name: "Meeting Intelligence",
    href: "/meetings",
    icon: Video,
    phase: "Active",
    activeInPhase1: true,
  },
  {
    name: "Micro-App Studio",
    href: "/micro-apps",
    icon: Blocks,
    phase: "Active",
    activeInPhase1: true,
  },
  {
    name: "Tasks & Workflows",
    href: "/workflows",
    icon: CheckSquare,
    phase: "Active",
    activeInPhase1: true,
  },
  {
    name: "Project Risks",
    href: "/risks",
    icon: BarChart3,
    phase: "Active",
    activeInPhase1: true,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    phase: "Phase 1",
    activeInPhase1: true,
  },
];

export function Sidebar({
  workspaceName = "My Workspace",
  userRole = "MEMBER",
  isOpen = false,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#E2E8F0] bg-white transition-transform duration-200 md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#E2E8F0] px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4F46E5] text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-[#172B4D]">
                  WorkMate AI
                </span>
                <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] font-medium text-[#64748B]">
                From Information to Action
              </p>
            </div>
          </Link>
        </div>

        {/* Workspace Pill */}
        <div className="px-4 py-3 border-b border-[#F1F5F9] bg-[#FAFBFC]">
          <div className="flex items-center justify-between rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-xs">
            <div className="truncate">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                Workspace
              </span>
              <p className="font-semibold text-[#172B4D] truncate">
                {workspaceName}
              </p>
            </div>
            <span className="shrink-0 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
              {userRole}
            </span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Platform Modules
          </div>

          {navigationItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#EEF2FF] text-[#4F46E5] font-semibold shadow-2xs"
                    : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#172B4D]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive
                        ? "text-[#4F46E5]"
                        : "text-[#94A3B8] group-hover:text-[#475569]"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>

                {item.activeInPhase1 ? (
                  isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4F46E5]" />
                  )
                ) : (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {item.phase}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="border-t border-[#E2E8F0] p-4 bg-[#FAFBFC]">
          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <ShieldCheck className="h-4 w-4 text-[#0D9488]" />
            <span>Groq LLM Engine Connected</span>
          </div>
        </div>
      </aside>
    </>
  );
}
