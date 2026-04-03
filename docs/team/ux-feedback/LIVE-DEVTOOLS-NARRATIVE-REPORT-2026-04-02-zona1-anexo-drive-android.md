# LIVE-DEVTOOLS-NARRATIVE-REPORT — 2026-04-02

Skill: [`.cursor/skills/live-devtools-narrative-mcp/SKILL.md`](../../.cursor/skills/live-devtools-narrative-mcp/SKILL.md). Invocación: **Live DevTools narrative** / **Narrativa en vivo DevTools**.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-02 |
| Base URL | `https://calculadora-bmc.vercel.app` |
| Entorno | prod |
| Navegador / MCP | **chrome-devtools MCP:** `navigate_page` falló — *“The browser is already running for … chrome-profile. Use --isolated…”*. **Fallback:** MCP **cursor-ide-browser** (`browser_navigate`, `browser_snapshot`, `browser_console_messages`, `browser_network_requests`). |
| Participantes | Matías (narrativa); agente (evidencia). |

---

## 2. Objetivo de la sesión

- **Goal (una frase):** Alinear el modelo mental de **“otras medidas / anexo lateral en zona 1”** con la obra real (misma superficie, mismos paneles en contacto) y señalar el tema **Drive en Android**; documentar expectativa vs estado observable en la app desplegada.
- **Criterios de éxito del usuario:**
  1. Que **anexo lateral u otras medidas** sobre el tramo principal se entiendan como **la misma Zona 1** (no como “otra zona” jerárquica distinta), con medidas que **alteran el tamaño del techo** al mismo nivel que el principal.
  2. Que **no se cree otra zona** cuando todo sigue siendo **una superficie de techo independiente** con piezas contiguas (solo otra **superficie** debería ser otra zona).
  3. Recuperar o replantear **capacidad Drive en Android** (pérdida reportada por el usuario).

---

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

_Texto normalizado del dictado; sin inventar pasos._

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | Paso 1 | Reporta pérdida de **capacidad Drive en Android** para “estas piezas”. | Volver a poder usar Drive desde Android en el flujo que antes funcionaba (alcance exacto a precisar: PWA, WebView, OAuth). |
| U-02 | Paso 2 | En **zona 1**, con **anexo lateral / otras medidas**, el producto debería tratarlo como **la misma zona 1**: poder **agregar o aplicar** las medidas que ya existen; si se modifican, **cambian el tamaño del techo**. | Una sola entidad “Zona 1” con variantes de medida que redibujan la superficie, no una segunda tarjeta “Zona 2” solo por otra medida lateral. |
| U-03 | Paso 3 | Si se agrega **otra parte** del techo pero **todo queda junto / contiguo**, **no** debería crearse **otra zona**; **zona = superficie de techo independiente**. | Solo crear zona nueva cuando sea **otro cuerpo / superficie independiente**; contigüidad con contacto de paneles = mismo modelo de superficie. |
| U-04 | Paso 4 | La **naturaleza del producto** (paneles que **contactan**) exige esa posibilidad; así es **en la realidad**. | Modelo de datos y UI coherentes con obra: laterales y medidas mixtas sin forzar multizona artificial. |

---

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Tras invocación | `call_mcp_tool` → **project-0-Calculadora-BMC-chrome-devtools** / `navigate_page` | Error: perfil Chrome DevTools MCP ya en uso; no se pudo abrir sesión aislada desde aquí. |
| E-02 | Post-navegación prod | **cursor-ide-browser** / `browser_navigate` → `https://calculadora-bmc.vercel.app/` | Título **Calculadora BMC**; URL correcta. |
| E-03 | Mismo cierre | **cursor-ide-browser** / `browser_snapshot` | Shell visible: enlaces Wolfboard / Calculadora / Logística; botones **Vendedor**, **Cliente**, **Config**, **Drive**, **Presupuestos**, **Limpiar**, **Imprimir**, **Siguiente**. El control **Drive** (`ref: e6`) **está presente** en la barra superior de la SPA prod (no prueba Android). |
| E-04 | Mismo cierre | **cursor-ide-browser** / `browser_network_requests` | `GET` **200** a `…/PanelinCalculadoraV3_backup-….js`, `calcApiBase-….js`, `OrbitControls-….js` (carga principal OK). |
| E-05 | Mismo cierre | **cursor-ide-browser** / `browser_console_messages` | Mezcla de mensajes de **sesiones previas** (`http://localhost:5173/`: Vite, React Router *future flag* warnings) y aviso `[CursorBrowser]` en `https://calculadora-bmc.vercel.app/`. **No** se observó error de app bloqueante en la muestra devuelta para la URL prod; no se puede atribuir limpieza total de consola sin sesión dedicada solo-Vercel. |

JSON hermano: [`LIVE-DEVTOOLS-NARRATIVE-EVIDENCE-2026-04-02-zona1-anexo-drive-android.json`](./LIVE-DEVTOOLS-NARRATIVE-EVIDENCE-2026-04-02-zona1-anexo-drive-android.json).

---

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01, E-03 | **parcial** | En **desktop prod** el botón **Drive** existe en el shell; **Android** no fue reproducible con MCP; causa de “pérdida” (navegador, cookies, API Google, PWA) requiere **repro en dispositivo** + red móvil. |
| U-02 | — | **no** (producto actual, por diseño previo) | Hoy el anexo lateral se modela como **otra fila en `techo.zonas`** con `attachParentGi` (ver [`ROOF-LATERAL-ANNEX-SAME-BODY-SPEC.md`](./ROOF-LATERAL-ANNEX-SAME-BODY-SPEC.md)), no como “sub-medidas” dentro de un único objeto zona. La expectativa del usuario es **colapsar** eso en **una sola Zona 1** en UI y semántica. |
| U-03 | — | **parcial** | La regla de negocio deseada (“contiguo = misma superficie”) **no** está expresada así en UI: cualquier anexo sigue siendo **índice de zona** distinto para cotización/BOM. |
| U-04 | E-03, E-04 | **parcial** | La app carga y expone flujo techo multizona; la **semántica “misma superficie”** vs **N zonas** es la brecha conceptual (U-02/U-03), no la disponibilidad básica de la SPA. |

---

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable |
|----|-----------|--------|---------|----------------|
| LDN-2026-04-02-07 | **P1** | Modelo “una zona” vs anexo como segunda zona | El usuario pide que **anexo lateral / otras medidas** vivan en la **misma Zona 1** (medidas que alteran tamaño al mismo nivel jerárquico). El código actual usa **varias entradas `zonas[]`** con metadatos de anexo. | `src/components/PanelinCalculadoraV3_backup.jsx`, `src/utils/roofLateralAnnexLayout.js`, eventual refactor de modelo `techo.zonas` o capa de presentación. |
| LDN-2026-04-02-08 | **P1** | Drive en Android | Reporte de **pérdida de capacidad** no verificada en esta sesión; en prod desktop el botón **Drive** aparece. | `src/` (flujo OAuth / picker), entorno Android (Chrome/Samsung Internet, bloqueos third-party cookies), sin evidencia MCP móvil. |
| LDN-2026-04-02-09 | **P2** | chrome-devtools MCP bloqueado por perfil en uso | Imposible repetir protocolo canónico **solo** con chrome-devtools sin `--isolated` o cerrar instancia previa. | Entorno local / configuración MCP (`.cursor/mcp.json`). |

---

## 7. Recomendaciones y siguientes pasos

1. **Producto / modelo:** Definir si “**misma Zona 1**” es **solo UX** (una tarjeta con sub-bloques “principal + lateral”, pero internamente sigue `zonas[]`) o **refactor** hacia `zona.tramos[]` / `subSuperficies[]` con un solo índice de zona para BOM agregado. Documentar decisión en [`ROOF-LATERAL-ANNEX-SAME-BODY-SPEC.md`](./ROOF-LATERAL-ANNEX-SAME-BODY-SPEC.md) o spec hija.
2. **Drive Android:** Checklist humano: mismo usuario en Android, URL prod, abrir **Drive**, capturar consola remota o pantalla de error; revisar si es **popup bloqueado**, **Google OAuth**, o **User-Agent** / **iframe** restrictions.
3. **DevTools:** Para la próxima sesión LDN, resolver conflicto de perfil Chrome DevTools MCP o usar **cursor-ide-browser** como fallback declarado (como en este informe).

---

## 8. Verificación (checklist)

- [x] Reproducible en URL indicada (carga shell prod)
- [ ] Consola limpia de errores P0 / o documentado (muestra mezclada localhost + prod; ver E-05)
- [x] Red: sin 4xx/5xx en chunks principales observados (E-04)
- [ ] Criterios de éxito del usuario (§2) cubiertos o ticket abierto → **abierto** como LDN-07/08

---

## 9. Anexos (opcional)

- Evidencia estructurada: `LIVE-DEVTOOLS-NARRATIVE-EVIDENCE-2026-04-02-zona1-anexo-drive-android.json`
- Snapshot YAML: barra superior con **Drive** visible (`browser_snapshot`, viewId `f533d2` en sesión agente).
