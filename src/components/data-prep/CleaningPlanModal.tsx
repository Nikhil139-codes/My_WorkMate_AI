"use client";

import { useState } from "react";
import {
  Sparkles,
  Check,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sliders,
} from "lucide-react";
import { ICleaningPlanStep } from "@/lib/db/models/CleaningJob";

interface CleaningPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetName: string;
  reasoning: string;
  plan: ICleaningPlanStep[];
  onExecute: (approvedPlan: ICleaningPlanStep[]) => Promise<void>;
  isExecuting: boolean;
}

export function CleaningPlanModal({
  isOpen,
  onClose,
  datasetName,
  reasoning,
  plan: initialPlan,
  onExecute,
  isExecuting,
}: CleaningPlanModalProps) {
  const [steps, setSteps] = useState<ICleaningPlanStep[]>(initialPlan);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleStepApproval = (index: number) => {
    setSteps((prev) =>
      prev.map((step, idx) =>
        idx === index ? { ...step, approved: !step.approved } : step
      )
    );
  };

  const handleApply = async () => {
    const approvedSteps = steps.filter((s) => s.approved);
    if (approvedSteps.length === 0) {
      setErrorMessage("Please approve at least one transformation step to execute.");
      return;
    }
    setErrorMessage(null);
    await onExecute(steps);
  };

  const approvedCount = steps.filter((s) => s.approved).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#0D9488]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                AI Data Cleaning Plan — Review & Approval
              </h3>
              <p className="text-[11px] text-slate-500 truncate max-w-md">
                Dataset: {datasetName} • Review and approve transformations before execution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* AI Reasoning */}
          <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3.5 text-xs text-teal-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[#0D9488]">
              <Sparkles className="h-4 w-4" />
              <span>AI Data Cleaning Strategy</span>
            </div>
            <p className="text-[11px] leading-relaxed text-teal-800">{reasoning}</p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Proposed Transformations ({steps.length})
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {approvedCount} of {steps.length} approved
            </span>
          </div>

          {/* Steps List */}
          <div className="space-y-3">
            {steps.map((step, idx) => {
              return (
                <div
                  key={step.id || idx}
                  className={`rounded-xl border p-4 text-xs space-y-2 transition-all ${
                    step.approved
                      ? "border-teal-200 bg-white shadow-2xs"
                      : "border-slate-200 bg-slate-50/70 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                        {step.operation.replace(/_/g, " ").toUpperCase()}
                      </span>
                      {step.column && (
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 font-mono">
                          Column: {step.column}
                        </span>
                      )}
                      <span className="font-bold text-slate-900">{step.description}</span>
                    </div>

                    {/* Toggle Approval Button */}
                    <button
                      type="button"
                      onClick={() => toggleStepApproval(idx)}
                      disabled={isExecuting}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors shrink-0 ${
                        step.approved
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                      }`}
                    >
                      {step.approved ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Approved</span>
                        </>
                      ) : (
                        <>
                          <X className="h-3 w-3" />
                          <span>Rejected</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Impact Explanation */}
                  <div className="rounded-lg bg-[#FAFBFC] border border-slate-100 p-2 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">Deterministic Impact: </span>
                    {step.impact}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-500 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              All operations are executed deterministically on the server via our strict transformation engine. Original files are never modified.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={isExecuting || approvedCount === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Executing Transformations...</span>
              </>
            ) : (
              <>
                <span>Apply {approvedCount} Transformations</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
