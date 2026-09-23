# Jev WCAG Auditor — GitHub Action

Drop accessibility auditing into any repo with a frontend. On every PR (or push),
the action loads your URL in headless Chromium, runs deterministic axe-core
checks, and optionally asks Jev to adjudicate the judgement calls automation
can't decide. Results land as a step summary, a PR comment, and a
machine-readable `wcag-audit-report.json` artifact — and the step can fail your
build below a score threshold.

Use it from any repository:

```yaml
uses: ctrimm/jev-wcag-auditor/action@v1
```

## Quick start: audit a Vercel preview deployment

```yaml
name: Accessibility
on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # ... your build / deploy steps that expose a preview URL ...

      - name: WCAG audit
        uses: ctrimm/jev-wcag-auditor/action@v1
        with:
          url: ${{ steps.deploy.outputs.preview_url }}
          wcag-versions: "2.1"
          fail-below: 80
```

No API key is needed for the default `jev-mode: "off"` (axe-core only).
The action installs Node 22, your repo's locked dependencies (`npm ci`),
and Playwright's Chromium itself.

## With Jev judgement calls

```yaml
      - name: WCAG audit
        uses: ctrimm/jev-wcag-auditor/action@v1
        with:
          url: ${{ steps.deploy.outputs.preview_url }}
          jev-mode: judgement        # or "full" for second opinions on axe findings
          typesafe-api-key: ${{ secrets.TYPESAFE_API_KEY }}
```

Store your TypeSafe API key as a `TYPESAFE_API_KEY` repo secret. Jev
adjudicates the semantic criteria automation can't fully decide (alt-text
meaningfulness, link purpose, heading quality, label descriptiveness,
sensory-only instructions, page language) — the same six questions as the app.

## Inputs

| Input | Default | Description |
|---|---|---|
| `url` | *(required)* | URL to audit, e.g. a preview deployment URL. |
| `wcag-versions` | `"2.1"` | Comma-separated: any of `2.0`, `2.1`, `2.2`. Tags are cumulative. |
| `include-level-a` | `"true"` | Include Level A criteria. |
| `laws` | `""` | Comma-separated law ids (e.g. `508,ada-title-ii`) whose mapped WCAG baselines are merged in. Empty = WCAG only. |
| `jev-mode` | `"off"` | `off` (axe only), `judgement`, or `full`. |
| `typesafe-api-key` | `""` | Required when `jev-mode` isn't `off`. |
| `fail-below` | `"0"` | Fail the step if the score (0–100) is below this. `0` disables. |
| `comment` | `"true"` | Post/update a PR comment with results (`pull_request` events only). The comment is updated in place, one per PR. |
| `github-token` | `${{ github.token }}` | Token for the PR comment. |
| `upload-artifact` | `"true"` | Upload `wcag-audit-report.json` as a workflow artifact. |

## Outputs

`score` (0–100), `pass`, `fail`, `needs-review`, `criteria-total`, `report-path`.

```yaml
      - name: WCAG audit
        id: audit
        uses: ctrimm/jev-wcag-auditor/action@v1
        with:
          url: https://staging.example.com
      - run: echo "score was ${{ steps.audit.outputs.score }}"
```

## How it works

The action reuses the app's audit pipeline (`lib/axe_audit.ts`,
`lib/jev_audit.ts`, `lib/combine.ts`) — the same 22-criterion knowledge base
and confidence scoring — bundled with esbuild and run under Node. The PR
comment and step summary show the score, the uncertainty band, and the
actionable findings with per-criterion confidence.

Honesty notes: automated checks catch roughly a third of real accessibility
barriers. "Needs review" means exactly that — ideally testing with a screen
reader.
