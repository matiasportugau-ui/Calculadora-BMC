# LIVE-DEVTOOLS-NARRATIVE-REPORT — 2026-04-09 — prod state baseline

Sesión **Live DevTools narrative** (chrome-devtools MCP) contra producción: comprobar estado actual de la app y dejar base para seguir desarrollando.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-09 |
| Base URL | `https://calculadora-bmc.vercel.app/` |
| Entorno | **prod** |
| Navegador / MCP | chrome-devtools MCP (`navigate_page`, `wait_for`, `list_console_messages`, `list_network_requests`) |
| Participantes | Operador (Matias) + agente |

---

## 2. Objetivo de la sesión

- **Goal (una frase):** Verificar carga inicial en producción (consola, red, estructura UI) como línea base para continuar desarrollo.
- **Criterios de éxito del usuario:** Página usable, sin errores de consola obvios, sin fallos HTTP en recursos del flujo de carga.

---

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | t0 | Pedir revisión del estado actual en prod y seguir desarrollando | App carga; sin errores P0 en consola/red en primera pintura |

---

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Tras invocación | `navigate_page` (`type: url`, `https://calculadora-bmc.vercel.app`) | Navegación OK; pestaña seleccionada: URL indicada. |
| E-02 | Post-nav | `wait_for` textos `["Paso","Panelin","Calculadora"]` | **Snapshot a11y** (extracto): título `RootWebArea "Calculadora BMC"`; nav **Módulos BMC** (Wolfboard, Calculadora, Logística); **PASO 1 DE 13** — Escenario de obra; visor y BOM visibles; **diálogo modal** `Panelin Asistente BMC` presente con saludo y quick replies. Texto de cabecera: **"· Panelin v3.0"**. |
| E-03 | Misma pintura | `list_console_messages` | **Sin mensajes** devueltos (ningún error/warn/log en el buffer desde la última navegación). |
| E-04 | Misma pintura | `list_network_requests` | **18** solicitudes; **todas** `GET` con **200** o **206** (vídeo `panelin-lista-loop.mp4` 206 parcial). Sin **4xx/5xx**. Recursos: bundle Vite (`index-*.js`, `App-*.js`, `PanelinCalculadoraV3_backup-*.js`, vendors), CSS, PWA (`manifest`, `registerSW`), Shopify CDN imagen ISODEC, `accounts.google.com/gsi/client` 200. |

---

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01, E-02, E-03, E-04 | **Sí** | Consola vacía y red limpia en carga. UI muestra paso 1/13; modal Panelin abierto al cargar (evaluar si es deseado para “modo cliente”). Etiqueta **Panelin v3.0** en pantalla vs **package.json 3.1.5** (ver hallazgos). |

---

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable |
|----|-----------|--------|---------|----------------|
| LDN-2026-04-09-01 | **P2** | Copy de versión en UI desalineado | Cabecera muestra **"· Panelin v3.0"** en prod; repo `package.json` **3.1.5**. Cadena en `src/components/PanelinCalculadoraV3_backup.jsx` (~línea con `Panelin v3.0`). | `src/` — alinear con semver o mostrar versión derivada de build/env. |
| LDN-2026-04-09-02 | **P2** | Modal Panelin visible en primera carga | Diálogo **Panelin Asistente BMC** aparece en el snapshot inicial (puede ser intencional para onboarding). Si se busca foco solo en cotización, valorar cerrado por defecto o persistencia “ya visto”. | `src/` — estado inicial del panel chat |

---

## 7. Recomendaciones y siguientes pasos

1. **Desarrollo:** Trabajar en local (`npm run dev:full`) para cambios; repetir esta pasada MCP tras deploy o en preview Vercel.
2. **Versión visible:** Unificar **Panelin v3.0** → **v3.1.5** (o leer `import.meta.env` / constante de build) para coherencia con [`package.json`](../../../package.json) y [`VERSION-HISTORY-BMC-CALC.md`](../orientation/VERSION-HISTORY-BMC-CALC.md).
3. **Panelin modal:** Confirmar producto: si debe abrir siempre, documentar; si no, ajustar default cerrado salvo query/localStorage.

---

## 8. Verificación (checklist)

- [x] Reproducible en URL indicada
- [x] Consola: sin errores en esta corrida (lista vacía)
- [x] Red: sin 4xx/5xx en las 18 peticiones listadas
- [x] Criterios §2: cubiertos para carga inicial; mejoras P2 abiertas arriba

---

## 9. Anexos

- Evidencia bruta: salidas MCP en el hilo de chat (navigate, wait_for con snapshot, list_console_messages, list_network_requests).
- Plantilla usada: [`TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md`](./TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md).
