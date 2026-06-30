# HANDOFF — 2026-06-25 — ML catálogo + /hub/ml-manager

## Resumen de la sesión
Auditoría del catálogo MercadoLibre, reactivaciones, y arreglo + mejora del dashboard `/hub/ml-manager`.
Todo lo desplegable está **en prod y verificado**. Quedan 3 blockers que dependen del usuario.

## Shipped a prod (mergeado a `main`)
| PR | Qué | Verificado |
|----|-----|-----------|
| #431 | `vercel.json` proxy `/ml` (causa raíz del dashboard roto: catch-all devolvía HTML 200 → `JSON.parse` rompía todo) + preguntas pull (`.questions`) + Overview counter + ListingsTab organización (título/estado/precio/stock/salud + pausar/activar inline) | ✅ prod: `/ml/users/me` → JSON, preguntas devuelven 2 |
| #433 | `fix(ai)`: Gemini `2.0-flash` (retirado) → `2.5-flash` en `server/lib/aiProviderConfig.js`. Desbloquea "Generar con IA" | ✅ prod: `/api/crm/suggest-response` → `{ok:true, provider:"gemini"}` |
| #434 | docs: marca IA resuelta | — |
| #435 | Preguntas: preview de producto (thumb+nombre+precio+permalink real); CSP `img-src` += `*.mlstatic.com` | ✅ prod: CSP con mlstatic |
| #436 | Editar publicación: header visualización estilo ML + variables completas (título, precio, stock, estado, condición, SKU, garantía/`sale_terms`, características/atributos dinámicos) | ✅ prod CSP + item API con attrs |

## Acciones en el catálogo (ya en vivo en ML)
- **Reactivadas**: ISP150 (`MLU445010304`) + IF40 (`MLU444372549`, 194 vendidas). Activas **46 → 48**.
- **Retenidas** (penalizadas, NO reactivar sin fix de calidad): ISP50 `MLU445615811`, ISP200 `MLU467582410`, ISP250 `MLU444957725`.

## Estado git
- Branch: `worktree-ml-product-clips` (todo lo de arriba ya está en `main`).
- Sin commitear / untracked (NO son parte del trabajo ML, no pushear sin querer):
  - `M .dockerignore`, `M .vercelignore` (exclusiones product-clips, de sesión previa)
  - `?? product-clips/` (workflow de clips ML + artefactos de auditoría: `out/ml-audit-179969104.*`, `out/bromyros-ml-gap.csv`, `scripts/ml-listing-audit.mjs`)
  - `?? goal-prompt-ml-catalog-and-manager.md`

## Blockers (dependen del usuario — ver runbooks)
1. **Claves IA premium** — claude(crédito)/openai(quota)/grok(key) muertas; Gemini cubre la generación. Recargar = upgrade opcional de calidad. Runbook: `docs/team/ML-AI-KEYS-REMEDIATION.md`.
2. **IsoFrig 60–200mm** — listar la línea cold-room (falta endpoint `POST /ml/items` + fotos). Checklist: `docs/team/ML-ISOFRIG-LISTING-CHECKLIST.md`.
3. **ISP50/200/250 penalizadas** — corregir calidad (fotos/política) antes de reactivar.

## Docs nuevos esta sesión
`ML-CREDENTIALS-PLAYBOOK.md`, `ML-AI-KEYS-REMEDIATION.md`, `ML-ISOFRIG-LISTING-CHECKLIST.md`, este handoff.

## Próximo prompt para retomar
> Continuá el trabajo de ML. Opciones: (a) construir `POST /ml/items` + form "Nueva publicación" en /hub/ml-manager para listar IsoFrig 60–200mm (template clon = MLU444372549, precios en `bromyros-ml-gap.csv`); (b) arreglar la calidad de ISP50/200/250 (fotos) y reactivar; (c) recargar una clave IA premium y verificar `/api/crm/suggest-response`. Estado en `docs/team/PROJECT-STATE.md` (entrada 2026-06-25).
