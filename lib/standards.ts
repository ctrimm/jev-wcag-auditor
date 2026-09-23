/** Curated WCAG knowledge base: the criteria this auditor can actually check,
 *  via axe-core, Jev judgement calls, or both.
 *
 *  axeTags use axe-core's criterion tags (e.g. "wcag111" = 1.1.1). jevQuestion
 *  keys into the question set in lib/jev_audit.ts.
 */

export type Principle = "Perceivable" | "Operable" | "Understandable" | "Robust";

export interface Criterion {
  id: string;
  name: string;
  principle: Principle;
  level: "A" | "AA";
  /** WCAG versions where this criterion exists. */
  versions: ("2.0" | "2.1" | "2.2")[];
  description: string;
  axeTags: string[];
  jevQuestion?: string;
  /** Honesty note when automated checking is only partial. */
  coverageNote?: string;
}

export const CRITERIA: Criterion[] = [
  // ---- Perceivable ----
  { id: "1.1.1", name: "Non-text Content", principle: "Perceivable", level: "A",
    versions: ["2.0", "2.1", "2.2"],
    description: "Images, icons, and other non-text content need a text alternative that serves the same purpose.",
    axeTags: ["wcag111"], jevQuestion: "alt_meaningful" },
  { id: "1.2.2", name: "Captions (Prerecorded)", principle: "Perceivable", level: "A",
    versions: ["2.0", "2.1", "2.2"],
    description: "Prerecorded video with audio needs synchronized captions.",
    axeTags: ["wcag122"],
    coverageNote: "Axe detects missing caption tracks; it cannot judge caption quality." },
  { id: "1.3.1", name: "Info and Relationships", principle: "Perceivable", level: "A",
    versions: ["2.0", "2.1", "2.2"],
    description: "Structure conveyed visually (lists, tables, headings hierarchy) must be programmatically determinable.",
    axeTags: ["wcag131"] },
  { id: "1.3.3", name: "Sensory Characteristics", principle: "Perceivable", level: "A",
    versions: ["2.0", "2.1", "2.2"],
    description: "Instructions must not rely solely on shape, color, size, or position (e.g. 'click the round button').",
    axeTags: [], jevQuestion: "sensory_only",
    coverageNote: "Judgement call — evaluated by Jev from the page snapshot." },
  { id: "1.4.1", name: "Use of Color", principle: "Perceivable", level: "A",
    versions: ["2.0", "2.1", "2.2"],
    description: "Color must not be the only way information is conveyed; links in body text need a second cue.",
    axeTags: ["wcag141"],
    coverageNote: "Axe checks link distinguishability; broader color-only meaning needs human review." },
  { id: "1.4.3", name: "Contrast (Minimum)", principle: "Perceivable", level: "AA",
    versions: ["2.0", "2.1", "2.2"],
    description: "Text needs a contrast ratio of at least 4.5:1 (3:1 for large text) against its background.",
    axeTags: ["wcag143"] },
  { id: "1.4.4", name: "Resize Text", principle: "Perceivable", level: "AA",
    versions: ["2.0", "2.1", "2.2"],
    description: "Text must remain readable when zoomed to 200%; the viewport must not block scaling.",
    axeTags: ["wcag144"],
    coverageNote: "Axe checks the viewport meta tag; true zoom reflow needs manual testing." },
  { id: "1.4.12", name: "Text Spacing", principle: "Perceivable", level: "AA",
    versions: ["2.1", "2.2"],
    description: "Content must survive user-adjusted text spacing without loss of content or function.",
    axeTags: ["wcag1412"] },
  // ---- Operable ----
  { id: "2.1.1", name: "Keyboard", principle: "Operable", level: "A",
    versions: ["2.0", "2.1", "2.2"],
    description: "Everything interactive must be reachable and operable by keyboard alone.",
    axeTags: ["wcag211"],
    coverageNote: "Axe checks scrollable regions and tabindex misuse; full keyboard walkthrough needs a human." },
  { id: "2.2.2", name: "Pause, Stop, Hide", principle: "Operable", level: "A",
    versions: ["2.0", "2.1", "2.2"],
    description: "Moving, blinking, or auto-updating content must have a pause/stop/hide control.",
    axeTags: ["wcag222"] },
  { id: "2.4.1", name: "Bypass Blocks", principle: "Operable", level: "A",
    versions: ["2.0", "2.1", "2.2"],
    description: "Pages need a skip link, landmark regions, or another way to bypass repeated navigation.",
    axeTags: ["wcag241"] },
  { id: "2.4.2", name: "Page Titled", principle: "Operable", level: "A",
    versions: ["2.0", "2.1", "2.2"],
    description: "Every page needs a descriptive, non-empty <title>.",
    axeTags: ["wcag242"] },
  { id: "2.4.4", name: "Link Purpose (In Context)", principle: "Operable", level: "A",
    versions: ["2.0", "2.1", "2.2"],
    description: "Each link's purpose must be clear from its text (plus nearby context) — not 'click here'.",
    axeTags: ["wcag244"], jevQuestion: "link_purpose" },
  { id: "2.4.6", name: "Headings and Labels", principle: "Operable", level: "AA",
    versions: ["2.0", "2.1", "2.2"],
    description: "Headings and labels must describe their topic or purpose, not just exist.",
    axeTags: [], jevQuestion: "heading_descriptive",
    coverageNote: "Judgement call — evaluated by Jev from the page snapshot." },
  { id: "2.5.3", name: "Label in Name", principle: "Operable", level: "A",
    versions: ["2.1", "2.2"],
    description: "For controls with visible labels, the accessible name must contain the visible text (voice control).",
    axeTags: ["wcag253"] },
  { id: "2.5.8", name: "Target Size (Minimum)", principle: "Operable", level: "AA",
    versions: ["2.2"],
    description: "Pointer targets need to be at least 24×24 CSS pixels (with spacing exceptions).",
    axeTags: ["wcag258"] },
  // ---- Understandable ----
  { id: "3.1.1", name: "Language of Page", principle: "Understandable", level: "A",
    versions: ["2.0", "2.1", "2.2"],
    description: "The page's human language must be set in the <html lang> attribute — and match the actual content.",
    axeTags: ["wcag311"], jevQuestion: "lang_matches" },
  { id: "3.1.2", name: "Language of Parts", principle: "Understandable", level: "AA",
    versions: ["2.0", "2.1", "2.2"],
    description: "Passages in a different language need their own lang attribute.",
    axeTags: ["wcag312"],
    coverageNote: "Axe validates lang attribute values; detecting unmarked foreign passages needs review." },
  { id: "3.3.2", name: "Labels or Instructions", principle: "Understandable", level: "A",
    versions: ["2.0", "2.1", "2.2"],
    description: "Form fields need labels — and the labels must actually describe what to enter.",
    axeTags: ["wcag332"], jevQuestion: "label_descriptive" },
  // ---- Robust ----
  { id: "4.1.1", name: "Parsing", principle: "Robust", level: "A",
    versions: ["2.0", "2.1"],
    description: "Markup must parse cleanly: no duplicate ids, properly nested elements.",
    axeTags: ["wcag411"],
    coverageNote: "Removed from WCAG 2.2 (browsers handle parsing); still checked for 2.0/2.1." },
  { id: "4.1.2", name: "Name, Role, Value", principle: "Robust", level: "A",
    versions: ["2.0", "2.1", "2.2"],
    description: "Custom controls must expose name, role, and value to assistive technology (valid ARIA).",
    axeTags: ["wcag412"] },
];

export interface Law {
  id: string;
  name: string;
  short: string;
  description: string;
  /** WCAG baseline this law maps to. */
  baseline: { version: "2.0" | "2.1" | "2.2"; level: "A" | "AA" };
  url: string;
}

/** Law mappings — verified against primary sources (see README "Legal references"). */
export const LAWS: Law[] = [
  { id: "508", name: "Section 508 of the Rehabilitation Act (2017 refresh)", short: "Section 508",
    description: "Federal agencies must make electronic content accessible. The 2017 refresh incorporates WCAG 2.0 A and AA by reference.",
    baseline: { version: "2.0", level: "AA" }, url: "https://www.access-board.gov/ict/" },
  { id: "idea", name: "21st Century Integrated Digital Experience Act", short: "21st Century IDEA",
    description: "Requires federal websites to be accessible, consistent, and mobile-friendly — pointing back to Section 508 compliance.",
    baseline: { version: "2.0", level: "AA" }, url: "https://www.congress.gov/bill/115th-congress/house-bill/5759" },
  { id: "ada-title-ii", name: "ADA Title II final rule (DOJ, 2024)", short: "ADA Title II",
    description: "State and local government web content and mobile apps must meet WCAG 2.1 AA. Note: a 2026 interim final rule extended the compliance dates; DOJ has signaled the rule itself may be revisited.",
    baseline: { version: "2.1", level: "AA" }, url: "https://www.federalregister.gov/d/2024-07758" },
  { id: "m-24-14", name: "OMB M-24-14 (Digital Experience Guidance)", short: "OMB M-24-14",
    description: "OMB guidance on delivering a digital-first public experience; accessibility is a required dimension but the memo sets no separate WCAG baseline beyond 508.",
    baseline: { version: "2.0", level: "AA" }, url: "https://www.whitehouse.gov/omb/management/ofc-procurement/memorandums/2024/" },
];

/** axe-core tag filter for a set of WCAG versions. axe-core tags each rule with
 *  the version its criterion comes from (wcag2aa, wcag21aa, wcag22aa), so the
 *  filter is cumulative: auditing 2.1 needs the 2.0 tags too. Level A rules
 *  carry wcag2a/wcag21a; AA adds wcag2aa/wcag21aa/wcag22aa. */
export function axeTagsFor(versions: string[], includeLevelA: boolean): string[] {
  const ordered = ["2.0", "2.1", "2.2"];
  // axe-core's tag suffixes drop the ".0": 2.0 -> "2", 2.1 -> "21", 2.2 -> "22".
  const suffix: Record<string, string> = { "2.0": "2", "2.1": "21", "2.2": "22" };
  const maxIdx = Math.max(...versions.map((v) => ordered.indexOf(v)).filter((i) => i >= 0), 0);
  const tags = new Set<string>();
  for (let i = 0; i <= maxIdx; i++) {
    const n = suffix[ordered[i]];
    if (includeLevelA) tags.add(`wcag${n}a`);
    tags.add(`wcag${n}aa`);
  }
  // Section 508's older rules overlap wcag2a; include for completeness.
  if (maxIdx >= 0) tags.add("section508");
  return [...tags];
}

/** Criteria in scope for the selected versions/levels/laws. An AA baseline
 *  always includes Level A criteria. */
export function criteriaInScope(versions: string[], includeLevelA: boolean, laws: string[]): Criterion[] {
  const lawBaselines = laws
    .map((id) => LAWS.find((l) => l.id === id))
    .filter((l): l is Law => Boolean(l))
    .map((l) => l.baseline);
  const allVersions = [...new Set([...versions, ...lawBaselines.map((b) => b.version)])];
  const aCovered = includeLevelA || lawBaselines.some((b) => b.level === "AA" || b.level === "A");
  return CRITERIA.filter((c) => {
    if (!c.versions.some((v) => allVersions.includes(v))) return false;
    if (c.level === "A" && !aCovered) return false;
    return true;
  });
}
