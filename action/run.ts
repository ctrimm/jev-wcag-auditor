/** GitHub Action runner: audit a URL with the same pipeline as the app
 *  (axe-core in headless Chromium + optional Jev adjudication), then publish
 *  results as action outputs, a step summary, a report JSON artifact, and an
 *  optional PR comment.
 *
 *  Configuration comes from environment variables (set by action.yml):
 *    AUDIT_URL (required), AUDIT_WCAG_VERSIONS, AUDIT_INCLUDE_LEVEL_A,
 *    AUDIT_LAWS, AUDIT_JEV_MODE, TYPESAFE_API_KEY (for jev modes),
 *    AUDIT_FAIL_BELOW, AUDIT_COMMENT,
 *  plus the standard GITHUB_* variables.
 */
import fs from "node:fs";
import path from "node:path";
import { auditPage } from "../lib/axe_audit";
import { buildReport } from "../lib/combine";
import { buildJevAuditRequest, parseJevAnswers } from "../lib/jev_audit";
import { axeTagsFor } from "../lib/standards";
import type { AuditOptions, AuditReport } from "../lib/types";

const TYPESAFE_API_URL = "https://api.typesafe.ai/v1/systemone";
const COMMENT_MARKER = "<!-- jev-wcag-auditor -->";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

/** Node port of lib/jev_bridge.py's post_systemone: one Jev evaluation call. */
async function askJev(payload: unknown, bearer: string): Promise<Record<string, any>> {
  const RETRYABLE = new Set([429, 529]);
  let lastError = "unknown";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const resp = await fetch(TYPESAFE_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
      if (RETRYABLE.has(resp.status)) {
        lastError = `HTTP ${resp.status}`;
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (resp.status === 401 || resp.status === 403) {
        throw new Error(`TypeSafe auth rejected (HTTP ${resp.status}) — check typesafe-api-key.`);
      }
      if (!resp.ok) throw new Error(`TypeSafe request failed (HTTP ${resp.status})`);
      const data = (await resp.json()) as any;
      if (data?.error) throw new Error(String(data.error));
      return (data?.answers ?? {}) as Record<string, any>;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (/auth rejected|check typesafe-api-key/i.test(lastError)) throw err;
      if (attempt < 1) { await sleep(1000); continue; }
      throw new Error(`Jev request failed: ${lastError}`);
    }
  }
  throw new Error(`Jev request failed after retries: ${lastError}`);
}

function appendOutput(name: string, value: string | number) {
  const f = env("GITHUB_OUTPUT");
  if (f) fs.appendFileSync(f, `${name}=${value}\n`);
}

function appendSummary(md: string) {
  const f = env("GITHUB_STEP_SUMMARY");
  if (f) fs.appendFileSync(f, md + "\n");
}

function prNumber(): number | null {
  // Prefer the event payload; fall back to parsing refs/pull/N/merge.
  try {
    const p = env("GITHUB_EVENT_PATH");
    if (p && fs.existsSync(p)) {
      const n = (JSON.parse(fs.readFileSync(p, "utf8")) as any)?.pull_request?.number;
      if (typeof n === "number") return n;
    }
  } catch { /* fall through */ }
  const m = /^refs\/pull\/(\d+)\//.exec(env("GITHUB_REF"));
  return m ? parseInt(m[1], 10) : null;
}

async function upsertPrComment(body: string) {
  const token = env("GITHUB_TOKEN");
  const repo = env("GITHUB_REPOSITORY");
  const pr = prNumber();
  if (!token || !repo || !pr) {
    console.log("[action] skipping PR comment (no token, repo, or PR number)");
    return;
  }
  const [owner, name] = repo.split("/");
  const base = `https://api.github.com/repos/${owner}/${name}/issues/${pr}/comments`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "jev-wcag-auditor-action",
  };
  const full = `${COMMENT_MARKER}\n${body}`;
  const list = await (await fetch(`${base}?per_page=100`, { headers })).json() as any[];
  const existing = Array.isArray(list) ? list.find((c) => typeof c?.body === "string" && c.body.includes(COMMENT_MARKER)) : null;
  // Update the existing bot comment in place so PRs don't collect one comment per run.
  if (existing?.url) {
    const r = await fetch(existing.url, { method: "PATCH", headers, body: JSON.stringify({ body: full }) });
    if (!r.ok) throw new Error(`updating PR comment failed (HTTP ${r.status})`);
    console.log("[action] updated existing PR comment");
  } else {
    const r = await fetch(base, { method: "POST", headers, body: JSON.stringify({ body: full }) });
    if (!r.ok) throw new Error(`posting PR comment failed (HTTP ${r.status})`);
    console.log("[action] posted PR comment");
  }
}

function badgeLine(report: AuditReport): string {
  const pct = Math.round(report.score * 100);
  const [lo, hi] = report.band.map((v) => Math.round(v * 100));
  return `## Accessibility audit — ${pct}% of criteria pass\n\n` +
    `**URL:** ${report.finalUrl} · **Standards:** ${report.standardsApplied.join(", ") || "—"}` +
    `${report.lawsApplied.length ? ` · **Laws:** ${report.lawsApplied.map((l) => l.name).join(", ")}` : ""}` +
    `${report.jevMs != null ? " · Jev adjudicated judgement calls" : " · axe-core only"}\n\n` +
    `| Pass | Fail | Needs review | Uncertainty band |\n` +
    `|---|---|---|---|\n` +
    `| ${report.counts.pass} | ${report.counts.fail} | ${report.counts.needsReview} | ${lo}–${hi}% |\n`;
}

function findingsSection(report: AuditReport, maxItems: number): string {
  const actionable = report.criteria.filter((c) => c.verdict !== "pass");
  if (actionable.length === 0) return "\nAll checked criteria passed.\n";
  const icon = { fail: "[fail]", "needs-review": "[review]", pass: "[pass]" } as const;
  const lines = actionable.slice(0, maxItems).map(
    (c) => `- ${icon[c.verdict]} **WCAG ${c.criterionId} ${c.name}** (Level ${c.level}, ${Math.round(c.confidence * 100)}% confidence) — ${c.detail}`,
  );
  const more = actionable.length > maxItems ? `\n…and ${actionable.length - maxItems} more — see the full report JSON artifact.` : "";
  return `\n### Actionable findings (${actionable.length})\n\n${lines.join("\n")}${more}\n`;
}

async function main() {
  const rawUrl = env("AUDIT_URL").trim();
  if (!rawUrl) throw new Error("AUDIT_URL is required.");
  let url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  new URL(url); // throws on garbage

  const options: AuditOptions = {
    url,
    wcagVersions: env("AUDIT_WCAG_VERSIONS", "2.1").split(",").map((s) => s.trim()).filter(Boolean),
    includeLevelA: env("AUDIT_INCLUDE_LEVEL_A", "true").toLowerCase() === "true",
    laws: env("AUDIT_LAWS").split(",").map((s) => s.trim()).filter(Boolean),
    jevMode: (env("AUDIT_JEV_MODE", "off") as AuditOptions["jevMode"]),
  };
  if (!["off", "judgement", "full"].includes(options.jevMode)) throw new Error(`Unknown jev mode: ${options.jevMode}`);
  if (options.jevMode !== "off" && !env("TYPESAFE_API_KEY")) {
    throw new Error("TYPESAFE_API_KEY is required when jev-mode is not 'off'.");
  }

  console.log(`[action] auditing ${url} (WCAG ${options.wcagVersions.join(",")}, jev: ${options.jevMode})`);
  const startedAt = new Date().toISOString();
  const tags = axeTagsFor(options.wcagVersions, options.includeLevelA);
  const { finalUrl, axe, snapshot, axeMs } = await auditPage(url, tags);

  let adjudications: AuditReport["jevAdjudications"] = [];
  let jevMs: number | null = null;
  if (options.jevMode !== "off") {
    console.log("[action] asking Jev to adjudicate judgement calls…");
    const t0 = Date.now();
    const req = buildJevAuditRequest(url, snapshot, axe.violations, options.jevMode);
    const answers = await askJev({ state: req.state, model: req.model, questions: req.questions }, env("TYPESAFE_API_KEY"));
    adjudications = parseJevAnswers(req, answers);
    jevMs = Date.now() - t0;
  }

  const report = buildReport(
    `action-${env("GITHUB_SHA", "local").slice(0, 8)}`, url, finalUrl,
    snapshot.title || finalUrl, startedAt, options, axe, adjudications, axeMs, jevMs,
  );

  const workspace = env("GITHUB_WORKSPACE", process.cwd());
  const reportPath = path.join(workspace, "wcag-audit-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 1));
  console.log(`[action] report written to ${reportPath}`);

  const pct = Math.round(report.score * 100);
  appendOutput("score", pct);
  appendOutput("pass", report.counts.pass);
  appendOutput("fail", report.counts.fail);
  appendOutput("needs-review", report.counts.needsReview);
  appendOutput("criteria-total", report.counts.total);
  appendOutput("report-path", reportPath);

  const summary = badgeLine(report) + findingsSection(report, 15) +
    `\n<details><summary>Honesty notes</summary>\n\nAutomated checks catch roughly a third of real accessibility barriers. ` +
    `“Needs review” items need a human, ideally testing with assistive technology. ` +
    `Full machine-readable report: \`wcag-audit-report.json\` artifact.\n</details>\n`;
  appendSummary(summary);

  if (env("AUDIT_COMMENT", "true").toLowerCase() === "true" && env("GITHUB_EVENT_NAME") === "pull_request") {
    await upsertPrComment(summary);
  }

  const failBelow = parseFloat(env("AUDIT_FAIL_BELOW", "0"));
  if (failBelow > 0 && pct < failBelow) {
    throw new Error(`Accessibility score ${pct}% is below the required ${failBelow}%.`);
  }
  console.log(`[action] done — score ${pct}% (${report.counts.pass}/${report.counts.total} pass)`);
}

main().catch((err) => {
  console.error(`[action] ERROR: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
