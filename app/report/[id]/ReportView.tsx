"use client";

import { useMemo, useState } from "react";
import type { AuditReport, CriterionResult, Verdict } from "@/lib/types";
import { LABEL, ScoreBand, CriterionRow, JevAdjudicationList } from "./ReportBits";

const PRINCIPLES = ["Perceivable", "Operable", "Understandable", "Robust"] as const;

export default function ReportView({ report }: { report: AuditReport }) {
  const [filter, setFilter] = useState<"all" | Verdict>("all");
  const filtered = useMemo(
    () => (filter === "all" ? report.criteria : report.criteria.filter((c) => c.verdict === filter)),
    [report, filter],
  );
  const byPrinciple = useMemo(() => {
    const m = new Map<string, CriterionResult[]>();
    for (const c of filtered) {
      if (!m.has(c.principle)) m.set(c.principle, []);
      m.get(c.principle)!.push(c);
    }
    return m;
  }, [filtered]);

  const sec: React.CSSProperties = { border: "1px solid #dfe1e2", borderRadius: 8, background: "#fff", padding: "18px 20px", marginBottom: 16 };

  return (
    <div>
      <ScoreBand report={report} />

      <div style={{ ...sec, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", fontSize: 14 }}>
        <div style={{ flex: "1 1 300px" }}>
          <div><strong>Page:</strong> <a href={report.finalUrl} target="_blank" rel="noreferrer" style={{ color: "#005ea2" }}>{report.finalUrl}</a></div>
          <div style={{ color: "#565c65" }}>{report.title} · audited {new Date(report.finishedAt).toLocaleString()}</div>
          <div style={{ color: "#565c65", marginTop: 4 }}>
            Standards: {report.standardsApplied.join(", ") || "—"}
            {report.lawsApplied.length > 0 && <> · Laws: {report.lawsApplied.map((l) => `${l.name} (${l.basis})`).join("; ")}</>}
          </div>
          <div style={{ color: "#565c65" }}>
            axe-core {report.axeSummary.violations} violations · {report.axeSummary.incomplete} needs-review · {report.axeSummary.passes} passed
            {report.jevMs != null && <> · Jev adjudication {(report.jevMs / 1000).toFixed(1)}s</>}
          </div>
        </div>
        <a
          href={`/api/report/${report.id}/pdf`}
          style={{ padding: "10px 22px", background: "#005ea2", color: "#fff", fontWeight: 700, borderRadius: 4, textDecoration: "none", whiteSpace: "nowrap" }}
        >
          Download PDF
        </a>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["all", "fail", "needs-review", "pass"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 16px", borderRadius: 999, border: "1px solid #005ea2", cursor: "pointer",
              background: filter === f ? "#005ea2" : "#fff", color: filter === f ? "#fff" : "#005ea2", fontWeight: 600,
            }}
          >
            {f === "all" ? `All (${report.criteria.length})` : `${LABEL[f]} (${report.counts[f === "needs-review" ? "needsReview" : f]})`}
          </button>
        ))}
      </div>

      {PRINCIPLES.map((p) => {
        const list = byPrinciple.get(p);
        if (!list || list.length === 0) return null;
        return (
          <section key={p} style={sec}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>{p}</h2>
            {list.map((c) => <CriterionRow key={c.criterionId} c={c} />)}
          </section>
        );
      })}

      <JevAdjudicationList report={report} />
    </div>
  );
}
