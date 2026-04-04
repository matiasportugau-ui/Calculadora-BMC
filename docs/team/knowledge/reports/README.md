# Knowledge Reports

This folder stores generated research-antenna outputs:

- `KNOWLEDGE-REPORT-YYYY-MM-DD.md` — technical run log (Markdown)
- `KNOWLEDGE-MAGAZINE-latest.html` — **Panelin Signal**: internal magazine layout (open in a browser)
- `KNOWLEDGE-MAGAZINE-YYYY-MM-DD.html` — dated snapshot of the same issue

Generate a report with:

- `npm run knowledge:scan`
- or full pipeline: `npm run knowledge:run`

Regenerate **only** the HTML magazine from current `docs/team/knowledge/*.json` (after manual edits to sources, references, or impact map):

- `npm run knowledge:magazine`
