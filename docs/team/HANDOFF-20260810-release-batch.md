# HANDOFF — 2026-08-10 · Release batch a producción + release-audit workflow

**Sesión:** Copilot CLI (claude-fable-5) · autopilot · plan aprobado "Full path to production"

## Qué se hizo (todo verificado)

### Shipped a main → producción (orden de merge, cada uno rebased sobre main fresco + CI verde)

| PR | Contenido | Commit en main |
|---|---|---|
| #986 | Bug CH — HYPERLINK ENCARGO label (logística) | `4a453af3` |
| #977 | Bugs BZ/CA — PEA terminal-state guard | `f9a783d1` |
| #978 | Bugs BX/BY — adjunto dual-format echoes | `e28be160` |
| #979 | Bugs CD/CE/BN — refunds + collapsed rows + cut keep-side | `2bc7e7fc` |
| #984 | Bug CG — cut-to-length snapLen | `6fd3c427` |
| #987 | **release-audit workflow** (`npm run release:audit[:strict]`) + gitignore secret-paths panelin-mcp + SDD 94/100 | `e6ac6aa7` |
| #956/#957/#959 | dependabot: dompurify 3.4.13, js-yaml 4.3.1, hono 4.13.1 (uno por vez) | `9f8c3306`/`0cbac77e`/`1d8cbd43` |
| #1005 | changelog PROJECT-STATE del batch | `625644a4` |

- Cerrados como superseded: **#974, #975, #976**. Abierto intencional: **#981** (DO NOT MERGE).
- Conflictos (solo `PROJECT-STATE.md`, `package.json` test:pea, `adjuntoLineParse.test.js`): resueltos por **unión**, nada descartado.
- **Verificación no-downgrade:** net +155/−11 en src+server, cero archivos borrados, todos los tests de bugs presentes en origin/main, deps estrictamente hacia arriba.
- **Gates:** CI main run `31376183445` success · `smoke:prod` OK completo.

## Pendientes / próxima sesión

1. **DISCO CRÍTICO — 100% lleno (~230 MB libres).** Culpable: `~/.grok/worktrees/matias/2026-07-24-20723902` = **45 GB** snapshot stale del home (cero archivos tocados desde 2026-07-25). Borrarlo libera ~20% del disco: `rm -rf ~/.grok/worktrees/matias/2026-07-24-20723902` — **requiere OK explícito del usuario** (irreversible; puede contener archivos borrados del home real después del 24-jul). `fleet/` (15 GB) está ACTIVO — no tocar sin revisar. Otros: `.grok/sessions` 4.7G, `.ollama` 7.1G, caches ~5G.
2. **Voice OpenAI key health en main: HTTP 502** — key probablemente revocada → `npm run keys:rotate`.
3. **23 vulnerabilidades GitHub en main (8 high)** — agendar pase de seguridad.
4. **Trabajo local sin commitear en main** (otra sesión): feature envíos-Drive coordinaciones, +727 líneas, `src/utils/logistica/enviosDrive.js` + tests untracked. NO tocado por esta sesión.
5. **77 stashes** + ramas divergentes (`final/ultimate-consolidation` ahead:34, `wip/cotizar-and-presup` ahead:24 con features sin shippear) — sesión dedicada de triage; inventario en session file `backlog-hygiene-20260810.md`.

## Herramienta nueva disponible

- `npm run release:audit` (informe) / `npm run release:audit:strict` (gate, exit 2 con blockers) — usar antes de cada release. Doc: `.claude/commands/release-audit.md` · SDD: `docs/sdd/release-readiness-audit/`.

## Update 07:25 — limpieza segura de disco

- Liberado sin tocar datos: npm cache (~800 MB), Cursor ShipIt updater cache (1.2 GB), Homebrew cache (147 MB) → **libre: 232 MB → 4.0 GB**.
- **Sigue pendiente el gran item:** `~/.grok/worktrees/matias/2026-07-24-20723902` (45 GB, snapshot stale del 24-jul, nada modificado desde el 25-jul). Borrar con `rm -rf` libera ~20% del disco — **esperando OK explícito** (irreversible). `fleet/` (15 GB) está activo, no tocar.

## Update 07:35 — disco RESUELTO

- Snapshot stale de 45 GB (`~/.grok/worktrees/matias/2026-07-24-20723902`) **eliminado** tras rescatar todo lo único:
  - Rescatado en `~/rescued-from-grok-snapshot-20260810/` (46 MB): `Downloads/IMG_1322.MOV` (45M), `calculadora-bmc/goal-prompt-meta-ads-live-pr3.md`, `Exportación de Safari 2025-10-23/`, `carpeta sin título/dual_runs/`, 184 historiales `.zsh_sessions`.
  - Verificación previa: rsync dry-run de 270k archivos — el resto de "únicos" eran solo caches/metadata (Library/Caches, .cursor, .codex, gcloud).
- También liberado: npm cache, Cursor ShipIt (1.2G), Homebrew cache.
- **Resultado: 232 MB → 12 GB libres (95%).** El tamaño aparente de 45 GB incluía clones APFS compartidos con el home real.
- Siguen como candidatos futuros: `.grok/fleet` 15G (ACTIVO — revisar antes), `.grok/sessions` 4.7G, `.ollama` 7.1G.
- Revisar `~/rescued-from-grok-snapshot-20260810/` y borrar cuando esté confirmado.
