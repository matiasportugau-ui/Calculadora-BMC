# Recreation Checklist — Hostinger (public use)

**System:** Hostinger platform (external SaaS)  
**Goal:** With this SDD + evidence, a team can evaluate, purchase, provision, and integrate—without undocumented assumptions.  
**Not a goal:** Rebuild Hostinger infrastructure or UI.

**Capture date:** 2026-08-13

---

## Stack & bootstrap

- [x] **Platform type documented** — Managed hosting + VPS + domains + email + AI (CONFIRMED: `SDD.md` §1, `evidence/inventory.md`)
- [x] **Entry URLs listed** — `hostinger.com/es`, `hpanel.hostinger.com`, `developers.hostinger.com` (CONFIRMED: `evidence/surfaces.md`)
- [N/A] **Runtime version (Node/Python)** — Customer workloads vary; platform runtime internal (UNKNOWN — justified)
- [N/A] **Local dev clone** — No self-host of Hostinger control plane

## Configuration

- [x] **API auth shape** — `Authorization: Bearer {token}` from hPanel Account (CONFIRMED: developers portal)
- [x] **Token scopes** — Same as user; mail tokens scoped to order (CONFIRMED)
- [x] **No secret values in docs** — REDACTED policy in evidence rules
- [x] **Billing model** — Prepaid, promo vs renewal documented (`evidence/pricing-es.md`)

## Data

- [x] **Public entity model** — Account, subscription, website, domain, mailbox, VPS (`evidence/data-model.md`)
- [x] **API identifiers** — `virtualMachineId`, `username`, `domain`, etc. (CONFIRMED)
- [N/A] **Internal DB schema** — Not public

## Integrations

- [x] **Payment / commerce** — Stripe in Horizons; checkout host (CONFIRMED: `KB/integrations.md`)
- [x] **DNS/CDN** — Cloudflare protection, Hostinger CDN (CONFIRMED)
- [x] **LLM vendors** — AI Router model list (CONFIRMED)
- [x] **Dev tooling** — MCP, CLI, Terraform, SDKs (CONFIRMED)
- [x] **MCP / Connector** — Documented with GitHub repo links (CONFIRMED)

## Deploy (customer workloads)

- [x] **Shared/cloud path** — hPanel → WP / Builder / Node (CONFIRMED: traces flow 1)
- [x] **Horizons path** — Prompt → deploy → hosting (CONFIRMED: traces flow 2)
- [x] **VPS path** — KVM + templates + Docker (CONFIRMED: traces flow 3)
- [x] **Datacenter selection** — Multi-region public list (CONFIRMED: §8 SDD)
- [N/A] **Hostinger internal CI/CD** — UNKNOWN

## UI / routes (public)

- [x] **Marketing routes** — `/es/web-hosting`, `/es/cloud-hosting`, `/es/servidor-vps`, `/es/horizons` (CONFIRMED)
- [x] **Product apps** — horizons, reach, agents, builder, mail hosts (CONFIRMED)
- [x] **hPanel sections** — Websites, Domains, Emails, VPS, AI (CONFIRMED)

## Operations

- [x] **Support channels** — 24/7 chat, WhatsApp Kodee (CONFIRMED)
- [x] **Backups** — Tiered weekly/daily; VPS snapshots (CONFIRMED)
- [x] **API observability** — `correlation_id`, mail logs endpoints (CONFIRMED)
- [x] **Migration** — Free unlimited migrations (web/cloud) (CONFIRMED)

## API recreation gate

- [x] **OpenAPI version captured** — v1.32.4 (CONFIRMED)
- [x] **Namespaces listed** — billing, domains, dns, mail, hosting, vps (CONFIRMED: `evidence/surfaces.md`)
- [x] **Rate limit behavior** — 429, IP block (CONFIRMED)
- [ ] **Download OpenAPI JSON to repo** — Optional follow-up (not required for public-use gate)

---

## Pass summary

| Category | Done | N/A | Open |
|----------|------|-----|------|
| All sections | 28 | 4 | 1 optional |

**R7 status:** Pass for **public-use recreation** (≥90% items addressed).  
**Open P0:** None — optional OpenAPI artifact export tracked as nice-to-have in SDD §11.
