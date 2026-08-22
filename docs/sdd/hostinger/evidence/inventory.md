# Evidence — Product inventory (BFS)

**Capture date:** 2026-08-13  
**Primary locale:** `https://www.hostinger.com/es`

## Company scale (marketing)

| Claim | Tag | Source |
|-------|-----|--------|
| +5M customers | CONFIRMED | `hostinger.com/es` home |
| +150 countries | CONFIRMED | `hostinger.com/es` home |
| +20 years experience | CONFIRMED | `hostinger.com/es` home |
| +10M websites created | CONFIRMED | `hostinger.com/es` home |

## Product lines

### Shared / web hosting (managed)

| Plan | Sites | Storage | Backups | CDN | AI credits/mo | Email (1y promo) | Tag |
|------|-------|---------|---------|-----|---------------|------------------|-----|
| Single | 1 | 10 GB SSD | Weekly | Yes | 5 | 1 mailbox | CONFIRMED |
| Premium | 3 | 20 GB SSD | Weekly | Yes | 5 | 2/site | CONFIRMED |
| Unlimited | Unlimited* | 50 GB NVMe | Daily | Yes | 15 | Unlimited/site* | CONFIRMED |
| Cloud Startup | Unlimited* | 100 GB NVMe | Daily + on-demand | Yes | 15 | Unlimited/site* | CONFIRMED |

\* Subject to fair-use policy (CONFIRMED: plan footers on `/es` and `/es/web-hosting`).

**Stack (public):** LiteSpeed, NVMe SSD on upper tiers, Object Cache, integrated CDN, Node.js support, WordPress 1-click, Website Builder drag-and-drop, integrated ecommerce (CONFIRMED: `/es/web-hosting`).

### Cloud hosting (managed, H5G-related)

| Tier | Promo (48 mo) | Renew (example) | CPU/RAM (Startup) | Uptime claim | Tag |
|------|---------------|-----------------|-------------------|--------------|-----|
| Cloud Startup | 7,99 €/mo | 23,99 €/mo | 4 CPU / 4 GB RAM | 99.9% | CONFIRMED |
| Cloud Professional | 14,99 €/mo | (see pricing page) | — | 99.9% | CONFIRMED |
| Cloud Enterprise | 29,99 €/mo | (see pricing page) | — | 99.9% | CONFIRMED |

Resources vs shared: **4× speed, 20× resources**, dedicated IP, 2M inodes / 100 PHP workers (Startup) (CONFIRMED: `/es/cloud-hosting`).

**Agency hosting:** H5G infrastructure, site isolation, per-site access sharing (CONFIRMED: security disclosure policy 2026-07-13).

### VPS (KVM, self-managed + AI assist)

| Plan | vCPU | RAM | NVMe | Bandwidth | Promo/mo | Renew/mo (2y) | Tag |
|------|------|-----|------|-----------|----------|---------------|-----|
| KVM 1 | 1 | 4 GB | 50 GB | 4 TB | 5,49 € | 11,99 € | CONFIRMED |
| KVM 2 | 2 | 8 GB | 100 GB | 8 TB | 7,79 € | 14,99 € | CONFIRMED |
| KVM 4 | 4 | 16 GB | 200 GB | 16 TB | 10,99 € | 27,99 € | CONFIRMED |
| KVM 8 | 8 | 32 GB | 400 GB | 32 TB | 21,99 € | 49,99 € | CONFIRMED |

**Included:** AMD EPYC, 1 Gbps network, weekly backups + snapshots, firewall mgmt, public API, AI web terminal (Kodee), free domain 1y (CONFIRMED: `/es/servidor-vps`).

**1-click apps:** Docker catalog (n8n, OpenClaw, Hermes Agent, WordPress, etc.), OS templates, optional panels (cPanel, Plesk, CyberPanel, DirectAdmin) (CONFIRMED: VPS page + tutorials).

### Hostinger Horizons (AI app/site builder)

| Plan | AI credits/mo | Sites | Hosting bundled | Tag |
|------|---------------|-------|-------------------|-----|
| Free trial | 5 (one-time) | 1 draft | No publish hosting | CONFIRMED |
| Explorer | 30 | 1 | Yes (1y promo mailbox) | CONFIRMED |
| Starter | 70 | 25 | Yes (+ domain 1y) | CONFIRMED |
| Hobbyist | 200 | 50 | Yes (+ code editor) | CONFIRMED |

Host at `horizons.hostinger.com`; deploy uses included or existing hosting; renews separately from Horizons subscription (CONFIRMED: `/es/horizons/pricing`).

### Email & marketing

| Product | Purpose | Surface | Tag |
|---------|---------|---------|-----|
| Hostinger Email | Branded mailboxes | hPanel Emails | CONFIRMED |
| Hostinger Reach | Email marketing + AI copy | `reach.hostinger.com`, hPanel | CONFIRMED |

### Domains

Registration, DNS zone, forwarding, privacy, transfers (CONFIRMED: API `domains/v1`, `dns/v1`; marketing “domain free 1y” on annual plans).

### AI & automation (platform)

| Surface | Role | Tag |
|---------|------|-----|
| Kodee | AI agent (chat, WhatsApp +16594444429, hPanel Home chat) | CONFIRMED |
| Backstage AI | SEO / task automation (marketing) | CONFIRMED |
| AI tools | Logo/image generators (marketing) | CONFIRMED |
| Hostinger Connector | MCP bridge for IDE agents → hosting/domains/stores | CONFIRMED |
| AI Agents platform | `agents.hostinger.com` — OpenClaw, Hermes, n8n managed | CONFIRMED |
| AI Router | Multi-model gateway (Anthropic, OpenAI, DeepSeek, xAI, Mistral, etc.) | CONFIRMED |
| hPanel Hostinger API (MCP) | Connect IDEs to Hostinger MCP | CONFIRMED |

### Developer API

OpenAPI **v1.32.4**, REST, bearer token from hPanel Account (CONFIRMED: `developers.hostinger.com`).

**API families (non-exhaustive):** `billing/v1`, `domains/v1`, `dns/v1`, `mail/v1`, `hosting/v1`, `vps/v1`, `reach/v1` (INFERRED from OpenAPI index — verify per endpoint in `surfaces.md`).

### Public hostnames (security scope)

`www.hostinger.com`, `hpanel.hostinger.com`, `cpanel.hostinger.com`, `payments.hostinger.com`, `builder.hostinger.com`, `horizons.hostinger.com`, `reach.hostinger.com`, `agents.hostinger.com`, `mail.hostinger.com` (CONFIRMED: responsible disclosure policy 2026-07-13).

## Commercial terms (cross-product)

| Term | Value | Tag |
|------|-------|-----|
| Money-back guarantee | 30 days | CONFIRMED |
| Billing | Prepaid; displayed monthly = total ÷ months | CONFIRMED |
| Support | 24/7; priority on upper tiers | CONFIRMED |
| Migration | Free unlimited site migrations (web/cloud) | CONFIRMED |

## UNKNOWN (not found in public pass)

- Exact CPU/RAM/inode tables for all shared tiers (pointer only to support article)
- Internal LLM routing costs for Kodee/Horizons
- Uruguay (`hostinger.com.uy` or similar) price list
