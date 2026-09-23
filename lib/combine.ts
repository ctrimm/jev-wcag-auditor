/** Merge deterministic axe-core findings with Jev adjudications into a single
 *  confidence-scored WCAG report. */
import { CRITERIA, LAWS, criteriaInScope, type Criterion } from "./standards";
import type {
  AuditOptions,
  AuditReport,
  AxeResults,
  CriterionResult,
  JevAdjudication,
  Verdict,
} from "./types";

const AXE_CONFIDENCE = 0.95; // deterministic, but page-state dependent

function rulesForTags(axe: AxeResults, tags: string[]) {
  const has = (r: { tags: string[] }) => tags.some((t) => r.tags.includes(t));
  return {
    violations: axe.violations.filter(has),
    passes: axe.passes.filter(has),
    incomplete: axe.incomplete.filter(has),
  };
}

function lawsCovering(c: Criterion, lawIds: string[]): string[] {
  return lawIds.filter((id) => {
    const law = LAWS.find((l) => l.id === id);
    if (!law) return false;
    return c.versions.some((v) => v >= law.baseline.version);
  });
}

export function buildReport(
  id: string,
  url: string,
  finalUrl: string,
  title: string,
  startedAt: string,
  options: AuditOptions,
  axe: AxeResults,
  adjudications: JevAdjudication[],
  axeMs: number,
  jevMs: number | null,
): AuditReport {
  const inScope = criteriaInScope(options.wcagVersions, options.includeLevelA, options.laws);
  const jevBySubject = new Map(adjudications.map((a) => [a.subject, a]));
  const disputed = new Set(
    adjudications.filter((a) => a.subject.startsWith("axe:") && a.verdict === "needs-review")
      .map((a) => a.subject.slice(4)),
  );

  const criteria: CriterionResult[] = inScope.map((c) => {
    const ev = rulesForTags(axe, c.axeTags);
    const jev = jevBySubject.get(c.id);
    const disputedRules = ev.violations.filter((v) => disputed.has(v.id));
    const standingViolations = ev.violations.filter((v) => !disputed.has(v.id));

    let verdict: Verdict;
    let basis: CriterionResult["basis"] = "axe";
    let confidence = AXE_CONFIDENCE;
    const notes: string[] = [];

    if (standingViolations.length > 0) {
      verdict = "fail";
      notes.push(
        `axe-core: ${standingViolations.map((v) => `${v.id} (${v.nodeCount} element${v.nodeCount === 1 ? "" : "s"})`).join(", ")}.`,
      );
    } else if (ev.incomplete.length > 0) {
      verdict = "needs-review";
      notes.push(`axe-core could not decide automatically: ${ev.incomplete.map((v) => v.id).join(", ")}.`);
    } else if (ev.passes.length > 0) {
      verdict = "pass";
      notes.push(`axe-core checked ${ev.passes.length} rule${ev.passes.length === 1 ? "" : "s"} covering this criterion.`);
    } else if (c.axeTags.length === 0) {
      verdict = "needs-review";
      notes.push("No automated check covers this criterion.");
    } else {
      verdict = "needs-review";
      notes.push("No matching axe-core rules ran for this criterion on this page.");
    }

    if (disputedRules.length > 0 && verdict === "fail") {
      // all violations disputed -> soften; some disputed -> keep fail, note it
      if (standingViolations.length === 0) {
        verdict = "needs-review";
        notes.push(`Jev disputes the automated finding(s) (${disputedRules.map((v) => v.id).join(", ")}) — possible false positive, needs a human.`);
      } else {
        notes.push(`Jev disputes ${disputedRules.map((v) => v.id).join(", ")} as a possible false positive.`);
      }
    }

    if (jev) {
      if (jev.verdict === "fail") {
        verdict = "fail";
        basis = basis === "axe" ? "axe+jev" : "jev";
        confidence = Math.max(confidence === AXE_CONFIDENCE ? 0 : confidence, jev.confidence);
        notes.push(`Jev judgement (${jev.confidence.toFixed(2)}): ${jev.note}`);
      } else if (jev.verdict === "needs-review" && verdict === "pass") {
        verdict = "needs-review";
        basis = "axe+jev";
        confidence = jev.confidence;
        notes.push(`Jev judgement (${jev.confidence.toFixed(2)}): ${jev.note}`);
      } else if (jev.verdict === "pass" && verdict !== "fail") {
        basis = basis === "axe" ? "axe+jev" : "jev";
        confidence = verdict === "pass" ? Math.max(AXE_CONFIDENCE, jev.confidence) : jev.confidence;
        notes.push(`Jev judgement (${jev.confidence.toFixed(2)}): ${jev.note}`);
      } else if (jev.verdict === "pass" && verdict === "fail") {
        notes.push(`Jev agreed the page passes its semantic check, but automated failures stand.`);
      }
      if (basis === "jev" && verdict !== "fail") { basis = "jev"; confidence = jev.confidence; }
    }

    const examples = standingViolations.flatMap((v) => v.nodes.map((n) => n.html)).slice(0, 3);

    return {
      criterionId: c.id,
      name: c.name,
      principle: c.principle,
      level: c.level,
      versions: c.versions,
      verdict,
      confidence: Math.round(confidence * 100) / 100,
      basis,
      detail: notes.join(" "),
      coverageNote: c.coverageNote,
      laws: lawsCovering(c, options.laws),
      helpUrl: `https://www.w3.org/WAI/WCAG21/Understanding/${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`,
      examples,
    };
  });

  const pass = criteria.filter((c) => c.verdict === "pass").length;
  const fail = criteria.filter((c) => c.verdict === "fail").length;
  const needsReview = criteria.filter((c) => c.verdict === "needs-review").length;
  const total = criteria.length;
  const score = total ? pass / total : 0;
  const band: [number, number] = total ? [score, (pass + needsReview) / total] : [0, 0];

  const standardsApplied = [
    ...options.wcagVersions.map((v) => `WCAG ${v}${options.includeLevelA ? " A/AA" : " AA"}`),
  ];
  const lawsApplied = options.laws
    .map((id) => LAWS.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l))
    .map((l) => ({
      id: l.id,
      name: l.short,
      basis: `Maps to WCAG ${l.baseline.version} ${l.baseline.level}`,
    }));

  return {
    id, url, finalUrl, title,
    startedAt, finishedAt: new Date().toISOString(),
    options, score, band,
    counts: { pass, fail, needsReview, total },
    criteria, jevAdjudications: adjudications,
    axeSummary: { violations: axe.violations.length, passes: axe.passes.length, incomplete: axe.incomplete.length },
    standardsApplied, lawsApplied, jevMs, axeMs,
  };
}

/** Laws not in the curated table are ignored silently. */
export function knownCriteria(): typeof CRITERIA {
  return CRITERIA;
}
