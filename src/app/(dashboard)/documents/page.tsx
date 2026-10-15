"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import {
  FileText,
  Upload,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  Trash2,
  Sparkles,
  Layers,
  FileSpreadsheet,
  FileCode,
  Eye,
  RefreshCw,
  MessageSquare,
  Check,
  ImageIcon,
  Music,
  Video,
  X,
  Play,
  FileAudio,
} from "lucide-react";
import { UploadModal } from "@/components/documents/UploadModal";
import { OnboardingApprovalModal } from "@/components/documents/OnboardingApprovalModal";
import { DocumentDetailsModal } from "@/components/documents/DocumentDetailsModal";

interface DocumentItem {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  pageCount: number;
  chunkCount: number;
  processingStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  mediaType?: "document" | "image" | "audio" | "video";
  purpose?: string | null;
  extractedText?: string | null;
  onboardingConfig?: any;
  onboardingSuggestion?: any;
  failureReason?: string | null;
  transcription?: any;
  mediaMetadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface DocumentStats {
  total: number;
  ready: number;
  pending: number;
  processing: number;
  failed: number;
}

type MediaFilter = "all" | "document" | "image" | "audio" | "video";

// ─── Media Player Modal ────────────────────────────────────────────────────────

function MediaPlayerModal({
  doc,
  initialTimestamp,
  onClose,
}: {
  doc: DocumentItem;
  initialTimestamp?: number;
  onClose: () => void;
}) {
  const [activeTimestamp, setActiveTimestamp] = useState<number | null>(
    initialTimestamp !== undefined ? initialTimestamp : null
  );
  const streamUrl = `/api/documents/${doc.id}/stream`;
  const segments: Array<{ id: number; start: number; end: number; text: string }> =
    doc.transcription?.segments || [];

  const handleLoadedMetadata = (
    e: React.SyntheticEvent<HTMLVideoElement | HTMLAudioElement>
  ) => {
    if (initialTimestamp && initialTimestamp > 0) {
      e.currentTarget.currentTime = initialTimestamp;
    }
  };

  const formatTs = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl bg-[#0f0f1a] border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            {doc.mediaType === "video" ? (
              <Video className="h-4 w-4 text-violet-400" />
            ) : (
              <FileAudio className="h-4 w-4 text-cyan-400" />
            )}
            <span className="text-sm font-semibold text-white truncate max-w-sm">
              {doc.originalFilename}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row">
          {/* Player */}
          <div className="flex-1 p-5">
            {doc.mediaType === "video" ? (
              <video
                id={`player-${doc.id}`}
                controls
                className="w-full rounded-xl bg-black aspect-video"
                src={streamUrl}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={(e) =>
                  setActiveTimestamp(Math.floor((e.target as HTMLVideoElement).currentTime))
                }
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-8">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/30">
                  <Music className="h-10 w-10 text-cyan-400" />
                </div>
                <audio
                  id={`player-${doc.id}`}
                  controls
                  className="w-full"
                  src={streamUrl}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={(e) =>
                    setActiveTimestamp(Math.floor((e.target as HTMLAudioElement).currentTime))
                  }
                />
              </div>
            )}

            {/* Media metadata */}
            {doc.mediaMetadata?.durationSeconds && (
              <div className="mt-3 flex gap-4 text-xs text-white/50">
                <span>
                  Duration:{" "}
                  <span className="text-white/70">
                    {formatTs(doc.mediaMetadata.durationSeconds)}
                  </span>
                </span>
                {doc.transcription?.language && (
                  <span>
                    Language:{" "}
                    <span className="text-white/70 uppercase">
                      {doc.transcription.language}
                    </span>
                  </span>
                )}
                {doc.chunkCount > 0 && (
                  <span>
                    Segments:{" "}
                    <span className="text-white/70">{doc.chunkCount} indexed</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Transcript Drawer */}
          {segments.length > 0 && (
            <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-white/10 flex flex-col max-h-96 md:max-h-[420px]">
              <div className="px-4 py-2.5 border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Transcript
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {segments.map((seg) => {
                  const isActive =
                    activeTimestamp !== null &&
                    activeTimestamp >= seg.start &&
                    activeTimestamp <= seg.end;
                  return (
                    <button
                      key={seg.id}
                      onClick={() => {
                        const el = document.getElementById(`player-${doc.id}`) as
                          | HTMLVideoElement
                          | HTMLAudioElement
                          | null;
                        if (el) {
                          el.currentTime = seg.start;
                          el.play().catch(() => {});
                        }
                      }}
                      className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
                        isActive
                          ? "bg-violet-500/20 border border-violet-500/40"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <div className="text-[10px] font-mono text-white/40 mb-0.5">
                        {formatTs(seg.start)} – {formatTs(seg.end)}
                      </div>
                      <div className="text-[11px] text-white/75 leading-relaxed">
                        {seg.text}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Image Preview Modal ────────────────────────────────────────────────────────

function ImagePreviewModal({
  doc,
  onClose,
}: {
  doc: DocumentItem;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-[#0f0f1a] border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <ImageIcon className="h-4 w-4 text-pink-400" />
            <span className="text-sm font-semibold text-white truncate max-w-xs">
              {doc.originalFilename}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/documents/${doc.id}/stream`}
            alt={doc.originalFilename}
            className="w-full rounded-xl max-h-[60vh] object-contain bg-slate-900"
          />
          {doc.extractedText && (
            <div className="mt-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
                OCR Text
              </div>
              <div className="rounded-xl bg-white/5 p-3 text-xs text-white/70 leading-relaxed max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                {doc.extractedText}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

function DocumentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docIdParam = searchParams.get("docId");
  const timeParam = searchParams.get("t");
  const initialTimestamp = timeParam ? parseFloat(timeParam) : undefined;

  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    workspaceName: string;
    role: string;
  } | null>(null);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [stats, setStats] = useState<DocumentStats>({
    total: 0,
    ready: 0,
    pending: 0,
    processing: 0,
    failed: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [indexingDocId, setIndexingDocId] = useState<string | null>(null);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [approvalDoc, setApprovalDoc] = useState<DocumentItem | null>(null);
  const [detailDocId, setDetailDocId] = useState<string | null>(null);
  const [mediaPreviewDoc, setMediaPreviewDoc] = useState<DocumentItem | null>(null);

  // Load user profile
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) setUserInfo(data.user);
      });
  }, []);

  // Fetch documents list
  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/documents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Auto-open media preview if docId is passed in query
  useEffect(() => {
    if (docIdParam && documents.length > 0 && !mediaPreviewDoc) {
      const match = documents.find((d) => d.id === docIdParam);
      if (match) {
        setMediaPreviewDoc(match);
      }
    }
  }, [docIdParam, documents, mediaPreviewDoc]);

  // Handle successful upload: trigger onboarding modal immediately
  const handleUploadSuccess = (newDoc: any, suggestion?: any) => {
    fetchDocuments();
    // For media files, skip the onboarding modal (no text classification needed)
    const mt = newDoc.mediaType || "document";
    if (mt === "document") {
      setApprovalDoc({ ...newDoc, onboardingSuggestion: suggestion });
    }
  };

  // Quick 1-click approve and index using AI suggested configuration
  const handleQuickApprove = async (id: string) => {
    setIndexingDocId(id);
    try {
      const res = await fetch(`/api/documents/${id}/onboard/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        await fetchDocuments();
      }
    } catch (err) {
      console.error("Quick approve failed:", err);
    } finally {
      setIndexingDocId(null);
    }
  };

  // Chat directly with document, auto-indexing if still pending
  const handleChatWithDocument = async (doc: DocumentItem) => {
    if (doc.processingStatus === "PENDING") {
      setIndexingDocId(doc.id);
      try {
        await fetch(`/api/documents/${doc.id}/onboard/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } catch (err) {
        console.error("Auto-index on chat failed:", err);
      } finally {
        setIndexingDocId(null);
      }
    }
    router.push(`/knowledge?docId=${doc.id}&docName=${encodeURIComponent(doc.originalFilename)}`);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this file and all its indexed chunks?")) {
      return;
    }

    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (doc: DocumentItem) => {
    const mt = doc.mediaType || "document";
    const ext = doc.originalFilename.split(".").pop()?.toLowerCase();

    if (mt === "image") return <ImageIcon className="h-5 w-5 text-pink-500" />;
    if (mt === "audio") return <Music className="h-5 w-5 text-cyan-500" />;
    if (mt === "video") return <Video className="h-5 w-5 text-violet-500" />;

    switch (ext) {
      case "pdf": return <FileText className="h-5 w-5 text-rose-600" />;
      case "docx": return <FileText className="h-5 w-5 text-blue-600" />;
      case "csv": return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
      case "txt":
      case "md": return <FileCode className="h-5 w-5 text-violet-600" />;
      default: return <FileText className="h-5 w-5 text-slate-500" />;
    }
  };

  const getMediaTypeLabel = (doc: DocumentItem) => {
    const mt = doc.mediaType || "document";
    switch (mt) {
      case "image": return { label: "Image", color: "text-pink-700 bg-pink-50 border-pink-200" };
      case "audio": return { label: "Audio", color: "text-cyan-700 bg-cyan-50 border-cyan-200" };
      case "video": return { label: "Video", color: "text-violet-700 bg-violet-50 border-violet-200" };
      default: return null;
    }
  };

  const canPreview = (doc: DocumentItem) => {
    const mt = doc.mediaType || "document";
    return mt === "image" || mt === "audio" || mt === "video";
  };

  // Filter documents by media type
  const filteredDocuments = documents.filter((doc) => {
    if (mediaFilter === "all") return true;
    const mt = doc.mediaType || "document";
    return mt === mediaFilter;
  });

  const totalChunks = documents.reduce((acc, d) => acc + (d.chunkCount || 0), 0);

  const MEDIA_TABS: Array<{ key: MediaFilter; label: string; icon: React.ReactNode }> = [
    { key: "all", label: "All", icon: <Layers className="h-3.5 w-3.5" /> },
    { key: "document", label: "Documents", icon: <FileText className="h-3.5 w-3.5" /> },
    { key: "image", label: "Images", icon: <ImageIcon className="h-3.5 w-3.5" /> },
    { key: "audio", label: "Audio", icon: <Music className="h-3.5 w-3.5" /> },
    { key: "video", label: "Video", icon: <Video className="h-3.5 w-3.5" /> },
  ];

  return (
    <AppShell
      pageTitle="Knowledge Library"
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
                Total Files
              </span>
              <FileText className="h-4 w-4 text-[#4F46E5]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
              <span className="text-[11px] text-slate-500">in workspace</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Indexed & Ready
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700">{stats.ready}</span>
              <span className="text-[11px] text-slate-500">ready for RAG</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Pending Review
              </span>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-600">{stats.pending}</span>
              <span className="text-[11px] text-slate-500">awaiting index</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Vector Segments
              </span>
              <Layers className="h-4 w-4 text-purple-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-purple-700">{totalChunks}</span>
              <span className="text-[11px] text-slate-500">indexed chunks</span>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2 flex-wrap">
            {/* Media type filter tabs */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
              {MEDIA_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setMediaFilter(tab.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    mediaFilter === tab.key
                      ? "bg-[#4F46E5] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[160px] max-w-md">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#4F46E5] focus:outline-hidden shadow-2xs"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#4F46E5] focus:outline-hidden shadow-2xs"
              >
                <option value="">All Statuses</option>
                <option value="READY">Ready for RAG</option>
                <option value="PENDING">Pending Review</option>
                <option value="PROCESSING">Processing</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <button
              onClick={() => fetchDocuments()}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
              title="Refresh list"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
          >
            <Upload className="h-4 w-4" />
            <span>Upload File</span>
          </button>
        </div>

        {/* Documents Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#4F46E5]" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-[#4F46E5] mb-4">
                <FileText className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {mediaFilter === "all" ? "No files found" : `No ${mediaFilter} files found`}
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                Upload PDF, DOCX, TXT, CSV, images (PNG/JPG/WEBP), audio (MP3/WAV), or video (MP4/WEBM) files to enable AI knowledge chat.
              </p>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs"
              >
                <Upload className="h-4 w-4" />
                <span>Upload First File</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">File</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Size / Chunks</th>
                    <th className="py-3 px-4">Uploaded</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredDocuments.map((doc) => {
                    const sensitivity =
                      doc.onboardingConfig?.sensitivityLabel ||
                      doc.onboardingSuggestion?.sensitivityLabel ||
                      null;
                    const mediaTypeBadge = getMediaTypeLabel(doc);

                    return (
                      <tr
                        key={doc.id}
                        onClick={() => setDetailDocId(doc.id)}
                        className="group hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        {/* Filename */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 group-hover:border-indigo-200">
                              {getFileIcon(doc)}
                            </div>
                            <div className="truncate max-w-xs md:max-w-sm">
                              <p className="font-bold text-slate-900 truncate">
                                {doc.originalFilename}
                              </p>
                              {doc.purpose ? (
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {doc.purpose}
                                </p>
                              ) : doc.mediaMetadata?.durationSeconds ? (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {Math.floor(doc.mediaMetadata.durationSeconds / 60)}m{" "}
                                  {Math.floor(doc.mediaMetadata.durationSeconds % 60)}s
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {doc.onboardingConfig?.documentType ||
                                    doc.onboardingSuggestion?.documentType ||
                                    (doc.mediaType ? doc.mediaType.charAt(0).toUpperCase() + doc.mediaType.slice(1) : "Document")}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Classification / Media Type Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {mediaTypeBadge ? (
                            <span
                              className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold border ${mediaTypeBadge.color}`}
                            >
                              {mediaTypeBadge.label}
                            </span>
                          ) : sensitivity ? (
                            <span
                              className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                                sensitivity === "RESTRICTED"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : sensitivity === "CONFIDENTIAL"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : sensitivity === "INTERNAL"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {sensitivity}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                              Document
                            </span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {doc.processingStatus === "READY" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              Ready
                            </span>
                          )}

                          {doc.processingStatus === "PENDING" && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickApprove(doc.id);
                                }}
                                disabled={indexingDocId === doc.id}
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-2xs"
                                title="Index immediately"
                              >
                                {indexingDocId === doc.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                                ) : (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                )}
                                <span>Index Now</span>
                              </button>
                              {(doc.mediaType === "document" || !doc.mediaType) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setApprovalDoc(doc);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
                                  title="Review AI proposal"
                                >
                                  <Sparkles className="h-3 w-3 text-amber-600" />
                                  <span>Review</span>
                                </button>
                              )}
                            </div>
                          )}

                          {doc.processingStatus === "PROCESSING" && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Processing...
                            </span>
                          )}

                          {doc.processingStatus === "FAILED" && (
                            <span
                              title={doc.failureReason || "Processing failed"}
                              className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Failed
                            </span>
                          )}
                        </td>

                        {/* Size & Chunks */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-800">
                            {formatFileSize(doc.fileSize)}
                          </span>
                          {doc.chunkCount > 0 && (
                            <span className="ml-1 text-indigo-600">
                              · {doc.chunkCount} chunks
                            </span>
                          )}
                        </td>

                        {/* Upload Date */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-slate-500">
                          {new Date(doc.createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div
                            className="flex items-center justify-end gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Preview button for media */}
                            {canPreview(doc) && doc.processingStatus === "READY" && (
                              <button
                                type="button"
                                onClick={() => setMediaPreviewDoc(doc)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-violet-600 transition-colors"
                                title="Preview media"
                              >
                                <Play className="h-3.5 w-3.5" />
                                <span>Preview</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleChatWithDocument(doc)}
                              disabled={indexingDocId === doc.id}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
                              title="Ask AI about this file"
                            >
                              {indexingDocId === doc.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <MessageSquare className="h-3.5 w-3.5" />
                              )}
                              <span>Ask AI</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDetailDocId(doc.id)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            <a
                              href={`/api/documents/${doc.id}/download`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                              title="Download File"
                            >
                              <Download className="h-4 w-4" />
                            </a>

                            <button
                              type="button"
                              onClick={(e) => handleDelete(doc.id, e)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Delete File"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* AI Onboarding Approval Modal */}
      {approvalDoc && (
        <OnboardingApprovalModal
          isOpen={Boolean(approvalDoc)}
          onClose={() => setApprovalDoc(null)}
          document={approvalDoc}
          onApproved={() => fetchDocuments()}
        />
      )}

      {/* Document Details & Chunks Modal */}
      {detailDocId && (
        <DocumentDetailsModal
          isOpen={Boolean(detailDocId)}
          onClose={() => setDetailDocId(null)}
          documentId={detailDocId}
          onDeleted={() => fetchDocuments()}
          onReOnboard={(doc) => setApprovalDoc(doc)}
        />
      )}

      {/* Media Player / Image Preview Modal */}
      {mediaPreviewDoc && (
        mediaPreviewDoc.mediaType === "image" ? (
          <ImagePreviewModal
            doc={mediaPreviewDoc}
            onClose={() => setMediaPreviewDoc(null)}
          />
        ) : (
          <MediaPlayerModal
            doc={mediaPreviewDoc}
            initialTimestamp={initialTimestamp}
            onClose={() => setMediaPreviewDoc(null)}
          />
        )
      )}
    </AppShell>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#4F46E5]" />
        </div>
      }
    >
      <DocumentsPageContent />
    </Suspense>
  );
}
