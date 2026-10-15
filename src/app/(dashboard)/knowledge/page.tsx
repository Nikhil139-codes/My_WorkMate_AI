"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Bot,
  User,
  Clock,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  Database,
  Layers,
  Music,
  Video,
  ImageIcon,
  ExternalLink,
} from "lucide-react";

interface Citation {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  excerpt: string;
  /** Modality of this chunk */
  modality?: "text" | "ocr" | "audio_transcript" | "video_visual" | "video_transcript";
  /** Timestamp start in seconds */
  timestampStart?: number;
  /** Timestamp end in seconds */
  timestampEnd?: number;
  /** Human-readable range */
  formattedTimestamp?: string;
  /** Media type of the source */
  mediaType?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string;
  citations?: Citation[];
  createdAt: string;
}

interface ConversationItem {
  id: string;
  title: string;
  updatedAt: string;
  _count?: { messages: number };
}

interface DocumentOption {
  id: string;
  originalFilename: string;
  pageCount: number;
  processingStatus?: string;
}

function KnowledgeChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt");
  const docIdParam = searchParams.get("docId");
  const docNameParam = searchParams.get("docName");

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    workspaceName: string;
    role: string;
  } | null>(null);

  // RAG Mode & Scope states
  const [chatMode, setChatMode] = useState<"rag" | "general">("rag");
  const [workspaceDocuments, setWorkspaceDocuments] = useState<DocumentOption[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>(docIdParam || "");
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const [isIndexingDoc, setIsIndexingDoc] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load user info, conversations list, and workspace documents on mount
  useEffect(() => {
    async function init() {
      try {
        const [meRes, convRes, docRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/ai/conversations"),
          fetch("/api/documents"),
        ]);

        if (meRes.status === 401) {
          router.push("/login");
          return;
        }

        const meData = await meRes.json();
        if (meData.authenticated && meData.user) {
          setUserInfo({
            name: meData.user.name,
            email: meData.user.email,
            workspaceName: meData.user.workspaceName,
            role: meData.user.role,
          });
        }

        if (convRes.ok) {
          const convData = await convRes.json();
          setConversations(convData.conversations || []);

          if (initialPrompt && initialPrompt.trim()) {
            setInputValue(initialPrompt);
          }
        }

        if (docRes.ok) {
          const docData = await docRes.json();
          const docs: DocumentOption[] = (docData.documents || []).map((d: any) => ({
            id: d.id,
            originalFilename: d.originalFilename,
            pageCount: d.pageCount || 1,
            processingStatus: d.processingStatus,
          }));
          setWorkspaceDocuments(docs);

          if (docIdParam) {
            setSelectedDocumentId(docIdParam);
            setChatMode("rag");
          }
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }

    init();
  }, [router, initialPrompt, docIdParam]);

  const handleIndexNow = async (docId: string) => {
    setIsIndexingDoc(true);
    try {
      const res = await fetch(`/api/documents/${docId}/onboard/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const docRes = await fetch("/api/documents");
        if (docRes.ok) {
          const docData = await docRes.json();
          setWorkspaceDocuments(
            (docData.documents || []).map((d: any) => ({
              id: d.id,
              originalFilename: d.originalFilename,
              pageCount: d.pageCount || 1,
              processingStatus: d.processingStatus,
            }))
          );
        }
      }
    } catch (err) {
      console.error("Quick index failed:", err);
    } finally {
      setIsIndexingDoc(false);
    }
  };

  // Load selected conversation
  const loadConversation = async (id: string) => {
    setActiveConversationId(id);
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/ai/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.conversation?.messages || []);
      } else {
        setErrorMessage("Could not load conversation history.");
      }
    } catch {
      setErrorMessage("Network error while loading conversation.");
    } finally {
      setIsLoading(false);
    }
  };

  // Start new conversation
  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setErrorMessage(null);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Delete conversation
  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/ai/conversations/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          startNewConversation();
        }
      }
    } catch (err) {
      console.error("Delete conversation failed:", err);
    }
  };

  const toggleCitations = (msgId: string) => {
    setExpandedCitations((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  // Handle message sending
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    setErrorMessage(null);
    setIsLoading(true);

    // Optimistic local user message display
    const tempUserMessage: Message = {
      id: "temp-" + Date.now(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMessage]);
    setInputValue("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId || undefined,
          message: trimmed,
          mode: chatMode,
          documentIds: selectedDocumentId ? [selectedDocumentId] : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(
          data.error || "Groq AI request failed. Please check your configuration."
        );
        // Remove temporary message on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
        return;
      }

      // If new conversation was created on the server, update active state and list
      if (!activeConversationId && data.conversationId) {
        setActiveConversationId(data.conversationId);
        setConversations((prev) => [
          {
            id: data.conversationId,
            title: data.conversationTitle,
            updatedAt: new Date().toISOString(),
            _count: { messages: 2 },
          },
          ...prev,
        ]);
      }

      // Auto-expand citations for the new response if present
      if (data.assistantMessage?.citations?.length) {
        setExpandedCitations((prev) => ({
          ...prev,
          [data.assistantMessage.id]: true,
        }));
      }

      // Replace optimistic message with actual persisted messages
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMessage.id),
        data.userMessage,
        data.assistantMessage,
      ]);
    } catch {
      setErrorMessage("Network error while connecting to WorkMate AI server.");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <AppShell
      pageTitle="AI Knowledge"
      userName={userInfo?.name || "Member"}
      userEmail={userInfo?.email || "user@workmate.ai"}
      workspaceName={userInfo?.workspaceName || "WorkMate AI"}
      userRole={userInfo?.role || "MEMBER"}
    >
      <div className="flex h-[calc(100vh-8.5rem)] flex-col md:flex-row gap-4 overflow-hidden">
        {/* Left: Conversations Sidebar */}
        <div className="hidden md:flex w-72 flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden shrink-0">
          <div className="p-3 border-b border-[#F1F5F9]">
            <button
              type="button"
              onClick={startNewConversation}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              <span>New Conversation</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Saved Sessions
            </div>
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No past conversations. Start a session to begin.
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = activeConversationId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => loadConversation(conv.id)}
                    className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-colors ${isActive
                        ? "bg-indigo-50 text-[#4F46E5] font-semibold border border-indigo-100"
                        : "text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-600" />
                      <span className="truncate">{conv.title}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded transition-opacity"
                      title="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-[#F1F5F9] p-3 bg-[#FAFBFC] text-[11px] text-slate-500 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Gemini</span>
            </div>
            <span className="text-[10px] text-indigo-600 font-semibold uppercase">
              {chatMode}
            </span>
          </div>
        </div>

        {/* Right: Active Chat Area */}
        <div className="flex flex-1 flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
          {/* Top Bar with Mode Selector & Document Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] bg-[#FAFBFC] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-purple-600 text-white shadow-2xs">
                {chatMode === "rag" ? (
                  <Database className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </div>
              <div>
                <h2 className="text-xs font-bold text-[#172B4D] flex items-center gap-1.5">
                  <span>WorkMate AI Knowledge Assistant</span>
                  <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                    Phase 2 RAG
                  </span>
                </h2>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span>
                    {chatMode === "rag"
                      ? "Grounded Document Intelligence"
                      : "General LLM Intelligence"}
                  </span>
                  <span>•</span>
                  <span>{workspaceDocuments.length} Indexed Files</span>
                </div>
              </div>
            </div>

            {/* Mode Toggle & Document Scope Picker */}
            <div className="flex items-center gap-2">
              {/* Mode Toggle Button */}
              <div className="flex rounded-xl bg-slate-200/70 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setChatMode("rag")}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${chatMode === "rag"
                      ? "bg-white text-indigo-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <Database className="h-3.5 w-3.5" />
                  <span>RAG (Documents)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChatMode("general")}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${chatMode === "general"
                      ? "bg-white text-indigo-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>General AI</span>
                </button>
              </div>

              {/* Document Scope Filter (only visible in RAG mode) */}
              {chatMode === "rag" && (
                <select
                  value={selectedDocumentId}
                  onChange={(e) => setSelectedDocumentId(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-[#4F46E5] focus:outline-hidden max-w-[200px] truncate shadow-2xs"
                >
                  <option value="">All Workspace Files ({workspaceDocuments.length})</option>
                  {workspaceDocuments.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.originalFilename} {doc.processingStatus === "READY" ? "✓" : "(Pending)"}
                    </option>
                  ))}
                </select>
              )}

              {/* Mobile New Chat trigger */}
              <button
                type="button"
                onClick={startNewConversation}
                className="md:hidden inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
              >
                <Plus className="h-3 w-3" />
                <span>New</span>
              </button>
            </div>
          </div>

          {/* Inline alert if the selected document is still PENDING */}
          {chatMode === "rag" && selectedDocumentId && (() => {
            const currentDoc = workspaceDocuments.find((d) => d.id === selectedDocumentId);
            if (currentDoc && currentDoc.processingStatus === "PENDING") {
              return (
                <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>{currentDoc.originalFilename}</strong> is awaiting indexing. Click below to index it with AI configuration so your questions can be answered.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleIndexNow(currentDoc.id)}
                    disabled={isIndexingDoc}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-2xs shrink-0"
                  >
                    {isIndexingDoc ? "Indexing..." : "Index Now"}
                  </button>
                </div>
              );
            }
            return null;
          })()}

          {/* RAG Grounding Notice Banner */}
          {chatMode === "rag" ? (
            <div className="border-b border-indigo-100 bg-indigo-50/60 px-4 py-2 text-[11px] text-indigo-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 shrink-0 text-[#4F46E5]" />
                <span>
                  <strong>Grounded RAG Mode Active:</strong> Answers are retrieved strictly from your authorized workspace documents with source page citations.
                </span>
              </div>
              <a
                href="/documents"
                className="text-[11px] font-semibold text-indigo-600 hover:underline shrink-0"
              >
                Manage Files &rarr;
              </a>
            </div>
          ) : (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-[11px] text-slate-600 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-slate-400" />
              <span>General Assistant Mode: Answers without document retrieval.</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{errorMessage}</p>
                <p className="text-[11px] text-red-600 mt-0.5">
                  Check your Gemini API configuration or ensure GROQ_API_KEY is configured in your environment.
                </p>
              </div>
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-6 max-w-lg mx-auto">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-[#4F46E5] mb-4">
                  {chatMode === "rag" ? (
                    <Database className="h-7 w-7" />
                  ) : (
                    <Sparkles className="h-7 w-7" />
                  )}
                </div>
                <h3 className="text-base font-bold text-[#172B4D]">
                  {chatMode === "rag"
                    ? "Ask questions grounded in your workspace documents"
                    : "How can WorkMate AI assist you today?"}
                </h3>
                <p className="mt-1 text-xs text-[#64748B] leading-relaxed">
                  {chatMode === "rag"
                    ? "Queries are matched against your indexed PDF, DOCX, CSV, and TXT files, returning exact facts and source page citations."
                    : "Draft communications, synthesize workflows, or brainstorm technical architectures."}
                </p>

                {chatMode === "rag" && workspaceDocuments.length === 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-semibold">No indexed documents yet</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Go to <a href="/documents" className="underline font-bold">Document Intelligence</a> to upload and onboard your first file.
                    </p>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue(
                        chatMode === "rag"
                          ? "What are the primary findings and conclusions in our documents?"
                          : "Draft a formal executive summary for an enterprise AI implementation initiative."
                      );
                    }}
                    className="rounded-xl border border-slate-200 bg-[#FAFBFC] p-3 text-xs text-slate-700 hover:border-indigo-300 hover:bg-white transition-all shadow-2xs"
                  >
                    💡 {chatMode === "rag" ? "Summarize document findings" : "Executive AI summary"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue(
                        chatMode === "rag"
                          ? "What are the key contractual deadlines, obligations, or financial metrics?"
                          : "Outline a comprehensive QA checklist for a SaaS product release."
                      );
                    }}
                    className="rounded-xl border border-slate-200 bg-[#FAFBFC] p-3 text-xs text-slate-700 hover:border-indigo-300 hover:bg-white transition-all shadow-2xs"
                  >
                    📋 {chatMode === "rag" ? "Deadlines & financial metrics" : "QA Release Checklist"}
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === "user";
                const hasCitations = msg.citations && msg.citations.length > 0;
                const isExpanded = expandedCitations[msg.id];

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                      }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${isUser
                          ? "bg-[#4F46E5] text-white"
                          : "bg-teal-50 text-[#0D9488] border border-teal-200"
                        }`}
                    >
                      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>

                    {/* Content Bubble */}
                    <div className="space-y-2 max-w-2xl">
                      <div
                        className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${isUser
                            ? "bg-[#4F46E5] text-white shadow-2xs"
                            : "bg-[#F8FAFC] text-[#172B4D] border border-[#E2E8F0]"
                          }`}
                      >
                        <MarkdownContent content={msg.content} isUser={isUser} />
                      </div>

                      {/* Source Citations Block for RAG Assistant responses */}
                      {!isUser && hasCitations && (
                        <div className="rounded-xl border border-indigo-100 bg-white overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => toggleCitations(msg.id)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-indigo-50/50 text-left hover:bg-indigo-50 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-800">
                              <Layers className="h-3.5 w-3.5 text-[#4F46E5]" />
                              <span>Grounded Sources ({msg.citations!.length})</span>
                            </div>
                            <div className="text-indigo-600">
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="p-2.5 space-y-2 divide-y divide-slate-100">
                              {msg.citations!.map((cit, idx) => {
                                const isAudio = cit.mediaType === "audio" || cit.modality === "audio_transcript";
                                const isVideo = cit.mediaType === "video" || cit.modality === "video_transcript" || cit.modality === "video_visual";
                                const isImage = cit.mediaType === "image" || cit.modality === "ocr";

                                let MediaIcon = FileText;
                                let iconColor = "text-indigo-500";
                                if (isAudio) {
                                  MediaIcon = Music;
                                  iconColor = "text-amber-500";
                                } else if (isVideo) {
                                  MediaIcon = Video;
                                  iconColor = "text-purple-500";
                                } else if (isImage) {
                                  MediaIcon = ImageIcon;
                                  iconColor = "text-sky-500";
                                }

                                return (
                                  <div key={idx} className="pt-2 first:pt-0 space-y-1">
                                    <div className="flex items-center justify-between gap-2 text-[10px]">
                                      <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate max-w-xs">
                                        <MediaIcon className={`h-3 w-3 ${iconColor} shrink-0`} />
                                        <span className="truncate">{cit.documentName}</span>
                                      </span>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {/* Modality Tag */}
                                        {cit.modality === "ocr" && (
                                          <span className="rounded-md bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 font-semibold">
                                            OCR
                                          </span>
                                        )}
                                        {cit.modality === "audio_transcript" && (
                                          <span className="rounded-md bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 font-semibold">
                                            Audio
                                          </span>
                                        )}
                                        {cit.modality === "video_transcript" && (
                                          <span className="rounded-md bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 font-semibold">
                                            Video Audio
                                          </span>
                                        )}
                                        {cit.modality === "video_visual" && (
                                          <span className="rounded-md bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 px-1.5 py-0.5 font-semibold">
                                            Video Frame
                                          </span>
                                        )}

                                        {/* Timestamp badge if audio/video */}
                                        {cit.formattedTimestamp ? (
                                          <a
                                            href={`/documents?docId=${cit.documentId}&t=${cit.timestampStart || 0}`}
                                            className="inline-flex items-center gap-1 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 px-1.5 py-0.5 font-mono font-semibold transition-colors"
                                            title="View in Document Library"
                                          >
                                            <Clock className="h-2.5 w-2.5" />
                                            <span>{cit.formattedTimestamp}</span>
                                            <ExternalLink className="h-2 w-2 opacity-60" />
                                          </a>
                                        ) : (
                                          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-700">
                                            Page {cit.pageNumber}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-[11px] text-slate-600 font-mono bg-slate-50/80 p-2 rounded-lg leading-relaxed">
                                      &ldquo;{cit.excerpt}&rdquo;
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Timestamp & Model Metadata */}
                      <div
                        className={`flex items-center gap-1.5 text-[10px] text-slate-400 px-1 ${isUser ? "justify-end" : "justify-start"
                          }`}
                      >
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {!isUser && msg.modelId && (
                          <span className="font-mono text-slate-400">
                            • {msg.modelId}
                          </span>
                        )}
                        {!isUser && hasCitations && (
                          <span className="text-emerald-600 font-medium">
                            • Grounded in {msg.citations!.length} sources
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3 max-w-3xl mr-auto">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[#0D9488] border border-teal-200">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3 text-xs text-slate-600 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#4F46E5]" />
                  <span>
                    {chatMode === "rag"
                      ? "WorkMate AI is searching workspace vectors and grounding response..."
                      : "Groq AI is processing your request..."}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box Footer */}
          <div className="border-t border-[#E2E8F0] bg-white p-3 md:p-4">
            <form onSubmit={handleSendMessage} className="relative">
              <textarea
                ref={textareaRef}
                rows={2}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  chatMode === "rag"
                    ? "Ask anything grounded in your documents... (Press Enter to send, Shift+Enter for new line)"
                    : "Message WorkMate AI... (Press Enter to send, Shift+Enter for new line)"
                }
                className="w-full resize-none rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-3 pr-12 text-xs md:text-sm text-[#172B4D] placeholder-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-hidden"
              />

              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="absolute right-3 bottom-3.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#4F46E5] text-white shadow-xs hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#4F46E5]" />
        </div>
      }
    >
      <KnowledgeChatContent />
    </Suspense>
  );
}
