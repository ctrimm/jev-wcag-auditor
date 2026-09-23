import AuditForm from "./AuditForm";
import { listReports } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default function Home() {
  const recent = listReports().slice(0, 8);
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 20px 80px", fontFamily: "system-ui, sans-serif", color: "#1b1b1b", background: "#f7f7f7", minHeight: "100vh" }}>
      <p style={{ color: "#005ea2", fontWeight: 700, margin: "0 0 4px", fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>
        Jev WCAG Auditor
      </p>
      <h1 style={{ margin: "0 0 8px", fontSize: 34 }}>Is this .gov page accessible?</h1>
      <p style={{ color: "#565c65", fontSize: 17, maxWidth: 640 }}>
        Deterministic <strong>axe-core</strong> checks plus <strong>Jev</strong> adjudication of the
        judgement calls automation can&rsquo;t decide — each with a confidence score, combined into
        one report with an honest uncertainty band.
      </p>

      <div style={{ marginTop: 28 }}>
        <AuditForm />
      </div>

      {recent.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 20 }}>Recent audits</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {recent.map((r) => (
              <li key={r.id} style={{ border: "1px solid #dfe1e2", borderRadius: 8, background: "#fff", padding: "12px 16px", marginBottom: 8 }}>
                <a href={`/report/${r.id}`} style={{ color: "#005ea2", fontWeight: 600 }}>{r.url}</a>
                <span style={{ color: "#565c65", fontSize: 14, marginLeft: 12 }}>
                  {Math.round(r.score * 100)}% · {new Date(r.finishedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer style={{ marginTop: 48, color: "#565c65", fontSize: 13 }}>
        Automated checks catch roughly a third of accessibility barriers. Items marked
        “needs human review” genuinely need a person — ideally testing with a screen reader.
      </footer>
    </main>
  );
}
