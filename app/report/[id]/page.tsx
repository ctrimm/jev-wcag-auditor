import { notFound } from "next/navigation";
import ReportView from "./ReportView";
import { getReport } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = getReport(id);
  if (!report) notFound();
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px 80px", fontFamily: "system-ui, sans-serif", color: "#1b1b1b", background: "#f7f7f7", minHeight: "100vh" }}>
      <a href="/" style={{ color: "#005ea2", fontSize: 14 }}>← New audit</a>
      <h1 style={{ fontSize: 28, margin: "8px 0 16px" }}>Accessibility audit report</h1>
      <ReportView report={report} />
      <footer style={{ marginTop: 32, color: "#565c65", fontSize: 13 }}>
        Automated checks catch roughly a third of accessibility barriers. Items marked
        “needs review” genuinely need a person — ideally testing with assistive technology.
        Confidence scores: {0.95 * 100}% for deterministic axe-core checks, Jev&rsquo;s reported
        confidence for judgement calls.
      </footer>
    </main>
  );
}
