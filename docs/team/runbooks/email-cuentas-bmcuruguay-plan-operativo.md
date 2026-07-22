# Runbook — Cuentas de correo @bmcuruguay.com.uy operativas YA (costo $0)

**Fecha investigación:** 2026-07-08 · **Estado:** plan aprobable, pasos human-gated `[H]`
**Problema:** el equipo de ventas está sin casillas usables desde ~junio. Este runbook documenta
la causa verificada y la solución gratuita implementable hoy, sin romper el pipeline CRM/Omni.

---

## 1. Diagnóstico verificado (2026-07-08)

| Check | Resultado |
|---|---|
| `dig MX bmcuruguay.com.uy` | `route1/2/3.mx.cloudflare.net` → **Cloudflare Email Routing** (solo recepción/forward) |
| SPF | `v=spf1 include:_spf.mx.cloudflare.net ~all` (solo Cloudflare) |
| DMARC | `p=quarantine; rua=dmarc@bmcuruguay.com.uy` |
| NetUy `s111.nty.uy` (179.27.153.55) | Puertos 993/465 abiertos **pero login IMAP `ventas@` → `Authentication failed`** — casillas muertas (commit `6ad51505`) |
| Hub Gmail | Inbound llega por forwarding a `matias.portugau@gmail.com` + `bmctecnopanel@gmail.com` |
| Ingest CRM/Omni | **Funciona**: cron `email-ingest-scheduled.yml` → `POST /api/email/poll-gmail` → allowlist 6 casillas (`GMAIL_INGEST_ADDRESSES` en prod) |
| Outbound app | `emailReply.js`: Gmail API preferido; fallback SMTP por casilla **sin configurar** (accounts.json sin bloques `smtp`; `GMAIL_SEND_FROM` no está en prod) |

**Causa raíz de "ventas sin email":** la migración NetUy→Cloudflare dejó solo *recepción* hacia 2
Gmails hub compartidos. Nadie del equipo puede **enviar como** `@bmcuruguay.com.uy` (Gmail
"Send mail as" exige un SMTP para verificar el alias, y el SMTP NetUy ya no autentica), ni tiene
bandeja individual.

Casillas (migración 009/016 + allowlist): `ventas@`, `info@`, `administracion@`, `ml@`,
`mportugau@`, `sarias@`.

## 2. Solución recomendada — relay SMTP gratuito + Gmail por vendedor (hoy, $0)

Mantiene intacto TODO lo construido (Cloudflare inbound, hub Gmail, poller, Omni). Solo agrega
la pata de **envío** y bandejas individuales.

**Relay elegido: SMTP2GO free** — 1.000 mails/mes, DKIM/SPF de dominio propio, sin footer
publicitario. (Alternativa: Brevo 300/día pero agrega footer con marca en free.)

### [H1] Alta SMTP2GO + DNS (15 min, una vez)
1. Crear cuenta free en smtp2go.com; agregar *sender domain* `bmcuruguay.com.uy`.
2. En Cloudflare DNS agregar los CNAME DKIM + return-path que indique SMTP2GO.
3. SPF: fusionar en el TXT existente → `v=spf1 include:_spf.mx.cloudflare.net include:spf.smtp2go.com ~all`.
4. Crear **una credencial SMTP por casilla/vendedor** (usuarios SMTP separados = revocables).
5. Verificar con mail-tester.com: DKIM alineado `d=bmcuruguay.com.uy` → DMARC pasa (hoy `p=quarantine`).

### [H2] Recepción individual por vendedor (10 min por persona)
Opción simple (sin tocar Cloudflare): en el hub Gmail que hoy recibe la casilla, crear filtro
`to:sarias@bmcuruguay.com.uy` → *Forward to* Gmail personal del vendedor (verificar dirección de
reenvío). El poller/ingest no se afecta (sigue leyendo el hub).
Opción limpia: en Cloudflare Email Routing, un **Email Worker** que haga `message.forward()` al
hub **y** al Gmail del vendedor (ambos destinos verificados). Elegir una; documentar cuál quedó.

### [H3] Envío como la casilla (10 min por persona)
En el Gmail de cada vendedor: Settings → Accounts → **Send mail as** → `sarias@bmcuruguay.com.uy`
→ SMTP `mail.smtp2go.com:587 STARTTLS` + su credencial SMTP2GO → llega mail de verificación
(vía el forwarding de [H2]) → confirmar. Listo: lee y envía como su casilla desde Gmail
(web/móvil) o Thunderbird (guía existente `THUNDERBIRD-GMAIL-ESTA-COMPUTADORA.md`).

### [H4] Outbound de la app por casilla (opcional, 20 min)
En `conexion-cuentas-email-agentes-bmc/config/accounts.json` agregar a cada cuenta:
```json
"smtp": { "host": "mail.smtp2go.com", "port": 587, "secure": false,
          "user": "<smtp2go-user-casilla>", "passwordEnv": "EMAIL_BMC_VENTAS_PASS" }
```
y rotar los `EMAIL_<CASILLA>_PASS` en Doppler `bmc-backend/prd` + GCP Secret Manager con las
credenciales SMTP2GO (los valores NetUy actuales están muertos). `emailReply.js` ya soporta este
fallback sin cambios de código. Además, verificar en el hub Gmail los alias "Send mail as" de las
6 casillas (mismo SMTP2GO) y setear `GMAIL_SEND_FROM` si se quiere forzar From por Gmail API.

### Verificación final
1. Vendedor envía a un Gmail externo → llega a INBOX (no spam), From `@bmcuruguay.com.uy`, DKIM pass.
2. Cliente responde → llega al Gmail del vendedor **y** aparece en CRM/Omni (ingest intacto).
3. Cockpit `origen=Email` send-approved → 200 (ya no `email_reply_not_configured`).
4. `npm run smoke:prod` verde.

## 3. Alternativas evaluadas y descartadas (para hoy)

| Opción | Veredicto |
|---|---|
| **Zoho Mail free** (5 usuarios, dominio propio) | ❌ Rompe el sistema: exige cambiar MX (mata Cloudflare→hub→ingest), free sin IMAP/POP **ni forwarding** — el CRM quedaría ciego. Tope 5 usuarios (hay 6 casillas). |
| **Volver a NetUy** | ❌ Credenciales muertas; hosting probablemente dado de baja; reintroduce cPanel legacy. |
| **Self-hosted open source** (Mailcow / Mailu / **Stalwart** / docker-mailserver) | ⏳ No para "hoy": requiere VPS con puerto 25 + rDNS (GCP lo bloquea), warmup de IP, mantenimiento. Stalwart es el candidato moderno si algún día se quiere control total (~USD 5/mes VPS externo). |
| **Cloudflare Email Sending** | ❌ Requiere Workers Paid; pensado para transaccional, no bandejas humanas. |
| **Google Workspace** (USD ~7/usuario/mes) | ✅ La salida "seria" a mediano plazo: casillas reales, DKIM nativo, admin central. Migración simple desde el esquema propuesto (mismo dominio, MX a Google, ingest cambia a domain-wide delegation). |
| **Purelymail (~USD 10/año total) / Migadu Micro (~USD 19/año)** | ✅ Casi-gratis con IMAP/SMTP real ilimitado si el free de SMTP2GO queda chico y Workspace parece caro. |

**Umbral:** si el equipo supera ~1.000 envíos/mes sostenidos, pasar a SMTP2GO paid (USD 10/mes),
Purelymail, o decidir Workspace.

## 4. Referencias

- Mapa canónico: [`EMAIL-SOURCE-MAP.md`](../EMAIL-SOURCE-MAP.md)
- Poller/cron: [`email-cloud-run-poller.md`](./email-cloud-run-poller.md) (nota: §H2 SMTP NetUy quedó obsoleto — usar este runbook), `.github/workflows/email-ingest-scheduled.yml`
- Envío app: `server/lib/emailReply.js`, `server/lib/gmailSend.js`
- Thunderbird por máquina: `conexion-cuentas-email-agentes-bmc/docs/THUNDERBIRD-GMAIL-ESTA-COMPUTADORA.md`

---

## 5. Ejecución 2026-07-08 (goal run)

**Estado:** prep autónomo completo; bloqueado en un único gate humano (alta SMTP2GO).

### Hecho ✅
- Verificado: no existe credencial SMTP2GO/Brevo/relay en Doppler (`bmc-backend/prd`, `bmc-frontend/prd`) ni en el entorno; token wrangler/Cloudflare **expirado** (2025-08-23) → DNS se toca vía dashboard o nuevo API token.
- **[H4-prep]** `conexion-cuentas-email-agentes-bmc/config/accounts.json`: bloques `smtp` SMTP2GO (`mail.smtp2go.com:465 SSL`) agregados a las 5 casillas `@bmcuruguay.com.uy` (backup en `config/accounts.json.bak-pre-smtp2go`). `expresoeste-mportugau` **excluido** a propósito: dominio ajeno con MX propio (`mail.expresoeste.com.uy` = NetUy) — no relayear por el dominio BMC.
- Validado contra el resolver real: `resolveCasillaSmtp()` de `server/lib/emailReply.js` resuelve host/port/user/from correctos para las 5 casillas; `tests/emailReply.test.js` 16/16 y `tests/omniEmailReply.test.js` 13/13 verdes.
- Nuevo `scripts/verify-smtp2go.mjs` en el repo de correo: `node scripts/verify-smtp2go.mjs` (AUTH check por casilla) / `--send tu@mail` (envío real de prueba).

### Gate humano pendiente 🔴 [H1]
1. Crear cuenta free en **smtp2go.com** (sugerido con `administracion@bmcuruguay.com.uy` o el Gmail hub).
2. **Sender domain** → `bmcuruguay.com.uy` → copiar los 3 CNAME (DKIM ×2 aprox. + return-path/track) que da el wizard.
3. **SMTP Users**: crear 5 usuarios — recomendado con username = la casilla exacta (`ventas@bmcuruguay.com.uy`, etc.). Si el plan free limita a 1 SMTP user, crear uno solo (p. ej. `bmc-relay`) y avisar: se ajusta `smtp.user` en accounts.json a ese username compartido.
4. Entregar al agente: los CNAME + las passwords SMTP (o setearlas directo en Doppler, abajo).

### Post-gate (copy-paste listo)
**DNS (Cloudflare dashboard → bmcuruguay.com.uy → DNS):** agregar los CNAME del wizard **(DNS only, nube gris — no proxy)** y editar el TXT raíz:
```
v=spf1 include:_spf.mx.cloudflare.net include:spf.smtp2go.com ~all
```
**Secrets (rotar los 5 — valor = password SMTP2GO de cada casilla; `printf`, no `echo`):**
```bash
for C in ADMINISTRACION INFO ML MPORTUGAU VENTAS; do
  printf '%s' "$PASS_DE_LA_CASILLA" | doppler secrets set EMAIL_BMC_${C}_PASS --project bmc-backend --config prd --silent
  printf '%s' "$PASS_DE_LA_CASILLA" | gcloud secrets versions add EMAIL_BMC_${C}_PASS --project chatbot-bmc-live --data-file=-
done
# + .env del repo de correo (mismas vars) para verify-smtp2go.mjs local
```
**Verificar:** `dig +short TXT bmcuruguay.com.uy` (SPF con smtp2go) · `node scripts/verify-smtp2go.mjs --send <tu@gmail>` → mail-tester.com ≥9/10 → seguir [H2]/[H3] (§2).
