import Link from "next/link";
import { LucideIcon, ArrowRight, Sparkles, Layers, ShieldCheck } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  tagline: string;
  icon: LucideIcon;
  plannedPhase: string;
  whatItDoes: string;
  primaryUseCases: string[];
  technicalRoadmap: string[];
}

export function PlaceholderPage({
  title,
  tagline,
  icon: Icon,
  plannedPhase,
  whatItDoes,
  primaryUseCases,
  technicalRoadmap,
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      {/* Banner Card */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#F1F5F9] pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5] border border-indigo-100">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-[#172B4D]">
                  {title}
                </h2>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                  {plannedPhase}
                </span>
              </div>
              <p className="text-sm text-[#64748B] mt-0.5">{tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/knowledge"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Use Active AI Knowledge</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Phase Boundary Disclaimer */}
        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-blue-900">
                Phase 1 Architecture Boundary
              </h4>
              <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                This module is designated for implementation in a future development phase ({plannedPhase}).
                In accordance with enterprise architectural principles, no fabricated mock actions are provided.
                The underlying schema foundation, database models, and authentication isolation are already established.
              </p>
            </div>
          </div>
        </div>

        {/* Content Details Grid */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Module Capabilities */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#172B4D]">
              <Layers className="h-4 w-4 text-[#4F46E5]" />
              <span>What this module will do</span>
            </h3>
            <p className="text-xs text-[#475569] mt-2 leading-relaxed">
              {whatItDoes}
            </p>

            <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mt-5 mb-2">
              Primary Enterprise Use Cases
            </h4>
            <ul className="space-y-2">
              {primaryUseCases.map((useCase, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-xs text-[#334155]"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{useCase}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Technical Integration Plan */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#172B4D]">
              <Sparkles className="h-4 w-4 text-[#0D9488]" />
              <span>Engineering & Integration Plan</span>
            </h3>
            <p className="text-xs text-[#475569] mt-2 leading-relaxed">
              The WorkMate AI Phase 1 foundation provides the storage abstraction, MongoDB schemas, and Groq backend
              needed to power this subsystem upon Phase release.
            </p>

            <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mt-5 mb-2">
              Planned Deliverables
            </h4>
            <ul className="space-y-2">
              {technicalRoadmap.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-2 text-xs text-[#334155]"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-[#0D9488]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
