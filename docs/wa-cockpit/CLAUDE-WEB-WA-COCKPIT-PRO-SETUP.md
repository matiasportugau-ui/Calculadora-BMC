# Claude Web — auditar WA Cockpit Pro (fácil de copiar)

Usá **Claude en el navegador** para revisar el repo sin terminal. Claude no puede ejecutar `npm`; vos o Cursor corrés los comandos después.

---

## Los 3 pasos (rápido)

| Paso | Qué hacés |
|-----|-----------|
| **1** | En repo: abrí estos 4 archivos y copiá su contenido (o adjuntálos si Claude Web permite archivos): `package.json`, `tests/wa-sla.test.js`, `src/components/BmcWaCockpit.jsx`, `AGENTS.md` |
| **2** | Pegá abajo **el bloque “TODO EN UN SOLO PROMPT”** en Claude Web + pegá después el contenido de los 4 archivos (etiquetas opcionales: `=== package.json ===` etc.). |
| **3** | Cuando Claude termine el informe, marcá ✅ en **Checklist vos** más abajo o corré los comandos en tu Mac. |

---

## TODO EN UN SOLO PROMPT (copiar desde la línea siguiente hasta el final del recuadro)

```
ROL: Auditor técnico Calculadora-BMC, solo módulo WA Cockpit Pro.

REGLAS
- Solo afirmaciones con evidencia en el TEXTO QUE TE PEGO ABAJO. Si falta archivo, decí QUÉ archivo falta — no inventes.
- Separá cada hallazgo: CONFIRMADO (texto citado) vs NO VERIFICADO (sin datos).
- Valores secretos (.env): no pidas valores; puede nombrarse DATABASE_URL solo como nombre de variable.

DEBAJO DE ESTE PROMPT TENGO LOS ARCHivos: package.json · tests/wa-sla.test.js · src/components/BmcWaCockpit.jsx · AGENTS.md.

TAREA (marca PASS/FAIL por ítem + cita textual breve archivo/líneas o substring):

1) package.json · script "test"
   - ¿Incluye "npm run test:wa-pro" o cadena que EXIJA Postgres para pasar gate local?
   - Contrato esperado: test = offline (sin Postgres obligatorio para npm test).

2) package.json · script "test:wa-pro"
   - Listá cada archivo que encadena.

3) tests/wa-sla.test.js
   - ¿Hay check de DB alcanzable antes de asserts?
   - ¿Si NO hay Postgres, salida SKIP con exit code 0 (no confundir con fallo)?
   - ¿finally: stop worker si aplica + reset pool/config/webhooks?

4) BmcWaCockpit.jsx
   - TABS followups: enabled ?
   - ¿Rama JSX explícita activeTab === "followups" antes del mensaje genérico "fase posterior"?

5) AGENTS.md vs package.json (drift)
   - Comandos: wa:admin, wa:gen-docs, test:wa-pro si aparecen en AGENTS ¿existen en package.json?

SALIDA OBLIGATORIA (orden fijo):

A) Tabla | # | Ítem | PASS/FAIL | Evidencia (cita mínima) |
B) Resumen ejecutivo ≤10 líneas
C) Lista "siguientes pasos humanos" (máximo 5 bullets): qué comando correr en local o qué PR tocar — sin ejecutarlos vos
```

**(Fin del recuadro — ya podés pegar debajo tus 4 archivos)**

---

## Checklist vos (marcar después de Claude o del PR)

Copiá esta lista en un notepad y tachá cuando corresponda:

```
[ ] Leí informe Claude: tabla PASS/FAIL completa
[ ] npm test  (repo local, Postgres NO requerido)
[ ] npm run test:wa-pro   (solo si tenés DATABASE_URL + migraciones wa_*)
[ ] npm run lint
[ ] Agente: scripts wa:admin y wa:gen-docs existen en package.json como dice AGENTS
[ ] UI: tab Follow-ups no muestra "fase posterior" incompatible con pestaña habilitada
```

**Comandos (referencia, no pegar secretos):**

```bash
cd Calculadora-BMC
npm run env:ensure   # opcional primera vez
npm test
npm run test:wa-pro   # opcional integración Postgres
npm run lint
```

---

## Si querés ir archivo por archivo (opcional)

Podés mandar el **mismo mega-prompt** pero en 4 mensajes: en cada uno pegá solo un archivo (más el prompt). Orden sugerido:

1. `package.json`
2. `tests/wa-sla.test.js`
3. `src/components/BmcWaCockpit.jsx`
4. `AGENTS.md`

En el último mensaje pedí: "Cerrá informe con tabla final y resumen."

---

## Archivos exactos para adjuntar o pegar

1. [`package.json`](../../package.json) → buscá `"test"`, `"test:wa-pro"`, `"gate:local"`, `wa:admin`, `wa:gen-docs`
2. [`tests/wa-sla.test.js`](../../tests/wa-sla.test.js)
3. [`src/components/BmcWaCockpit.jsx`](../../src/components/BmcWaCockpit.jsx) → constante `TABS` + panel derecho por `activeTab`
4. [`AGENTS.md`](../../AGENTS.md) → tabla de comandos npm

---

## Contrato rápido (memoria)

- `npm test` → sin depender de Postgres para que pase CI/gate típico.
- `npm run test:wa-pro` → integración WA (Postgres donde aplique).
- Tab Follow-ups habilitada → UI coherente, sin mensaje de “fase posterior” contradictorio.

---

Actualización docs: esta página prioriza **un solo copiar-pegar completo + checklist**.
