/** Print/PDF version of the audit report — same visual design as the
 *  interactive report (shared ReportBits), tuned for paper: no interactive
 *  controls, rows kept intact across page breaks, offending markup expanded. */
import type { AuditReport, CriterionResult } from "@/lib/types";
import { ScoreBand, CriterionRow, JevAdjudicationList } from "../ReportBits";

const PRINCIPLES = ["Perceivable", "Operable", "Understandable", "Robust"] as const;

export default function PrintReport({ report }: { report: AuditReport }) {
  // Paper shows the actionable items only (fail + needs review); the full
  // criterion list lives in the interactive report. Keeps the PDF to ~2 pages.
  const actionable = report.criteria.filter((c) => c.verdict !== "pass");
  const passed = report.criteria.length - actionable.length;
  const byPrinciple = new Map<string, CriterionResult[]>();
  for (const c of actionable) {
    if (!byPrinciple.has(c.principle)) byPrinciple.set(c.principle, []);
    byPrinciple.get(c.principle)!.push(c);
  }
  const sec: React.CSSProperties = { border: "1px solid #dfe1e2", borderRadius: 8, background: "#fff", padding: "18px 20px", marginBottom: 16 };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#005ea2", letterSpacing: 1, textTransform: "uppercase" }}>Jev WCAG Auditor</div>
        <h1 style={{ fontSize: 26, margin: "4px 0 6px" }}>Accessibility audit report</h1>
        <div style={{ color: "#565c65", fontSize: 13 }}>
          {report.finalUrl} · audited {new Date(report.finishedAt).toLocaleString()}
        </div>
      </div>

      <ScoreBand report={report} />

      <div className="pcard" style={{ ...sec, fontSize: 13, color: "#565c65" }}>
        <div><strong style={{ color: "#1b1b1b" }}>Standards:</strong> {report.standardsApplied.join(", ") || "—"}
          {report.lawsApplied.length > 0 && <> · <strong style={{ color: "#1b1b1b" }}>Laws:</strong> {report.lawsApplied.map((l) => `${l.name} (${l.basis})`).join("; ")}</>}
        </div>
        <div style={{ marginTop: 4 }}>
          axe-core {report.axeSummary.violations} violations · {report.axeSummary.incomplete} needs-review · {report.axeSummary.passes} passed
          {report.jevMs != null && <> · Jev adjudication {(report.jevMs / 1000).toFixed(1)}s</>}
        </div>
      </div>

      {PRINCIPLES.map((p) => {
        const list = byPrinciple.get(p);
        if (!list || list.length === 0) return null;
        return (
          <section key={p} className="pcard" style={sec}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>{p}</h2>
            {list.map((c) => <CriterionRow key={c.criterionId} c={c} print />)}
          </section>
        );
      })}

      <JevAdjudicationList report={report} />

      <footer style={{ marginTop: 8, color: "#565c65", fontSize: 11, lineHeight: 1.4 }}>
        {passed > 0 && <>{passed} of {report.criteria.length} checked criteria passed — full list in the interactive report. </>}
        Automated checks catch roughly a third of barriers; “needs review” items need a human,
        ideally with assistive technology. Confidence: 95% axe-core, Jev&rsquo;s reported confidence otherwise. · {report.id}
      </footer>
    </div>
  );
}
