"use client";

import { useEffect, useRef, useState } from "react";
import { LAWS } from "@/lib/standards";

type JevMode = "off" | "judgement" | "full";

const JEV_MODES: { id: JevMode; name: string; blurb: string }[] = [
  { id: "off", name: "axe-core only", blurb: "Deterministic checks only. Fastest; ambiguous items are marked needs-review." },
  { id: "judgement", name: "Jev judgement calls", blurb: "Axe-core plus one Jev evaluation for the semantic checks automation can't decide (alt-text quality, link purpose, heading meaning…). Recommended." },
  { id: "full", name: "Jev full page", blurb: "Everything in judgement-calls, plus Jev second-opinions every serious axe violation (agree / dispute / unsure)." },
];

export default function AuditForm() {
  const [url, setUrl] = useState("");
  const [jevMode, setJevMode] = useState<JevMode>("judgement");
  const [versions, setVersions] = useState<string[]>(["2.1"]);
  const [includeA, setIncludeA] = useState(true);
  const [laws, setLaws] = useState<string[]>(["508"]);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const toggleVersion = (v: string) =>
    setVersions((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const toggleLaw = (id: string) => {
    setLaws((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // A law's baseline version is always in scope while the law is selected.
      const law = LAWS.find((l) => l.id === id);
      if (law && !prev.includes(id)) {
        setVersions((vs) => (vs.includes(law.baseline.version) ? vs : [...vs, law.baseline.version]));
      }
      return next;
    });
  };

  const start = async () => {
    setError("");
    if (!url.trim()) { setError("Enter a URL to audit."); return; }
    if (versions.length === 0) { setError("Select at least one WCAG version."); return; }
    setRunning(true);
    setStage("Starting audit");
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, wcagVersions: versions, includeLevelA: includeA, laws, jevMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audit failed to start.");
      const id = data.id as string;
      timer.current = setInterval(async () => {
        const s = await fetch(`/api/audit/${id}`).then((r) => r.json());
        if (s.stage) setStage(s.stage);
        if (s.status === "done") {
          if (timer.current) clearInterval(timer.current);
          window.location.href = `/report/${id}`;
        } else if (s.status === "error") {
          if (timer.current) clearInterval(timer.current);
          setRunning(false);
          setError(s.error || "The audit failed.");
        }
      }, 2000);
    } catch (e) {
      setRunning(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const box: React.CSSProperties = { border: "1px solid #dfe1e2", borderRadius: 8, padding: "16px 18px", marginBottom: 16, background: "#fff" };
  const h3: React.CSSProperties = { margin: "0 0 8px", fontSize: 17 };
  const muted: React.CSSProperties = { color: "#565c65", fontSize: 14 };

  return (
    <div>
      <div style={box}>
        <h3 style={h3}>Page to audit</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !running) void start(); }}
            placeholder="https://www.usa.gov"
            disabled={running}
            style={{ flex: 1, padding: "10px 12px", fontSize: 16, border: "1px solid #565c65", borderRadius: 4 }}
          />
          <button
            onClick={() => void start()}
            disabled={running}
            style={{ padding: "10px 28px", fontSize: 16, fontWeight: 700, color: "#fff", background: running ? "#8a8d90" : "#005ea2", border: "none", borderRadius: 4, cursor: running ? "default" : "pointer" }}
          >
            {running ? "Auditing…" : "Run audit"}
          </button>
        </div>
        {url && !/\.gov(\/|$|:)/i.test(url) && (
          <p style={{ ...muted, margin: "8px 0 0" }}>Note: this auditor is built for <strong>.gov</strong> sites — it will still run on any public URL.</p>
        )}
        {running && <p style={{ margin: "12px 0 0" }}><span aria-hidden>◌ </span>{stage}…</p>}
        {error && <p style={{ color: "#b50909", margin: "12px 0 0" }}>{error}</p>}
      </div>

      <div style={box}>
        <h3 style={h3}>How Jev participates</h3>
        {JEV_MODES.map((m) => (
          <label key={m.id} style={{ display: "block", padding: "8px 0", cursor: "pointer" }}>
            <input type="radio" name="jevMode" checked={jevMode === m.id} onChange={() => setJevMode(m.id)} disabled={running} />
            {" "}<strong>{m.name}</strong>
            <div style={{ ...muted, marginLeft: 24 }}>{m.blurb}</div>
          </label>
        ))}
      </div>

      <div style={box}>
        <h3 style={h3}>Standards to check</h3>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {["2.0", "2.1", "2.2"].map((v) => (
            <label key={v} style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={versions.includes(v)} onChange={() => toggleVersion(v)} disabled={running} />
              {" "}WCAG {v}
            </label>
          ))}
          <label style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={includeA} onChange={(e) => setIncludeA(e.target.checked)} disabled={running} />
            {" "}Include Level A <span style={muted}>(AA selections always include A)</span>
          </label>
        </div>
      </div>

      <div style={box}>
        <h3 style={h3}>Laws & authorities</h3>
        <p style={{ ...muted, marginTop: 0 }}>Selecting a law adds its WCAG baseline to the check set and cites it on the report.</p>
        {LAWS.map((l) => (
          <label key={l.id} style={{ display: "block", padding: "8px 0", cursor: "pointer" }}>
            <input type="checkbox" checked={laws.includes(l.id)} onChange={() => toggleLaw(l.id)} disabled={running} />
            {" "}<strong>{l.short}</strong> <span style={muted}>— maps to WCAG {l.baseline.version} {l.baseline.level}</span>
            <div style={{ ...muted, marginLeft: 24 }}>{l.description}</div>
          </label>
        ))}
      </div>
    </div>
  );
}
