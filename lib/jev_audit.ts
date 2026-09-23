/** Jev evaluation requests for WCAG judgement calls.
 *
 * Follows the same pattern as the voice builder: one Jev call, N choice
 * questions over a state snapshot. Two modes:
 *  - "judgement": Jev adjudicates the semantic criteria axe-core cannot
 *    fully decide (alt-text meaningfulness, link purpose, heading quality…).
 *  - "full": judgement questions PLUS a second opinion on each serious axe
 *    violation (agree / dispute / unsure).
 */
import type {
  AxeRuleResult,
  JevAdjudication,
  PageSnapshot,
  Verdict,
} from "./types";
import { CRITERIA } from "./standards";

interface JevQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
}

export interface JevAuditRequest {
  state: string;
  model: string;
  questions: Record<string, JevQuestion>;
  /** Maps question key -> { subject, subjectLabel } for answer parsing. */
  subjects: Record<string, { subject: string; subjectLabel: string; criterionId?: string }>;
}

const VERDICT_CRITERIA: Record<string, string> = {
  A: "Pass: the page meets this requirement. Only choose this if the evidence clearly supports it.",
  B: "Fail: the page clearly violates this requirement. Cite the specific evidence.",
  C: "Needs human review: the evidence is ambiguous, the sample is too small to judge, or this needs a human with assistive technology to verify.",
};

function snapshotState(url: string, snap: PageSnapshot): string {
  const headings = snap.headings ?? [];
  const images = snap.images ?? [];
  const links = snap.links ?? [];
  const fields = snap.fields ?? [];
  const landmarks = snap.landmarks ?? [];
  const lines: string[] = [
    `You are auditing the accessibility of a US government website for WCAG compliance.`,
    `Page: ${url}`,
    `Title: ${snap.title || "(no title)"}`,
    `HTML lang attribute: ${snap.lang ?? "(missing)"}`,
    ``,
    `Headings (${headings.length} shown):`,
    ...headings.map((h) => `  h${h.level}: ${h.text || "(empty)"}`),
    ``,
    `Images (${images.length} shown):`,
    ...images.map((i) => `  alt=${i.alt === null ? "(missing)" : JSON.stringify(i.alt)} src=${i.src}`),
    ``,
    `Links (${links.length} shown):`,
    ...links.map((l) => `  "${l.text || "(no text)"}" -> ${l.href}`),
    ``,
    `Form fields (${fields.length} shown):`,
    ...fields.map(
      (f) => `  <${f.tag} type=${f.type}> label=${f.label === null ? "(missing)" : JSON.stringify(f.label)} name=${f.name ?? "(none)"}`,
    ),
    ``,
    `Landmarks: ${landmarks.join(", ") || "(none detected)"}`,
    ``,
    `Visible text sample:`,
    (snap.textSample ?? "").slice(0, 1200),
  ];
  return lines.join("\n");
}

const JUDGEMENT_QUESTIONS: Record<string, { criterionId: string; instructions: string }> = {
  alt_meaningful: {
    criterionId: "1.1.1",
    instructions:
      "Look at the Images list. For images that convey information (photos, charts, icons with meaning), is the alt text a meaningful equivalent — not empty, not a filename, not generic filler like 'image' or 'picture'? Decorative images correctly marked alt=\"\" or role=\"presentation\" are fine. If there are no informative images, choose Pass.",
  },
  sensory_only: {
    criterionId: "1.3.3",
    instructions:
      "From the headings, links, form fields, and text sample: is any instruction or piece of information conveyed ONLY by shape, color, size, or position (e.g. 'click the green button', 'required fields are in red')? If everything is also described in words, choose Pass.",
  },
  link_purpose: {
    criterionId: "2.4.4",
    instructions:
      "Look at the Links list. Can the purpose of each link be determined from its link text alone (or its immediate context)? Flag generic text like 'click here', 'read more', 'learn more' with no descriptive context as failures. A few ambiguous links among many descriptive ones is still a Fail for this criterion.",
  },
  heading_descriptive: {
    criterionId: "2.4.6",
    instructions:
      "Look at the Headings list. Do the headings describe the topic or purpose of the content beneath them? Empty headings, headings that are just numbers or generic words ('Section 1', 'More info'), or skipped levels used for visual styling are failures.",
  },
  label_descriptive: {
    criterionId: "3.3.2",
    instructions:
      "Look at the Form fields list. Does every field have a visible label (or accessible name), and do the labels describe what to enter? Placeholder-only or cryptic labels ('Field 1', 'Enter data') are failures. If there are no form fields, choose Pass.",
  },
  lang_matches: {
    criterionId: "3.1.1",
    instructions:
      "Compare the HTML lang attribute with the Visible text sample. Is the lang attribute present, valid, and does it match the actual language of the content? If the content is clearly in a different language than the lang attribute claims, that is a Fail.",
  },
};

export function buildJevAuditRequest(
  url: string,
  snap: PageSnapshot,
  violations: AxeRuleResult[],
  mode: "judgement" | "full",
): JevAuditRequest {
  const state = snapshotState(url, snap);
  const questions: Record<string, JevQuestion> = {};
  const subjects: JevAuditRequest["subjects"] = {};

  for (const [key, q] of Object.entries(JUDGEMENT_QUESTIONS)) {
    const criterion = CRITERIA.find((c) => c.id === q.criterionId)!;
    questions[key] = {
      type: "choice",
      instructions: `${q.instructions} This maps to WCAG ${criterion.id} ${criterion.name} (Level ${criterion.level}).`,
      criteria: VERDICT_CRITERIA,
    };
    subjects[key] = {
      subject: criterion.id,
      subjectLabel: `WCAG ${criterion.id} ${criterion.name}`,
      criterionId: criterion.id,
    };
  }

  if (mode === "full") {
    const serious = violations
      .filter((v) => v.impact === "critical" || v.impact === "serious")
      .slice(0, 8);
    serious.forEach((v, i) => {
      const key = `second_opinion_${i}`;
      const examples = v.nodes
        .slice(0, 3)
        .map((n) => `<${n.target.join(" ")}> ${n.html}`)
        .join("\n");
      questions[key] = {
        type: "choice",
        instructions:
          `The automated checker axe-core flagged a potential WCAG violation on this page:\n` +
          `Rule: ${v.id} — ${v.description}\n` +
          `Impact: ${v.impact}\n` +
          `Offending elements:\n${examples || "(no element details)"}\n\n` +
          `Give your second opinion: is this a genuine accessibility failure a human auditor would confirm?`,
        criteria: {
          A: "Agree: this is a genuine failure. The automated finding stands.",
          B: "Disagree: this looks like a false positive or is not actually a barrier. Downgrade to needs-review.",
          C: "Unsure: cannot tell from this evidence. Keep as needs human review.",
        },
      };
      subjects[key] = {
        subject: `axe:${v.id}`,
        subjectLabel: `axe rule ${v.id} (${v.description})`,
      };
    });
  }

  return { state, model: "jev-latest", questions, subjects };
}

const CHOICE_TO_VERDICT: Record<string, Verdict> = { A: "pass", B: "fail", C: "needs-review" };

/** Second-opinion answers map differently: agree=fail stands, disagree/unsure=needs-review. */
export function parseJevAnswers(
  req: JevAuditRequest,
  answers: Record<string, any>,
): JevAdjudication[] {
  const out: JevAdjudication[] = [];
  for (const [key, ans] of Object.entries(answers ?? {})) {
    const meta = req.subjects[key];
    if (!meta) continue;
    const choice = String(ans?.choice ?? "").toUpperCase();
    const confidence = typeof ans?.confidence === "number" ? ans.confidence : 0.5;
    let verdict: Verdict;
    let note: string;
    if (key.startsWith("second_opinion_")) {
      if (choice === "A") { verdict = "fail"; note = "Jev second opinion agrees with the automated finding."; }
      else if (choice === "B") { verdict = "needs-review"; note = "Jev disputes the automated finding — flagged as a possible false positive for human review."; }
      else { verdict = "needs-review"; note = "Jev could not confirm or deny the automated finding."; }
    } else {
      verdict = CHOICE_TO_VERDICT[choice] ?? "needs-review";
      note =
        verdict === "pass"
          ? "Jev judged the page meets this criterion from the snapshot."
          : verdict === "fail"
            ? "Jev judged the page violates this criterion from the snapshot."
            : "Jev found the evidence ambiguous — needs a human auditor to verify.";
    }
    out.push({
      subject: meta.subject,
      subjectLabel: meta.subjectLabel,
      verdict,
      confidence,
      basis: "jev",
      note,
    });
  }
  return out;
}
