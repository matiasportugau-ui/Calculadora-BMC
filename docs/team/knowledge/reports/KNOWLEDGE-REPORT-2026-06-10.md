# Knowledge Antenna Report — 2026-06-10

Generated at: 2026-06-10T13:48:56.946Z

## Panelin Signal — revista interna (HTML)

Lectura humana en el navegador: diseño editorial con el conocimiento actual del agente. Se actualiza al ejecutar este reporte o `npm run knowledge:magazine` (solo regenera HTML desde los JSON).

- [Última edición](./KNOWLEDGE-MAGAZINE-latest.html) (siempre apunta al último build)
- [Edición del día](./KNOWLEDGE-MAGAZINE-2026-06-10.html) (archivo fechado)

*Nota:* una futura edición pública puede reutilizar la misma plantilla con fuentes y textos curados aparte.

## Executive Summary

- Sources scanned: 9
- Raw events fetched: 72
- New references saved: 37
- Accepted events: 37
- No-action events: 0
- New source candidates discovered: 0

## Source Ranking (Top)

1. OpenAI News (0.9303) [active]
2. Vercel Releases (0.8961) [active]
3. Vercel AI SDK Releases (0.8928) [active]
4. Anthropic SDK Releases (0.8847) [active]
5. arXiv cs.AI (0.8498) [active]
6. Hugging Face Blog (0.8435) [active]
7. OpenAI Node SDK Releases (0.8127) [active]
8. MCP TypeScript SDK Releases (0.7849) [active]

## Tactical Recommendations (This Week)

- Validate high-priority impact mappings in `docs/team/knowledge/impact-map.json`.
- Route deployment-related updates into `scripts/deploy-vercel.sh` and `scripts/deploy-cloud-run.sh` checks.
- Review LLM provider updates for action/API compatibility in `server/gptActions.js`.
- Sync major findings into `docs/team/PROJECT-STATE.md` only when they become concrete implementation tasks.

## Accepted Events

- [<![CDATA[From data to decisions: how LSEG is scaling trusted AI]]>](https://openai.com/index/lseg) — score 0.593, source OpenAI News
- [<![CDATA[How engineers at Nextdoor use Codex to build without limits]]>](https://openai.com/index/nextdoor) — score 0.623, source OpenAI News
- [<![CDATA[What Codex unlocks for Notion]]>](https://openai.com/index/notion) — score 0.543, source OpenAI News
- [vertex-sdk: v0.17.1](https://github.com/anthropics/anthropic-sdk-typescript/releases/tag/vertex-sdk-v0.17.1) — score 0.6625, source Anthropic SDK Releases
- [sdk: v0.104.1](https://github.com/anthropics/anthropic-sdk-typescript/releases/tag/sdk-v0.104.1) — score 0.6625, source Anthropic SDK Releases
- [sdk: v0.104.0](https://github.com/anthropics/anthropic-sdk-typescript/releases/tag/sdk-v0.104.0) — score 0.7425, source Anthropic SDK Releases
- [sdk: v0.103.0](https://github.com/anthropics/anthropic-sdk-typescript/releases/tag/sdk-v0.103.0) — score 0.6625, source Anthropic SDK Releases
- [foundry-sdk: v0.3.1](https://github.com/anthropics/anthropic-sdk-typescript/releases/tag/foundry-sdk-v0.3.1) — score 0.6625, source Anthropic SDK Releases
- [bedrock-sdk: v0.30.2](https://github.com/anthropics/anthropic-sdk-typescript/releases/tag/bedrock-sdk-v0.30.2) — score 0.6625, source Anthropic SDK Releases
- [aws-sdk: v0.4.2](https://github.com/anthropics/anthropic-sdk-typescript/releases/tag/aws-sdk-v0.4.2) — score 0.6625, source Anthropic SDK Releases
- [vercel@54.11.1](https://github.com/vercel/vercel/releases/tag/vercel%4054.11.1) — score 0.652, source Vercel Releases
- [vercel@54.11.0](https://github.com/vercel/vercel/releases/tag/vercel%4054.11.0) — score 0.732, source Vercel Releases
- [@vercel/static-build@2.10.1](https://github.com/vercel/vercel/releases/tag/%40vercel/static-build%402.10.1) — score 0.652, source Vercel Releases
- [@vercel/routing-utils@6.3.0](https://github.com/vercel/vercel/releases/tag/%40vercel/routing-utils%406.3.0) — score 0.652, source Vercel Releases
- [@vercel/node@5.8.15](https://github.com/vercel/vercel/releases/tag/%40vercel/node%405.8.15) — score 0.652, source Vercel Releases
- [@vercel/nestjs@0.2.95](https://github.com/vercel/vercel/releases/tag/%40vercel/nestjs%400.2.95) — score 0.652, source Vercel Releases
- [@vercel/koa@0.1.74](https://github.com/vercel/vercel/releases/tag/%40vercel/koa%400.1.74) — score 0.652, source Vercel Releases
- [@vercel/hono@0.2.94](https://github.com/vercel/vercel/releases/tag/%40vercel/hono%400.2.94) — score 0.652, source Vercel Releases
- [Business World Model](https://arxiv.org/abs/2606.10044) — score 0.697, source arXiv cs.AI
- [Deployment-Time Memorization in Foundation-Model Agents](https://arxiv.org/abs/2606.10062) — score 0.697, source arXiv cs.AI

## Impact Mapping Summary

```json
{
  "ok": true,
  "generatedAt": "2026-06-10T13:48:56.945Z",
  "daysAnalyzed": 14,
  "mappings": 275,
  "summary": {
    "low": 182,
    "high": 22,
    "medium": 71
  }
}
```

## No-Action Items (Noise Control)

- None.
