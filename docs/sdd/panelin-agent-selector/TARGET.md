# Target — Panelin In-Chat AI Agent Selector

**Slug:** `panelin-agent-selector`  
**Question:** Can we generate a real AI agent selector inside the Panelin chat window (not main calculadora UI) that also affects voice?

**Answer:** **Yes.**

| Surface | Feasibility |
|---------|-------------|
| Text chat multi-provider | **Ready** — API + `useChat` already support `aiProvider`/`aiModel`; need UI in `PanelinChatPanel` |
| Placement in chat only | **Ready** — do not put control on main calculator chrome |
| Voice uses same preference | **Partial** — voice is **OpenAI Realtime only**; selector can choose Realtime model + disable voice when OpenAI not ready; cannot run Claude/Gemini as Realtime engine without new stack |

**SDD:** `docs/sdd/panelin-agent-selector/SDD.md`
