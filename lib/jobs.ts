/** Audit job lifecycle: jobs run in the background while the client polls. */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { auditPage } from "./axe_audit";
import { buildReport } from "./combine";
import { buildJevAuditRequest, parseJevAnswers } from "./jev_audit";
import { axeTagsFor } from "./standards";
import type { AuditJob, AuditOptions, AuditReport } from "./types";

const DATA = path.join(process.cwd(), "data", "reports");
const BRIDGE = path.join(process.cwd(), "lib", "jev_bridge.py");
const PYTHON = path.join(process.cwd(), ".venv", "bin", "python");

function jobPath(id: string) { return path.join(DATA, `${id}.job.json`); }
function reportPath(id: string) { return path.join(DATA, `${id}.json`); }

function writeJob(job: AuditJob) {
  fs.writeFileSync(jobPath(job.id), JSON.stringify(job));
}

export function getJob(id: string): AuditJob | null {
  try {
    return JSON.parse(fs.readFileSync(jobPath(id), "utf8"));
  } catch { return null; }
}

export function getReport(id: string): AuditReport | null {
  try {
    return JSON.parse(fs.readFileSync(reportPath(id), "utf8"));
  } catch { return null; }
}

export function listReports(): { id: string; url: string; finishedAt: string; score: number }[] {
  try {
    return fs.readdirSync(DATA)
      .filter((f) => f.endsWith(".json") && !f.endsWith(".job.json"))
      .map((f) => {
        const r = JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8")) as AuditReport;
        return { id: r.id, url: r.url, finishedAt: r.finishedAt, score: r.score };
      })
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  } catch { return []; }
}

async function askJev(payload: unknown): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [BRIDGE], { timeout: 120000 });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`jev bridge exited ${code}: ${stderr.slice(0, 400)}`));
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.error) reject(new Error(parsed.error));
        else resolve(parsed.answers as Record<string, any>);
      } catch { reject(new Error(`bad bridge output: ${stdout.slice(0, 300)}`)); }
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export function createJob(options: AuditOptions): AuditJob {
  const job: AuditJob = { id: randomUUID().slice(0, 8), status: "running", stage: "starting" };
  writeJob(job);
  // Run in background; the client polls GET /api/audit/[id].
  void runAudit(job.id, options).catch((err) => {
    writeJob({ ...job, status: "error", stage: "failed", error: err instanceof Error ? err.message : String(err) });
  });
  return job;
}

async function runAudit(id: string, options: AuditOptions): Promise<void> {
  const startedAt = new Date().toISOString();
  const setStage = (stage: string) => writeJob({ id, status: "running", stage });

  let url = options.url.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL must be http(s).");

  setStage("Loading page in headless Chromium");
  const tags = axeTagsFor(options.wcagVersions, options.includeLevelA);
  console.log(`[audit] tags for versions=${options.wcagVersions.join(",")}: ${tags.join(",")}`);
  const { finalUrl, axe, snapshot, axeMs } = await auditPage(url, tags);

  let adjudications: AuditReport["jevAdjudications"] = [];
  let jevMs: number | null = null;
  if (options.jevMode !== "off") {
    setStage("Jev is adjudicating judgement calls");
    const t0 = Date.now();
    const req = buildJevAuditRequest(url, snapshot, axe.violations, options.jevMode);
    const answers = await askJev({ state: req.state, model: req.model, questions: req.questions });
    adjudications = parseJevAnswers(req, answers);
    jevMs = Date.now() - t0;
  }

  setStage("Assembling report");
  const report = buildReport(
    id, url, finalUrl, snapshot.title || finalUrl, startedAt,
    { ...options, url }, axe, adjudications, axeMs, jevMs,
  );
  fs.writeFileSync(reportPath(id), JSON.stringify(report, null, 1));
  writeJob({ id, status: "done", stage: "done" });
}
