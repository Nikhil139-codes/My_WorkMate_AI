"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  FileSpreadsheet,
  Upload,
  Search,
  Sparkles,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sliders,
  Layers,
  ArrowRight,
  Database,
  History,
  FileText,
  Table as TableIcon,
} from "lucide-react";
import { DataUploadModal } from "@/components/data-prep/DataUploadModal";
import { DataQualityCard } from "@/components/data-prep/DataQualityCard";
import { CleaningPlanModal } from "@/components/data-prep/CleaningPlanModal";
import { ICleaningPlanStep } from "@/lib/db/models/CleaningJob";

interface DatasetItem {
  id: string;
  originalFilename: string;
  format: "csv" | "xlsx";
  rowCount: number;
  columnCount: number;
  columns: any[];
  previewRows: Record<string, any>[];
  cleanedPreviewRows?: Record<string, any>[];
  profilingReport?: any;
  cleaningSummary?: any;
  status: "UPLOADED" | "PROFILING" | "READY" | "CLEANING" | "CLEANED" | "FAILED";
  failureReason?: string | null;
  createdAt: string;
}

interface DatasetStats {
  totalDatasets: number;
  totalRows: number;
  cleanedCount: number;
  avgQualityScore: number;
}

export default function DataPreparationPage() {
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    workspaceName: string;
    role: string;
  } | null>(null);

  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [activeDataset, setActiveDataset] = useState<DatasetItem | null>(null);
  // Ref tracks selected dataset ID without causing fetchDatasets to recreate on every selection
  const activeDatasetIdRef = useRef<string | null>(null);
  const [stats, setStats] = useState<DatasetStats>({
    totalDatasets: 0,
    totalRows: 0,
    cleanedCount: 0,
    avgQualityScore: 0,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Natural language cleaning prompt & plan states
  const [cleaningPrompt, setCleaningPrompt] = useState("");
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planModalData, setPlanModalData] = useState<{
    reasoning: string;
    plan: ICleaningPlanStep[];
    jobId?: string;
  } | null>(null);
  const [isExecutingCleaning, setIsExecutingCleaning] = useState(false);

  // Preview tab state
  const [previewTab, setPreviewTab] = useState<"cleaned" | "raw" | "audit">("cleaned");

  // Load user profile
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) setUserInfo(data.user);
      });
  }, []);

  // Fetch datasets list
  // IMPORTANT: activeDatasetId is NOT in the deps — we use a ref to avoid an infinite loop
  // (fetch → setActiveDatasetId → new callback → useEffect → fetch → ...)
  const fetchDatasets = useCallback(async (selectId?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      const res = await fetch(`/api/data-prep/datasets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const list: DatasetItem[] = data.datasets || [];
        setDatasets(list);
        if (data.stats) setStats(data.stats);

        if (list.length > 0) {
          const currentId = selectId || activeDatasetIdRef.current;
          const target = currentId
            ? list.find((d) => d.id === currentId) || list[0]
            : list[0];
          activeDatasetIdRef.current = target.id;
          setActiveDatasetId(target.id);
          setActiveDataset(target);
          if (target.status === "CLEANED") {
            setPreviewTab("cleaned");
          } else {
            setPreviewTab("raw");
          }
        } else {
          activeDatasetIdRef.current = null;
          setActiveDatasetId(null);
          setActiveDataset(null);
        }
      }
    } catch (err) {
      console.error("Error fetching datasets:", err);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]); // activeDatasetId removed — tracked via ref instead

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  // Load single dataset details when clicked
  const handleSelectDataset = async (dataset: DatasetItem) => {
    activeDatasetIdRef.current = dataset.id; // sync ref first so next fetch won't switch
    setActiveDatasetId(dataset.id);
    setActiveDataset(dataset);
    setPreviewTab(dataset.status === "CLEANED" ? "cleaned" : "raw");
    try {
      const res = await fetch(`/api/data-prep/datasets/${dataset.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.dataset) {
          setActiveDataset(data.dataset);
        }
      }
    } catch (err) {
      console.error("Failed to load dataset details:", err);
    }
  };

  // Generate AI Cleaning Plan
  const handleGeneratePlan = async (customPrompt?: string) => {
    if (!activeDataset) return;
    setIsGeneratingPlan(true);
    const promptToSend = customPrompt || cleaningPrompt;

    try {
      const res = await fetch(`/api/data-prep/datasets/${activeDataset.id}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptToSend || undefined }),
      });

      const data = await res.json();
      if (res.ok) {
        setPlanModalData({
          reasoning: data.reasoning,
          plan: data.plan || [],
          jobId: data.jobId,
        });
      } else {
        alert(data.error || "Failed to generate cleaning plan");
      }
    } catch {
      alert("Network error connecting to AI cleaning agent");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Execute Approved Cleaning Plan
  const handleExecuteApprovedPlan = async (approvedPlan: ICleaningPlanStep[]) => {
    if (!activeDataset) return;
    setIsExecutingCleaning(true);

    try {
      const res = await fetch(`/api/data-prep/datasets/${activeDataset.id}/clean`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: planModalData?.jobId,
          approvedPlan,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPlanModalData(null);
        setCleaningPrompt("");
        // Reload dataset with cleaned preview and updated score
        if (data.dataset) {
          setActiveDataset(data.dataset);
          setPreviewTab("cleaned");
        }
        await fetchDatasets(activeDataset.id);
      } else {
        alert(data.error || "Failed to execute cleaning transformations");
      }
    } catch {
      alert("Network error during cleaning execution");
    } finally {
      setIsExecutingCleaning(false);
    }
  };

  // Delete Dataset
  const handleDeleteDataset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this dataset, cleaned files, and audit records?")) {
      return;
    }

    try {
      const res = await fetch(`/api/data-prep/datasets/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (activeDatasetId === id) {
          setActiveDatasetId(null);
          setActiveDataset(null);
        }
        await fetchDatasets();
      }
    } catch (err) {
      console.error("Failed to delete dataset:", err);
    }
  };

  const currentPreviewRows =
    previewTab === "cleaned" && activeDataset?.cleanedPreviewRows && activeDataset.cleanedPreviewRows.length > 0
      ? activeDataset.cleanedPreviewRows
      : activeDataset?.previewRows || [];

  const previewColumns =
    activeDataset?.columns?.map((c) => c.name) ||
    (currentPreviewRows[0] ? Object.keys(currentPreviewRows[0]) : []);

  return (
    <AppShell
      pageTitle="Data Preparation"
      userName={userInfo?.name || "Member"}
      userEmail={userInfo?.email || "user@workmate.ai"}
      workspaceName={userInfo?.workspaceName || "WorkMate AI"}
      userRole={userInfo?.role || "MEMBER"}
    >
      <div className="space-y-6">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Total Datasets
              </span>
              <FileSpreadsheet className="h-4 w-4 text-[#0D9488]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{stats.totalDatasets}</span>
              <span className="text-[11px] text-slate-500">spreadsheets</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Cleaned & Validated
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700">{stats.cleanedCount}</span>
              <span className="text-[11px] text-slate-500">ready for analytics</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Total Rows
              </span>
              <Layers className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-indigo-700">
                {stats.totalRows.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-500">records profiled</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Avg Quality Score
              </span>
              <Sparkles className="h-4 w-4 text-teal-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-teal-700">
                {stats.avgQualityScore ? `${stats.avgQualityScore}%` : "—"}
              </span>
              <span className="text-[11px] text-slate-500">workspace health</span>
            </div>
          </div>
        </div>

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search datasets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0D9488] focus:outline-hidden shadow-2xs"
              />
            </div>

            <button
              onClick={() => fetchDatasets()}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
              title="Refresh list"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700 transition-colors"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Dataset (CSV / XLSX)</span>
          </button>
        </div>

        {/* Main Workspace Layout */}
        {isLoading && datasets.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" />
          </div>
        ) : datasets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-[#0D9488] mb-4">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No tabular datasets uploaded</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              Upload CSV or XLSX spreadsheets to auto-detect anomalies, deduplicate records, harmonize date formats, and produce validated clean datasets.
            </p>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 shadow-2xs"
            >
              <Upload className="h-4 w-4" />
              <span>Upload First Dataset</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Sidebar: Dataset Selector (4 Cols) */}
            <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden flex flex-col">
              <div className="p-3.5 border-b border-slate-100 bg-[#FAFBFC] flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Workspace Datasets ({datasets.length})
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
                {datasets.map((d, idx) => {
                  const isSelected = activeDatasetId === d.id;
                  const isCleaned = d.status === "CLEANED";
                  const score = d.profilingReport?.qualityScore ?? 100;

                  return (
                    <div
                      key={d.id || `dataset-${idx}`}
                      onClick={() => handleSelectDataset(d)}
                      className={`group p-3.5 cursor-pointer transition-colors flex items-start justify-between gap-3 ${isSelected
                          ? "bg-teal-50/70 border-l-4 border-l-[#0D9488]"
                          : "hover:bg-slate-50"
                        }`}
                    >
                      <div className="flex items-start gap-3 truncate">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${isCleaned
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-xs text-slate-900 truncate">
                            {d.originalFilename}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {d.rowCount} rows • {d.columnCount} cols • {d.format.toUpperCase()}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span
                              className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${isCleaned
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                                }`}
                            >
                              {isCleaned ? "Cleaned" : "Needs Review"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Score: {score}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteDataset(d.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-600 rounded transition-opacity"
                        title="Delete dataset"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Active Dataset Work Area (8 Cols) */}
            {activeDataset ? (
              <div className="lg:col-span-8 space-y-6">
                {/* 1. Profiling Diagnostics Card */}
                {activeDataset.profilingReport && (
                  <DataQualityCard
                    report={activeDataset.profilingReport}
                    columns={activeDataset.columns}
                    status={activeDataset.status}
                  />
                )}

                {/* 2. Natural Language AI Cleaning Prompt Bar */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-[#0D9488]">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <h3 className="text-xs font-bold text-slate-900">
                        AI Data Cleaning & Preparation Agent
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Powered by Gemini
                    </span>
                  </div>

                  <p className="text-xs text-slate-500">
                    Describe how you want to clean this dataset, or pick a standard preset below. The AI will propose a step-by-step cleaning plan for your approval.
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cleaningPrompt}
                      onChange={(e) => setCleaningPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleGeneratePlan();
                        }
                      }}
                      placeholder="e.g. 'Remove all duplicate rows, fill missing department with Unknown, and standardize dates to YYYY-MM-DD'..."
                      className="flex-1 rounded-xl border border-slate-200 bg-[#FAFBFC] px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0D9488] focus:bg-white focus:outline-hidden"
                    />

                    <button
                      type="button"
                      onClick={() => handleGeneratePlan()}
                      disabled={isGeneratingPlan}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D9488] px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700 disabled:opacity-50 transition-colors shrink-0"
                    >
                      {isGeneratingPlan ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Generate Plan</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Preset Prompt Chips */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className="text-slate-400 font-semibold">Quick presets:</span>
                    <button
                      type="button"
                      onClick={() =>
                        handleGeneratePlan("Remove duplicate rows, trim text spaces, and standardize all date formats to YYYY-MM-DD.")
                      }
                      className="rounded-lg border border-slate-200 bg-[#FAFBFC] px-2.5 py-1 text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                    >
                      🧹 Deduplicate & Clean Dates
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleGeneratePlan("Fill all missing values with sensible defaults and trim whitespace.")
                      }
                      className="rounded-lg border border-slate-200 bg-[#FAFBFC] px-2.5 py-1 text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                    >
                      🩹 Impute Missing Cells
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleGeneratePlan("Full standard audit clean: remove duplicates, trim strings, normalize categories, and cap numeric outliers.")
                      }
                      className="rounded-lg border border-slate-200 bg-[#FAFBFC] px-2.5 py-1 text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                    >
                      ⚡ Comprehensive Auto-Clean
                    </button>
                  </div>
                </div>

                {/* 3. Data Preview & Audit History Tabs */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                  {/* Tab Navigation & Downloads */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 bg-[#FAFBFC] px-4 py-2.5">
                    <div className="flex rounded-xl bg-slate-200/70 p-0.5 text-xs font-semibold">
                      {activeDataset.status === "CLEANED" && (
                        <button
                          type="button"
                          onClick={() => setPreviewTab("cleaned")}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1 transition-all ${previewTab === "cleaned"
                              ? "bg-white text-teal-800 shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Cleaned Data ({activeDataset.cleaningSummary?.finalQualityScore ?? 100}%)</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setPreviewTab("raw")}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1 transition-all ${previewTab === "raw"
                            ? "bg-white text-teal-800 shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                          }`}
                      >
                        <TableIcon className="h-3.5 w-3.5 text-slate-500" />
                        <span>Raw Data</span>
                      </button>

                      {activeDataset.cleaningSummary && (
                        <button
                          type="button"
                          onClick={() => setPreviewTab("audit")}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1 transition-all ${previewTab === "audit"
                              ? "bg-white text-teal-800 shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          <History className="h-3.5 w-3.5 text-indigo-600" />
                          <span>Audit Report</span>
                        </button>
                      )}
                    </div>

                    {/* Download Buttons */}
                    <div className="flex items-center gap-2">
                      {activeDataset.status === "CLEANED" && (
                        <>
                          <a
                            href={`/api/data-prep/datasets/${activeDataset.id}/download?type=cleaned&format=csv`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors shadow-2xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Cleaned CSV</span>
                          </a>

                          <a
                            href={`/api/data-prep/datasets/${activeDataset.id}/download?type=cleaned&format=xlsx`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors shadow-2xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Cleaned XLSX</span>
                          </a>
                        </>
                      )}

                      <a
                        href={`/api/data-prep/datasets/${activeDataset.id}/download?type=original`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Original</span>
                      </a>
                    </div>
                  </div>

                  {/* Content View Area */}
                  {previewTab === "audit" && activeDataset.cleaningSummary ? (
                    <div className="p-6 space-y-4">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs text-emerald-900 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Cleaning Execution Audit Summary
                          </span>
                          <span className="text-[10px] font-mono text-emerald-700">
                            {new Date(activeDataset.cleaningSummary.completedAt).toLocaleString()}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-center">
                          <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                            <span className="text-[10px] text-slate-500 font-semibold">Transformations Applied</span>
                            <p className="text-base font-bold text-emerald-800">
                              {activeDataset.cleaningSummary.transformationsAppliedCount}
                            </p>
                          </div>

                          <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                            <span className="text-[10px] text-slate-500 font-semibold">Rows Removed</span>
                            <p className="text-base font-bold text-emerald-800">
                              {activeDataset.cleaningSummary.rowsRemovedCount}
                            </p>
                          </div>

                          <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                            <span className="text-[10px] text-slate-500 font-semibold">Cells Modified</span>
                            <p className="text-base font-bold text-emerald-800">
                              {activeDataset.cleaningSummary.cellsModifiedCount}
                            </p>
                          </div>

                          <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                            <span className="text-[10px] text-slate-500 font-semibold">Final Quality Score</span>
                            <p className="text-base font-bold text-emerald-800">
                              {activeDataset.cleaningSummary.finalQualityScore}/100
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500">
                        <p>
                          Both original and cleaned datasets are preserved in immutable multi-tenant storage. Cleaned data can be exported in CSV or XLSX format for downstream enterprise workflows.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/80 font-bold uppercase tracking-wider text-[10px] text-slate-500 sticky top-0 z-10">
                            <th className="py-2.5 px-3 w-12 text-center text-slate-400">#</th>
                            {previewColumns.map((col) => (
                              <th key={col} className="py-2.5 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span>{col}</span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
                          {currentPreviewRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2 px-3 text-center text-slate-400 text-[10px] font-sans">
                                {idx + 1}
                              </td>
                              {previewColumns.map((col) => {
                                const val = row[col];
                                const isNull = val === null || val === undefined || val === "";

                                return (
                                  <td key={col} className="py-2 px-3 whitespace-nowrap max-w-xs truncate">
                                    {isNull ? (
                                      <span className="text-slate-300 italic">null</span>
                                    ) : (
                                      <span>{String(val)}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="border-t border-slate-100 bg-[#FAFBFC] px-4 py-2 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>
                      Showing first {currentPreviewRows.length} sample records of {activeDataset.rowCount} total rows
                    </span>
                    <span className="font-semibold text-slate-500">
                      Format: {activeDataset.format.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <DataUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={(newDataset) => {
          fetchDatasets(newDataset.id);
        }}
      />

      {/* Cleaning Plan Review & Approval Modal */}
      {planModalData && activeDataset && (
        <CleaningPlanModal
          isOpen={Boolean(planModalData)}
          onClose={() => setPlanModalData(null)}
          datasetName={activeDataset.originalFilename}
          reasoning={planModalData.reasoning}
          plan={planModalData.plan}
          onExecute={handleExecuteApprovedPlan}
          isExecuting={isExecutingCleaning}
        />
      )}
    </AppShell>
  );
}
