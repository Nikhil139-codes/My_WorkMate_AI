"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  Video,
  FileAudio,
  Play,
  Pause,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Sparkles,
  CheckSquare,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  Plus,
  X,
  FileText,
  Calendar,
  Users,
  ChevronRight,
  ListTodo,
  Layers,
  HelpCircle,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Edit2,
  Share2,
  ShieldCheck,
  Info,
} from "lucide-react";

interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

interface DecisionItem {
  id: string;
  decision: string;
  excerpt?: string;
  timestamp?: string;
  approved: boolean;
}

interface ActionItem {
  id: string;
  task: string;
  owner: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string;
  dependencies: string[];
  excerpt?: string;
  timestamp?: string;
  isExplicitCommitment: boolean;
  approved: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CONVERTED";
  createdTaskId?: string;
}

interface MeetingTopic {
  title: string;
  summary: string;
  timestampStart?: number;
  timestampEnd?: number;
  formattedTimestamp?: string;
}

interface MeetingAnalysis {
  title?: string;
  executiveSummary: string;
  keyDiscussionPoints: string[];
  topics: MeetingTopic[];
  decisions: DecisionItem[];
  actionItems: ActionItem[];
  unresolvedQuestions: string[];
  blockers: string[];
  followUpTopics: string[];
  analyzedAt?: string;
}

interface MeetingRecord {
  id: string;
  title: string;
  meetingType: string;
  participants: string[];
  meetingDate?: string;
  inputType: "PASTE" | "UPLOAD_TRANSCRIPT" | "AUDIO_RECORDING";
  status: "DRAFT" | "ANALYZING" | "READY" | "FAILED";
  transcriptText: string;
  transcriptSegments?: TranscriptSegment[];
  analysis?: MeetingAnalysis | null;
  followUpSummary?: string | null;
  sourceDocumentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function MeetingsPage() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    workspaceName: string;
    role: string;
  } | null>(null);

  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null);
  // Use a ref to track selectedMeeting.id without making it a fetchMeetings dependency
  const selectedMeetingIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  // Media Player State (for audio recordings)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playerRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  // Studio Active Tab
  const [activeTab, setActiveTab] = useState<"review" | "followup" | "transcript" | "ask">("review");

  // Analysis & Export State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isConvertingTasks, setIsConvertingTasks] = useState(false);
  const [convertFeedback, setConvertFeedback] = useState<string | null>(null);

  // Transcript Search
  const [transcriptSearch, setTranscriptSearch] = useState("");

  // Ask AI State
  const [askQuestion, setAskQuestion] = useState("");
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  // Follow-up copy confirmation
  const [hasCopiedSummary, setHasCopiedSummary] = useState(false);

  // Upload & Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"paste" | "upload" | "sample">("paste");
  const [modalTitle, setModalTitle] = useState("");
  const [modalType, setModalType] = useState("Sprint Planning Sync");
  const [modalParticipants, setModalParticipants] = useState("");
  const [modalPastedText, setModalPastedText] = useState("");
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Format MM:SS helper
  const formatTs = (s: number) => {
    if (isNaN(s)) return "00:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  // Load User Profile
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) setUserInfo(data.user);
      });
  }, []);

  // Fetch Meetings List
  // IMPORTANT: selectedMeeting is NOT in the deps array — we use a ref instead
  // to avoid an infinite loop (fetch → setSelectedMeeting → new callback → fetch → ...)
  const fetchMeetings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/meetings");
      if (res.ok) {
        const data = await res.json();
        const list: MeetingRecord[] = data.meetings || [];
        setMeetings(list);

        const currentId = selectedMeetingIdRef.current;
        if (list.length > 0 && !currentId) {
          // No meeting selected yet — auto-select the first one
          setSelectedMeeting(list[0]);
          selectedMeetingIdRef.current = list[0].id;
        } else if (currentId) {
          // Refresh the currently selected meeting's data without switching meetings
          const refreshed = list.find((m) => m.id === currentId);
          if (refreshed) {
            setSelectedMeeting((prev) => {
              // Only update if the refreshed data actually changed (status, analysis, etc.)
              if (!prev) return refreshed;
              const prevJson = JSON.stringify({ status: prev.status, analysis: prev.analysis, followUpSummary: prev.followUpSummary });
              const nextJson = JSON.stringify({ status: refreshed.status, analysis: refreshed.analysis, followUpSummary: refreshed.followUpSummary });
              return prevJson !== nextJson ? refreshed : prev;
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to load meetings:", err);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // No deps — uses ref for selected meeting ID

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Audio Playback Controls
  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
      setIsPlaying(false);
    } else {
      playerRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (timeInSeconds: number) => {
    if (!playerRef.current) return;
    playerRef.current.currentTime = timeInSeconds;
    setCurrentTime(timeInSeconds);
    playerRef.current.play().catch(() => {});
    setIsPlaying(true);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (playerRef.current) {
      playerRef.current.playbackRate = speed;
    }
  };

  // Trigger / Retrigger AI Analysis
  const handleRunAnalysis = async () => {
    if (!selectedMeeting) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setConvertFeedback(null);

    try {
      const res = await fetch(`/api/meetings/${selectedMeeting.id}/analyze`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        setAnalysisError(data.error || "Failed to analyze meeting transcript");
        return;
      }

      const updated = {
        ...selectedMeeting,
        analysis: data.analysis,
        followUpSummary: data.followUpSummary,
        status: "READY" as const,
      };

      setSelectedMeeting(updated);
      setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err: any) {
      setAnalysisError(err.message || "Meeting analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Toggle Decision Approval
  const handleToggleDecision = async (decisionId: string, currentApproved: boolean) => {
    if (!selectedMeeting || !selectedMeeting.analysis) return;
    const newApproved = !currentApproved;

    // Optimistic UI update
    const updatedDecisions = selectedMeeting.analysis.decisions.map((d) =>
      d.id === decisionId ? { ...d, approved: newApproved } : d
    );
    const updatedMeeting = {
      ...selectedMeeting,
      analysis: {
        ...selectedMeeting.analysis,
        decisions: updatedDecisions,
      },
    };
    setSelectedMeeting(updatedMeeting);

    try {
      await fetch(`/api/meetings/${selectedMeeting.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisions: [{ id: decisionId, approved: newApproved }],
        }),
      });
    } catch (err) {
      console.error("Decision toggle error:", err);
    }
  };

  // Toggle Action Item Approval
  const handleToggleActionItem = async (actionId: string, currentApproved: boolean) => {
    if (!selectedMeeting || !selectedMeeting.analysis) return;
    const newApproved = !currentApproved;

    const updatedActions = selectedMeeting.analysis.actionItems.map((a) =>
      a.id === actionId
        ? {
            ...a,
            approved: newApproved,
            status: newApproved ? ("APPROVED" as const) : ("REJECTED" as const),
          }
        : a
    );
    const updatedMeeting = {
      ...selectedMeeting,
      analysis: {
        ...selectedMeeting.analysis,
        actionItems: updatedActions,
      },
    };
    setSelectedMeeting(updatedMeeting);

    try {
      await fetch(`/api/meetings/${selectedMeeting.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionItems: [
            {
              id: actionId,
              approved: newApproved,
              status: newApproved ? "APPROVED" : "REJECTED",
            },
          ],
        }),
      });
    } catch (err) {
      console.error("Action item toggle error:", err);
    }
  };

  // Convert Approved Action Items to Workspace Tasks (Duplicate Prevention Guaranteed)
  const handleConvertTasks = async () => {
    if (!selectedMeeting || !selectedMeeting.analysis?.actionItems?.length) return;
    setIsConvertingTasks(true);
    setConvertFeedback(null);

    const approvedItems = selectedMeeting.analysis.actionItems.filter(
      (a) => a.approved !== false
    );
    if (approvedItems.length === 0) {
      alert("Please approve at least one action item before converting to tasks.");
      setIsConvertingTasks(false);
      return;
    }

    try {
      const res = await fetch(`/api/meetings/${selectedMeeting.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionItemIds: approvedItems.map((a) => a.id),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setConvertFeedback(
          `Success: ${data.createdCount} new tasks created, ${data.updatedCount} existing tasks updated. Duplicate creation was safely prevented!`
        );
        if (data.analysis) {
          const updated = {
            ...selectedMeeting,
            analysis: data.analysis,
          };
          setSelectedMeeting(updated);
          setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      } else {
        alert(data.error || "Failed to convert tasks");
      }
    } catch (err: any) {
      alert(err.message || "Task conversion error");
    } finally {
      setIsConvertingTasks(false);
    }
  };

  // Copy Follow-Up Summary to Clipboard
  const handleCopySummary = () => {
    if (!selectedMeeting?.followUpSummary) return;
    navigator.clipboard.writeText(selectedMeeting.followUpSummary);
    setHasCopiedSummary(true);
    setTimeout(() => setHasCopiedSummary(false), 3000);
  };

  // Download Follow-Up Summary Markdown File
  const handleDownloadSummary = () => {
    if (!selectedMeeting) return;
    window.open(`/api/meetings/${selectedMeeting.id}/follow-up?download=true`, "_blank");
  };

  // Grounded Meeting Chat / Ask AI
  const handleAskMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuestion.trim() || !selectedMeeting || isAsking) return;

    setIsAsking(true);
    setAskAnswer(null);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Based ONLY on the meeting transcript for "${selectedMeeting.title}": ${askQuestion}\n\nTranscript excerpt:\n${selectedMeeting.transcriptText.slice(0, 10000)}`,
          mode: "general",
        }),
      });

      const data = await res.json();
      if (res.ok && data.assistantMessage) {
        setAskAnswer(data.assistantMessage.content);
      } else {
        setAskAnswer(data.error || "Could not retrieve answer grounded in this meeting transcript.");
      }
    } catch (err: any) {
      setAskAnswer("Error querying meeting: " + err.message);
    } finally {
      setIsAsking(false);
    }
  };

  // Submit Create Meeting Modal (Paste, Upload File, or Sample)
  const handleCreateMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingModal(true);
    setModalError(null);

    try {
      let res: Response;

      if (createMode === "paste") {
        if (!modalPastedText.trim()) {
          setModalError("Please paste meeting notes or transcript text.");
          setIsSubmittingModal(false);
          return;
        }

        res = await fetch("/api/meetings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: modalTitle.trim() || "Meeting Sync",
            meetingType: modalType,
            participants: modalParticipants.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean),
            transcriptText: modalPastedText.trim(),
            inputType: "PASTE",
            autoAnalyze: true,
          }),
        });
      } else if (createMode === "upload") {
        if (!modalFile) {
          setModalError("Please select a transcript file (TXT, DOCX, PDF) or audio recording.");
          setIsSubmittingModal(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", modalFile);
        formData.append("title", modalTitle.trim() || modalFile.name.replace(/\.[^/.]+$/, ""));
        formData.append("meetingType", modalType);
        formData.append("participants", modalParticipants);
        formData.append("autoAnalyze", "true");

        res = await fetch("/api/meetings", {
          method: "POST",
          body: formData,
        });
      } else {
        // Sample Mode: Pre-configured Standup
        const sampleText = `Alex (Engineering Lead): Good morning everyone. Let's do a quick round for Sprint 44 sync. Maya, how is the PostgreSQL to MongoDB migration coming along?
Maya: All user auth and session tokens have been verified in staging. I will deploy the database adapter migration to production by Thursday 5 PM.
Alex: Great. Make sure to verify index performance on the audit logs collection before deploying.
David (Security): I audited the new Micro-App submission endpoints. We need to implement IP rate limiting to prevent spam on public survey links. I explicitly commit to finishing the token bucket rate limiter by tomorrow noon.
Maya: I depend on David's rate limiter before I can open the external beta.
Alex: Agreed. Decision: David completes rate limiting by tomorrow, Maya deploys production migration on Thursday.
David: What about our external SMTP email notifications?
Alex: We don't have an approved SMTP budget yet, so email dispatch remains an open question for next week's leadership meeting.`;

        res = await fetch("/api/meetings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Sprint 44 Engineering Sync & Security Review",
            meetingType: "Sprint Planning",
            participants: ["Alex", "Maya", "David"],
            transcriptText: sampleText,
            inputType: "PASTE",
            autoAnalyze: true,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || "Failed to create meeting.");
        setIsSubmittingModal(false);
        return;
      }

      setIsCreateModalOpen(false);
      setModalTitle("");
      setModalParticipants("");
      setModalPastedText("");
      setModalFile(null);
      await fetchMeetings();
    } catch (err: any) {
      setModalError(err.message || "Failed to create meeting.");
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Filter meetings by search query and meeting type
  const filteredMeetings = meetings.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.participants?.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = filterType === "ALL" || m.meetingType === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <AppShell
      pageTitle="Meeting Intelligence"
      userName={userInfo?.name || "Member"}
      userEmail={userInfo?.email || "user@workmate.ai"}
      workspaceName={userInfo?.workspaceName || "WorkMate AI"}
      userRole={userInfo?.role || "MEMBER"}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-100">
                Phase 6 Engine
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[#172B4D]">
                Meeting-to-Execution Engine
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Extract structured decisions, approve action items without duplicates, and convert meetings into trackable tasks.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/workflows"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <CheckSquare className="h-4 w-4 text-emerald-600" />
              <span>Workspace Tasks</span>
            </Link>

            <button
              onClick={() => {
                setModalError(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>New Meeting</span>
            </button>
          </div>
        </div>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Meetings Library (4 cols) */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Video className="h-4 w-4 text-purple-600" />
                <span>Meeting Library ({filteredMeetings.length})</span>
              </h2>

              <button
                onClick={fetchMeetings}
                title="Refresh meetings"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by title or participants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Meetings Scroll List */}
            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {isLoading && meetings.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  <span>Loading meetings...</span>
                </div>
              ) : filteredMeetings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 space-y-3">
                  <Video className="mx-auto h-8 w-8 text-slate-300" />
                  <div>
                    <p className="font-semibold text-slate-700">No meetings recorded yet</p>
                    <p className="text-[11px] mt-0.5">
                      Paste notes, upload a transcript (TXT/DOCX/PDF), or load the sample sprint meeting.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Meeting</span>
                  </button>
                </div>
              ) : (
                filteredMeetings.map((m) => {
                  const isSelected = selectedMeeting?.id === m.id;
                  const decisionsCount = m.analysis?.decisions?.length || 0;
                  const actionItemsCount = m.analysis?.actionItems?.length || 0;

                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedMeeting(m);
                        selectedMeetingIdRef.current = m.id;
                        setConvertFeedback(null);
                        setAnalysisError(null);
                        setAskAnswer(null);
                        setActiveTab("review");
                      }}
                      className={`w-full text-left rounded-xl border p-3 transition-all ${
                        isSelected
                          ? "border-purple-500 bg-purple-50/70 shadow-xs ring-1 ring-purple-500"
                          : "border-slate-200 bg-white hover:border-purple-200 hover:bg-slate-50/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                              m.inputType === "AUDIO_RECORDING"
                                ? "bg-amber-100 text-amber-700"
                                : m.inputType === "UPLOAD_TRANSCRIPT"
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {m.inputType === "AUDIO_RECORDING" ? (
                              <FileAudio className="h-3.5 w-3.5" />
                            ) : m.inputType === "UPLOAD_TRANSCRIPT" ? (
                              <FileText className="h-3.5 w-3.5" />
                            ) : (
                              <Video className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {m.title}
                          </span>
                        </div>

                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase shrink-0 ${
                            m.status === "READY"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : m.status === "ANALYZING"
                              ? "bg-blue-50 text-blue-700 animate-pulse border border-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="truncate max-w-[140px]">
                          {m.participants?.length ? m.participants.join(", ") : m.meetingType}
                        </span>

                        <span className="font-mono text-slate-400">
                          {new Date(m.createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>

                      {actionItemsCount > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-[10px]">
                          <span className="inline-flex items-center gap-1 rounded bg-purple-100/70 px-1.5 py-0.5 font-semibold text-purple-700">
                            <CheckSquare className="h-3 w-3" />
                            <span>{actionItemsCount} Actions</span>
                          </span>

                          {decisionsCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100/70 px-1.5 py-0.5 font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>{decisionsCount} Decisions</span>
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Meeting Studio (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedMeeting ? (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                {/* Meeting Header Strip */}
                <div className="border-b border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700 border border-purple-200">
                          {selectedMeeting.meetingType || "General Sync"}
                        </span>
                        <h2 className="text-base font-bold text-[#172B4D]">
                          {selectedMeeting.title}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                        <span>Participants: <strong>{selectedMeeting.participants?.length ? selectedMeeting.participants.join(", ") : "Team"}</strong></span>
                        <span>•</span>
                        <span>Source: <strong>{selectedMeeting.inputType.replace("_", " ")}</strong></span>
                      </p>
                    </div>

                    <button
                      onClick={handleRunAnalysis}
                      disabled={isAnalyzing}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      <span>{selectedMeeting.analysis ? "Re-Analyze" : "Analyze Meeting"}</span>
                    </button>
                  </div>
                </div>

                {/* Navigation Tabs */}
                <div className="border-b border-slate-200 bg-white px-4 flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("review")}
                    className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
                      activeTab === "review"
                        ? "border-purple-600 text-purple-700"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span>Review & Approvals</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("followup")}
                    className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
                      activeTab === "followup"
                        ? "border-purple-600 text-purple-700"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Follow-Up Summary</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("transcript")}
                    className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
                      activeTab === "transcript"
                        ? "border-purple-600 text-purple-700"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Original Transcript</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("ask")}
                    className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
                      activeTab === "ask"
                        ? "border-purple-600 text-purple-700"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Ask AI Q&A</span>
                  </button>
                </div>

                {/* Tab Body */}
                <div className="p-5">
                  {/* TAB 1: Review & Approvals */}
                  {activeTab === "review" && (
                    <div className="space-y-6">
                      {convertFeedback && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span>{convertFeedback}</span>
                          </div>
                          <Link
                            href="/workflows"
                            className="font-bold underline text-emerald-900 text-xs shrink-0"
                          >
                            View in Tasks &rarr;
                          </Link>
                        </div>
                      )}

                      {analysisError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>{analysisError}</span>
                        </div>
                      )}

                      {!selectedMeeting.analysis ? (
                        <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/40 p-10 text-center space-y-3">
                          <Sparkles className="mx-auto h-10 w-10 text-purple-600" />
                          <h3 className="font-bold text-sm text-slate-800">
                            AI Meeting Analysis Not Yet Generated
                          </h3>
                          <p className="text-xs text-slate-500 max-w-md mx-auto">
                            Groq will analyze the transcript to identify explicit commitments vs suggestions, decisions with excerpts, and action items.
                          </p>
                          <button
                            onClick={handleRunAnalysis}
                            disabled={isAnalyzing}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 disabled:opacity-50"
                          >
                            {isAnalyzing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            <span>{isAnalyzing ? "Analyzing..." : "Analyze Transcript Now"}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Executive Summary Card */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Executive Summary</span>
                            </span>
                            <p className="text-xs text-slate-700 leading-relaxed font-serif whitespace-pre-line">
                              {selectedMeeting.analysis.executiveSummary}
                            </p>
                          </div>

                          {/* Key Discussion Points */}
                          {selectedMeeting.analysis.keyDiscussionPoints?.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                Key Discussion Points
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {selectedMeeting.analysis.keyDiscussionPoints.map((pt, i) => (
                                  <div
                                    key={i}
                                    className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700 flex items-start gap-2 shadow-2xs"
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                                    <span>{pt}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Decisions Made (Editable & Approvable) */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <span>
                                  Decisions Made (
                                  {selectedMeeting.analysis.decisions?.length || 0})
                                </span>
                              </h4>
                              <span className="text-[11px] text-slate-400">
                                Toggle checkmark to approve/exclude
                              </span>
                            </div>

                            <div className="space-y-2">
                              {selectedMeeting.analysis.decisions?.map((dec) => (
                                <div
                                  key={dec.id}
                                  className={`rounded-xl border p-3 transition-colors text-xs ${
                                    dec.approved !== false
                                      ? "border-emerald-200 bg-emerald-50/20"
                                      : "border-slate-200 bg-slate-50/60 opacity-60"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5 flex-1">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleDecision(dec.id, dec.approved !== false)}
                                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                          dec.approved !== false
                                            ? "border-emerald-600 bg-emerald-600 text-white"
                                            : "border-slate-300 bg-white"
                                        }`}
                                      >
                                        {dec.approved !== false && <Check className="h-3 w-3" />}
                                      </button>
                                      <div>
                                        <p className="font-semibold text-slate-800">
                                          {dec.decision}
                                        </p>
                                        {dec.excerpt && (
                                          <p className="text-[11px] text-slate-500 italic mt-1 bg-white/70 p-1.5 rounded border border-slate-100">
                                            &ldquo;{dec.excerpt}&rdquo;
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                        dec.approved !== false
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-slate-200 text-slate-600"
                                      }`}
                                    >
                                      {dec.approved !== false ? "Approved" : "Excluded"}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Proposed Action Items & Execution Conversion */}
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2">
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                  <ListTodo className="h-4 w-4 text-purple-600" />
                                  <span>
                                    Action Items & Approvals (
                                    {selectedMeeting.analysis.actionItems?.length || 0})
                                  </span>
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  Explicit commitments are differentiated from AI-suggested items.
                                </p>
                              </div>

                              <button
                                onClick={handleConvertTasks}
                                disabled={isConvertingTasks}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors shrink-0"
                              >
                                {isConvertingTasks ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckSquare className="h-3.5 w-3.5" />
                                )}
                                <span>Convert Approved to Workspace Tasks</span>
                              </button>
                            </div>

                            <div className="space-y-2.5">
                              {selectedMeeting.analysis.actionItems?.map((item) => (
                                <div
                                  key={item.id}
                                  className={`rounded-xl border p-3.5 transition-all text-xs ${
                                    item.status === "CONVERTED"
                                      ? "border-indigo-200 bg-indigo-50/20"
                                      : item.approved !== false
                                      ? "border-slate-200 bg-white"
                                      : "border-slate-200 bg-slate-50/60 opacity-60"
                                  }`}
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5 flex-1">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleActionItem(item.id, item.approved !== false)}
                                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                          item.approved !== false
                                            ? "border-purple-600 bg-purple-600 text-white"
                                            : "border-slate-300 bg-white"
                                        }`}
                                      >
                                        {item.approved !== false && <Check className="h-3 w-3" />}
                                      </button>

                                      <div className="space-y-1.5 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          {item.isExplicitCommitment ? (
                                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 border border-indigo-200">
                                              Explicit Commitment
                                            </span>
                                          ) : (
                                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                                              AI-Suggested
                                            </span>
                                          )}

                                          <span
                                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                              item.priority === "URGENT" || item.priority === "HIGH"
                                                ? "bg-red-50 text-red-700 border border-red-200"
                                                : item.priority === "MEDIUM"
                                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                                : "bg-slate-50 text-slate-600 border border-slate-200"
                                            }`}
                                          >
                                            {item.priority}
                                          </span>

                                          {item.status === "CONVERTED" && (
                                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                                              Converted to Task
                                            </span>
                                          )}
                                        </div>

                                        <p className="font-bold text-slate-900 text-xs">
                                          {item.task}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                                          <span>Owner: <strong className="text-slate-700">{item.owner}</strong></span>
                                          <span>•</span>
                                          <span>Due: <strong className="text-slate-700">{item.dueDate || "Unknown"}</strong></span>
                                          {item.dependencies?.length > 0 && (
                                            <>
                                              <span>•</span>
                                              <span>Depends on: <strong className="text-slate-700">{item.dependencies.join(", ")}</strong></span>
                                            </>
                                          )}
                                        </div>

                                        {item.excerpt && (
                                          <p className="text-[11px] text-slate-500 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                                            &ldquo;{item.excerpt}&rdquo;
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="self-start sm:self-center">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleActionItem(item.id, item.approved !== false)}
                                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                                          item.approved !== false
                                            ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                            : "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                                        }`}
                                      >
                                        {item.approved !== false ? "Reject" : "Approve"}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Blockers & Unresolved Questions */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedMeeting.analysis.unresolvedQuestions?.length > 0 && (
                              <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3.5 space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                                  <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
                                  <span>Unresolved Questions</span>
                                </h4>
                                <ul className="space-y-1 text-xs text-amber-900">
                                  {selectedMeeting.analysis.unresolvedQuestions.map((q, i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                      <span>•</span>
                                      <span>{q}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {selectedMeeting.analysis.blockers?.length > 0 && (
                              <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-3.5 space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                                  <span>Identified Blockers & Risks</span>
                                </h4>
                                <ul className="space-y-1 text-xs text-rose-900">
                                  {selectedMeeting.analysis.blockers.map((b, i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                      <span>•</span>
                                      <span>{b}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: Follow-Up Summary */}
                  {activeTab === "followup" && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">
                            Executive Follow-Up Document
                          </h3>
                          <p className="text-xs text-slate-500">
                            Pre-formatted summary containing decisions, approved action items, owners, and open questions.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopySummary}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                          >
                            {hasCopiedSummary ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            <span>{hasCopiedSummary ? "Copied!" : "Copy Markdown"}</span>
                          </button>

                          <button
                            onClick={handleDownloadSummary}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 shadow-xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download .md</span>
                          </button>
                        </div>
                      </div>

                      {/* Explicit Security Notice */}
                      <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-2.5 text-xs text-blue-800">
                        <Info className="h-4 w-4 shrink-0 text-blue-600" />
                        <span>
                          Privacy & Compliance: WorkMate AI does not dispatch external emails or notifications without explicit approval.
                        </span>
                      </div>

                      {/* Formatted Text Preview */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                        {selectedMeeting.followUpSummary || "Follow-up summary has not been generated yet. Please run AI Meeting Analysis."}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: Original Transcript */}
                  {activeTab === "transcript" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Filter transcript text..."
                            value={transcriptSearch}
                            onChange={(e) => setTranscriptSearch(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          {selectedMeeting.transcriptText.length} characters
                        </span>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4 max-h-[500px] overflow-y-auto font-sans text-xs leading-relaxed text-slate-700 space-y-3">
                        {selectedMeeting.transcriptSegments && selectedMeeting.transcriptSegments.length > 0 ? (
                          selectedMeeting.transcriptSegments
                            .filter(
                              (s) =>
                                !transcriptSearch ||
                                s.text.toLowerCase().includes(transcriptSearch.toLowerCase())
                            )
                            .map((seg) => (
                              <div
                                key={seg.id}
                                className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50"
                              >
                                <span className="font-mono text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded shrink-0">
                                  {formatTs(seg.start)}
                                </span>
                                <div>
                                  {seg.speaker && (
                                    <strong className="text-slate-900 block text-[11px]">
                                      {seg.speaker}
                                    </strong>
                                  )}
                                  <p>{seg.text}</p>
                                </div>
                              </div>
                            ))
                        ) : (
                          <div className="whitespace-pre-line font-serif text-xs leading-relaxed">
                            {selectedMeeting.transcriptText}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: Ask AI Q&A */}
                  {activeTab === "ask" && (
                    <div className="space-y-4">
                      <form onSubmit={handleAskMeeting} className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={askQuestion}
                          onChange={(e) => setAskQuestion(e.target.value)}
                          placeholder="e.g. What were the specific deadlines agreed for Maya?"
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        <button
                          type="submit"
                          disabled={isAsking}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                        >
                          {isAsking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          <span>Ask Meeting</span>
                        </button>
                      </form>

                      {askAnswer && (
                        <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 space-y-2 text-xs">
                          <span className="font-bold text-purple-800 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Grounded Answer</span>
                          </span>
                          <p className="text-slate-800 leading-relaxed whitespace-pre-line">
                            {askAnswer}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center">
                <Video className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-800">No meeting selected</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Choose a meeting from the library or create a new meeting to analyze transcript decisions and action items.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Create New Meeting */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                    <Video className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-[#172B4D]">
                    Add Meeting for AI Analysis
                  </h2>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Input Mode Selector */}
              <div className="grid grid-cols-3 gap-2 mt-4 border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setCreateMode("paste")}
                  className={`rounded-lg py-1.5 text-xs font-semibold text-center transition-colors ${
                    createMode === "paste"
                      ? "bg-purple-600 text-white shadow-2xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Paste Notes
                </button>

                <button
                  type="button"
                  onClick={() => setCreateMode("upload")}
                  className={`rounded-lg py-1.5 text-xs font-semibold text-center transition-colors ${
                    createMode === "upload"
                      ? "bg-purple-600 text-white shadow-2xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Upload File
                </button>

                <button
                  type="button"
                  onClick={() => setCreateMode("sample")}
                  className={`rounded-lg py-1.5 text-xs font-semibold text-center transition-colors ${
                    createMode === "sample"
                      ? "bg-purple-600 text-white shadow-2xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Sample Demo
                </button>
              </div>

              {modalError && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleCreateMeetingSubmit} className="mt-4 space-y-3.5 text-xs">
                {createMode !== "sample" && (
                  <>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Meeting Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={modalTitle}
                        onChange={(e) => setModalTitle(e.target.value)}
                        placeholder="e.g. Q4 Infrastructure Architecture Sync"
                        className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Meeting Type
                        </label>
                        <select
                          value={modalType}
                          onChange={(e) => setModalType(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="Sprint Planning Sync">Sprint Planning Sync</option>
                          <option value="Architecture Review">Architecture Review</option>
                          <option value="Client Onboarding">Client Onboarding</option>
                          <option value="Executive Review">Executive Review</option>
                          <option value="1-on-1 Catchup">1-on-1 Catchup</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Participants
                        </label>
                        <input
                          type="text"
                          value={modalParticipants}
                          onChange={(e) => setModalParticipants(e.target.value)}
                          placeholder="e.g. Alex, Maya, David"
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </>
                )}

                {createMode === "paste" && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Meeting Notes or Transcript Text *
                    </label>
                    <textarea
                      rows={6}
                      required
                      value={modalPastedText}
                      onChange={(e) => setModalPastedText(e.target.value)}
                      placeholder="Paste meeting discussion, transcript excerpts, or notes here..."
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                    />
                  </div>
                )}

                {createMode === "upload" && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Select Transcript or Audio/Video Recording *
                    </label>
                    <input
                      type="file"
                      required
                      accept=".txt,.docx,.pdf,.mp3,.wav,.m4a,.mp4,.webm"
                      onChange={(e) => setModalFile(e.target.files?.[0] || null)}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-purple-50 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-purple-700 hover:file:bg-purple-100"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Supported formats: TXT, DOCX, PDF transcripts, or MP3/WAV/MP4 audio recordings.
                    </p>
                  </div>
                )}

                {createMode === "sample" && (
                  <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 space-y-2">
                    <p className="font-bold text-slate-800">
                      Load Sprint 44 Standup & Security Review Demo
                    </p>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Instant sample featuring 3 participants (Alex, Maya, David) with explicit commitments (&ldquo;I commit to finishing rate limiting by tomorrow&rdquo;), agreed decisions, and open questions to test the execution engine immediately.
                    </p>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingModal}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 disabled:opacity-50"
                  >
                    {isSubmittingModal && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{isSubmittingModal ? "Analyzing..." : "Save & Analyze Meeting"}</span>
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
