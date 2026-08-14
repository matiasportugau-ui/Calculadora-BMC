# Evidence — Public data model (conceptual)

**Capture date:** 2026-08-13  
**Scope:** Entities observable from marketing, hPanel docs, and OpenAPI — **not** internal DB schema.

## Core account graph

```text
Account (Hostinger user)
├── Subscriptions[] (billing/v1)
├── PaymentMethods[]
├── ApiTokens[] (account-level + mail-scoped)
├── SharedAccess[] (collaborators)
└── Services[]
    ├── HostingOrder → Websites[]
    ├── CloudOrder → Websites[]
    ├── VpsVirtualMachine[]
    ├── DomainPortfolio[]
    ├── MailOrder → Mailboxes[]
    ├── HorizonsProject[]
    ├── ReachCampaign[] (INFERRED — UI in hPanel)
    └── AgentInstance[] (OpenClaw/Hermes/n8n)
```

## Entity notes

### Account

- Auth: email/password, optional social login, 2FA (CONFIRMED: hPanel account menu).
- AI memory store for Kodee personalization (CONFIRMED).

### Subscription / Order

- Prepaid terms; auto-renew toggles via API (`PATCH .../auto-renewal`) (CONFIRMED: billing API).
- Catalog endpoint lists plan SKUs and pricing (CONFIRMED).

### Website (hosting/cloud)

- Bound to hosting account username + domain (CONFIRMED: `/api/hosting/v1/accounts/{username}/websites/{domain}/...`).
- Capabilities: cache toggle, cron jobs, MySQL DBs, file manager, Node.js apps, PHP version (CONFIRMED: hosting API groups).

### Domain

- Portfolio entry: nameservers, lock, privacy, auth code, renewal (CONFIRMED: domains API).
- DNS zone with records; snapshots for rollback (CONFIRMED: dns API).

### Mailbox (mail)

- Belongs to mail order; protocols, aliases, forwarders, catch-all, autoreply, webhooks (CONFIRMED: mail API).
- Separate mail API tokens scoped to order (CONFIRMED).

### VPS (VirtualMachine)

- Attributes: plan tier, datacenter, template, firewall, backups, snapshots, Docker projects (CONFIRMED: vps API + marketing).
- Actions async (`actions/{actionId}`) (CONFIRMED).

### HorizonsProject

- AI credits balance; published site linked to hosting subscription (CONFIRMED: pricing FAQ).
- Code ownership downloadable on paid plans (CONFIRMED).

### AgentInstance (managed automation)

- Bundled OpenClaw + Hermes + n8n under managed hosting plans (CONFIRMED: hPanel sidebar).
- Credits managed in hPanel (CONFIRMED).

## Identifiers (API)

| ID type | Used in | Tag |
|---------|---------|-----|
| `virtualMachineId` | VPS routes | CONFIRMED |
| `orderId` (mail) | Mail routes | CONFIRMED |
| `mailboxId` | Mail entity | CONFIRMED |
| `username` (hosting account) | Hosting routes | CONFIRMED |
| `domain` | DNS, hosting, domains | CONFIRMED |
| `subscriptionId` | Billing | CONFIRMED |

## UNKNOWN

- Horizons project ID format in public API (no Horizons group found in OpenAPI index)
- Reach subscriber/list IDs in REST
- Cross-region replication model for NVMe storage
