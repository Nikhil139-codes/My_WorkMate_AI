"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, AlertCircle, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, workspaceName }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          setFieldErrors(data.details);
        }
        setError(data.error || "Registration failed. Please check the form.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("An unexpected network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFBFC] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4F46E5] text-white shadow-md">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#172B4D]">
            Get Started with WorkMate AI
          </h1>
          <p className="mt-1 text-xs text-[#64748B]">
            Create your organization workspace and set up enterprise AI
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-xs">
          {error && (
            <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sarah Connor"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] px-3.5 py-2.5 text-xs text-[#172B4D] placeholder-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-hidden"
              />
              {fieldErrors.name && (
                <p className="mt-1 text-[11px] text-red-600">{fieldErrors.name[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">
                Work Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@acme-corp.com"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] px-3.5 py-2.5 text-xs text-[#172B4D] placeholder-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-hidden"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-[11px] text-red-600">{fieldErrors.email[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">
                Workspace / Organization Name
              </label>
              <input
                type="text"
                required
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Acme Technologies"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] px-3.5 py-2.5 text-xs text-[#172B4D] placeholder-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-hidden"
              />
              {fieldErrors.workspaceName && (
                <p className="mt-1 text-[11px] text-red-600">{fieldErrors.workspaceName[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">
                Password (min. 8 characters)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] px-3.5 py-2.5 text-xs text-[#172B4D] placeholder-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-hidden"
              />
              {fieldErrors.password && (
                <p className="mt-1 text-[11px] text-red-600">{fieldErrors.password[0]}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating Workspace...</span>
                </>
              ) : (
                <>
                  <span>Create Workspace & Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-[#F1F5F9] pt-4 text-center">
            <p className="text-xs text-[#64748B]">
              Already registered?{" "}
              <Link
                href="/login"
                className="font-semibold text-[#4F46E5] hover:underline"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* Multi-tenant note */}
        <div className="mt-6 rounded-lg border border-slate-200 bg-white/60 p-3 text-center">
          <p className="text-[11px] text-slate-500">
            🔒 Built with strict multi-tenant workspace isolation. Each workspace maintains dedicated cryptographic isolation and audit trails.
          </p>
        </div>
      </div>
    </div>
  );
}
