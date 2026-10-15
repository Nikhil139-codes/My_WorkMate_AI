import Link from "next/link";
import { Sparkles, ArrowRight, Shield, Zap, Layers } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSessionUser();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFBFC]">
      {/* Top Navbar */}
      <header className="flex h-16 items-center justify-between border-b border-[#E2E8F0] bg-white px-6 md:px-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4F46E5] text-white shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-[#172B4D]">
              WorkMate AI
            </span>
            <span className="ml-2 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
              Enterprise v1.0
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-3.5 py-2 text-xs font-semibold text-[#172B4D] hover:bg-slate-100 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <span>Get Started</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3.5 py-1 text-xs font-semibold text-[#4F46E5] mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          <span>From Information to Action — Powered by Gemini AI</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#172B4D] leading-tight">
          The Intelligent Workspace for Enterprise Productivity
        </h1>

        <p className="mt-4 max-w-2xl text-sm md:text-base text-[#64748B] leading-relaxed">
          Unify organization knowledge, synthesize complex decisions, and automate everyday workflows with high-velocity LLM inference.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/register"
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-6 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition-colors"
          >
            <span>Create Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-6 py-3.5 text-sm font-semibold text-[#172B4D] hover:bg-slate-50 transition-colors"
          >
            <span>Sign In to Existing Workspace</span>
          </Link>
        </div>

        {/* Feature Pills */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full text-left">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-[#4F46E5] mb-3">
              <Zap className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-bold text-[#172B4D]">Groq LLM Acceleration</h2>
            <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
              Ultra-low latency conversational AI powered by Gemini for real-time executive assistance.
            </p>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-[#0D9488] mb-3">
              <Shield className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-bold text-[#172B4D]">Multi-Tenant Security</h2>
            <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
              Strict database-enforced organization isolation, encrypted tokens, and tamper-evident audit logging.
            </p>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 mb-3">
              <Layers className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-bold text-[#172B4D]">Modular Enterprise Extensibility</h2>
            <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
              Architecture ready for Document Intelligence, Data Prep, Meeting Synthesis, and Micro-Apps in Phase 2+.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#E2E8F0] bg-white py-6 text-center text-xs text-slate-400">
        WorkMate AI — Enterprise Productivity Platform • Phase 1 Release
      </footer>
    </div>
  );
}
