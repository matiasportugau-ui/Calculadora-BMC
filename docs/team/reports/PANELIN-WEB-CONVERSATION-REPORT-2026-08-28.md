# Panelin Web — conversation log report

**Fecha:** 2026-08-28  
**Agente:** `/panelin-web` (no operator Panelin BMC)  
**Ventana:** 2026-08-27 → 2026-08-28 (primeras ~48 h del widget público)  
**Cloud Run:** `panelin-calc` / `panelin-calc-01081-8dw` (`PUBLIC_STOREFRONT_VOICE=1`)  
**Git shop vs rama:** `origin/main` ya tiene `#1156` (saludo abierto + corte 30 s, `9e782d69` 05:47 UTC). El `widget.js` servido en Cloud Run sigue siendo el de **02:18 UTC** (~51 KB): la tienda **no** tiene el corte de silencio todavía.

## Hallazgo principal

**No hay transcripciones recuperables.** El contrato dice: identify → fila Admin 2.0 `origen=VW` → `POST /api/public/voice/log` escribe el chat en col J. En la práctica:

| Lo que debería quedar | Lo que hay |
|---|---|
| Filas `VW` en tab `Admin.` | **0** (workbook entero, todos los tabs) |
| Eventos `storefront_chat_log` (Postgres) | **0** |
| HTTP `POST /api/public/voice/log` en Cloud Run (7 d) | **0** |
| HTTP `POST /api/public/voice/chat` en Cloud Run (7 d) | **0** |

El chat de la tienda corre en voz (Grok S2S). El texto de esas vueltas vive en la sesión realtime y en el DOM (`#bmc-caps`) y **se pierde al cerrar**. No hay JSONL local (`data/conversations/` no existe para storefront).

Este informe es de **telemetría operacional** (sesiones, identify, tools, errores), no de contenido de conversación.

## Fuentes (evidencia)

1. Postgres `public.agent_voice_events` (mismo `DATABASE_URL` para local Doppler y Cloud Run) — 118 eventos storefront / 30 d, todos el 27–28 ago.
2. Cloud Logging HTTP `panelin-calc` path `/api/public/voice*` — 88 líneas / 7 d (set completo: el limit 400 no recortó).
3. Admin 2.0 Google Sheet (`WOLFB_ADMIN_TAB` default `Admin.`) vía Sheets API: 13 tabs, búsqueda `VW|Panelin|MAN-|Chat tienda|voz web|storefront`.
4. `GET /api/wolfboard/pendientes?scope=admin` en prod — 29 filas, orígenes `WA` / `LO` / `ML` / vacío. Cero `VW`.

PII: no se copian teléfonos ni nombres de shoppers. IPs solo agregadas.

## Volumen

### Eventos Postgres (local + prod mezclados)

El API local con Doppler escribe al **mismo** Cloud SQL. Por eso 118 ≠ HTTP de Cloud Run.

| kind | n | nota |
|---|---:|---|
| `storefront_session` | 76 | 21 con `pageUrl` de `bmcuruguay.com.uy`; el resto demo `127.0.0.1:3001` / theme `9292` |
| `storefront_lead` | 20 | se graba **aunque** el write a Admin falle (ver causa) |
| `storefront_identify` | 19 | idem |
| `storefront_chat` | 3 | solo API local (no hay `/chat` en logs de Cloud Run) |
| `storefront_chat_log` | 0 | `/log` nunca persistió |
| `storefront_lead_update` | 0 | nunca se actualizó una fila existente |
| `storefront_session_mint` (error) | 0 | el mint de voz no está fallando en métricas |

Por día: 27-ago 26 session / 2 identify / 3 lead / 2 chat · 28-ago 50 session / 17 identify / 17 lead / 1 chat (casi todo QA local: `?v=mictest|captions|micpin|keepstream`).

### HTTP Cloud Run (tienda + theme + curl)

| endpoint | POST 200 | POST 4xx | OPTIONS |
|---|---:|---:|---:|
| `/api/public/voice/session` | 23 | 5× **429** | 24×204 + 2×**403** |
| `/api/public/voice/action` | 12 | 3× **400** | 12×204 |
| `/api/public/voice/identify` | 3 | 0 | 4×204 |
| `/api/public/voice/chat` | 0 | 0 | 0 |
| `/api/public/voice/log` | 0 | 0 | 0 |

Identify 200 latencia **5–12 ms**. Un `values.append` a Sheets no entra en esa ventana. En la misma hora **no hay ningún** `POST /api/wolfboard/row-create` en Cloud Logging. Las 3 identifies “ok” **no crearon fila**.

### Quién llamó (agregado)

Sesiones POST únicas por IP: 4.

- Mac Chrome (misma IP que `curl` y `127.0.0.1:9292`): mayoría, incluidos los 5×429.
- iPad Safari: varias `action` 200 + 1×400.
- IPv6 residencial: 3 session + 3 action (mismo operador).
- **Windows Chrome: 1 session, 0 identify, 0 action** — único rastro que parece visitante de tienda que abrió voz y se fue.

Casi todo el tráfico de 48 h es QA (Matias: Mac, iPad, theme local, curl). Hay **como máximo un shopper real**, y no pasó el gate nombre+teléfono.

## Journeys en la tienda (URLs, no texto)

21 `storefront_session` con host `bmcuruguay.com.uy`:

| Cuándo (UTC) | Páginas | Señales |
|---|---|---|
| 27 08:00–08:47 | home | arranque + 1 action curl 400 |
| 27 09:11–10:38 | home → `/collections/isoroof` → `/products/iroof80-pls` | 2 actions; una **11.4 s** (cotización) |
| 27 17:49–18:15 | `/collections/all?page=4` → home | 4 actions; una **11.8 s**; 1×400 |
| 28 00:49–00:50 | home → `/collections/isodec` | 1 identify 200 (12 ms, sin fila) |
| 28 05:06–05:19 | home → galpones jardín → Cardelino → HM Rubber | 5×429 session; 1 identify; 3 actions (una **12.9 s**) |

Temas implícitos por URL + duración de `/action`: IsoRoof 80 PLUS, IsoDec, galpón Cardelino, goma líquida. **No se puede citar lo que dijo el shopper ni lo que contestó Panelin.**

Tools en el servidor (allowlist): las 3 actions de ~12 s son el único fingerprint de `calcular_cotizacion`. Las 400 (~620 B, <10 ms) son `Tool no permitida` — el modelo mandó una shop-tool (`shop_search` / `navigate` / `add_to_cart`) al API en vez de ejecutarla en el browser.

## Por qué no hay conversaciones en Admin

Cadena diseñada:

1. Widget gate → `POST /identify` → `capture_lead` → `wa_lead_to_admin` → `POST /api/wolfboard/row-create` (col F = `VW`, col I = `Chat tienda Panelin — inicio`).
2. Captions → debounce 2.5 s → `POST /log` con `adminRow` → col J.

Rotura observada:

1. **`identify` devuelve 200 sin write.** `executeTool` / `wolfboardForward` no llega a `row-create` (no hay log HTTP). `capture_lead` igual hace `recordVoiceEvent({ kind: "storefront_lead" })`. `identify` solo hace 502 si `parsed.ok === false`. Un `{ error: "..." }` **sin** `ok: false` (p. ej. throw de `fetch` envuelto en `executeTool`) queda como 200. `adminRow` cae a `parsed.id` o `null`.
2. **`flushLog` no corre sin `adminRow` numérico ≥ 2.** De ahí 0 `/log` y 0 `storefront_chat_log`.
3. **Prod no usa texto.** 0 `/chat`. Voz only; captions no se serializan si el log no dispara.
4. **Local QA** infla identify/lead en Postgres (19/20) contra el mismo Cloud SQL, con API local que aquí no pudo leer Sheets (`pendientes` local 503). Eso explica métricas de “lead” sin filas.

`WOLFB_DRY_RUN` no está seteado en Cloud Run. `PANELI_MCP_ALLOW_WRITES=1`. El denylist MCP de operator **no** cubre `executeTool` del storefront; no es la causa del 200 vacío.

Schema extra: tab `Admin.` en vivo usa col B = iniciales de operador (`MA`/`RA`/`TIN`), no `DD/MM/YYYY`. `row-create` igual escribe el schema A–M canónico. Si alguna fila VW hubiera aterrizado, `fecha` se vería `27/08/2026` o `28/08/2026`. No aparece.

## Errores operativos

| Código | Qué | Impacto |
|---|---|---|
| **429** session ×5 (28 05:10, shop, misma IP) | `SESSION_MAX=3` / 5 min en prod | QA en tienda corta el mic; shopper real en el mismo NAT también |
| **400** action ×3 | tool de tienda mandada al server | el modelo pierde el golpe de catálogo/nav; el shopper oye un fallo o un silencio |
| **403** OPTIONS session ×2 | origin `http://127.0.0.1:9292` vs CORS de una revisión vieja | theme local contra prod; ya hay 200 posteriores desde 9292 (allowlist actual incluye 9292) |

Mint de sesión: 23×200, 0×502. La voz **sí** arranca. El agujero es persistencia, no Grok token.

## Qué se puede y no se puede afirmar

**Se puede:** el widget en tienda abre voz; hay journeys IsoRoof / IsoDec / galpón / rubber; hay al menos una cotización server-side (action 11–13 s); el gate identify “parece” ok al browser y no deja rastro en Admin; el corte de silencio de `#1156` **no** está en el JS que sirve Cloud Run.

**No se puede:** reconstruir diálogos, scoring de calidad de respuesta, “dijo flete / no dijo flete”, ni si el PDF se ofreció. Eso requiere col J o un log propio de storefront.

## Fixes (prioridad)

1. **Identify honesto:** 502 a menos que `adminRow` sea `number ≥ 2`. No tratar `{ error }` como éxito.
2. **No emitir `storefront_lead` / `storefront_identify` hasta `ok: true` + `adminRow`.** Hoy las métricas mienten (20 leads, 0 filas).
3. **`wolfboardForward` en Cloud Run:** o loopback a `127.0.0.1:${PORT}` (aparece en logs de request y evita IAM/hairpin), o in-process `row-create`. Hoy el self-fetch a `PUBLIC_BASE_URL` **no deja** `row-create` y el identify igual da 200.
4. **Log de conversación propio** (tabla `storefront_turns` o JSONL diario) **además** de col J, privacy-safe (hash de teléfono, sin PCM). Col J no puede ser el único SoT: Cloud Run es efímero y el write a Sheets ya falló en silencio.
5. **Loguear `action.type`** en pino en `/action` 4xx/200. Sin eso las 400 son opacas.
6. **Rate limit de session:** 3/5 min es justo para un humano que recarga el orb. Subir en prod o exceptuar OPTIONS + retries del widget.

## Next

Cloud Run todavía sirve widget pre-`#1156`. Después de que `deploy-calc-api` tome `main` (`9e782d69`+): `/panelin-web shop` — un identify de prueba debe crear fila `VW` **visible** en Admin 2.0 y un `/log` debe llenar col J. Hasta que (1)+(3) no estén, ese QA va a “funcionar” en el browser y seguir vacío en la planilla.
