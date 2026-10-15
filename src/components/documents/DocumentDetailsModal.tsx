"use client";

import { useState, useEffect } from "react";
import {
  X,
  FileText,
  Download,
  Trash2,
  Calendar,
  Layers,
  Shield,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  MessageSquare,
} from "lucide-react";

interface DocumentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  onDeleted?: () => void;
  onReOnboard?: (doc: any) => void;
}

export function DocumentDetailsModal({
  isOpen,
  onClose,
  documentId,
  onDeleted,
  onReOnboard,
}: DocumentDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "onboarding" | "preview" | "chunks">("overview");
  const [doc, setDoc] = useState<any | null>(null);
  const [chunks, setChunks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [copiedChunkId, setCopiedChunkId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !documentId) return;

    let isMounted = true;
    setIsLoading(true);
    setDeleteConfirm(false);

    Promise.all([
      fetch(`/api/documents/${documentId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/documents/${documentId}/chunks`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([docData, chunksData]) => {
        if (!isMounted) return;
        if (docData?.document) {
          setDoc(docData.document);
        }
        if (chunksData?.chunks) {
          setChunks(chunksData.chunks);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDeleted?.();
        onClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const copyChunk = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChunkId(id);
    setTimeout(() => setCopiedChunkId(null), 1500);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[90vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
                {doc?.originalFilename || "Document Details"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {doc?.pageCount || 1} pages • {doc?.chunkCount || 0} vector chunks •{" "}
                {formatFileSize(doc?.fileSize)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/knowledge?docId=${documentId}&docName=${encodeURIComponent(doc?.originalFilename || "")}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-2xs"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Ask AI</span>
            </a>

            <a
              href={`/api/documents/${documentId}/download`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 px-6 bg-white shrink-0">
          {[
            { id: "overview", label: "Overview" },
            { id: "onboarding", label: "AI Configuration" },
            { id: "preview", label: "Text Preview" },
            { id: "chunks", label: `Vector Chunks (${chunks.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`border-b-2 py-3 px-4 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? "border-[#4F46E5] text-[#4F46E5]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#4F46E5]" />
            </div>
          ) : !doc ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Document could not be found.
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div
                    className={`rounded-xl border p-4 flex items-center justify-between ${
                      doc.processingStatus === "READY"
                        ? "border-emerald-200 bg-emerald-50/50 text-emerald-800"
                        : doc.processingStatus === "PENDING"
                        ? "border-amber-200 bg-amber-50/50 text-amber-800"
                        : doc.processingStatus === "PROCESSING"
                        ? "border-blue-200 bg-blue-50/50 text-blue-800"
                        : "border-rose-200 bg-rose-50/50 text-rose-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {doc.processingStatus === "READY" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5" />
                      )}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider">
                          Status: {doc.processingStatus}
                        </h4>
                        <p className="text-[11px] mt-0.5">
                          {doc.processingStatus === "READY"
                            ? "Document is segmented, vectorized, and active in RAG Knowledge queries."
                            : doc.processingStatus === "PENDING"
                            ? "Awaiting user review and approval of the AI onboarding proposal."
                            : doc.processingStatus === "PROCESSING"
                            ? "Chunking and vector embeddings are currently executing."
                            : `Processing failed: ${doc.failureReason || "Check file format and content."}`}
                        </p>
                      </div>
                    </div>

                    {doc.processingStatus === "PENDING" && onReOnboard && (
                      <button
                        onClick={() => {
                          onReOnboard(doc);
                          onClose();
                        }}
                        className="rounded-xl bg-[#4F46E5] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700"
                      >
                        Review Proposal
                      </button>
                    )}
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">
                        File Type
                      </p>
                      <p className="text-xs font-bold text-slate-800 mt-1 uppercase">
                        {doc.originalFilename.split(".").pop()}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">
                        File Size
                      </p>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        {formatFileSize(doc.fileSize)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">
                        Total Pages
                      </p>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        {doc.pageCount || 1}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">
                        Indexed Chunks
                      </p>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        {doc.chunkCount || 0}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">
                        Uploaded
                      </p>
                      <p className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">
                        Classification
                      </p>
                      <p className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1">
                        <Shield className="h-3 w-3 text-indigo-500" />
                        {doc.onboardingConfig?.sensitivityLabel ||
                          doc.onboardingSuggestion?.sensitivityLabel ||
                          "INTERNAL"}
                      </p>
                    </div>
                  </div>

                  {/* Purpose */}
                  {doc.purpose && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-1">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Business Purpose
                      </p>
                      <p className="text-xs text-slate-800">{doc.purpose}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: AI ONBOARDING */}
              {activeTab === "onboarding" && (
                <div className="space-y-4">
                  {doc.onboardingConfig || doc.onboardingSuggestion ? (
                    (() => {
                      const cfg = doc.onboardingConfig || doc.onboardingSuggestion;
                      return (
                        <div className="space-y-4">
                          {cfg.summary && (
                            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-1">
                              <h5 className="text-xs font-bold text-indigo-900">
                                Executive Content Summary
                              </h5>
                              <p className="text-xs text-indigo-800 leading-relaxed">
                                {cfg.summary}
                              </p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-xl border border-slate-100 p-3">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase">
                                Document Type
                              </span>
                              <p className="text-xs font-bold text-slate-800 mt-1">
                                {cfg.documentType || "General Document"}
                              </p>
                            </div>

                            <div className="rounded-xl border border-slate-100 p-3">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase">
                                Department
                              </span>
                              <p className="text-xs font-bold text-slate-800 mt-1">
                                {cfg.department || "Operations"}
                              </p>
                            </div>

                            <div className="rounded-xl border border-slate-100 p-3">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase">
                                Chunking Strategy
                              </span>
                              <p className="text-xs font-bold text-slate-800 mt-1">
                                {cfg.chunkingStrategy || "paragraph-semantic"}
                              </p>
                            </div>

                            <div className="rounded-xl border border-slate-100 p-3">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase">
                                Target Size / Overlap
                              </span>
                              <p className="text-xs font-bold text-slate-800 mt-1">
                                {cfg.chunkSize || 600} chars / {cfg.chunkOverlap || 100} chars
                              </p>
                            </div>
                          </div>

                          {cfg.validationRules && cfg.validationRules.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                Compliance & Validation Rules
                              </span>
                              <ul className="space-y-1">
                                {cfg.validationRules.map((rule: string, idx: number) => (
                                  <li
                                    key={idx}
                                    className="text-xs text-slate-700 flex items-center gap-2"
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                    <span>{rule}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {cfg.tags && cfg.tags.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                Tags
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {cfg.tags.map((t: string) => (
                                  <span
                                    key={t}
                                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                                  >
                                    <Tag className="h-3 w-3 text-slate-400" />
                                    <span>{t}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No onboarding configuration recorded for this document.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: TEXT PREVIEW */}
              {activeTab === "preview" && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs font-mono text-slate-800 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
                    {doc.extractedTextPreview || "No preview text available for this file."}
                  </div>
                </div>
              )}

              {/* TAB 4: VECTOR CHUNKS */}
              {activeTab === "chunks" && (
                <div className="space-y-3">
                  {chunks.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No vector chunks generated yet. Approve onboarding to chunk and index this file.
                    </div>
                  ) : (
                    chunks.map((chunk) => (
                      <div
                        key={chunk.id}
                        className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 hover:border-indigo-200 transition-colors shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-indigo-600">
                              Chunk #{chunk.chunkIndex + 1}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-slate-700">
                              Page {chunk.pageNumber || 1}
                            </span>
                            <span>•</span>
                            <span>{chunk.tokenCount} tokens</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyChunk(chunk.id, chunk.content)}
                            className="text-slate-400 hover:text-slate-600 flex items-center gap-1"
                          >
                            {copiedChunkId === chunk.id ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span>{copiedChunkId === chunk.id ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                          {chunk.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer with Delete Option */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50 shrink-0">
          <div>
            {deleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-semibold">
                  Confirm permanent deletion?
                </span>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete"}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-600 font-medium transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Document</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
