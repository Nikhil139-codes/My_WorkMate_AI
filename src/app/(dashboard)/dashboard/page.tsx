"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  Sparkles,
  ArrowRight,
  FileText,
  CheckSquare,
  Clock,
  Layers,
  Activity,
  Users,
  Database,
  Video,
  Blocks,
  BarChart3,
  Loader2,
  Inbox,
  AlertCircle,
} from "lucide-react";

interface DashboardData {
  workspace: {
    id: string;
    name: string;
    role: string;
    membersCount: number;
  };
  metrics: {
    documentsCount: number;
    activeTasksCount: number;
    completedWorkflowsCount: number;
    conversationsCount: number;
    estimatedTimeSavedMinutes: number;
  };
  recentActivities: Array<{
    id: string;
    action: string;
    resourceType: string;
    userName: string;
    createdAt: string;
    metadata?: any;
  }>;
  upcomingTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: string;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [userName, setUserName] = useState("Member");
  const [userEmail, setUserEmail] = useState("");
  const [quickPrompt, setQuickPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [authRes, statsRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/dashboard/stats"),
        ]);

        if (authRes.status === 401) {
          router.push("/login");
          return;
        }

        const authData = await authRes.json();
        if (authData.authenticated && authData.user) {
          setUserName(authData.user.name);
          setUserEmail(authData.user.email);
        }

        if (statsRes.ok) {
          const stats = await statsRes.json();
          setData(stats);
        } else {
          setError("Failed to load workspace data.");
        }
      } catch (err) {
        console.error("Dashboard load failed:", err);
        setError("Unable to connect to server.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPrompt.trim()) return;
    // Route to AI Knowledge page with the pre-filled prompt in query param
    router.push(`/knowledge?prompt=${encodeURIComponent(quickPrompt.trim())}`);
  };

  const formatActivityText = (action: string) => {
    switch (action) {
      case "USER_REGISTERED":
        return "Workspace created and initialized";
      case "USER_LOGGED_IN":
        return "Member authenticated session";
      case "CHAT_MESSAGE_SENT":
        return "AI Knowledge query generated with Groq";
      default:
        return action.replace(/_/g, " ").toLowerCase();
    }
  };

  return (
    <AppShell
      pageTitle="Overview"
      userName={userName}
      userEmail={userEmail}
      workspaceName={data?.workspace.name || "WorkMate AI"}
      userRole={data?.workspace.role || "MEMBER"}
    >
      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {/* 1. Welcome Section & Quick AI Action */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-gradient-to-r from-white via-white to-indigo-50/40 p-6 md:p-8 shadow-xs">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-[#4F46E5] border border-indigo-100 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Phase 1 — Operational Foundation</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#172B4D]">
              Welcome to WorkMate AI
            </h1>
            <p className="mt-1.5 text-sm text-[#64748B]">
              Your intelligent workspace for knowledge, decisions, and everyday work.
            </p>

            {/* Quick Action Input */}
            <form onSubmit={handleQuickSubmit} className="mt-6">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-2">
                What would you like to get done?
              </label>
              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={quickPrompt}
                    onChange={(e) => setQuickPrompt(e.target.value)}
                    placeholder="Ask a question, synthesize ideas, or draft business correspondence..."
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-xs md:text-sm text-[#172B4D] placeholder-slate-400 focus:border-[#4F46E5] focus:outline-hidden shadow-2xs"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-5 py-3 text-xs md:text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Start AI Query</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Powered by Gemini LLM engine. Connects directly to AI Knowledge.
              </p>
            </form>
          </div>
        </div>

        {/* 2. Database-backed Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Documents */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                Documents in Workspace
              </span>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-[#172B4D]">
                {loading ? "..." : data?.metrics.documentsCount ?? 0}
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                {data?.metrics.documentsCount === 0
                  ? "Awaiting Phase 2 ingestion"
                  : "Stored document records"}
              </p>
            </div>
          </div>

          {/* Active Tasks */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                Active Tasks
              </span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                <CheckSquare className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-[#172B4D]">
                {loading ? "..." : data?.metrics.activeTasksCount ?? 0}
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                {data?.metrics.activeTasksCount === 0
                  ? "No pending tasks"
                  : "Pending & in-progress"}
              </p>
            </div>
          </div>

          {/* Completed Workflows */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                Completed Workflows
              </span>
              <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-[#172B4D]">
                {loading ? "..." : data?.metrics.completedWorkflowsCount ?? 0}
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                {data?.metrics.completedWorkflowsCount === 0
                  ? "0 executed workflows"
                  : "Recorded workflow executions"}
              </p>
            </div>
          </div>

          {/* Estimated Time Saved */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                Estimated Time Saved
              </span>
              <div className="rounded-lg bg-teal-50 p-2 text-teal-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-[#172B4D]">
                {loading ? "..." : `${data?.metrics.estimatedTimeSavedMinutes ?? 0}m`}
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                {data?.metrics.estimatedTimeSavedMinutes === 0
                  ? "No measured data recorded yet"
                  : "Calculated from workflow events"}
              </p>
            </div>
          </div>
        </div>

        {/* 3. Main Dashboard Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols): AI Knowledge Assistant + Recent Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card 1: AI Knowledge Assistant */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-indigo-50 p-2 text-[#4F46E5]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#172B4D]">
                      AI Knowledge Assistant
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      Direct access to Groq enterprise conversational intelligence
                    </p>
                  </div>
                </div>
                <Link
                  href="/knowledge"
                  className="text-xs font-semibold text-[#4F46E5] hover:underline flex items-center gap-1"
                >
                  <span>Open Chat</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/knowledge?prompt=" +
                      encodeURIComponent(
                        "Draft an executive briefing summarizing our Q3 product engineering milestones."
                      )
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-[#FAFBFC] p-3 text-left hover:border-indigo-300 hover:bg-white transition-all group"
                >
                  <p className="text-xs font-semibold text-[#172B4D] group-hover:text-[#4F46E5]">
                    Draft Executive Brief
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    Synthesize milestones and strategic impact
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/knowledge?prompt=" +
                      encodeURIComponent(
                        "Explain architectural best practices for multi-tenant data isolation in SaaS applications."
                      )
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-[#FAFBFC] p-3 text-left hover:border-indigo-300 hover:bg-white transition-all group"
                >
                  <p className="text-xs font-semibold text-[#172B4D] group-hover:text-[#4F46E5]">
                    Security Architecture
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    Review multi-tenant tenant isolation
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/knowledge?prompt=" +
                      encodeURIComponent(
                        "Analyze common operational bottlenecks in project workflows and recommend mitigations."
                      )
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-[#FAFBFC] p-3 text-left hover:border-indigo-300 hover:bg-white transition-all group"
                >
                  <p className="text-xs font-semibold text-[#172B4D] group-hover:text-[#4F46E5]">
                    Workflow Analysis
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    Identify bottlenecks and solutions
                  </p>
                </button>
              </div>
            </div>

            {/* Card 2: Recent Activity (Persisted DB Records) */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-teal-50 p-2 text-[#0D9488]">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#172B4D]">
                      Recent Workspace Activity
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      Persisted audit records for this workspace
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {loading ? (
                  <div className="py-6 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : data?.recentActivities && data.recentActivities.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {data.recentActivities.map((act) => (
                      <div
                        key={act.id}
                        className="flex items-center justify-between py-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-[#0D9488]" />
                          <div>
                            <p className="font-semibold text-[#172B4D]">
                              {formatActivityText(act.action)}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              By {act.userName} • {act.resourceType}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(act.createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                    <Inbox className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-xs font-semibold text-slate-700">
                      No activity recorded yet
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Actions like chat queries, configuration updates, and workspace operations will log here automatically.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Card 4: Upcoming Tasks */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                    <CheckSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#172B4D]">
                      Upcoming Tasks
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      Active workspace task records
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {data?.upcomingTasks && data.upcomingTasks.length > 0 ? (
                  <div className="space-y-2">
                    {data.upcomingTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-[#FAFBFC] p-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-2 w-2 rounded-full bg-amber-500" />
                          <span className="font-medium text-[#172B4D]">
                            {task.title}
                          </span>
                        </div>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                    <CheckSquare className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-xs font-semibold text-slate-700">
                      No active tasks currently assigned
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tasks generated by meeting notes or project workflows in future phases will appear here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (1 Col): Workspace Overview, Productivity Summary, Explore Modules */}
          <div className="space-y-6">
            {/* Card 3: Workspace Overview */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="rounded-lg bg-indigo-50 p-2 text-[#4F46E5]">
                  <Users className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-[#172B4D]">
                  Workspace Overview
                </h2>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Name</span>
                  <span className="font-semibold text-[#172B4D]">
                    {data?.workspace.name || "Default Workspace"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Your Role</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                    {data?.workspace.role || "OWNER"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Members</span>
                  <span className="font-semibold text-[#172B4D]">
                    {data?.workspace.membersCount ?? 1} User
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">AI Provider</span>
                  <span className="font-semibold text-[#4F46E5]">
                    Groq Cloud
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Storage Backend</span>
                  <span className="font-semibold text-slate-700">
                    Local Storage (Phase 1)
                  </span>
                </div>
              </div>
            </div>

            {/* Card 5: Productivity Summary */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="rounded-lg bg-teal-50 p-2 text-[#0D9488]">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-[#172B4D]">
                  Productivity Summary
                </h2>
              </div>

              <div className="mt-4">
                <div className="rounded-lg bg-[#FAFBFC] border border-slate-100 p-4 text-center">
                  <p className="text-2xl font-bold text-[#172B4D]">0 hrs</p>
                  <p className="text-xs font-medium text-slate-600 mt-1">
                    Direct automated time saved
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    Metric tracking will begin accumulating as automated workflows and document processing execute in upcoming phases.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 6: Explore WorkMate AI Modules */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-[#172B4D]">
                  Explore Platform Modules
                </h2>
                <span className="text-[11px] text-slate-400 font-medium">
                  Roadmap
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                <Link
                  href="/documents"
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-[#FAFBFC] p-3 text-xs hover:border-indigo-200 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-[#4F46E5]" />
                    <span className="font-medium text-[#172B4D]">
                      Document Intelligence
                    </span>
                  </div>
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                    Phase 2
                  </span>
                </Link>

                <Link
                  href="/data-preparation"
                  className="flex items-center justify-between rounded-lg border border-teal-100 bg-[#FAFBFC] p-3 text-xs hover:border-teal-300 hover:bg-white transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Database className="h-4 w-4 text-[#0D9488]" />
                    <span className="font-semibold text-[#172B4D]">
                      Data Preparation
                    </span>
                  </div>
                  <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 border border-teal-200">
                    Active
                  </span>
                </Link>

                <Link
                  href="/meetings"
                  className="flex items-center justify-between rounded-lg border border-purple-100 bg-[#FAFBFC] p-3 text-xs hover:border-purple-300 hover:bg-white transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Video className="h-4 w-4 text-purple-600" />
                    <span className="font-semibold text-[#172B4D]">
                      Meeting Intelligence
                    </span>
                  </div>
                  <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
                    Active
                  </span>
                </Link>

                <Link
                  href="/micro-apps"
                  className="flex items-center justify-between rounded-lg border border-amber-100 bg-[#FAFBFC] p-3 text-xs hover:border-amber-300 hover:bg-white transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Blocks className="h-4 w-4 text-amber-600" />
                    <span className="font-semibold text-[#172B4D]">
                      Micro-App Studio
                    </span>
                  </div>
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                    Active
                  </span>
                </Link>

                <Link
                  href="/workflows"
                  className="flex items-center justify-between rounded-lg border border-emerald-100 bg-[#FAFBFC] p-3 text-xs hover:border-emerald-300 hover:bg-white transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                    <span className="font-semibold text-[#172B4D]">
                      Tasks & Workflows
                    </span>
                  </div>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </Link>

                <Link
                  href="/risks"
                  className="flex items-center justify-between rounded-lg border border-rose-100 bg-[#FAFBFC] p-3 text-xs hover:border-rose-300 hover:bg-white transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="h-4 w-4 text-rose-600" />
                    <span className="font-semibold text-[#172B4D]">
                      Project Risks
                    </span>
                  </div>
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200">
                    Active
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
