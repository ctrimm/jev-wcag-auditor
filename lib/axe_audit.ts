/** Run axe-core against a live page in headless Chromium, and capture the
 *  semantic snapshot Jev needs for judgement calls. */
import fs from "node:fs";
import path from "node:path";
import { launchAuditBrowser, ensureProxyForwarder } from "./browser";
import type { AxeResults, AxeRuleResult, PageSnapshot } from "./types";

/** axe-core ships its injectable bundle; resolve it from the project dir
 *  (kept out of webpack's reach — require.resolve gets rewritten to a
 *  numeric module id in bundled server code). */
function axeSourcePath(): string {
  const p = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");
  if (!fs.existsSync(p)) throw new Error(`axe-core bundle not found at ${p}`);
  return p;
}

const MAX_NODES = 5;
const MAX_HTML = 300;

function toRuleResult(r: any, withNodes: boolean): AxeRuleResult {
  return {
    id: r.id,
    description: r.description,
    help: r.help,
    helpUrl: r.helpUrl,
    impact: r.impact ?? null,
    tags: r.tags ?? [],
    nodes: withNodes
      ? (r.nodes ?? []).slice(0, MAX_NODES).map((n: any) => ({
          target: n.target ?? [],
          html: String(n.html ?? "").slice(0, MAX_HTML),
        }))
      : [],
    nodeCount: (r.nodes ?? []).length,
  };
}

function collectSnapshot() {
  const txt = (el: Element) => (el.textContent || "").trim().replace(/\s+/g, " ");
  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
    .slice(0, 40)
    .map((el) => ({ level: +el.tagName[1], text: txt(el).slice(0, 120) }));
  const images = [...document.querySelectorAll("img")].slice(0, 30).map((el) => ({
    src: (el.getAttribute("src") || "").slice(0, 160),
    alt: el.hasAttribute("alt") ? el.getAttribute("alt") : null,
  }));
  const links = [...document.querySelectorAll("a[href]")].slice(0, 40).map((el) => ({
    text: txt(el).slice(0, 80),
    href: (el.getAttribute("href") || "").slice(0, 160),
  }));
  const fields = [...document.querySelectorAll("input,select,textarea")].slice(0, 30).map((el) => {
    const lab = (el as HTMLInputElement).labels && (el as HTMLInputElement).labels![0]
      ? txt((el as HTMLInputElement).labels![0]).slice(0, 80)
      : null;
    return {
      label: lab || el.getAttribute("aria-label") || el.getAttribute("placeholder") || null,
      name: el.getAttribute("name"),
      type: el.getAttribute("type") || el.tagName.toLowerCase(),
      tag: el.tagName.toLowerCase(),
    };
  });
  const landmarks = [
    ...document.querySelectorAll(
      '[role="banner"],[role="navigation"],[role="main"],[role="contentinfo"],[role="complementary"],header,nav,main,footer,aside',
    ),
  ]
    .slice(0, 20)
    .map((el) => el.getAttribute("role") || el.tagName.toLowerCase());
  return {
    title: document.title || "",
    lang: document.documentElement.getAttribute("lang"),
    headings,
    images,
    links,
    fields,
    landmarks,
    textSample: (document.body ? document.body.innerText : "").replace(/\s+/g, " ").slice(0, 2000),
  };
}

export interface PageAudit {
  finalUrl: string;
  axe: AxeResults;
  snapshot: PageSnapshot;
  axeMs: number;
}

export async function auditPage(url: string, tags: string[]): Promise<PageAudit> {
  await ensureProxyForwarder();
  const browser = await launchAuditBrowser();
  const t0 = Date.now();
  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      viewport: { width: 1366, height: 900 },
    });
    page.setDefaultTimeout(90000);
    page.setDefaultNavigationTimeout(60000);
    const resp = await page.goto(url, { waitUntil: "domcontentloaded" });
    console.log(`[audit] goto ${url} -> status=${resp?.status() ?? "null"} url=${page.url()}`);
    if (!resp || !resp.ok()) {
      throw new Error(`Page failed to load (status ${resp?.status() ?? "no response"}).`);
    }
    await page.waitForTimeout(2500);
    const finalUrl = page.url();
    const dbgTitle = await page.title();
    const dbgLen = await page.evaluate("document.documentElement.outerHTML.length");
    console.log(`[audit] loaded title=${JSON.stringify(dbgTitle)} htmlLen=${dbgLen}`);

    await page.addScriptTag({ path: axeSourcePath() });
    const raw: any = await page.evaluate(
      (runTags: string[]) =>
        (window as any).axe.run(document, {
          runOnly: { type: "tag", values: runTags },
          resultTypes: ["violations", "passes", "incomplete"],
        }),
      tags,
    );

    const snap: any = await page.evaluate(collectSnapshot);
    const axe: AxeResults = {
      violations: (raw.violations ?? []).map((r: any) => toRuleResult(r, true)),
      passes: (raw.passes ?? []).map((r: any) => toRuleResult(r, false)),
      incomplete: (raw.incomplete ?? []).map((r: any) => toRuleResult(r, true)),
      ranRuleIds: [
        ...(raw.violations ?? []).map((r: any) => r.id),
        ...(raw.passes ?? []).map((r: any) => r.id),
        ...(raw.incomplete ?? []).map((r: any) => r.id),
      ],
    };
    const snapshot: PageSnapshot = { url: finalUrl, ...snap };
    return { finalUrl, axe, snapshot, axeMs: Date.now() - t0 };
  } finally {
    await browser.close();
  }
}
