"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  HelpCircle,
  Copy,
  Table,
} from "lucide-react";
import { IDataProfilingReport, IDatasetColumn } from "@/lib/db/models/Dataset";

interface DataQualityCardProps {
  report: IDataProfilingReport;
  columns: IDatasetColumn[];
  status: string;
}

export function DataQualityCard({ report, columns, status }: DataQualityCardProps) {
  const [showAllIssues, setShowAllIssues] = useState(false);

  const score = report.qualityScore ?? 100;
  const scoreColor =
    score >= 85
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : score >= 65
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-rose-700 bg-rose-50 border-rose-200";

  const scoreBadge =
    score >= 85
      ? "bg-emerald-600"
      : score >= 65
      ? "bg-amber-500"
      : "bg-rose-600";

  const issues = report.issues || [];
  const highSeverityCount = issues.filter((i) => i.severity === "high").length;
  const mediumSeverityCount = issues.filter((i) => i.severity === "medium").length;
  const displayedIssues = showAllIssues ? issues : issues.slice(0, 4);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-2xs space-y-6">
      {/* Top Banner: Score & Metric Counters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-5 border-b border-slate-100">
        {/* Score Radial / Badge */}
        <div className="flex items-center gap-4">
          <div
            className={`flex h-18 w-18 shrink-0 flex-col items-center justify-center rounded-2xl border-2 ${scoreColor} shadow-2xs`}
          >
            <span className="text-2xl font-black tracking-tight">{score}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">/ 100</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Data Quality Health Score
              </h2>
              {status === "CLEANED" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  Post-Cleaning
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  Initial Profile
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-md">
              {score >= 85
                ? "Dataset exhibits strong structural integrity with minimal formatting defects."
                : score >= 65
                ? "Moderate quality defects detected (duplicates, inconsistent dates, or missing values)."
                : "Significant data quality anomalies detected requiring cleaning before downstream analysis."}
            </p>
          </div>
        </div>

        {/* Quick Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="rounded-xl border border-slate-100 bg-[#FAFBFC] p-3 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Duplicates
            </span>
            <p className={`text-base font-bold ${report.duplicateRowsCount > 0 ? "text-amber-600" : "text-slate-800"}`}>
              {report.duplicateRowsCount}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-[#FAFBFC] p-3 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Missing Cells
            </span>
            <p className={`text-base font-bold ${report.missingCellsCount > 0 ? "text-rose-600" : "text-slate-800"}`}>
              {report.missingCellsCount}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-[#FAFBFC] p-3 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total Rows
            </span>
            <p className="text-base font-bold text-slate-800">{report.totalRows}</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-[#FAFBFC] p-3 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Columns
            </span>
            <p className="text-base font-bold text-slate-800">{report.totalColumns}</p>
          </div>
        </div>
      </div>

      {/* Column Schema Health Pills */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
          <Table className="h-3.5 w-3.5" />
          <span>Column Types & Sparsity</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {columns.map((c) => {
            const hasNulls = c.nullCount > 0;
            return (
              <div
                key={c.name}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#FAFBFC] px-2.5 py-1 text-xs"
              >
                <span className="font-semibold text-slate-800">{c.name}</span>
                <span className="rounded bg-slate-200/60 px-1.5 py-0.2 text-[10px] font-mono text-slate-600">
                  {c.inferredType}
                </span>
                {hasNulls && (
                  <span className="rounded bg-amber-50 px-1 py-0.2 text-[10px] font-bold text-amber-700">
                    {c.nullCount} null
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Issues Diagnostic List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span>Detected Quality Defects ({issues.length})</span>
          </h3>

          <div className="flex items-center gap-2">
            {highSeverityCount > 0 && (
              <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                {highSeverityCount} High
              </span>
            )}
            {mediumSeverityCount > 0 && (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                {mediumSeverityCount} Medium
              </span>
            )}
          </div>
        </div>

        {issues.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              Zero data quality issues detected! All records meet format, deduplication, and schema validation standards.
            </span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedIssues.map((issue) => {
              const badgeStyle =
                issue.severity === "high"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : issue.severity === "medium"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-blue-50 text-blue-700 border-blue-200";

              return (
                <div
                  key={issue.id}
                  className="rounded-xl border border-slate-100 bg-[#FAFBFC] p-3 text-xs space-y-1 hover:border-slate-200 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border ${badgeStyle}`}>
                        {issue.severity}
                      </span>
                      {issue.column && (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-mono font-bold text-indigo-700">
                          {issue.column}
                        </span>
                      )}
                      <span className="font-semibold text-slate-800 truncate">
                        {issue.description}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 pl-1">
                    💡 <strong>Recommended Action:</strong> {issue.recommendedAction}
                  </p>
                </div>
              );
            })}

            {issues.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllIssues(!showAllIssues)}
                className="w-full text-center py-2 text-xs font-semibold text-[#0D9488] hover:underline flex items-center justify-center gap-1"
              >
                <span>{showAllIssues ? "Show Less" : `View all ${issues.length} detected issues`}</span>
                {showAllIssues ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
