/** Shared types for the WCAG audit pipeline. */

export type Verdict = "pass" | "fail" | "needs-review";

export interface AuditOptions {
  url: string;
  /** WCAG versions to check, e.g. ["2.0", "2.1"]. */
  wcagVersions: string[];
  /** Include Level A criteria (AA always includes A). */
  includeLevelA: boolean;
  /** Law ids whose mapped baselines are merged in. */
  laws: string[];
  /** "off" = axe only; "judgement" = Jev adjudicates ambiguous items;
   *  "full" = Jev also second-opinions axe violations. */
  jevMode: "off" | "judgement" | "full";
}

export interface AxeNodeSummary {
  target: string[];
  html: string;
}

export interface AxeRuleResult {
  id: string;
  description: string;
  help: string;
  helpUrl: string;
  impact: string | null;
  tags: string[];
  /** For violations/incomplete: offending nodes (capped). */
  nodes: AxeNodeSummary[];
  /** For passes: number of nodes checked. */
  nodeCount: number;
}

export interface AxeResults {
  violations: AxeRuleResult[];
  passes: AxeRuleResult[];
  incomplete: AxeRuleResult[];
  /** Rules that ran, by id. */
  ranRuleIds: string[];
}

export interface SnapshotImage { src: string; alt: string | null; }
export interface SnapshotLink { text: string; href: string; }
export interface SnapshotField { label: string | null; name: string | null; type: string; tag: string; }
export interface SnapshotHeading { level: number; text: string; }

export interface PageSnapshot {
  url: string;
  title: string;
  lang: string | null;
  headings: SnapshotHeading[];
  images: SnapshotImage[];
  links: SnapshotLink[];
  fields: SnapshotField[];
  landmarks: string[];
  /** First ~2k chars of visible text, for language/meaning checks. */
  textSample: string;
}

export interface JevAdjudication {
  /** Criterion id (e.g. "1.1.1") or axe rule id prefixed "axe:". */
  subject: string;
  subjectLabel: string;
  verdict: Verdict;
  confidence: number;
  basis: "jev";
  note: string;
}

export interface CriterionResult {
  criterionId: string;
  name: string;
  principle: "Perceivable" | "Operable" | "Understandable" | "Robust";
  level: "A" | "AA";
  versions: string[];
  verdict: Verdict;
  /** 1.0 for deterministic axe checks; Jev confidence for adjudicated ones. */
  confidence: number;
  basis: "axe" | "jev" | "axe+jev";
  detail: string;
  /** Honesty note when automated checking is only partial. */
  coverageNote?: string;
  /** Laws that cite this criterion (from selected law set). */
  laws: string[];
  helpUrl: string;
  /** Example offending markup (violations only, capped). */
  examples: string[];
}

export interface AuditReport {
  id: string;
  url: string;
  finalUrl: string;
  title: string;
  startedAt: string;
  finishedAt: string;
  options: AuditOptions;
  /** Aggregate pass rate over checked criteria. */
  score: number;
  /** Honest uncertainty band: [all needs-review fail, all pass]. */
  band: [number, number];
  counts: { pass: number; fail: number; needsReview: number; total: number };
  criteria: CriterionResult[];
  jevAdjudications: JevAdjudication[];
  axeSummary: { violations: number; passes: number; incomplete: number };
  standardsApplied: string[];
  lawsApplied: { id: string; name: string; basis: string }[];
  jevMs: number | null;
  axeMs: number;
}

export interface AuditJob {
  id: string;
  status: "running" | "done" | "error";
  stage: string;
  error?: string;
}
