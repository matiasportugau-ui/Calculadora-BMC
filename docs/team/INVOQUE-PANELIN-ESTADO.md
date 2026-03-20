# Invoque Panelin — Estado y ubicación

**Fecha:** 2026-03-19  
**Pregunta:** ¿Qué pasó con "Invoque a Panelin" funcional (OpenAI como cerebro, extracción de clientes/órdenes)?

---

## Resumen

La versión **funcional** de "Invocar a Panelin" existe, pero vive en un **proyecto distinto** al BMC Dashboard:

| Ubicación | App | Puerto | Estado |
|-----------|-----|--------|--------|
| **~/.panelin-evolution/viewer/** | Panelin Evolution (Internal) | **3847** | ✓ Funcional — chat GPT, extracción de params, invocación a /calc |
| **Calculadora-BMC** (este repo) | BMC Dashboard Finanzas/Operaciones | 3001 | Placeholder — "Próximamente" |

---

## Dónde está la versión funcional

**Panelin Evolution** (`~/.panelin-evolution/viewer/`):

- **Nav:** "Invocar a Panelin" (data-target="gpt-sim")
- **Proxy OpenAI:** `run_proxy_openai.sh` → puerto **3848** (requiere OPENAI_API_KEY)
- **Funcionalidad:**
  - Chat con GPT como "cerebro" (system: "Sos Panelin, asesor conversacional de paneles BMC")
  - Extracción de parámetros de cliente/orden ("Necesitás preguntarle al cliente por el campo X")
  - Invocación a endpoints /calc (generar_cotizacion_pdf, etc.)
  - KPIs, Situaciones, Tareas, Notificaciones, Hojas configuradas
  - Params para cotización (cliente, obra, etc.)

**Cómo ejecutarla:**

```bash
# 1. Viewer (3847) — desde el repo
./run_invoque_panelin.sh
# O manual: ~/.panelin-evolution/launch.sh

# 2. Proxy OpenAI (3848) — para que funcione el chat
OPENAI_API_KEY=sk-xxx ./run_proxy_openai.sh
```

URL correcta: http://localhost:3847/viewer/

---

## Por qué "desapareció" del Dashboard

El **BMC Dashboard** (3001/finanzas) en este repo **nunca tuvo** la versión funcional integrada. Siempre fue un placeholder:

- `docs/bmc-dashboard-modernization/dashboard/index.html` → sección #invoque: "Próximamente. Asistente transversal en módulos + sección dedicada."
- `DASHBOARD-INTERFACE-MAP.md` → "Invoque Panelin | — | placeholder"
- `05-universe-invoque-panelin.md` → "No route, no component, no doc in map. Only IA recommendation (hybrid)."

La funcionalidad real está en **Panelin Evolution**, que es una app separada (viewer en ~/.panelin-evolution).

---

## Implementado (2026-03-19)

**Opción C:** Link desde Dashboard — ✓ Hecho.

- Sección #invoque: botón "Abrir Invoque Panelin" → localhost:3847 (nueva pestaña)
- Hint: requiere run_proxy_openai.sh (3848) + Panelin Evolution (3847)

---

## Otras opciones (no implementadas)

| Opción | Descripción | Esfuerzo |
|--------|-------------|----------|
| **A. Usar Panelin Evolution directo** | Abrir localhost:3847 sin pasar por dashboard | 0 — ya existe |
| **B. Integrar en BMC Dashboard** | Embed iframe o copiar lógica de gpt-sim al dashboard 3001 | Medio — requiere conectar proxy 3848 + UI |

---

## Troubleshooting

### "You exceeded your current quota" (OpenAI)

**Causa:** Cuota de OpenAI agotada. **Acción:** Verificar https://platform.openai.com/account/billing

**Mientras tanto:** El flujo sigue funcionando con el fallback **"respuesta rápida"** — el usuario responde con valores directos (ej. "solo techo", "isodec eps", "150") y el sistema los parsea sin GPT. No requiere OpenAI para completar la cotización.

### localhost:3847 rechazó la conexión

**Acción:** `./run_invoque_panelin.sh` para levantar el viewer.

### Chat no genera preguntas

**Causa:** Proxy 3848 no corre o OPENAI_API_KEY no definido. **Acción:** `./run_proxy_openai.sh`  
El fallback permite completar sin proxy.

---

## Referencias

- `docs/team/PANELIN-EVOLUTION-FLOW.md` — **Flujo completo** (proxy, collector, viewer, APIs)
- `~/.panelin-evolution/viewer/app.js` — lógica gpt-sim, extracción params, fallback
- `~/.panelin-evolution/proxy-openai.js` — proxy OpenAI (3848)
- `run_proxy_openai.sh`, `run_invoque_panelin.sh` — scripts de arranque
- `docs/bmc-dashboard-modernization/IA.md` — Invoque Panelin (hybrid)

---

**Última actualización:** 2026-03-19
