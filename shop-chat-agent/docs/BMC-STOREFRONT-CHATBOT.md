# Shopify Storefront AI Chat (BMC fork notes)

This folder is the official [Shopify shop-chat-agent](https://github.com/Shopify/shop-chat-agent) template (vendored into Calculadora-BMC without nested `.git`), plus BMC-specific wiring for **env-driven models**, **optional OpenAI fallback**, **configurable chat API URL** in the theme, and **prompt/tool guidance** for search, policies, recommendations, and cart.

Official reference: [Build a Storefront AI agent](https://shopify.dev/docs/apps/build/storefront-mcp/build-storefront-ai-agent).

---

## 1. Project structure (relevant paths)

| Area | Path | Role |
|------|------|------|
| Chat API (SSE) + MCP orchestration | `app/routes/chat.jsx` | Loader/action for `/chat`; connects MCP, streams Claude, tool loop, fallback |
| MCP client (storefront + customer) | `app/mcp-client.js` | Lists/calls tools on `{origin}/api/mcp` and Customer Account MCP |
| Claude | `app/services/claude.server.js` | Anthropic streaming + tools |
| Fallback LLM | `app/services/fallback-llm.server.js` | OpenAI text-only or static message if Claude fails |
| Config | `app/services/config.server.js` | Model, tokens, messages |
| Tool UX (product cards) | `app/services/tool.server.js` | Parses `search_shop_catalog` for product strip |
| System prompts | `app/prompts/prompts.json` | Assistant personas + MCP usage instructions |
| **Widget UI (storefront)** | `extensions/chat-bubble/blocks/chat-interface.liquid` | Renders bubble, loads `chat.js` / `chat.css`, injects `shopChatConfig` |
| **Widget client (backend calls)** | `extensions/chat-bubble/assets/chat.js` | `fetch` SSE to `/chat`, history, token polling |
| Env template | `.env.example` | Keys and optional overrides |

The **Calculadora BMC Vite storefront** (`../src/`) is unchanged; this app is a separate Node app run with Shopify CLI.

---

## 2. Where the widget renders vs backend calls

- **Render:** Theme app extension block **AI Chat Assistant** (`chat-interface.liquid`) targets `body`, fixed-position bubble + panel.
- **Backend calls:** `extensions/chat-bubble/assets/chat.js` posts to `{chatApiBase}/chat` (SSE), GET `{base}/chat?history=…`, GET `{base}/auth/token-status?…`.
- **App server:** React Router routes (e.g. `app/routes/chat.jsx`) implement `/chat`; MCP calls hit the **shop’s** `/api/mcp` from the browser origin.

---

## 3. Environment variables (store + model)

Copy `.env.example` to `.env` in **this directory** (never commit secrets).

| Variable | Purpose |
|----------|---------|
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | App credentials (Partner Dashboard) |
| `SCOPES` | As in Shopify app config |
| `REDIRECT_URL` | OAuth callback URL |
| `CLAUDE_API_KEY` or `ANTHROPIC_API_KEY` | Primary model (full tool use) |
| `CLAUDE_MODEL` / `ANTHROPIC_MODEL` | Optional model id override |
| `CLAUDE_MAX_TOKENS` | Optional cap |
| `OPENAI_API_KEY` | Optional fallback assistant (no MCP tools) |
| `FALLBACK_OPENAI_MODEL` | Default `gpt-4o-mini` |
| `FALLBACK_STATIC_MESSAGE` | Final fallback text if OpenAI also fails or is unset |
| `SHOPIFY_APP_URL` | Set by `shopify app dev` (tunnel) |

Theme block **Chat API base URL** must match the tunnel/app URL shoppers use (HTTPS).

---

## 4. Capabilities (how they are covered)

| Capability | Mechanism |
|------------|-----------|
| Product search | Shopify MCP tool `search_shop_catalog` (prompt instructs the model to call it) |
| Shipping / returns / policies | `search_shop_policies_and_faqs` |
| Recommendations | Prompt: multiple targeted `search_shop_catalog` queries + explanations (no separate MCP tool in template) |
| Cart | `get_cart`, `update_cart` (+ checkout links in assistant text) |
| Model outage | Try/catch around Claude stream → `getFallbackAssistantReply` → SSE `fallback_notice` + text chunk |

---

## 5. Plan of changes (BMC layer)

1. Vendor official template under `shop-chat-agent/` (no nested `.git`).
2. Document env + theme URL so production/tunnel is not hardcoded only in JS.
3. Extend system prompts with explicit MCP tool usage (search, policies, cart, orders).
4. Add optional OpenAI + static fallback when Claude errors (invalid key, overload, network).
5. Theme: setting `chat_api_base_url` + `chat.js` helper `getChatApiBase()`.
6. Document structure, testing, and local run for the team.

---

## 6. Diff by file (summary)

| File | Change |
|------|--------|
| `app/services/config.server.js` | Model/max tokens from env; `fallbackUsed` message |
| `app/services/claude.server.js` | `ANTHROPIC_API_KEY` alias |
| `app/services/fallback-llm.server.js` | **New** — OpenAI or static fallback |
| `app/routes/chat.jsx` | Import fallback; try/catch around `streamConversation`; SSE `fallback_notice` |
| `app/prompts/prompts.json` | MCP tool instructions (standard + enthusiastic) |
| `package.json` | Dependency `openai` |
| `.env.example` | Expanded Shopify + Claude + fallback vars |
| `extensions/chat-bubble/blocks/chat-interface.liquid` | Setting `chat_api_base_url`, pass `chatApiBase` |
| `extensions/chat-bubble/assets/chat.js` | `getChatApiBase()`, all `/chat` and auth URLs; handle `fallback_notice` |
| `extensions/chat-bubble/assets/chat.css` | Styles for `.shop-ai-fallback-notice` |
| `docs/BMC-STOREFRONT-CHATBOT.md` | **This file** |

---

## 7. Testing checklist

- [ ] `cp .env.example .env` and fill `CLAUDE_API_KEY`, Shopify app vars.
- [ ] `npm install` && `npm run typecheck` in `shop-chat-agent/`.
- [ ] `shopify app dev` (see Shopify docs); install app on dev store; enable theme block.
- [ ] Theme: set **Chat API base URL** to the CLI tunnel origin (HTTPS).
- [ ] Open storefront: bubble opens, welcome message shows.
- [ ] Message `hi` → assistant reply (Claude).
- [ ] `search for …` → tool_use lines + catalog results + product cards when applicable.
- [ ] Shipping/returns question → `search_shop_policies_and_faqs` (if MCP exposes it on your store).
- [ ] `add … to cart` / `what’s in my cart` → cart tools; checkout link formatting.
- [ ] Temporarily break Claude (wrong key) → `fallback_notice` + fallback text; with `OPENAI_API_KEY`, reply is model-generated short help.

---

## 8. Run locally (short)

1. Install [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) and log in.
2. `cd shop-chat-agent && npm install`
3. Copy `.env.example` → `.env` and set at least `CLAUDE_API_KEY`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `REDIRECT_URL` per your app config.
4. `npm run dev` (runs `shopify app dev`): use the preview URL, install the app, add the **AI Chat Assistant** block to the theme.
5. In the block settings, set **Chat API base URL** to the same HTTPS origin the CLI shows for the app (not `localhost` from the buyer’s browser unless you know what you’re doing).

For deeper behavior and MCP tool lists, see the [Storefront MCP docs](https://shopify.dev/docs/apps/build/storefront-mcp).
