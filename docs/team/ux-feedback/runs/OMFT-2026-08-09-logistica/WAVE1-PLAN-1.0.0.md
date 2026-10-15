# Wave 1 OMFT Logística — Documento rector **RC5**

> **Freeze formal:** 2026-08-09 · rama `docs/omft-wave1-v1` · PR sin merge · cero promote a producción · inbox privado fuera de Git.
> **SHA-256:** ver archivo companion `WAVE1-PLAN-1.0.0.sha256`.


| Campo | Valor |
|-------|--------|
| **Documento** | Wave 1 OMFT Logística — plan rector |
| **Versión** | **1.0.0** |
| **Fecha efectiva** | 2026-08-09 |
| **Estado** | **CONGELADO 1.0.0** · freeze en rama docs/omft-wave1-v1 · GATE-00A habilitado tras este freeze |
| **SHA base main (referencia de código)** | `f436448f` — **no** se mueve por el freeze del plan |
| **Ubicación de trabajo** | Plan mode Grok `plan.md` hasta freeze canónico |
| **GATE-00A** | Solo **después del freeze 1.0.0** · no invocado |
| **Código de producto** | **0%** hasta GATE-00C **verde** |
| **Promoción / restore prod** | **Solo GATE-00B** (puede ser **antes** de 00C) |

**No autoriza:** merge del plan a `main` · promote prod por freeze · producto 01–05 · 00A sin freeze · 00B sin frase con rollback · commit de `runs/inbox/`.

---

## 0. Política de una línea

**Freeze del plan ≠ deploy; promote 00B ≠ producto; 00C verde exige observación completa de residuales P0; lockRevision ≠ documentRevision; sin PII en repo.**

---

## 1. Separación crítica: producto vs promoción

| Acción | Regla |
|--------|--------|
| **Código de producto** (NAV-01…05) | **0%** hasta GATE-00C **verde** |
| **Restauración / promoción de deployment** | Permitida **antes** de 00C, **solo** con autorización **GATE-00B** |
| **Freeze del documento rector** | Rama + PR **sin merge** · **cero deploy** (ver §2) |

El encabezado **no** dice “promote 0% hasta 00C”: eso bloqueaba 00B.  
**Promote** = 00B · **Producto** = post-00C verde.

---

## 2. Freeze formal del plan (sin tocar producción)

### Problema

Fusionar docs a `main` (p.ej. `f436448f` / #980) **dispara deployment productivo** en este repo.  
Por tanto **prohibido** “copiar a main + SHA-256” como paso de freeze.

### Procedimiento obligatorio de freeze 1.0.0

**El freeze es requisito de secuencia**, no opcional: **Freeze 1.0.0 → GATE-00A → (00B si corresponde) → GATE-00C**.  
Sin freeze formal **no** se invoca GATE-00A.

1. Crear archivo canónico en rama **`docs/omft-wave1-v1`**.  
2. Commit **inmutable** solo del plan (+ companion SHA-256).  
3. Calcular **SHA-256 del contenido** del markdown.  
4. Abrir **PR documental** hacia main.  
5. **No mergear** a main · **no promote** · **no deploy a producción** por el freeze.  
6. Registrar: ruta canónica, commit de la rama, **SHA-256 del documento**, URL del PR.

#### Preview de Vercel vs producción (freeze)

Abrir el PR **puede** generar un **preview** automático de Vercel. Eso **no** viola el freeze si se respeta:

| Permitido | Prohibido |
|-----------|-----------|
| Preview automático como **artefacto estático** del PR | **Merge** a main por el freeze |
| | **Deploy / promote a producción** por el freeze |
| | Usar el preview como **baseline** de GATE-00 |
| | Operaciones con **DB** o **mutaciones** en el preview mientras **#ZonaDesconocida** (preview ↔ DB prod) siga abierta |

Baseline de GATE-00A = **alias de producción medido** (y candidato Git), no la URL de preview del PR del plan.

**Frase de freeze (única autorizada):**

```text
Congelá formal Wave 1 plan 1.0.0: crear archivo canónico y SHA-256
en rama docs/omft-wave1-v1; abrir PR documental; no mergear a main ni desplegar.
```

**Si más adelante se mergea el PR:** antes de un **nuevo** ciclo GATE-00A el agente **debe** re-medir baseline (nuevo SHA de main + nuevo deployment). Hasta merge, baseline de **código** = `f436448f` + deploys medidos en 00A.

### Ruta canónica sugerida del archivo (en la rama docs)

```text
docs/team/ux-feedback/runs/OMFT-2026-08-09-logistica/WAVE1-PLAN-1.0.0.md
```

(y opcional `WAVE1-PLAN-1.0.0.sha256`)

---

## 3. Tres ejes de autoridad

| Eje | Autoridad |
|-----|-----------|
| **Estado real** | Código del **deployment aprobado** |
| **Objetivo normativo** | Decisión humana vigente → Documento Maestro → Trazabilidad → plan rector |
| **Alcance autorizado** | **Última instrucción humana explícita** → plan rector |
| **Evidencia** | Pack privado + rebaseline 00C |
| **Arquitectura** | SDD, salvo desactualización documentada |

Código defectuoso **no** manda el objetivo. Plan manda **alcance**, no hechos.

---

## 4. Trazabilidad NAV

| ID canónico | Alias | Fuente |
|-------------|-------|--------|
| NAV-2026-08-09-01 | NAV-01 | REQ-010 · RUT · EV-012/013 |
| NAV-2026-08-09-02 | NAV-02A/02B | REQ-020/021/022 · EV-017–019 |
| NAV-2026-08-09-03 | NAV-03 | REQ-003/004 · EV-001–007 |
| NAV-2026-08-09-04 | NAV-04 | REQ-024 · EV-020 |
| NAV-2026-08-09-05 | NAV-05 | REQ-001 · PKG-01 §4.2 |
| — | **GATE-00** (hist. NAV-00) | Gate, no hallazgo P0 |

---

## 5. lockRevision vs documentRevision (as-built)

| Concepto | Función |
|----------|---------|
| **`lockRevision`** | Columna actual `revision`; +1 cada autosave PUT / concurrencia |
| **`documentRevision`** | Versión comercial; +1 solo reabrir Listo / versionar / editar post-Coordinado |
| **`activeDocumentRevision`** | Puntero vigente |
| **`reparto_revisions`** | Snapshots inmutables `(repartoNo, documentRevision)` |
| Documentos | `(repartoNo, documentRevision, documentType)` · `active` \| `superseded` |

**Prohibido** reutilizar `revision` de autosave como documental.  
Mismo **`repartoNo`** a lo largo de `documentRevision`.

---

## 6. GATE-00

### 6.0 Subfases

| | Deploy | Datos |
|--|--------|-------|
| **00A** inspect RO | No | No |
| **00B** restore/promote | Auth + rollback target | — |
| **00C** residual | No | RO default |
| **00C-M** OMFT-TEST | No | Auth |

**Frases:**

```text
Ejecutá GATE-00A (solo inspect read-only).
```

```text
Autorizo GATE-00B: promover <deployment-candidato> a producción;
rollback permitido a <deployment-actual-id>;
smoke pre/post según plan RC5.
```

```text
Ejecutá GATE-00C replay y residual freeze.
```

```text
Autorizo GATE-00C-M: crear registros de prueba OMFT, sin confirmar coordinación, writeback, Drive ni comunicaciones.
```

### 6.1 Hipótesis prod (re-medir en 00A)

- main `f436448f`  
- Activa: `dpl_BgBs…` CLI · **gitDirty=1**  
- Candidato: `dpl_82yK…` Git · mismo SHA · verificado  

### 6.2 GATE-00B + rollback dirty

1. Registrar deployment **actual** + aliases = rollback target.  
2. Smoke en **URL candidata**.  
3. Promover Git (preferido) o rebuild limpio.  
4. Smoke en **producción** (mismo checklist).  
5. Fallo → rollback **solo** si autorizado en la frase 00B; si no, STOP.

**Si se hace rollback a un deployment dirty (p.ej. `dpl_BgBs…`):**

| Efecto | Estado del gate |
|--------|-----------------|
| Servicio puede recuperarse | OK operativo corto |
| Reproducibilidad | **No** recuperada |
| **GATE-00** | Sigue **rojo** |
| **GATE-00C** | **No puede comenzar** |
| **Producto** | **Sigue bloqueado** |

Rollback dirty **no** es baseline verde.

### 6.3 Smoke API

| Check | Esperado |
|-------|----------|
| `GET /logistica` | App carga |
| `GET /api/repartos/health` | `ok`, `module: "repartos"`, `db` |
| Credencial: `GET /api/repartos?limit=1` | `ok: true`, `repartos` array |
| Sin credencial | Cobertura limitada explícita |
| **Eliminado** | `/api/envios/health` |
| **Prohibido** | Crear endpoints para el gate |

### 6.4 Seguridad 00C

RO por defecto; stop antes de create auto; 00C-M para `OMFT-TEST-*`; no confirm/WA/Sheets/Drive; no delete auto.  
Previews: ZonaDesconocida DB compartida.

### 6.5 Casos públicos

CASE-OMFT-01…04 / EVID-ORDER-01…04 (PII solo pack privado).

### 6.6 Semáforo 00C

| | |
|--|--|
| **Verde** | Deploy reproducible + alias OK · **cuatro** casos llegaron al **punto de observación** para clasificar **todos** residuales P0 · residual clasificado · fixtures sintéticos · cero mutaciones indebidas · NAV-03 reemitido |
| **Amarillo** | ≥1 caso bloqueado **antes** de ese punto (aunque bloqueo documentado) |
| **Rojo** | No reproducible · alias mal · mutación indebida · deploy ambiguo |

Bloqueo documentado **≠** verde.

### 6.7 Rutas: inbox vs outputs del gate

| Uso | Ruta | Git |
|-----|------|-----|
| **Inputs privados / pack original** | `docs/team/ux-feedback/runs/inbox/OMFT-REPORT-2026-08-09-logistica/` | **Fuera de Git** — permanece local/privado; **no** se commitea en PRs públicos |
| **Informes sanitizados del gate** | `docs/team/ux-feedback/runs/OMFT-2026-08-09-logistica/gate/` | **Solo estos** pueden entrar en un PR público (tras sanitización) |

```text
docs/team/ux-feedback/runs/OMFT-2026-08-09-logistica/gate/
  GATE-00A-INSPECT-YYYY-MM-DD.md
  GATE-00B-RESTORE-YYYY-MM-DD.md
  GATE-00C-REBASELINE-YYYY-MM-DD.md
  residual-after-rebaseline.md
  fixtures/four-orders-manifest.md
```

**Sanitización obligatoria** antes de cualquier commit de outputs.  
**Inbox privado no se sube** aunque el freeze o el gate generen PRs.

---

## 7. NAV producto (post 00C verde)

### NAV-05  
Create/open explícito; block API fail; sin TMP confirmable.

### NAV-04  
`lockRevision` vs `documentRevision` (§5 modelo); reabrir Listo ↑documentRevision + superseded; Coordinado inmutable.

### NAV-01  
Exportable = coordinates; stopId en TXT/WA/GeoJSON/GPX; Maps por navToken; multi-leg segmentado sin slice silencioso; filename + documentRevision.

### NAV-02A  
Print root aislado · chrome oculto · cero páginas vacías · saltos controlados · `document.title` best-effort · **no** cierra REQ-021.

### NAV-02B  
Contenedor; hard 05+04+Drive; mini-spec obligatorio antes de codificar.

### NAV-03  
Checklist residual: proveedor, procedencia, estados, mapa≠OK genérico, adjunto⊥carga, parser a `src/utils/logistica`, clave `sourceSheetId+gid+pedidoId`, no re-#953/955/960.

---

## 8. Orden (freeze obligatorio)

```text
Freeze plan 1.0.0  →  rama docs/omft-wave1-v1 + PR sin merge
         │              (preview Vercel estático OK; no baseline; no DB)
         ▼
GATE-00A inspect RO
         │
         ├─ dirty / no Git-traceable ──► STOP ──► (auth) GATE-00B promote
         │         (rollback dirty ≠ gate verde; 00C no arranca)
         ▼
GATE-00C residual freeze [opt 00C-M]
         │
         ├─► NAV-05 → NAV-04 → NAV-01
         ├─► NAV-02A (∥ 05)
         ├─► NAV-03
         └─► NAV-02B (mini-spec)
```

---

## 9. Prohibido

- Invocar **GATE-00A** sin **freeze 1.0.0** previo  
- Freeze merge a main / promote a **producción** por docs  
- Usar **preview** del PR del plan como baseline o con DB/mutaciones  
- Commitear **`runs/inbox/`** (inputs privados)  
- Tratar rollback dirty como gate verde  
- Producto antes de 00C verde  
- 00B sin rollback target en la frase  
- Reusar `revision` lock como documental  
- PII en outputs  
- `/api/envios/health` en checklist  

---

## 10. Semáforo RC5

| Control | Estado |
|---------|--------|
| Parches técnicos + RC4 | 🟢 |
| Freeze sin producción | 🟢 |
| Freeze **obligatorio** antes de 00A | 🟢 |
| Preview ≠ baseline / sin DB | 🟢 |
| Inbox privado **fuera de Git** | 🟢 |
| Producto vs promote | 🟢 |
| Rollback dirty ≠ verde | 🟢 |
| **Freeze 1.0.0 ejecutado** | 🟡 hasta frase freeze |
| **GATE-00A** | 🟢 **después del freeze** · no invocado |
| **Producto** | 🔴 hasta 00C verde |

---

## 11. Frases

```text
Congelá formal Wave 1 plan 1.0.0: crear archivo canónico y SHA-256
en rama docs/omft-wave1-v1; abrir PR documental; no mergear a main ni desplegar.
```

```text
Ejecutá GATE-00A (solo inspect read-only).
```

```text
Autorizo GATE-00B: promover <deployment-candidato> a producción;
rollback permitido a <deployment-actual-id>;
smoke pre/post según plan RC5.
```

```text
Ejecutá GATE-00C replay y residual freeze.
```

```text
Autorizo GATE-00C-M: crear registros de prueba OMFT, sin confirmar coordinación, writeback, Drive ni comunicaciones.
```

```text
OMFT implement NAV-05 y NAV-02A según plan rector Wave 1.
```

---

## 12. Próximo paso

1. Aceptar **RC5** (freeze obligatorio, preview, inbox fuera de Git).  
2. **`Congelá formal Wave 1 plan 1.0.0: …`** (rama + PR sin merge).  
3. Solo después: **`Ejecutá GATE-00A (solo inspect read-only).`**  
4. Producto solo tras **00C verde**.
