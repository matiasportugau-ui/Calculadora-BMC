# Evidence — AI surfaces (§6 probe)

**Capture date:** 2026-08-13  
**Verdict:** AI is **core product**, not optional add-on. §6 is **not N/A**.

## AI product map

| Component | User-facing role | Integration surface | Tag |
|-----------|------------------|---------------------|-----|
| **Kodee** | Support + ops copilot (plans, DNS, WP, VPS) | Web chat, WhatsApp, hPanel Home chat, VPS web terminal (MCP) | CONFIRMED |
| **Horizons** | NL → web/app generation, deploy | `horizons.hostinger.com`, hPanel | CONFIRMED |
| **Reach** | AI email copy, brand styling | `reach.hostinger.com`, hPanel Email Marketing | CONFIRMED |
| **Backstage AI** | SEO / visibility automation | Marketing + hPanel (details sparse) | CONFIRMED |
| **AI tools** | Logo, image generation | Marketplace / bundled credits | CONFIRMED |
| **Hostinger Connector** | MCP: agent manages hosting, domains, stores | Free with active plan; IDE agents | CONFIRMED |
| **AI Agents platform** | Managed OpenClaw, Hermes, n8n | `agents.hostinger.com`, hPanel | CONFIRMED |
| **AI Router** | Unified LLM API for integrations | Models: Anthropic, OpenAI, DeepSeek, xAI, Mistral, Moonshot, MiniMax, StepFun, Z.ai | CONFIRMED |
| **WordPress AI** | Content, troubleshooting | Cloud/shared WP tooling | CONFIRMED |
| **VPS Kodee terminal** | NL → shell commands on VPS | MCP-powered; included with VPS | CONFIRMED |

## Credit economics

| Product | Credit model | Tag |
|---------|--------------|-----|
| Shared hosting | 5–15 “programación con IA” credits on plan | CONFIRMED |
| Horizons | Monthly AI credits; fractional use for live app AI features | CONFIRMED |
| Horizons | Top-up without plan upgrade | CONFIRMED |
| AI Router | Prepaid credits; usage dashboard (tokens, cache) | CONFIRMED |
| Standalone tool credits | Migrated to Agent credits (hPanel note) | CONFIRMED |

## Horizons technical (public)

- Outputs: responsive **web apps** (not native App Store / Play) (CONFIRMED).
- Integrations: Stripe native; generic REST for third parties (CONFIRMED).
- Deploy: one-click; uses bundled or existing hosting (CONFIRMED).
- Ownership: customer owns generated code on paid plans (CONFIRMED).

## MCP / agent infrastructure

| Artifact | Purpose | Tag |
|----------|---------|-----|
| `github.com/hostinger/api-mcp-server` | Hostinger API via MCP | CONFIRMED |
| hPanel “Hostinger API” | Connect IDEs | CONFIRMED |
| Kodee on VPS | MCP agent in web terminal | CONFIRMED |

## UNKNOWN (do not invent)

- Exact LLM model IDs per Horizons prompt turn
- Kodee system prompt, guardrails, PII retention policy (beyond “AI memory” toggle)
- Whether Backstage uses same router as AI Router
- Inference hosting region (EU vs US)

## Evidence commands / URLs

- hPanel AI Router models list: support article on hPanel (CONFIRMED names in support/1583483).
- Horizons credits FAQ: `hostinger.com/es/horizons/pricing`.
- Kodee WhatsApp: `hostinger.com/es` home footer.
