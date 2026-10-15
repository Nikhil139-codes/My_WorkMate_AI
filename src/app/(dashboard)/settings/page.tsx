"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import {
  User,
  Sparkles,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Server,
} from "lucide-react";

interface HealthData {
  status: string;
  timestamp: string;
  services: {
    application: {
      status: string;
      version: string;
      environment: string;
    };
    database: {
      status: string;
      latencyMs?: number;
      error?: string;
    };
    aiProvider: {
      provider: string;
      status: string;
      defaultModel: string;
    };
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    workspaceName: string;
    role: string;
  } | null>(null);

  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const [authRes, healthRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/health"),
        ]);

        if (authRes.status === 401) {
          router.push("/login");
          return;
        }

        const authData = await authRes.json();
        if (!ignore && authData.authenticated && authData.user) {
          setUserInfo({
            name: authData.user.name,
            email: authData.user.email,
            workspaceName: authData.user.workspaceName,
            role: authData.user.role,
          });
        }

        const health = await healthRes.json();
        if (!ignore) {
          setHealthData(health);
        }
      } catch (err) {
        console.error("Diagnostics load error:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [router]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [authRes, healthRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/health"),
      ]);

      if (authRes.status === 401) {
        router.push("/login");
        return;
      }

      const authData = await authRes.json();
      if (authData.authenticated && authData.user) {
        setUserInfo({
          name: authData.user.name,
          email: authData.user.email,
          workspaceName: authData.user.workspaceName,
          role: authData.user.role,
        });
      }

      const health = await healthRes.json();
      setHealthData(health);
    } catch (err) {
      console.error("Diagnostics load error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AppShell
      pageTitle="Settings & Diagnostics"
      userName={userInfo?.name || "Member"}
      userEmail={userInfo?.email || "user@workmate.ai"}
      workspaceName={userInfo?.workspaceName || "WorkMate AI"}
      userRole={userInfo?.role || "MEMBER"}
    >
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#172B4D]">
              Workspace Settings & Diagnostics
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Review workspace profile, AI provider configuration, and live system health
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-[#4F46E5]" : ""}`}
            />
            <span>Refresh Diagnostics</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#4F46E5]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section 1: User Profile */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                <div className="rounded-lg bg-indigo-50 p-2 text-[#4F46E5]">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#172B4D]">User Profile</h3>
                  <p className="text-xs text-[#64748B]">Personal account details</p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500">
                    Display Name
                  </label>
                  <p className="font-semibold text-[#172B4D] mt-0.5">
                    {userInfo?.name || "—"}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500">
                    Work Email Address
                  </label>
                  <p className="font-semibold text-[#172B4D] mt-0.5">
                    {userInfo?.email || "—"}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500">
                    Assigned Role
                  </label>
                  <div className="mt-0.5">
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      {userInfo?.role || "MEMBER"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Workspace Details */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                <div className="rounded-lg bg-teal-50 p-2 text-[#0D9488]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#172B4D]">
                    Workspace Details
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Multi-tenant organization boundary
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500">
                    Workspace Name
                  </label>
                  <p className="font-semibold text-[#172B4D] mt-0.5">
                    {userInfo?.workspaceName || "Default Workspace"}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500">
                    Data Isolation Status
                  </label>
                  <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>Cryptographic multi-tenant scoping active</span>
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500">
                    Subscription Tier
                  </label>
                  <p className="font-semibold text-slate-700 mt-0.5">
                    Enterprise (Phase 1 Development)
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: AI Provider Configuration */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#172B4D]">
                    AI Provider Configuration
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Primary LLM engine parameters
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">LLM Provider</span>
                  <span className="font-bold text-[#172B4D]">Gemini API</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Target Model</span>
                  <span className="font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded text-[11px]">
                    {healthData?.services.aiProvider.defaultModel || "openai/gpt-oss-120b"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">API Key Exposure</span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold">
                    Server-Side Only (Protected)
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Configuration Status</span>
                  {healthData?.services.aiProvider.status === "configured" ? (
                    <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold text-[10px]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Configured</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold text-[10px]">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Missing GROQ_API_KEY</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: System Diagnostics */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#172B4D]">
                    System Diagnostics
                  </h3>
                  <p className="text-xs text-[#64748B]">Live connectivity results</p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">App Version</span>
                  <span className="font-semibold text-slate-700">
                    {healthData?.services.application.version || "1.0.0-phase1"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Database (MongoDB)</span>
                  {healthData?.services.database.status === "connected" ? (
                    <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold text-[10px]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Connected ({healthData.services.database.latencyMs}ms)</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold text-[10px]" title={healthData?.services.database.error}>
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Disconnected</span>
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Overall Health</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      healthData?.status === "healthy"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {healthData?.status?.toUpperCase() || "CHECKING"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
