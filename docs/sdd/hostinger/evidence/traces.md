# Evidence — Primary user flows

**Capture date:** 2026-08-13

## Flow 1 — Purchase shared hosting (web)

```mermaid
sequenceDiagram
  participant U as Customer
  participant Web as hostinger.com/es
  participant Pay as payments.hostinger.com
  participant HP as hPanel

  U->>Web: Select plan (e.g. Premium 48mo)
  Web->>Pay: Checkout prepaid bundle
  Pay-->>U: Payment confirmation
  U->>HP: Login / auto-provision
  HP-->>U: Claim free domain (annual+)
  U->>HP: Add website (WP / Builder / Node)
  HP-->>U: Site live on LiteSpeed + CDN
```

Tag: CONFIRMED (marketing + web-hosting FAQ + hPanel websites section).

## Flow 2 — Horizons build & deploy

```mermaid
sequenceDiagram
  participant U as Customer
  participant H as horizons.hostinger.com
  participant AI as Horizons agent
  participant HP as hPanel
  participant Host as Hosting stack

  U->>H: Natural-language prompt
  H->>AI: Generate / iterate app
  AI-->>H: Preview (mobile/desktop)
  U->>H: Deploy
  H->>Host: Publish to included/existing hosting
  U->>HP: Optional custom domain + mail
```

Tag: CONFIRMED (`/es/horizons`, `/es/horizons/pricing`).

## Flow 3 — VPS provision + API automation

```mermaid
sequenceDiagram
  participant Dev as Developer
  participant Web as hostinger.com/es/servidor-vps
  participant HP as hPanel
  participant VPS as KVM VM
  participant API as Hostinger API

  Dev->>Web: Choose KVM plan + DC
  Dev->>HP: Provision VM + 1-click template
  HP->>VPS: OS / Docker / n8n
  Dev->>API: Bearer token + GET /api/vps/v1/virtual-machines
  Dev->>VPS: Kodee web terminal (optional)
  API->>VPS: Lifecycle actions (backup, firewall, docker)
```

Tag: CONFIRMED (VPS page + developers.hostinger.com).

## Flow 4 — Professional email + Reach campaign

```mermaid
sequenceDiagram
  participant U as Customer
  participant HP as hPanel
  participant Mail as mail.hostinger.com
  participant Reach as reach.hostinger.com

  U->>HP: Create mailbox on domain
  U->>Mail: Configure client access
  U->>Reach: Create campaign (AI copy)
  Reach-->>U: Send / automate sequences
```

Tag: CONFIRMED (home + hPanel Emails / Email Marketing sections).

## Flow 5 — Developer API token usage

```mermaid
sequenceDiagram
  participant Dev as Developer
  participant HP as hPanel Account
  participant API as api.hostinger.com
  participant Svc as Domains/DNS/VPS/Mail

  Dev->>HP: Create API token
  Dev->>API: Authorization Bearer REDACTED
  API->>Svc: CRUD per OpenAPI
  Svc-->>Dev: JSON + correlation_id on error
```

Base host for API calls: INFERRED from SDK/docs (exact hostname not verified in this pass — use OpenAPI server URL from downloaded spec). Token creation: CONFIRMED (developers portal).
