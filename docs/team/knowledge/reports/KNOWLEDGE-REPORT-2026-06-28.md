# Knowledge Antenna Report — 2026-06-28

Generated at: 2026-06-28T13:33:29.975Z

## Panelin Signal — revista interna (HTML)

Lectura humana en el navegador: diseño editorial con el conocimiento actual del agente. Se actualiza al ejecutar este reporte o `npm run knowledge:magazine` (solo regenera HTML desde los JSON).

- [Última edición](./KNOWLEDGE-MAGAZINE-latest.html) (siempre apunta al último build)
- [Edición del día](./KNOWLEDGE-MAGAZINE-2026-06-28.html) (archivo fechado)

*Nota:* una futura edición pública puede reutilizar la misma plantilla con fuentes y textos curados aparte.

## Executive Summary

- Sources scanned: 9
- Raw events fetched: 64
- New references saved: 14
- Accepted events: 14
- No-action events: 0
- New source candidates discovered: 0

## Source Ranking (Top)

1. OpenAI News (0.9329) [active]
2. Vercel Releases (0.9006) [active]
3. Vercel AI SDK Releases (0.8982) [active]
4. Anthropic SDK Releases (0.8887) [active]
5. arXiv cs.AI (0.85) [active]
6. Hugging Face Blog (0.8458) [active]
7. OpenAI Node SDK Releases (0.8254) [active]
8. MCP TypeScript SDK Releases (0.7915) [active]

## Tactical Recommendations (This Week)

- Validate high-priority impact mappings in `docs/team/knowledge/impact-map.json`.
- Route deployment-related updates into `scripts/deploy-vercel.sh` and `scripts/deploy-cloud-run.sh` checks.
- Review LLM provider updates for action/API compatibility in `server/gptActions.js`.
- Sync major findings into `docs/team/PROJECT-STATE.md` only when they become concrete implementation tasks.

## Accepted Events

- [vercel@54.18.1](https://github.com/vercel/vercel/releases/tag/vercel%4054.18.1) — score 0.652, source Vercel Releases
- [@vercel/static-build@2.11.4](https://github.com/vercel/vercel/releases/tag/%40vercel/static-build%402.11.4) — score 0.652, source Vercel Releases
- [@vercel/node@5.8.22](https://github.com/vercel/vercel/releases/tag/%40vercel/node%405.8.22) — score 0.652, source Vercel Releases
- [@vercel/nestjs@0.2.102](https://github.com/vercel/vercel/releases/tag/%40vercel/nestjs%400.2.102) — score 0.652, source Vercel Releases
- [@vercel/koa@0.1.81](https://github.com/vercel/vercel/releases/tag/%40vercel/koa%400.1.81) — score 0.652, source Vercel Releases
- [@vercel/hono@0.2.101](https://github.com/vercel/vercel/releases/tag/%40vercel/hono%400.2.101) — score 0.652, source Vercel Releases
- [@vercel/h3@0.1.107](https://github.com/vercel/vercel/releases/tag/%40vercel/h3%400.1.107) — score 0.652, source Vercel Releases
- [@vercel/gatsby-plugin-vercel-builder@2.2.24](https://github.com/vercel/vercel/releases/tag/%40vercel/gatsby-plugin-vercel-builder%402.2.24) — score 0.652, source Vercel Releases
- [@ai-sdk/fireworks@2.0.62](https://github.com/vercel/ai/releases/tag/%40ai-sdk/fireworks%402.0.62) — score 0.6485, source Vercel AI SDK Releases
- [ai@7.0.4](https://github.com/vercel/ai/releases/tag/ai%407.0.4) — score 0.5685, source Vercel AI SDK Releases
- [ai@6.0.214](https://github.com/vercel/ai/releases/tag/ai%406.0.214) — score 0.5685, source Vercel AI SDK Releases
- [@ai-sdk/xai@4.0.2](https://github.com/vercel/ai/releases/tag/%40ai-sdk/xai%404.0.2) — score 0.6485, source Vercel AI SDK Releases
- [@ai-sdk/xai@3.0.100](https://github.com/vercel/ai/releases/tag/%40ai-sdk/xai%403.0.100) — score 0.6485, source Vercel AI SDK Releases
- [@ai-sdk/workflow@1.0.4](https://github.com/vercel/ai/releases/tag/%40ai-sdk/workflow%401.0.4) — score 0.6485, source Vercel AI SDK Releases

## Impact Mapping Summary

```json
{
  "ok": true,
  "generatedAt": "2026-06-28T13:33:29.972Z",
  "daysAnalyzed": 14,
  "mappings": 277,
  "summary": {
    "low": 192,
    "high": 28,
    "medium": 57
  }
}
```

## No-Action Items (Noise Control)

- None.
