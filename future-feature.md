# Future feature: whole-domain .gov crawl

**Status:** parked. The auditor currently audits a single page per run.

## Goal

Given a .gov domain (e.g. `usa.gov`), crawl up to N pages and produce:
- a domain-level compliance score (mean of page scores, with a band),
- the most common failures across the domain (rule × page-count matrix),
- per-page reports linked from the domain report,
- a domain PDF (executive summary + top-10 failures).

## Proposed design

- **Crawler:** same-domain BFS from the homepage, cap at ~50 pages default (user-adjustable
  to 200). Respect robots.txt; skip non-HTML, auth-walled, and file downloads. Dedupe by
  canonical URL. Politeness delay ~1s between page loads.
- **Per page:** reuse the existing single-page pipeline (axe-core + optional Jev).
  Jev cost control: run "judgement calls" mode per page but batch — or run Jev only on
  pages with incomplete/ambiguous findings. Full-page second opinions only on demand.
- **Aggregation:** criterion verdict per page → domain verdict per criterion by majority
  with the share of failing pages; domain score = mean page score; band widens with
  per-page uncertainty.
- **UI:** new `/domain` entry point (domain input + page cap), domain report page with
  the failure matrix, links to per-page reports, domain PDF download.
- **Storage:** `data/reports/domain-<id>.json` + per-page reports as today.

## Open questions

- Authenticated sections of .gov sites (login.gov-gated) — out of scope initially.
- JS-heavy single-page apps need longer settle waits; consider per-domain tuning.
- Rate limiting / WAFs on some .gov hosts — backoff and user-agent identification.
