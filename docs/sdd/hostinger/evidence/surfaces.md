# Evidence — Public surfaces & API

**Capture date:** 2026-08-13

## Marketing & storefront (HTTPS)

| Surface | URL pattern | Purpose | Tag |
|---------|-------------|---------|-----|
| ES home | `hostinger.com/es` | Catalog hub, pricing | CONFIRMED |
| Web hosting | `hostinger.com/es/web-hosting` | Shared plans, features | CONFIRMED |
| Cloud hosting | `hostinger.com/es/cloud-hosting` | Cloud Startup/Pro/Enterprise | CONFIRMED |
| VPS | `hostinger.com/es/servidor-vps` | KVM plans, 1-click apps | CONFIRMED |
| Horizons | `hostinger.com/es/horizons` | AI builder marketing | CONFIRMED |
| Horizons pricing | `hostinger.com/es/horizons/pricing` | Plans & credits | CONFIRMED |
| n8n on VPS | `hostinger.com/es/applications/n8n` | VPS + Docker n8n | CONFIRMED |
| Legal / policies | `hostinger.com/es/legal/*` | ToS, fair use, disclosure | CONFIRMED |
| Support KB | `hostinger.com/support/*` | hPanel guides | CONFIRMED |
| Tutorials | `hostinger.com/*/tutoriales/*` | How-tos | CONFIRMED |

## Control plane & product apps

| Surface | Host | Purpose | Tag |
|---------|------|---------|-----|
| hPanel | `hpanel.hostinger.com` | Primary control panel | CONFIRMED |
| cPanel (legacy/alternate) | `cpanel.hostinger.com` | Alternate hosting panel | CONFIRMED |
| Payments | `payments.hostinger.com` | Checkout / billing | CONFIRMED |
| Website Builder | `builder.hostinger.com` | Drag-and-drop builder | CONFIRMED |
| Horizons app | `horizons.hostinger.com` | AI build workspace | CONFIRMED |
| Reach | `reach.hostinger.com` | Email marketing | CONFIRMED |
| AI Agents | `agents.hostinger.com` | Managed agent hosting | CONFIRMED |
| Webmail | `mail.hostinger.com` | Mailbox access | CONFIRMED |

## hPanel modules (from support docs)

| Section | Capabilities | Tag |
|---------|--------------|-----|
| Home | AI chat (Kodee), to-dos, business cards | CONFIRMED |
| Websites | Add/migrate sites (web, cloud, agency) | CONFIRMED |
| Domains | DNS zone, purchase, settings | CONFIRMED |
| Emails | Mailbox configuration | CONFIRMED |
| Marketplace | Upsell AI/automation tools | CONFIRMED |
| Horizons | Create/manage AI apps | CONFIRMED |
| Reach | Campaigns, lists, analytics | CONFIRMED |
| Ecommerce | AI stores, orders, payments | CONFIRMED |
| Agents | OpenClaw, Hermes, n8n managed | CONFIRMED |
| VPS | VM dashboard, Docker manager | CONFIRMED |
| GPU | Waitlist | CONFIRMED |
| Hostinger API / MCP | IDE integration | CONFIRMED |
| AI Router | Multi-model credits & usage | CONFIRMED |
| Account | Billing, 2FA, sharing, AI memory | CONFIRMED |

Source: `hostinger.com/support/1583483-comprehensive-guide-to-hpanel-at-hostinger/`.

## Hostinger API (OpenAPI v1.32.4)

**Base:** REST, `Content-Type: application/json`, `Authorization: Bearer {token}`  
**Token:** Created on hPanel Account page; same permissions as user; optional expiry  
**Rate limit:** 429 on abuse; IP may be temporarily blocked  
**Pagination:** Default 50 items; `?page=N`  
**Errors:** JSON with `error`, `correlation_id`  
Source: `developers.hostinger.com`.

### API namespace summary

| Prefix | Domain | Example operations | Tag |
|--------|--------|-------------------|-----|
| `/api/billing/v1` | Catalog, orders, payment methods, subscriptions | `GET catalog`, `POST orders` | CONFIRMED |
| `/api/domains/v1` | Availability, portfolio, WHOIS, transfer, forwarding, move | `GET portfolio`, `POST availability` | CONFIRMED |
| `/api/dns/v1` | Zones, records, snapshots | `GET zones/{domain}`, `POST snapshots/.../restore` | CONFIRMED |
| `/api/mail/v1` | Mail orders, mailboxes, aliases, webhooks, logs | `POST mailboxes`, `POST webhooks` | CONFIRMED |
| `/api/hosting/v1` | Websites, files, DBs, cron, cache, Node.js, PHP, datacenters | `GET websites`, `POST databases` | CONFIRMED |
| `/api/vps/v1` | VMs, backups, Docker, firewall, templates, SSH keys, actions | `GET virtual-machines`, `POST docker` | CONFIRMED |
| `/api/v2/direct/verifications` | Domain verification | `GET .../active` | CONFIRMED |

### SDKs & integration tools (official)

Ansible, CLI, n8n node, **MCP server**, PHP/Python/TypeScript SDKs, Terraform, Postman, WHMCS (CONFIRMED: developers portal).

## Support channels

| Channel | Detail | Tag |
|---------|--------|-----|
| Live chat | 24/7 via hPanel “Ask AI” / support | CONFIRMED |
| WhatsApp | +16594444429 (Kodee) | CONFIRMED |
| GitHub | API issues/discussions | CONFIRMED |

## UNKNOWN

- Full OpenAPI path list for Reach-specific REST (may be hPanel-only)
- Webhook/event bus for hosting lifecycle (beyond mail webhooks)
- Internal service mesh between Horizons and hosting provisioner
