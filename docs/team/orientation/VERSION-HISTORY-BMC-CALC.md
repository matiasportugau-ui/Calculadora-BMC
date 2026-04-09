# Historial y trazabilidad de versiones — Calculadora BMC (repo)

**Propósito:** Una sola referencia para **semver de producto** (`package.json`), **huella de datos** de la calculadora (constants + MATRIZ mapping), y **dónde** seguir el relato operativo. Complementa (no sustituye) [`../PROJECT-STATE.md`](../PROJECT-STATE.md).

**Estado actual (repo):** `package.json` → **3.1.5** (verificar con `node -p "require('./package.json').version"` en la raíz del repo).

---

## 1. Semver de producto (`package.json`)

Origen: historial Git de `package.json` (primer commit por cada versión nueva). Los mensajes de commit son los registrados en el repo.

| Versión | Fecha (commit) | Commit | Resumen (subject del commit) |
|--------|----------------|--------|------------------------------|
| **3.0.0** | 2026-03-05 | `225fe4d` | Panelin Calculadora BMC v3.0 — initial release |
| **3.1.0** | 2026-03-10 | `24d71ba` | v3.1.0 — multi-zone techo, aguas, pendiente, BOM categories, internal report |
| **3.1.1** | 2026-03-19 | `8be0ce0` | Docker / Cloud Build calculadora, dependencias y scripts (bump a 3.1.1 en árbol actual) |
| **3.1.2** | 2026-03-20 | `42f1cb9` | npm audit fix non-force (bump de versión en `package.json`) |
| **3.1.3** | 2026-03-31 | `1ad15ce` | release: calculadora + logística, SPA fallback `/calculadora` |
| **3.1.4** | 2026-04-01 | `7cffb4c` | Wolfboard routes, logística 3 vistas, parseo bultos |
| **3.1.5** | 2026-04-01 | `f5482b1` | Logística vista 3D WebGL (R3F) y selección de bultos |

**Desde 2026-04-01** el semver en `package.json` sigue en **3.1.5**; los cambios posteriores (omnicanal, workspace, expert traceability, etc.) están documentados en **PROJECT-STATE** hasta el próximo bump explícito.

**Regenerar esta tabla (mantenimiento):**

```bash
cd "$(git rev-parse --show-toplevel)"
node -e "
const {execSync}=require('child_process');
const revs = execSync('git rev-list --reverse HEAD -- package.json',{encoding:'utf8'}).trim().split(/\n/).filter(Boolean);
let prev='';
for (const c of revs){
  let j;
  try { j = JSON.parse(execSync('git show '+c+':package.json',{encoding:'utf8'})); } catch { continue; }
  const v=j.version;
  if(v!==prev){
    const d = execSync('git show -s --format=%cs '+c,{encoding:'utf8'}).trim();
    const s = execSync('git show -s --format=%s '+c,{encoding:'utf8'}).trim();
    console.log(v, d, c.slice(0,7), s);
    prev=v;
  }
}
"
```

---

## 2. Huella de datos de la calculadora (`CALCULATOR_DATA_VERSION*`)

**Qué es:** Hash corto (10 chars) + timestamp ISO generados por [`scripts/update-calculator-data-version.js`](../../../scripts/update-calculator-data-version.js) a partir de:

- `src/data/constants.js`
- `src/data/matrizPreciosMapping.js`

**Salida:** [`src/data/calculatorDataVersion.js`](../../../src/data/calculatorDataVersion.js) (generado; **no** editar a mano).

**Cuándo cambia:** Al ejecutar `npm run version:data`, o al inicio de `npm run dev` / `npm run build` (`predev` / `prebuild`).

**Relación con semver:** Es un eje **independiente** del `package.json`. Dos builds con la misma versión **3.1.5** pueden tener distinto `CALCULATOR_DATA_VERSION` si cambiaron constants o el mapping MATRIZ.

---

## 3. Despliegues y URLs (operativo)

| Superficie | URL / notas |
|------------|-------------|
| Frontend (Vercel) | `https://calculadora-bmc.vercel.app` |
| API (Cloud Run) | Variable `VITE_API_URL` / host documentado en deploy; revisiones puntuales en [`../PROJECT-STATE.md`](../PROJECT-STATE.md) (búsqueda: “Cloud Run”, “deploy”) |

No hay un segundo número de versión oficial solo para Cloud Run en este doc: la trazabilidad de producción es **commit Git + entry en PROJECT-STATE** + checks `npm run smoke:prod`.

---

## 4. Tags Git

En el estado revisado del repo **no** hay tags semver publicados (`git tag` vacío). **Recomendación:** al bump de `package.json`, crear tag anotado, por ejemplo `git tag -a v3.1.6 -m "release: …"` y publicar con el release.

---

## 5. Checkpoints locales y flujo experto

Snapshots locales (rama, sha, nota) sin commitear: [`EXPERT-DEV-TRACEABILITY.md`](./EXPERT-DEV-TRACEABILITY.md) — `npm run expert:checkpoint`, `expert:checkpoints`.

---

## 6. Documentación narrativa (“desde que empezamos”)

- **Diario canónico del proyecto:** [`../PROJECT-STATE.md`](../PROJECT-STATE.md) — sección *Cambios recientes* y *Pendientes*.
- **Programa maestro (fases):** [`programs/bmc-panelin-master.json`](./programs/bmc-panelin-master.json) + `npm run program:status`.
- **Notas de release en commit:** buscar `chore(release):` o `release:` en `git log`.

---

## 7. Actualizar este documento

Cuando subas **semver** en `package.json`:

1. Añade una fila a la tabla del §1 (commit, fecha, mensaje).
2. Opcional: una línea en `PROJECT-STATE.md` → *Cambios recientes*.
3. Opcional: tag `vX.Y.Z`.

Cuando el cambio sea solo de **datos** (constants / mapping), el §2 se actualiza solo al correr `dev`/`build`; no hace falta tocar este archivo salvo que quieras anotar un hito de negocio en PROJECT-STATE.

---

*Índice de orientación:* [README.md](./README.md). Última revisión del índice semver: **2026-04-09**.
