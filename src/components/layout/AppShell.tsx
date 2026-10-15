"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

interface AppShellProps {
  children: React.ReactNode;
  pageTitle?: string;
  userName?: string;
  userEmail?: string;
  workspaceName?: string;
  userRole?: string;
}

export function AppShell({
  children,
  pageTitle = "Overview",
  userName = "Member",
  userEmail = "user@workmate.ai",
  workspaceName = "Main Workspace",
  userRole = "MEMBER",
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#FAFBFC]">
      {/* Sidebar */}
      <Sidebar
        workspaceName={workspaceName}
        userRole={userRole}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          pageTitle={pageTitle}
          userName={userName}
          userEmail={userEmail}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
