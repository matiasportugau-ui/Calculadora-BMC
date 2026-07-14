# Knowledge Antenna Report — 2026-06-13

Generated at: 2026-06-13T13:00:16.533Z

## Panelin Signal — revista interna (HTML)

Lectura humana en el navegador: diseño editorial con el conocimiento actual del agente. Se actualiza al ejecutar este reporte o `npm run knowledge:magazine` (solo regenera HTML desde los JSON).

- [Última edición](./KNOWLEDGE-MAGAZINE-latest.html) (siempre apunta al último build)
- [Edición del día](./KNOWLEDGE-MAGAZINE-2026-06-13.html) (archivo fechado)

*Nota:* una futura edición pública puede reutilizar la misma plantilla con fuentes y textos curados aparte.

## Executive Summary

- Sources scanned: 9
- Raw events fetched: 64
- New references saved: 17
- Accepted events: 17
- No-action events: 0
- New source candidates discovered: 0

## Source Ranking (Top)

1. OpenAI News (0.9313) [active]
2. Vercel Releases (0.8974) [active]
3. Vercel AI SDK Releases (0.8941) [active]
4. Anthropic SDK Releases (0.8847) [active]
5. arXiv cs.AI (0.8501) [active]
6. Hugging Face Blog (0.8445) [active]
7. OpenAI Node SDK Releases (0.8127) [active]
8. MCP TypeScript SDK Releases (0.7849) [active]

## Tactical Recommendations (This Week)

- Validate high-priority impact mappings in `docs/team/knowledge/impact-map.json`.
- Route deployment-related updates into `scripts/deploy-vercel.sh` and `scripts/deploy-cloud-run.sh` checks.
- Review LLM provider updates for action/API compatibility in `server/gptActions.js`.
- Sync major findings into `docs/team/PROJECT-STATE.md` only when they become concrete implementation tasks.

## Accepted Events

- [<![CDATA[New OpenAI Academy courses for the next era of work]]>](https://openai.com/index/academy-courses-applying-ai-at-work) — score 0.623, source OpenAI News
- [vercel@54.13.0](https://github.com/vercel/vercel/releases/tag/vercel%4054.13.0) — score 0.732, source Vercel Releases
- [@vercel/fs-detectors@6.9.0](https://github.com/vercel/vercel/releases/tag/%40vercel/fs-detectors%406.9.0) — score 0.652, source Vercel Releases
- [@vercel/frameworks@3.29.0](https://github.com/vercel/vercel/releases/tag/%40vercel/frameworks%403.29.0) — score 0.652, source Vercel Releases
- [@vercel/express@0.1.105](https://github.com/vercel/vercel/releases/tag/%40vercel/express%400.1.105) — score 0.652, source Vercel Releases
- [@vercel/connect@0.2.4](https://github.com/vercel/vercel/releases/tag/%40vercel/connect%400.2.4) — score 0.652, source Vercel Releases
- [@vercel/cervel@0.1.22](https://github.com/vercel/vercel/releases/tag/%40vercel/cervel%400.1.22) — score 0.652, source Vercel Releases
- [@vercel/backends@0.8.14](https://github.com/vercel/vercel/releases/tag/%40vercel/backends%400.8.14) — score 0.652, source Vercel Releases
- [ai@6.0.204](https://github.com/vercel/ai/releases/tag/ai%406.0.204) — score 0.5685, source Vercel AI SDK Releases
- [ai@6.0.203](https://github.com/vercel/ai/releases/tag/ai%406.0.203) — score 0.6485, source Vercel AI SDK Releases
- [ai@5.0.200](https://github.com/vercel/ai/releases/tag/ai%405.0.200) — score 0.6485, source Vercel AI SDK Releases
- [@ai-sdk/xai@3.0.95](https://github.com/vercel/ai/releases/tag/%40ai-sdk/xai%403.0.95) — score 0.6485, source Vercel AI SDK Releases
- [@ai-sdk/xai@2.0.74](https://github.com/vercel/ai/releases/tag/%40ai-sdk/xai%402.0.74) — score 0.6485, source Vercel AI SDK Releases
- [@ai-sdk/vue@3.0.203](https://github.com/vercel/ai/releases/tag/%40ai-sdk/vue%403.0.203) — score 0.5685, source Vercel AI SDK Releases
- [@ai-sdk/vue@2.0.200](https://github.com/vercel/ai/releases/tag/%40ai-sdk/vue%402.0.200) — score 0.5685, source Vercel AI SDK Releases
- [@ai-sdk/voyage@1.0.6](https://github.com/vercel/ai/releases/tag/%40ai-sdk/voyage%401.0.6) — score 0.5685, source Vercel AI SDK Releases
- [olmo-eval: An evaluation workbench for the model development loop](https://huggingface.co/blog/allenai/olmo-eval) — score 0.6345, source Hugging Face Blog

## Impact Mapping Summary

```json
{
  "ok": true,
  "generatedAt": "2026-06-13T13:00:16.531Z",
  "daysAnalyzed": 14,
  "mappings": 300,
  "summary": {
    "medium": 74,
    "low": 203,
    "high": 23
  }
}
```

## No-Action Items (Noise Control)

- None.
