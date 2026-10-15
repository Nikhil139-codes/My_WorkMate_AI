"use client";

import { useState } from "react";
import {
  Sparkles,
  Check,
  X,
  Sliders,
  Shield,
  Layers,
  FileCheck,
  AlertCircle,
  Loader2,
  Tag,
  Building,
} from "lucide-react";

interface OnboardingApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  onApproved: () => void;
}

export function OnboardingApprovalModal({
  isOpen,
  onClose,
  document,
  onApproved,
}: OnboardingApprovalModalProps) {
  const initialSuggestion = document?.onboardingSuggestion || {};

  const [documentType, setDocumentType] = useState<string>(
    initialSuggestion.documentType || "General Document"
  );
  const [department, setDepartment] = useState<string>(
    initialSuggestion.department || "Operations"
  );
  const [chunkingStrategy, setChunkingStrategy] = useState<string>(
    initialSuggestion.chunkingStrategy || "paragraph-semantic"
  );
  const [chunkSize, setChunkSize] = useState<number>(
    initialSuggestion.chunkSize || 600
  );
  const [chunkOverlap, setChunkOverlap] = useState<number>(
    initialSuggestion.chunkOverlap || 100
  );
  const [sensitivityLabel, setSensitivityLabel] = useState<string>(
    initialSuggestion.sensitivityLabel || "INTERNAL"
  );
  const [validationRules, setValidationRules] = useState<string[]>(
    initialSuggestion.validationRules || [
      "Retain revision history",
      "Verify source origin",
    ]
  );
  const [newRuleInput, setNewRuleInput] = useState("");
  const [tags, setTags] = useState<string[]>(
    initialSuggestion.suggestedTags || ["Document"]
  );
  const [newTagInput, setNewTagInput] = useState("");
  const [summary, setSummary] = useState<string>(
    initialSuggestion.summary || ""
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !document) return null;

  const handleAddRule = () => {
    if (newRuleInput.trim() && !validationRules.includes(newRuleInput.trim())) {
      setValidationRules([...validationRules, newRuleInput.trim()]);
      setNewRuleInput("");
    }
  };

  const handleRemoveRule = (rule: string) => {
    setValidationRules(validationRules.filter((r) => r !== rule));
  };

  const handleAddTag = () => {
    if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
      setTags([...tags, newTagInput.trim()]);
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      documentType,
      department,
      chunkingStrategy,
      chunkSize: Number(chunkSize),
      chunkOverlap: Number(chunkOverlap),
      sensitivityLabel,
      validationRules,
      tags,
      summary,
    };

    try {
      const res = await fetch(`/api/documents/${document.id}/onboard/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Approval failed.");
        setIsSubmitting(false);
        return;
      }

      onApproved();
      onClose();
    } catch {
      setErrorMessage("Network error occurred while applying configuration.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-purple-600 text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  AI Document Onboarding Agent
                </h3>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                  Review & Approval
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate max-w-md">
                Analyzing: <strong className="text-slate-700">{document.originalFilename}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* AI Reasoning Summary Callout */}
          {initialSuggestion.reasoning && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 text-xs text-indigo-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-800">
                <Sparkles className="h-3.5 w-3.5 text-[#4F46E5]" />
                <span>AI Recommendation Rationale:</span>
              </div>
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                {initialSuggestion.reasoning}
              </p>
            </div>
          )}

          {/* Document Summary (editable) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <FileCheck className="h-3.5 w-3.5 text-slate-500" />
              Executive Content Summary
            </label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-hidden"
              placeholder="Summary of document purpose and primary topics..."
            />
          </div>

          {/* Grid: Type & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Suggested Document Type
              </label>
              <input
                type="text"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:border-[#4F46E5] focus:bg-white focus:outline-hidden"
                placeholder="e.g. Financial Report, Legal Agreement..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-slate-500" />
                Department / Ownership
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:border-[#4F46E5] focus:bg-white focus:outline-hidden"
                placeholder="e.g. Finance, Legal, Engineering..."
              />
            </div>
          </div>

          {/* Sensitivity Label Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-slate-500" />
              Sensitivity Classification
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "PUBLIC", color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
                { label: "INTERNAL", color: "border-blue-200 bg-blue-50 text-blue-700" },
                { label: "CONFIDENTIAL", color: "border-amber-200 bg-amber-50 text-amber-700" },
                { label: "RESTRICTED", color: "border-rose-200 bg-rose-50 text-rose-700" },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSensitivityLabel(s.label)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                    sensitivityLabel === s.label
                      ? `${s.color} ring-2 ring-indigo-500 font-bold shadow-2xs`
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {sensitivityLabel === s.label && <Check className="h-3.5 w-3.5" />}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chunking Pipeline Parameters */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Sliders className="h-4 w-4 text-[#4F46E5]" />
                <span>Chunking & Segmentation Strategy</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                Optimized for Vector Search
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: "paragraph-semantic", title: "Paragraph Semantic", desc: "Best for reports, manuals, narrative text" },
                { id: "page-level", title: "Page Boundary", desc: "Preserves exact full-page cohesion" },
                { id: "tabular-fixed", title: "Tabular Structured", desc: "Best for CSVs and tabular datasets" },
              ].map((strat) => (
                <button
                  key={strat.id}
                  type="button"
                  onClick={() => setChunkingStrategy(strat.id)}
                  className={`rounded-xl border p-2.5 text-left transition-all ${
                    chunkingStrategy === strat.id
                      ? "border-indigo-500 bg-indigo-50/70 text-indigo-900 ring-1 ring-indigo-400"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <p className="text-xs font-semibold">{strat.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{strat.desc}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-700 font-medium mb-1">
                  <span>Target Chunk Size</span>
                  <span className="font-bold text-indigo-600">{chunkSize} chars</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="1600"
                  step="50"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-700 font-medium mb-1">
                  <span>Chunk Overlap</span>
                  <span className="font-bold text-indigo-600">{chunkOverlap} chars</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="300"
                  step="25"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
            </div>
          </div>

          {/* Validation Rules */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              Compliance & Ingestion Rules
            </label>
            <div className="flex flex-wrap gap-1.5">
              {validationRules.map((rule) => (
                <span
                  key={rule}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700 border border-slate-200"
                >
                  <span>{rule}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(rule)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newRuleInput}
                onChange={(e) => setNewRuleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddRule();
                  }
                }}
                placeholder="Add compliance rule (e.g. Mask PII)..."
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddRule}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Add Rule
              </button>
            </div>
          </div>

          {/* Metadata Tags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-slate-500" />
              Document Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-100"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-indigo-400 hover:text-indigo-700"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag..."
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Add Tag
              </button>
            </div>
          </div>

          {/* Security & Access Boundary Notice */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 flex items-start gap-2">
            <Shield className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
            <div>
              <strong>Access Control Notice:</strong> WorkMate AI never permits AI agents to independently grant access permissions. Approved configuration will be applied strictly within your current workspace boundaries.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-[#4F46E5] px-6 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Segmenting & Indexing...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Approve & Index Document</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
