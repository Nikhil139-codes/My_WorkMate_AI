"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  RefreshCw,
  Plus,
  ArrowRight,
  Sparkles,
  Layers,
  User,
  Calendar,
  CheckSquare,
  HelpCircle,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Info,
  Check,
  History,
  FileText,
} from "lucide-react";

interface MitigationNote {
  id: string;
  note: string;
  authorName: string;
  createdAt: string;
}

interface RiskHistoryEntry {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

interface RiskItem {
  id: string;
  title: string;
  description: string;
  category: "OVERDUE" | "BLOCKED_DEPENDENCY" | "MISSING_OWNER" | "MISSING_DEADLINE" | "UNRESOLVED_DECISION" | "BOTTLENECK" | "GENERAL";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  score: number;
  contributingFactors: string[];
  evidence: string;
  affectedTaskIds: string[];
  affectedMeetingIds: string[];
  status: "IDENTIFIED" | "ACKNOWLEDGED" | "MITIGATING" | "RESOLVED";
  mitigationNotes: MitigationNote[];
  history: RiskHistoryEntry[];
  lastEvaluatedAt: string;
  createdAt: string;
}

interface RiskSummary {
  overallScore: number;
  healthLevel: "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK" | "CRITICAL_RISK";
  totalRisks: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  evaluatedAt?: string;
}

interface AIRecommendation {
  id: string;
  suggestion: string;
  rationale: string;
  actionType: string;
}

export default function RisksPage() {
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    workspaceName: string;
    role: string;
  } | null>(null);

  const [summary, setSummary] = useState<RiskSummary>({
    overallScore: 0,
    healthLevel: "LOW_RISK",
    totalRisks: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    acknowledgedCount: 0,
    resolvedCount: 0,
  });

  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  // Expanded History Drawer per card
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Mitigation Note Modal
  const [activeNoteRisk, setActiveNoteRisk] = useState<RiskItem | null>(null);
  const [newNoteText, setNewNoteText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Create Task Modal
  const [activeTaskRisk, setActiveTaskRisk] = useState<RiskItem | null>(null);
  const [taskFormTitle, setTaskFormTitle] = useState("");
  const [taskFormOwner, setTaskFormOwner] = useState("");
  const [taskFormDueDate, setTaskFormDueDate] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskSuccessMsg, setTaskSuccessMsg] = useState<string | null>(null);

  // Load User Profile
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) setUserInfo(data.user);
      });
  }, []);

  // Fetch Risks & Summary
  const fetchRisks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (severityFilter !== "ALL") params.append("severity", severityFilter);
      if (searchQuery.trim()) params.append("query", searchQuery.trim());

      const res = await fetch(`/api/risks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRisks(data.risks || []);
        if (data.summary) setSummary(data.summary);
      }
    } catch (err) {
      console.error("Failed to load risks:", err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, severityFilter, searchQuery]);

  // Fetch Groq AI Recommendations
  const fetchRecommendations = useCallback(async () => {
    setIsLoadingRecs(true);
    try {
      const res = await fetch("/api/risks/recommendations");
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (err) {
      console.error("Failed to load recommendations:", err);
    } finally {
      setIsLoadingRecs(false);
    }
  }, []);

  useEffect(() => {
    fetchRisks();
    fetchRecommendations();
  }, [fetchRisks, fetchRecommendations]);

  // Manual Risk Evaluation Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTaskSuccessMsg(null);
    try {
      const res = await fetch("/api/risks/refresh", { method: "POST" });
      if (res.ok) {
        await fetchRisks();
        await fetchRecommendations();
      }
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Toggle Risk Status (Acknowledge / Resolve)
  const handleUpdateStatus = async (riskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/risks/${riskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchRisks();
      }
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  // Submit Mitigation Note
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNoteRisk || !newNoteText.trim()) return;

    setIsSavingNote(true);
    try {
      const res = await fetch(`/api/risks/${activeNoteRisk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mitigationNote: newNoteText.trim() }),
      });
      if (res.ok) {
        setActiveNoteRisk(null);
        setNewNoteText("");
        fetchRisks();
      }
    } catch (err) {
      console.error("Save note error:", err);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Open Task Creation Modal from Risk
  const handleOpenTaskModal = (risk: RiskItem) => {
    setActiveTaskRisk(risk);
    setTaskFormTitle(`Mitigate: ${risk.title}`);
    setTaskFormOwner("");
    setTaskFormDueDate(
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    );
  };

  // Submit Follow-up Task Creation
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTaskRisk || !taskFormTitle.trim()) return;

    setIsCreatingTask(true);
    try {
      const res = await fetch(`/api/risks/${activeTaskRisk.id}/create-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskFormTitle.trim(),
          owner: taskFormOwner.trim() || null,
          dueDate: taskFormDueDate || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActiveTaskRisk(null);
        setTaskSuccessMsg(
          `Follow-up remediation task created successfully! (Task: "${data.task.title}")`
        );
        fetchRisks();
      } else {
        alert(data.error || "Failed to create task");
      }
    } catch (err: any) {
      alert(err.message || "Task creation failed");
    } finally {
      setIsCreatingTask(false);
    }
  };

  const getHealthBadge = (level: string) => {
    switch (level) {
      case "CRITICAL_RISK":
        return { text: "Critical Risk Alert", color: "bg-red-500 text-white", ring: "border-red-300 bg-red-50 text-red-700" };
      case "HIGH_RISK":
        return { text: "High Risk Threshold", color: "bg-orange-500 text-white", ring: "border-orange-300 bg-orange-50 text-orange-700" };
      case "MODERATE_RISK":
        return { text: "Moderate Risk", color: "bg-amber-500 text-white", ring: "border-amber-300 bg-amber-50 text-amber-800" };
      default:
        return { text: "Healthy Velocity", color: "bg-emerald-500 text-white", ring: "border-emerald-300 bg-emerald-50 text-emerald-700" };
    }
  };

  const severityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-50 text-red-700 border-red-200";
      case "HIGH":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "MEDIUM":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "MITIGATING":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "ACKNOWLEDGED":
        return "bg-amber-50 text-amber-800 border-amber-200";
      default:
        return "bg-rose-50 text-rose-700 border-rose-200";
    }
  };

  const health = getHealthBadge(summary.healthLevel);

  return (
    <AppShell
      pageTitle="Project Risks"
      userName={userInfo?.name || "Member"}
      userEmail={userInfo?.email || "user@workmate.ai"}
      workspaceName={userInfo?.workspaceName || "WorkMate AI"}
      userRole={userInfo?.role || "MEMBER"}
    >
      <div className="space-y-6">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-100">
                Phase 7 Engine
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[#172B4D]">
                Proactive Project Risk & Decision Support
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Deterministic risk detection engine evaluating overdue milestones, incomplete dependencies, and unassigned work.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/workflows"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <CheckSquare className="h-4 w-4 text-emerald-600" />
              <span>Workspace Tasks</span>
            </Link>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>{isRefreshing ? "Evaluating..." : "Recalculate Risks"}</span>
            </button>
          </div>
        </div>

        {taskSuccessMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{taskSuccessMsg}</span>
            </div>
            <Link href="/workflows" className="font-bold underline text-emerald-900 text-xs">
              Go to Tasks &rarr;
            </Link>
          </div>
        )}

        {/* 1. Hero Health Gauge & KPI Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Risk Score Index Hero (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-6 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Project Risk Index
                </span>
                <h3 className="text-xl font-bold text-[#172B4D] mt-0.5">
                  Workspace Health Score
                </h3>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold border ${health.ring}`}>
                {health.text}
              </span>
            </div>

            <div className="flex items-baseline gap-3 my-2">
              <span className="text-5xl font-black tracking-tight text-[#172B4D]">
                {summary.overallScore}
              </span>
              <span className="text-slate-400 font-semibold text-lg">/ 100</span>
            </div>

            {/* Meter Bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                <div
                  style={{ width: `${Math.min(100, summary.overallScore)}%` }}
                  className={`h-full transition-all duration-500 ${health.color}`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>0 Healthy</span>
                <span>30 Moderate</span>
                <span>60 High</span>
                <span>80 Critical</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
              Score is calculated deterministically from overdue duration, priority weights, and blocked dependencies. LLM never alters numerical metrics.
            </p>
          </div>

          {/* Severity & Status Counters (7 cols) */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-700">Critical Risks</span>
                <ShieldAlert className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-800 mt-2">{summary.criticalCount}</p>
              <p className="text-[11px] text-red-600 mt-1">Requires immediate mitigation</p>
            </div>

            <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-orange-700">High Severity</span>
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-orange-800 mt-2">{summary.highCount}</p>
              <p className="text-[11px] text-orange-600 mt-1">Significant delivery risk</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800">Medium Severity</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-amber-900 mt-2">{summary.mediumCount}</p>
              <p className="text-[11px] text-amber-700 mt-1">Approaching deadlines</p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700">Low Severity</span>
                <Info className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-800 mt-2">{summary.lowCount}</p>
              <p className="text-[11px] text-blue-600 mt-1">Unassigned scope items</p>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-700">Acknowledged</span>
                <CheckSquare className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-bold text-indigo-800 mt-2">{summary.acknowledgedCount}</p>
              <p className="text-[11px] text-indigo-600 mt-1">Under team review</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700">Resolved</span>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-emerald-800 mt-2">{summary.resolvedCount}</p>
              <p className="text-[11px] text-emerald-600 mt-1">Safely mitigated</p>
            </div>
          </div>
        </div>

        {/* 2. Groq AI Recommendations Panel */}
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/60 via-purple-50/30 to-white p-5 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  Gemini-Powered Decision Support Advisor
                </h3>
                <p className="text-[11px] text-slate-500">
                  Real-time actionable recommendations synthesized from active risk evidence.
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-md bg-white/80 px-2 py-0.5 text-[10px] text-slate-500 border border-indigo-100">
              <Info className="h-3 w-3 text-indigo-500" />
              <span>Advisory Suggestions — Requires Human Approval</span>
            </div>
          </div>

          {isLoadingRecs ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-indigo-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating decision recommendations with Groq...</span>
            </div>
          ) : recommendations.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">
              No recommendations needed at this time. All milestones and deliverables are currently healthy.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-white/80 bg-white p-3.5 shadow-2xs hover:border-indigo-300 transition-all space-y-1.5 flex flex-col justify-between"
                >
                  <div>
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-indigo-700">
                      {rec.actionType.replace("_", " ")}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 mt-1">
                      {rec.suggestion}
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                      {rec.rationale}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-50 flex items-center justify-end">
                    <Link
                      href="/workflows"
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <span>Take Action in Tasks</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Filter & Search Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: "ACTIVE", label: "Active Risks" },
              { id: "ALL", label: "All Records" },
              { id: "ACKNOWLEDGED", label: "Acknowledged" },
              { id: "RESOLVED", label: "Resolved" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${statusFilter === tab.id
                    ? "bg-[#4F46E5] text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Severity Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search risks or evidence..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        {/* 4. Risk Cards List */}
        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#4F46E5]" />
            <p className="mt-2 text-xs text-slate-500">Evaluating workspace project risks...</p>
          </div>
        ) : risks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500 mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No risks identified</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {searchQuery || statusFilter !== "ACTIVE" || severityFilter !== "ALL"
                ? "No risk records match your selected filter criteria. Try resetting filters."
                : "Great news! Your project has no overdue deliverables, unassigned tasks, or blocked dependencies."}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {risks.map((risk) => {
              const isHistoryOpen = expandedHistoryId === risk.id;

              return (
                <div
                  key={risk.id}
                  className={`rounded-xl border bg-white p-4.5 transition-all shadow-2xs hover:shadow-xs ${risk.status === "RESOLVED"
                      ? "border-slate-200 bg-slate-50/40 opacity-70"
                      : risk.severity === "CRITICAL"
                        ? "border-red-200 bg-red-50/15"
                        : "border-slate-200"
                    }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Left: Severity, Category, Title, Factors */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${severityBadge(
                            risk.severity
                          )}`}
                        >
                          {risk.severity} ({risk.score}/100)
                        </span>

                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {risk.category.replace(/_/g, " ")}
                        </span>

                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadge(
                            risk.status
                          )}`}
                        >
                          {risk.status}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-[#172B4D]">
                        {risk.title}
                      </h3>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {risk.description}
                      </p>

                      {/* Contributing Factors */}
                      {risk.contributingFactors?.length > 0 && (
                        <div className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-100 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Contributing Factors:
                          </span>
                          <ul className="text-xs text-slate-700 space-y-0.5">
                            {risk.contributingFactors.map((f, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-slate-400">•</span>
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Evidence / Audit quote */}
                      {risk.evidence && (
                        <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded border border-slate-100">
                          <strong>Evidence:</strong> {risk.evidence}
                        </p>
                      )}

                      {/* Mitigation Notes Trail */}
                      {risk.mitigationNotes?.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                            Mitigation Notes ({risk.mitigationNotes.length}):
                          </span>
                          <div className="space-y-1">
                            {risk.mitigationNotes.map((note) => (
                              <div
                                key={note.id}
                                className="rounded bg-indigo-50/60 p-2 text-xs text-indigo-900 border border-indigo-100 flex items-start justify-between gap-2"
                              >
                                <p>{note.note}</p>
                                <span className="text-[10px] text-indigo-500 font-mono shrink-0">
                                  {new Date(note.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col sm:items-end gap-2 shrink-0 pt-1">
                      <div className="flex items-center gap-1.5">
                        {risk.status !== "RESOLVED" && (
                          <>
                            {risk.status !== "ACKNOWLEDGED" && (
                              <button
                                onClick={() => handleUpdateStatus(risk.id, "ACKNOWLEDGED")}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                              >
                                Acknowledge
                              </button>
                            )}

                            <button
                              onClick={() => handleUpdateStatus(risk.id, "RESOLVED")}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              Resolve
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => {
                            setActiveNoteRisk(risk);
                            setNewNoteText("");
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          Add Note
                        </button>

                        <button
                          onClick={() => handleOpenTaskModal(risk)}
                          className="rounded-lg bg-[#4F46E5] px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs"
                        >
                          Create Task
                        </button>
                      </div>

                      <button
                        onClick={() =>
                          setExpandedHistoryId(isHistoryOpen ? null : risk.id)
                        }
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 mt-1"
                      >
                        <History className="h-3 w-3" />
                        <span>Audit Trail ({risk.history?.length || 0})</span>
                        {isHistoryOpen ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Collapsible History Trail */}
                  {isHistoryOpen && (
                    <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-2 animate-in fade-in duration-150">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Risk State & Detection History:
                      </span>
                      <div className="space-y-1.5 text-xs text-slate-600">
                        {risk.history?.map((h) => (
                          <div
                            key={h.id}
                            className="flex items-start justify-between gap-2 p-1.5 rounded bg-slate-50 text-[11px]"
                          >
                            <div>
                              <strong className="text-slate-800 uppercase text-[9px] mr-1.5">
                                {h.action}:
                              </strong>
                              <span>{h.details}</span>
                            </div>
                            <span className="font-mono text-slate-400 shrink-0">
                              {new Date(h.timestamp).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal 1: Add Mitigation Note */}
        {activeNoteRisk && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-[#172B4D]">
                  Add Mitigation Note
                </h3>
                <button
                  onClick={() => setActiveNoteRisk(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveNote} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <p className="font-semibold text-slate-700 mb-1">
                    Risk: <span className="text-slate-900">{activeNoteRisk.title}</span>
                  </p>
                  <textarea
                    rows={4}
                    required
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Describe mitigation steps taken, agreement with stakeholders, or timeline adjustments..."
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveNoteRisk(null)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingNote}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSavingNote && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Save Note</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Create Follow-up Task */}
        {activeTaskRisk && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-[#172B4D]">
                  Create Follow-Up Remediation Task
                </h3>
                <button
                  onClick={() => setActiveTaskRisk(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={taskFormTitle}
                    onChange={(e) => setTaskFormTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Assign Owner
                    </label>
                    <input
                      type="text"
                      value={taskFormOwner}
                      onChange={(e) => setTaskFormOwner(e.target.value)}
                      placeholder="e.g. Alex"
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={taskFormDueDate}
                      onChange={(e) => setTaskFormDueDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                  This task will be automatically linked to <strong>{activeTaskRisk.title}</strong> and added to the workspace tasks backlog.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveTaskRisk(null)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingTask}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isCreatingTask && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Create Task</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
