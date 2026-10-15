"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import {
  Blocks,
  Sparkles,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Download,
  Eye,
  Settings,
  Send,
  Star,
  RefreshCw,
  Sliders,
  Calendar,
  X,
  Lock,
  ChevronRight,
  Filter,
} from "lucide-react";
import { ALLOWED_FIELD_TYPES, AllowedFieldType } from "@/lib/micro-apps/specGenerator";

interface MicroAppField {
  id: string;
  label: string;
  type: AllowedFieldType;
  placeholder?: string;
  required: boolean;
  helpText?: string;
  options?: string[];
}

interface MicroAppItem {
  id: string;
  title: string;
  description: string;
  slug: string;
  status: "draft" | "published" | "expired" | "archived";
  category: string;
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    layout?: "card" | "full";
  };
  fields: MicroAppField[];
  settings: {
    submitButtonText: string;
    successMessage: string;
    allowMultipleSubmissions: boolean;
    requireAuth: boolean;
    expiresAt?: string | null;
  };
  submissionsCount: number;
  fieldsCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface SubmissionRecord {
  id: string;
  submittedAt: string;
  data: Record<string, any>;
}

const TEMPLATE_PROMPTS = [
  {
    name: "Product Feedback & NPS",
    icon: "🌟",
    prompt:
      "Customer feedback form with a 5-star product satisfaction rating, an NPS score number field (0 to 10), dropdown of primary feature used, textarea for suggestions, and optional email.",
  },
  {
    name: "Event RSVP & Dietary",
    icon: "🎟️",
    prompt:
      "All-hands offsite event registration form with attendee name, email, department dropdown, attendance date picker, multiselect for dietary preferences (Vegetarian, Vegan, Gluten-Free, Halal, None), and plus-one checkbox.",
  },
  {
    name: "IT Hardware Request",
    icon: "🛠️",
    prompt:
      "Internal IT equipment request form with employee name, work email, hardware category dropdown (Laptop, Monitor, Keyboard/Mouse, Headset), urgency level dropdown (Low, Medium, Critical), and justification textarea.",
  },
  {
    name: "Bug Report & Triage",
    icon: "🐛",
    prompt:
      "Software bug report form with bug title, module dropdown, severity rating (1 to 5), steps to reproduce multiline text, expected vs actual behavior, and reporter contact email.",
  },
  {
    name: "Employee 1-on-1 Sync",
    icon: "👥",
    prompt:
      "Manager 1-on-1 prep questionnaire with team member name, date, rating of weekly energy/morale (1-5), proudest accomplishment this sprint, roadblocks needing escalation, and topics for discussion.",
  },
];

export default function MicroAppsPage() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    workspaceName: string;
    role: string;
  } | null>(null);

  const [apps, setApps] = useState<MicroAppItem[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    expired: 0,
    totalSubmissions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Mode: "library" or "builder"
  const [viewMode, setViewMode] = useState<"library" | "builder">("library");

  // Builder State
  const [promptInput, setPromptInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // App being created or edited
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [appTitle, setAppTitle] = useState("");
  const [appDescription, setAppDescription] = useState("");
  const [appCategory, setAppCategory] = useState("feedback");
  const [appFields, setAppFields] = useState<MicroAppField[]>([]);
  const [appExpiryOption, setAppExpiryOption] = useState<string>("7d");
  const [submitBtnText, setSubmitBtnText] = useState("Submit Response");
  const [successMsg, setSuccessMsg] = useState("Thank you! Your response has been recorded.");
  const [primaryColor, setPrimaryColor] = useState("#4F46E5");
  const [isPublishing, setIsPublishing] = useState(false);
  const [copiedAppId, setCopiedAppId] = useState<string | null>(null);

  // Preview form test input state
  const [previewData, setPreviewData] = useState<Record<string, any>>({});

  // Submissions Drawer State
  const [selectedAppForSubs, setSelectedAppForSubs] = useState<MicroAppItem | null>(null);
  const [submissionsList, setSubmissionsList] = useState<SubmissionRecord[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Load User Profile
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) setUserInfo(data.user);
      });
  }, []);

  // Fetch Micro-Apps
  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/micro-apps");
      if (res.ok) {
        const data = await res.json();
        setApps(data.apps || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch micro-apps:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  // AI Prompt Spec Generation
  const handleGenerateSpec = async (customPrompt?: string) => {
    const text = customPrompt || promptInput;
    if (!text.trim() || isGenerating) return;

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const res = await fetch("/api/micro-apps/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setGenerationError(data.error || "Failed to generate micro-app specification");
        return;
      }

      const spec = data.specification;
      setAppTitle(spec.title);
      setAppDescription(spec.description || "");
      setAppCategory(spec.category || "custom");
      setAppFields(spec.fields || []);
      setPrimaryColor(spec.theme?.primaryColor || "#4F46E5");
      setSubmitBtnText(spec.settings?.submitButtonText || "Submit");
      setSuccessMsg(spec.settings?.successMessage || "Thank you! Your response has been recorded.");

      // Initialize preview data
      const initPreview: Record<string, any> = {};
      for (const f of spec.fields || []) {
        if (f.type === "checkbox") initPreview[f.id] = false;
        else if (f.type === "multiselect") initPreview[f.id] = [];
        else if (f.type === "rating") initPreview[f.id] = 0;
        else initPreview[f.id] = "";
      }
      setPreviewData(initPreview);

      setViewMode("builder");
    } catch (err: any) {
      setGenerationError(err.message || "Spec generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  // Add a new blank field
  const handleAddField = () => {
    const newId = `fld_${Date.now().toString(36)}`;
    const newField: MicroAppField = {
      id: newId,
      label: `New Field ${appFields.length + 1}`,
      type: "text",
      placeholder: "",
      required: false,
    };
    setAppFields([...appFields, newField]);
  };

  // Update a field property
  const handleUpdateField = (index: number, key: keyof MicroAppField, val: any) => {
    const updated = [...appFields];
    updated[index] = { ...updated[index], [key]: val };

    // If changing to select/multiselect and has no options, give defaults
    if ((key === "type" && val === "select") || val === "multiselect") {
      if (!updated[index].options || updated[index].options!.length === 0) {
        updated[index].options = ["Option 1", "Option 2", "Option 3"];
      }
    }
    setAppFields(updated);
  };

  // Remove a field
  const handleRemoveField = (index: number) => {
    setAppFields(appFields.filter((_, i) => i !== index));
  };

  // Save / Publish App
  const handleSaveApp = async (publishImmediately: boolean) => {
    if (!appTitle.trim()) {
      alert("Please provide a title for your micro-app.");
      return;
    }
    if (appFields.length === 0) {
      alert("App must have at least one field.");
      return;
    }

    setIsPublishing(true);

    try {
      const payload = {
        title: appTitle.trim(),
        description: appDescription.trim(),
        category: appCategory,
        theme: {
          primaryColor,
          backgroundColor: "#F8FAFC",
          layout: "card",
        },
        fields: appFields,
        settings: {
          submitButtonText: submitBtnText,
          successMessage: successMsg,
          allowMultipleSubmissions: true,
          requireAuth: false,
        },
        expiryOption: appExpiryOption,
        publishImmediately,
      };

      let res: Response;
      if (editingAppId) {
        res = await fetch(`/api/micro-apps/${editingAppId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            status: publishImmediately ? "published" : "draft",
          }),
        });
      } else {
        res = await fetch("/api/micro-apps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to save micro-app");
        return;
      }

      await fetchApps();
      setViewMode("library");
      setEditingAppId(null);
      setPromptInput("");
    } catch (err: any) {
      alert("Save error: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  // Toggle App Status (Expire / Republish)
  const handleToggleStatus = async (app: MicroAppItem) => {
    const nextStatus = app.status === "published" ? "expired" : "published";
    try {
      const res = await fetch(`/api/micro-apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          expiryOption: nextStatus === "published" ? "7d" : undefined,
        }),
      });
      if (res.ok) fetchApps();
    } catch (err) {
      console.error("Toggle status error:", err);
    }
  };

  // Delete App
  const handleDeleteApp = async (id: string) => {
    if (!confirm("Are you sure you want to delete this micro-app?")) return;
    try {
      const res = await fetch(`/api/micro-apps/${id}`, { method: "DELETE" });
      if (res.ok) fetchApps();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // Copy Public Link
  const handleCopyLink = (slug: string, id: string) => {
    const url = `${window.location.origin}/app/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedAppId(id);
    setTimeout(() => setCopiedAppId(null), 2000);
  };

  // Open Submissions Viewer
  const handleViewSubmissions = async (app: MicroAppItem) => {
    setSelectedAppForSubs(app);
    setLoadingSubs(true);
    try {
      const res = await fetch(`/api/micro-apps/${app.id}/submissions`);
      if (res.ok) {
        const data = await res.json();
        setSubmissionsList(data.submissions || []);
      }
    } catch (err) {
      console.error("Failed to load submissions:", err);
    } finally {
      setLoadingSubs(false);
    }
  };

  // Filter Apps in Library
  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.description && app.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppShell
      pageTitle="Micro-App Studio"
      userName={userInfo?.name || "Member"}
      userEmail={userInfo?.email || "user@workmate.ai"}
      workspaceName={userInfo?.workspaceName || "WorkMate AI"}
      userRole={userInfo?.role || "MEMBER"}
    >
      <div className="space-y-6">
        {/* ─── Hero Header & Stats ────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0A0A1F] p-6 text-white shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 text-xs font-semibold text-indigo-300">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span>Phase 5 • Disposable Micro-App Generator</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
                Micro-App Studio
              </h1>
              <p className="mt-1 text-xs md:text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
                Describe the tool or mini-application you need in plain English. Groq AI generates a
                secure, structured specification rendered with predefined React components. Share via
                unique link with configurable expiration and export submissions to CSV.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {viewMode === "builder" ? (
                <button
                  type="button"
                  onClick={() => setViewMode("library")}
                  className="rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 px-4 py-2 text-xs font-semibold text-white transition-colors"
                >
                  ← Back to Library
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAppId(null);
                    setAppTitle("Customer Feedback & CSAT Survey");
                    setAppDescription("Please share your feedback to help us improve our services.");
                    setAppCategory("feedback");
                    setAppFields([
                      {
                        id: "full_name",
                        label: "Full Name",
                        type: "text",
                        placeholder: "Jane Doe",
                        required: true,
                      },
                      {
                        id: "work_email",
                        label: "Work Email",
                        type: "email",
                        placeholder: "jane@company.com",
                        required: true,
                      },
                      {
                        id: "satisfaction_rating",
                        label: "Overall Satisfaction",
                        type: "rating",
                        required: true,
                      },
                      {
                        id: "primary_usage",
                        label: "Primary Feature Used",
                        type: "select",
                        options: ["Knowledge RAG", "Data Prep", "Meeting Intelligence", "Workflows"],
                        required: false,
                      },
                      {
                        id: "feedback_text",
                        label: "What can we do to improve?",
                        type: "textarea",
                        placeholder: "Share your thoughts...",
                        required: false,
                      },
                    ]);
                    setViewMode("builder");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-900/40 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Micro-App</span>
                </button>
              )}
            </div>
          </div>

          {/* Metrics bar */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-white/10 pt-4">
            <div className="rounded-xl bg-white/5 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/70">
                Total Micro-Apps
              </span>
              <p className="text-xl font-bold text-white mt-0.5">{stats.total}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/70">
                Active Published
              </span>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">{stats.published}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/70">
                Total Submissions
              </span>
              <p className="text-xl font-bold text-cyan-400 mt-0.5">{stats.totalSubmissions}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/70">
                Expired (Disposable)
              </span>
              <p className="text-xl font-bold text-amber-400 mt-0.5">{stats.expired}</p>
            </div>
          </div>
        </div>

        {/* ─── AI Prompt Bar (Available in both modes) ───────────────────────── */}
        <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span>Generate Mini-App with Gemini Natural Language AI</span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerateSpec();
            }}
            className="flex flex-col sm:flex-row items-stretch gap-2.5"
          >
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="e.g. Create a 5-star product feedback form with feature dropdown, NPS score, and suggestions..."
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <button
              type="submit"
              disabled={isGenerating || !promptInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>{isGenerating ? "Generating Spec..." : "Generate with Gemini"}</span>
            </button>
          </form>

          {generationError && (
            <p className="text-xs text-red-600 flex items-center gap-1 font-semibold">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{generationError}</span>
            </p>
          )}

          {/* Quick Template Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold text-slate-400">Templates:</span>
            {TEMPLATE_PROMPTS.map((t, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPromptInput(t.prompt);
                  handleGenerateSpec(t.prompt);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#FAFBFC] hover:bg-indigo-50 hover:border-indigo-300 px-2.5 py-1 text-[11px] text-slate-700 transition-all"
              >
                <span>{t.icon}</span>
                <span className="font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── Mode Switcher / View ───────────────────────────────────────────── */}
        {viewMode === "builder" ? (
          /* ─── BUILDER & PREVIEW WORKFLOW ─────────────────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Form Specification Editor (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-indigo-600" />
                  <span>Configure App Specification</span>
                </h2>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSaveApp(false)}
                    disabled={isPublishing}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Save as Draft
                  </button>

                  <button
                    onClick={() => handleSaveApp(true)}
                    disabled={isPublishing}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isPublishing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>Publish Micro-App</span>
                  </button>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    App Title *
                  </label>
                  <input
                    type="text"
                    value={appTitle}
                    onChange={(e) => setAppTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                    placeholder="e.g. Q4 Beta Customer Satisfaction Survey"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description / Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={appDescription}
                    onChange={(e) => setAppDescription(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-indigo-500 focus:outline-hidden"
                    placeholder="Explain what this form is for..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={appCategory}
                      onChange={(e) => setAppCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="feedback">Feedback</option>
                      <option value="survey">Survey</option>
                      <option value="registration">Registration</option>
                      <option value="request">Request / Ticket</option>
                      <option value="tracker">Tracker</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Disposable Expiration
                    </label>
                    <select
                      value={appExpiryOption}
                      onChange={(e) => setAppExpiryOption(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="1h">1 Hour (Single Session)</option>
                      <option value="24h">24 Hours (Daily Event)</option>
                      <option value="7d">7 Days (Weekly Sprint)</option>
                      <option value="30d">30 Days (Monthly Campaign)</option>
                      <option value="never">Never (Persistent)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Fields List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Form Fields ({appFields.length})
                  </span>

                  <button
                    type="button"
                    onClick={handleAddField}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Field</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {appFields.map((field, idx) => (
                    <div
                      key={field.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                          {idx + 1}
                        </span>

                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => handleUpdateField(idx, "label", e.target.value)}
                          placeholder="Field Label"
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                        />

                        <select
                          value={field.type}
                          onChange={(e) =>
                            handleUpdateField(idx, "type", e.target.value as AllowedFieldType)
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-hidden"
                        >
                          <option value="text">Text</option>
                          <option value="textarea">Textarea</option>
                          <option value="email">Email</option>
                          <option value="number">Number</option>
                          <option value="rating">Rating (1-5)</option>
                          <option value="select">Dropdown</option>
                          <option value="checkbox">Checkbox</option>
                          <option value="multiselect">Multiselect</option>
                          <option value="date">Date</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveField(idx)}
                          className="text-slate-400 hover:text-red-600 p-1"
                          title="Remove Field"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Options editor for select / multiselect */}
                      {["select", "multiselect"].includes(field.type) && (
                        <div className="pl-8 space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">
                            Comma-separated options:
                          </label>
                          <input
                            type="text"
                            value={(field.options || []).join(", ")}
                            onChange={(e) =>
                              handleUpdateField(
                                idx,
                                "options",
                                e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                              )
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                            placeholder="Option 1, Option 2, Option 3"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between pl-8 text-[11px] text-slate-500">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) =>
                              handleUpdateField(idx, "required", e.target.checked)
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                          />
                          <span>Required field</span>
                        </label>

                        <input
                          type="text"
                          value={field.placeholder || ""}
                          onChange={(e) =>
                            handleUpdateField(idx, "placeholder", e.target.value)
                          }
                          placeholder="Placeholder text (optional)"
                          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 max-w-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Behavior Settings */}
              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Submit Button Text
                  </label>
                  <input
                    type="text"
                    value={submitBtnText}
                    onChange={(e) => setSubmitBtnText(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Theme Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-7 w-12 rounded cursor-pointer border border-slate-200"
                    />
                    <span className="font-mono text-xs text-slate-500">{primaryColor}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Interactive Preview (5 cols) */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-indigo-600" />
                  <span>Real-time Interactive Preview</span>
                </span>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  Live Preview
                </span>
              </div>

              {/* Mock Form Container */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div className="h-1.5 w-full rounded" style={{ backgroundColor: primaryColor }} />

                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {appTitle || "Untitled Micro-App"}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {appDescription || "Form description will appear here..."}
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  {appFields.map((f) => (
                    <div key={f.id} className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        {f.label}
                        {f.required && <span className="text-red-500 ml-1 font-bold">*</span>}
                      </label>

                      {["text", "email", "number", "date"].includes(f.type) && (
                        <input
                          type={f.type}
                          placeholder={f.placeholder || ""}
                          value={previewData[f.id] || ""}
                          onChange={(e) =>
                            setPreviewData({ ...previewData, [f.id]: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                        />
                      )}

                      {f.type === "textarea" && (
                        <textarea
                          rows={2}
                          placeholder={f.placeholder || ""}
                          value={previewData[f.id] || ""}
                          onChange={(e) =>
                            setPreviewData({ ...previewData, [f.id]: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800"
                        />
                      )}

                      {f.type === "select" && (
                        <select
                          value={previewData[f.id] || ""}
                          onChange={(e) =>
                            setPreviewData({ ...previewData, [f.id]: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                        >
                          <option value="">Select an option...</option>
                          {(f.options || []).map((o, i) => (
                            <option key={i} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      )}

                      {f.type === "rating" && (
                        <div className="flex items-center gap-1 pt-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() =>
                                setPreviewData({ ...previewData, [f.id]: star })
                              }
                            >
                              <Star
                                className={`h-4 w-4 ${star <= Number(previewData[f.id] || 0)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-300"
                                  }`}
                              />
                            </button>
                          ))}
                        </div>
                      )}

                      {f.type === "checkbox" && (
                        <label className="flex items-center gap-2 pt-0.5 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(previewData[f.id])}
                            onChange={(e) =>
                              setPreviewData({ ...previewData, [f.id]: e.target.checked })
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                          />
                          <span>{f.placeholder || f.label}</span>
                        </label>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    className="w-full rounded-lg py-2 text-xs font-bold text-white shadow-xs"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {submitBtnText}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ─── APPS LIBRARY & MANAGEMENT VIEW ─────────────────────────────── */
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5">
                {(["all", "published", "draft", "expired"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${statusFilter === st
                      ? "bg-indigo-600 text-white shadow-xs font-bold"
                      : "text-slate-600 hover:bg-slate-100"
                      }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search micro-apps..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* Apps Grid */}
            {loading && apps.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <span>Loading workspace micro-apps...</span>
              </div>
            ) : filteredApps.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400 space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Blocks className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-700 text-sm">No micro-apps found</p>
                  <p className="text-[11px] mt-0.5">
                    Generate an app above using natural language or select a template.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredApps.map((item) => {
                  const isPublished = item.status === "published";
                  const isExpired = item.status === "expired";
                  const publicUrl = `/app/${item.slug}`;

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-indigo-200 transition-all group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            {item.category}
                          </span>

                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${isPublished
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isExpired
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-slate-100 text-slate-600"
                              }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                            {item.title}
                          </h3>
                          {item.description && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
                          <span>{item.fieldsCount || item.fields?.length || 0} fields</span>

                          <span className="font-bold text-indigo-700">
                            {item.submissionsCount || 0} submissions
                          </span>
                        </div>

                        {item.settings.expiresAt && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50/70 px-2 py-1 rounded-md font-mono">
                            <Clock className="h-3 w-3" />
                            <span>
                              {isExpired ? "Expired on " : "Expires on "}
                              {new Date(item.settings.expiresAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(item.slug, item.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 hover:bg-slate-50 px-2.5 py-1 text-xs text-slate-700 font-semibold transition-colors"
                            title="Copy Public Link"
                          >
                            {copiedAppId === item.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-emerald-700 font-bold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5 text-slate-500" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>

                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                            title="Open Live Public Form"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleViewSubmissions(item)}
                            className="rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 text-xs font-bold transition-colors"
                          >
                            Submissions
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item)}
                            className="rounded-lg p-1 text-slate-400 hover:text-amber-600 transition-colors"
                            title={isPublished ? "Deactivate / Expire App" : "Republish App"}
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteApp(item.id)}
                            className="rounded-lg p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete App"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Submissions Modal / Drawer ───────────────────────────────────────── */}
      {selectedAppForSubs && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setSelectedAppForSubs(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <span className="rounded bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[10px] font-bold uppercase">
                  Submissions Data
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedAppForSubs.title}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/micro-apps/${selectedAppForSubs.id}/submissions/export`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download CSV</span>
                </a>

                <button
                  onClick={() => setSelectedAppForSubs(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Submissions Content Table */}
            <div className="flex-1 overflow-auto p-5">
              {loadingSubs ? (
                <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                  <span>Loading submissions...</span>
                </div>
              ) : submissionsList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                  <p className="font-bold text-slate-700 text-sm">No submissions recorded yet</p>
                  <p className="text-[11px]">
                    Share the public URL to start collecting responses.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3">Submitted At</th>
                        {selectedAppForSubs.fields.map((f) => (
                          <th key={f.id} className="p-3">
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {submissionsList.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(sub.submittedAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          {selectedAppForSubs.fields.map((f) => {
                            const val = sub.data?.[f.id];
                            return (
                              <td key={f.id} className="p-3 max-w-xs truncate">
                                {val === undefined || val === null
                                  ? "-"
                                  : f.type === "rating"
                                    ? `⭐ ${val} / 5`
                                    : Array.isArray(val)
                                      ? val.join(", ")
                                      : typeof val === "boolean"
                                        ? val ? "Yes" : "No"
                                        : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
