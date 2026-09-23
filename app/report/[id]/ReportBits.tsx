/** Shared presentational pieces for the interactive report and the print/PDF
 *  view. Pure markup + inline styles — no hooks — so both render identically. */
import type { AuditReport, CriterionResult, Verdict } from "@/lib/types";

export const BADGE: Record<Verdict, React.CSSProperties> = {
  pass: { background: "#e7f4e4", color: "#1f5c1f", border: "1px solid #a3d9a3" },
  fail: { background: "#fde8e8", color: "#9b1c1c", border: "1px solid #f5a3a3" },
  "needs-review": { background: "#fff3d6", color: "#7a5b00", border: "1px solid #e8c95c" },
};
export const LABEL: Record<Verdict, string> = { pass: "Pass", fail: "Fail", "needs-review": "Needs review" };

export function ScoreBand({ report }: { report: AuditReport }) {
  const [lo, hi] = report.band.map((v) => Math.round(v * 100));
  const mid = Math.round(report.score * 100);
  return (
    <div style={{ border: "1px solid #dfe1e2", borderRadius: 8, background: "#fff", padding: "18px 20px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 44, fontWeight: 800 }}>{mid}<span style={{ fontSize: 20, color: "#565c65" }}>%</span></div>
        <div>
          <div style={{ fontWeight: 700 }}>of checked criteria pass</div>
          <div style={{ color: "#565c65", fontSize: 14 }}>
            Uncertainty band {lo}–{hi}%: where the score lands once “needs review” items are resolved by a human.
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {(["pass", "fail", "needs-review"] as Verdict[]).map((v) => (
            <span key={v} style={{ ...BADGE[v], borderRadius: 999, padding: "4px 12px", fontSize: 13, fontWeight: 700 }}>
              {report.counts[v === "needs-review" ? "needsReview" : v]} {LABEL[v].toLowerCase()}
            </span>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, height: 12, borderRadius: 6, background: "#dfe1e2", position: "relative" }}>
        <div style={{ position: "absolute", left: `${lo}%`, width: `${Math.max(hi - lo, 1)}%`, top: 0, bottom: 0, background: "#e8c95c", borderRadius: 6 }} />
        <div style={{ position: "absolute", left: `${mid}%`, top: -4, bottom: -4, width: 3, background: "#005ea2", borderRadius: 2 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#565c65", marginTop: 4 }}>
        <span>0%</span><span style={{ color: "#005ea2" }}>■ measured score</span><span style={{ color: "#b39b2e" }}>■ uncertainty band</span><span>100%</span>
      </div>
    </div>
  );
}

export function CriterionRow({ c, print }: { c: CriterionResult; print?: boolean }) {
  const conf = Math.round(c.confidence * 100);
  return (
    <div className="prow" style={{ borderBottom: "1px solid #f0f0f0", padding: "12px 0" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...BADGE[c.verdict], borderRadius: 4, padding: "2px 10px", fontSize: 13, fontWeight: 700 }}>{LABEL[c.verdict]}</span>
        <strong>WCAG {c.criterionId} {c.name}</strong>
        <span style={{ fontSize: 12, color: "#565c65", border: "1px solid #dfe1e2", borderRadius: 4, padding: "1px 8px" }}>Level {c.level}</span>
        <span style={{ fontSize: 12, color: "#565c65", border: "1px solid #dfe1e2", borderRadius: 4, padding: "1px 8px" }} title="How this was checked">{c.basis}</span>
        {c.laws.length > 0 && (
          <span style={{ fontSize: 12, color: "#005ea2" }} title="Cited by these selected laws">{c.laws.join(" · ")}</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#565c65", display: "flex", alignItems: "center", gap: 6 }}>
          confidence
          <span style={{ width: 90, height: 8, background: "#dfe1e2", borderRadius: 4, display: "inline-block", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${conf}%`, background: conf >= 80 ? "#2e7d32" : conf >= 50 ? "#c49000" : "#b50909" }} />
          </span>
          {conf}%
        </span>
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 14, color: "#454540" }}>{c.detail}</p>
      {c.coverageNote && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#565c65", fontStyle: "italic" }}>{c.coverageNote}</p>}
      {c.examples.length > 0 && print ? (
        <div style={{ marginTop: 6 }}>
          {c.examples.slice(0, 2).map((ex, i) => (
            <pre key={i} style={{ background: "#f7f7f7", border: "1px solid #eee", borderRadius: 4, padding: 8, overflowX: "auto", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{ex}</pre>
          ))}
        </div>
      ) : c.examples.length > 0 ? (
        <details style={{ marginTop: 6, fontSize: 13 }}>
          <summary style={{ cursor: "pointer", color: "#005ea2" }}>Offending markup ({c.examples.length} shown)</summary>
          {c.examples.map((ex, i) => (
            <pre key={i} style={{ background: "#f7f7f7", border: "1px solid #eee", borderRadius: 4, padding: 8, overflowX: "auto", fontSize: 12 }}>{ex}</pre>
          ))}
        </details>
      ) : null}
      <a href={c.helpUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#005ea2" }}>About this criterion ↗</a>
    </div>
  );
}

export function JevAdjudicationList({ report }: { report: AuditReport }) {
  if (report.jevAdjudications.length === 0) return null;
  return (
    <section className="pcard" style={{ border: "1px solid #dfe1e2", borderRadius: 8, background: "#fff", padding: "18px 20px", marginBottom: 16 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Jev adjudications</h2>
      <p style={{ color: "#565c65", fontSize: 14, marginTop: 0 }}>
        One Jev evaluation call assessed the criteria automation can&rsquo;t fully decide
        {report.options.jevMode === "full" && " and second-opinioned the serious automated findings"}.
      </p>
      {report.jevAdjudications.map((a, i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #f0f0f0", fontSize: 14 }}>
          <span style={{ ...BADGE[a.verdict], borderRadius: 4, padding: "2px 10px", fontSize: 12, fontWeight: 700, height: "fit-content", whiteSpace: "nowrap" }}>{LABEL[a.verdict]}</span>
          <div>
            <strong>{a.subjectLabel}</strong>{" "}
            <span style={{ color: "#565c65" }}>({Math.round(a.confidence * 100)}% confidence)</span>
            <div style={{ color: "#454540" }}>{a.note}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
