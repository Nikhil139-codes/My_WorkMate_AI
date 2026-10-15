"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  Plus,
  ArrowRight,
  MoreVertical,
  Calendar,
  User,
  Layers,
  Sparkles,
  Link as LinkIcon,
  Video,
  X,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
  Loader2,
  ShieldAlert,
} from "lucide-react";

interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  owner?: string | null;
  dueDate?: string | null;
  isOverdue: boolean;
  dependencies: string[];
  unresolvedDependencies: string[];
  hasUnresolvedDependencies: boolean;
  meetingId?: string | null;
  sourceExcerpt?: string | null;
  isExplicitCommitment?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  blocked: number;
  completed: number;
  overdue: number;
}

export default function WorkflowsPage() {
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    workspaceName: string;
    role: string;
  } | null>(null);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    todo: 0,
    inProgress: 0,
    blocked: 0,
    completed: 0,
    overdue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [modalForm, setModalForm] = useState({
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    owner: "",
    dueDate: "",
    dependencies: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick Assign Owner State
  const [quickAssigningTaskId, setQuickAssigningTaskId] = useState<string | null>(null);
  const [quickOwnerInput, setQuickOwnerInput] = useState("");
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  // Load User Profile
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) setUserInfo(data.user);
      });
  }, []);

  // Fetch Tasks with filters
  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (priorityFilter !== "ALL") params.append("priority", priorityFilter);
      if (searchQuery.trim()) params.append("query", searchQuery.trim());

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Open Modal for New Task
  const handleOpenNewTask = () => {
    setEditingTask(null);
    setModalForm({
      title: "",
      description: "",
      status: "TODO",
      priority: "MEDIUM",
      owner: "",
      dueDate: "",
      dependencies: "",
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  // Open Modal for Editing Task
  const handleOpenEditTask = (task: TaskItem) => {
    setEditingTask(task);
    setModalForm({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      owner: task.owner && !/^(unknown|unassigned|none)$/i.test(task.owner) ? task.owner : "",
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
      dependencies: task.dependencies ? task.dependencies.join(", ") : "",
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  // Quick Status Toggle on Card
  const handleQuickStatusChange = async (task: TaskItem, newStatus: string) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Quick Owner Save on Card
  const handleSaveQuickOwner = async (taskId: string) => {
    setIsQuickSaving(true);
    try {
      const raw = quickOwnerInput.trim();
      const cleanOwner = raw && !/^(unassigned|unknown|none)$/i.test(raw) ? raw : null;
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: cleanOwner }),
      });
      if (res.ok) {
        setQuickAssigningTaskId(null);
        setQuickOwnerInput("");
        await fetchTasks();
      }
    } catch (err) {
      console.error("Failed to quick assign owner:", err);
    } finally {
      setIsQuickSaving(false);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error("Delete task failed:", err);
    }
  };

  // Save Modal Form (Create / Edit)
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.title.trim()) {
      setErrorMsg("Task title is required.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const rawOwner = modalForm.owner.trim();
    const cleanOwner = rawOwner && !/^(unassigned|unknown|none)$/i.test(rawOwner) ? rawOwner : null;

    const payload = {
      title: modalForm.title.trim(),
      description: modalForm.description.trim() || null,
      status: modalForm.status,
      priority: modalForm.priority,
      owner: cleanOwner,
      dueDate: modalForm.dueDate || null,
      dependencies: modalForm.dependencies
        .split(/[,;\n]/)
        .map((d) => d.trim())
        .filter(Boolean),
    };

    try {
      let res: Response;
      if (editingTask) {
        res = await fetch(`/api/tasks/${editingTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setIsModalOpen(false);
        fetchTasks();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to save task.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save task.");
    } finally {
      setIsSaving(false);
    }
  };

  const priorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-50 text-red-700 border-red-200";
      case "HIGH":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "MEDIUM":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "IN_PROGRESS":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "BLOCKED":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <AppShell
      pageTitle="Tasks & Workflows"
      userName={userInfo?.name || "Member"}
      userEmail={userInfo?.email || "user@workmate.ai"}
      workspaceName={userInfo?.workspaceName || "WorkMate AI"}
      userRole={userInfo?.role || "MEMBER"}
    >
      <div className="space-y-6">
        {/* Header with Title and Create Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-100">
                Phase 6 Engine
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[#172B4D]">
                Task Management & Execution
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Track approved meeting action items, resolve dependencies, and monitor execution velocity.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/meetings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <Video className="h-3.5 w-3.5 text-purple-600" />
              <span>Go to Meetings</span>
            </Link>

            <button
              onClick={handleOpenNewTask}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Task</span>
            </button>
          </div>
        </div>

        {/* 1. KPI Statistics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Total Tasks</span>
            <p className="text-xl font-bold text-[#172B4D] mt-0.5">{stats.total}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">To Do</span>
            <p className="text-xl font-bold text-slate-700 mt-0.5">{stats.todo}</p>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 shadow-2xs">
            <span className="text-[11px] font-medium text-indigo-600">In Progress</span>
            <p className="text-xl font-bold text-indigo-700 mt-0.5">{stats.inProgress}</p>
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3.5 shadow-2xs">
            <span className="text-[11px] font-medium text-rose-600">Blocked</span>
            <p className="text-xl font-bold text-rose-700 mt-0.5">{stats.blocked}</p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 shadow-2xs">
            <span className="text-[11px] font-medium text-emerald-600">Completed</span>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">{stats.completed}</p>
          </div>

          <div className={`rounded-xl border p-3.5 shadow-2xs ${
            stats.overdue > 0
              ? "border-red-200 bg-red-50/50 text-red-700"
              : "border-slate-200 bg-white text-slate-700"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium">Overdue</span>
              {stats.overdue > 0 && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
            </div>
            <p className="text-xl font-bold mt-0.5">{stats.overdue}</p>
          </div>
        </div>

        {/* 2. Filter & Search Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: "ALL", label: "All" },
              { id: "TODO", label: "To Do" },
              { id: "IN_PROGRESS", label: "In Progress" },
              { id: "BLOCKED", label: "Blocked" },
              { id: "COMPLETED", label: "Completed" },
              { id: "OVERDUE", label: "Overdue" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === tab.id
                    ? "bg-[#4F46E5] text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Priority Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks or owner..."
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
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        {/* 3. Task Cards List */}
        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#4F46E5]" />
            <p className="mt-2 text-xs text-slate-500">Loading workspace tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <CheckSquare className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No tasks found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {searchQuery || statusFilter !== "ALL" || priorityFilter !== "ALL"
                ? "No tasks match your selected filter criteria. Try resetting filters."
                : "Convert approved action items from your meeting transcripts, or create custom tasks to manage execution."}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Link
                href="/meetings"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Video className="h-3.5 w-3.5 text-purple-600" />
                <span>Open Meetings Studio</span>
              </Link>
              <button
                onClick={handleOpenNewTask}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Task</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`rounded-xl border bg-white p-4 transition-all shadow-2xs hover:shadow-xs ${
                  task.isOverdue
                    ? "border-red-200 bg-red-50/10"
                    : task.status === "COMPLETED"
                    ? "border-slate-200 bg-slate-50/40 opacity-80"
                    : "border-slate-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Left Column: Title, Description, Meta */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBadge(
                          task.status
                        )}`}
                      >
                        {task.status.replace("_", " ")}
                      </span>

                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityBadge(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>

                      {task.isExplicitCommitment && (
                        <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                          Explicit Commitment
                        </span>
                      )}

                      {task.isOverdue && (
                        <span className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          <span>OVERDUE</span>
                        </span>
                      )}

                      {task.hasUnresolvedDependencies && (
                        <span className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800" title={`Unresolved: ${task.unresolvedDependencies.join(", ")}`}>
                          <ShieldAlert className="h-3 w-3 text-amber-600" />
                          <span>Unresolved Dependencies ({task.unresolvedDependencies.length})</span>
                        </span>
                      )}
                    </div>

                    <h3 className={`text-sm font-bold ${
                      task.status === "COMPLETED" ? "line-through text-slate-500" : "text-[#172B4D]"
                    }`}>
                      {task.title}
                    </h3>

                    {task.description && (
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {/* Metadata strip */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                      {/* Owner Section with Instant Quick-Assign */}
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-slate-500 font-medium">Owner:</span>
                        {quickAssigningTaskId === task.id ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="text"
                              value={quickOwnerInput}
                              onChange={(e) => setQuickOwnerInput(e.target.value)}
                              placeholder="Enter owner name..."
                              autoFocus
                              disabled={isQuickSaving}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveQuickOwner(task.id);
                                if (e.key === "Escape") setQuickAssigningTaskId(null);
                              }}
                              className="rounded border border-indigo-400 bg-white px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36 shadow-2xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveQuickOwner(task.id)}
                              disabled={isQuickSaving}
                              className="rounded bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {isQuickSaving ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuickAssigningTaskId(null)}
                              disabled={isQuickSaving}
                              className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : task.owner ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50/70 px-2 py-0.5 text-xs font-semibold text-indigo-900 border border-indigo-100">
                            <span>{task.owner}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setQuickAssigningTaskId(task.id);
                                setQuickOwnerInput(task.owner || "");
                              }}
                              className="text-indigo-400 hover:text-indigo-700 transition-colors"
                              title="Edit assigned owner"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setQuickAssigningTaskId(task.id);
                              setQuickOwnerInput("");
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-colors"
                            title="Click to assign an owner"
                          >
                            <span>Unassigned</span>
                            <Plus className="h-3 w-3 text-amber-600" />
                          </button>
                        )}
                      </div>

                      {task.dueDate && (
                        <div className={`flex items-center gap-1 ${task.isOverdue ? "text-red-700 font-semibold" : ""}`}>
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>Due: {new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                      )}

                      {task.dependencies?.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5 text-slate-400" />
                          <span>Dependencies: {task.dependencies.join(", ")}</span>
                        </div>
                      )}

                      {task.meetingId && (
                        <Link
                          href="/meetings"
                          className="flex items-center gap-1 text-purple-600 hover:underline"
                        >
                          <Video className="h-3.5 w-3.5" />
                          <span>From Meeting Transcript</span>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions & Quick Status Switcher */}
                  <div className="flex items-center gap-2 self-start pt-1">
                    {/* Status Dropdown */}
                    <select
                      value={task.status}
                      onChange={(e) => handleQuickStatusChange(task, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="BLOCKED">Blocked</option>
                      <option value="COMPLETED">Completed</option>
                    </select>

                    <button
                      onClick={() => handleOpenEditTask(task)}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                      title="Edit task"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create / Edit Task */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-indigo-50 p-2 text-[#4F46E5]">
                    <CheckSquare className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-[#172B4D]">
                    {editingTask ? "Edit Workspace Task" : "Create New Task"}
                  </h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {errorMsg && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveModal} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={modalForm.title}
                    onChange={(e) => setModalForm({ ...modalForm, title: e.target.value })}
                    placeholder="e.g. Implement rate limiting on API endpoints"
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Description & Source Notes
                  </label>
                  <textarea
                    rows={2}
                    value={modalForm.description}
                    onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                    placeholder="Add background context, transcript excerpts, or acceptance criteria..."
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Status
                    </label>
                    <select
                      value={modalForm.status}
                      onChange={(e) => setModalForm({ ...modalForm, status: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="BLOCKED">Blocked</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={modalForm.priority}
                      onChange={(e) => setModalForm({ ...modalForm, priority: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Owner
                    </label>
                    <input
                      type="text"
                      value={modalForm.owner}
                      onChange={(e) => setModalForm({ ...modalForm, owner: e.target.value })}
                      placeholder="e.g. Alex Chen"
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={modalForm.dueDate}
                      onChange={(e) => setModalForm({ ...modalForm, dueDate: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Dependencies
                  </label>
                  <input
                    type="text"
                    value={modalForm.dependencies}
                    onChange={(e) => setModalForm({ ...modalForm, dependencies: e.target.value })}
                    placeholder="Comma-separated prerequisite tasks (e.g. DB Schema, Auth)"
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Tasks that must be completed before this task can progress.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>{editingTask ? "Save Changes" : "Create Task"}</span>
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
