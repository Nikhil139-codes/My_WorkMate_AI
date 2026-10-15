"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";
import { BarChart3, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AnalyticsPage() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    workspaceName: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    router.replace("/risks");
  }, [router]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) setUserInfo(data.user);
      });
  }, []);

  return (
    <AppShell
      pageTitle="Productivity Analytics"
      userName={userInfo?.name || "Member"}
      userEmail={userInfo?.email || "user@workmate.ai"}
      workspaceName={userInfo?.workspaceName || "WorkMate AI"}
      userRole={userInfo?.role || "MEMBER"}
    >
      <PlaceholderPage
        title="Productivity Analytics & ROI Measurement"
        tagline="Quantify operational time saved, monitor AI adoption metrics, and optimize organizational throughput"
        icon={BarChart3}
        plannedPhase="Phase 7 Release"
        whatItDoes="Delivers executive-ready dashboards tracking aggregate time saved, user engagement across WorkMate AI modules, workflow completion rates, and tangible productivity improvements across departments."
        primaryUseCases={[
          "Measure aggregate engineering and operations hours saved across all active workspaces.",
          "Identify most frequently triggered AI workflows and high-impact automated processes.",
          "Track department-level adoption metrics and ROI reports for executive leadership.",
          "Analyze query performance, model latency, and prompt efficiency trends.",
        ]}
        technicalRoadmap={[
          "Audit event logging infrastructure — Established in Phase 1",
          "Workspace aggregate metrics API endpoint — Established in Phase 1",
          "Automated time-saved estimation heuristic algorithms — Scheduled for Phase 7",
          "Interactive analytics charts and PDF export reporting — Scheduled for Phase 7",
        ]}
      />
    </AppShell>
  );
}
