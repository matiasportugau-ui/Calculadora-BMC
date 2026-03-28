# Reference — bmc-docs-and-repos-organizer

## Alcance

- Carpetas y archivos bajo `docs/`, READMEs en raíz de submódulos doc, referencias cruzadas desde `AGENTS.md` y `docs/team/README.md`.
- Flujo GitHub sugerido para cambios puramente documentales (rama, PR, descripción).
- Handoff textual a Repo Sync y Orquestador.

## Fuera de alcance

- Edición de pestañas o celdas en Google Sheets (rol Sheets Structure, Matias).
- Verdad de contrato API o columnas de planilla (Contract, Mapping).
- Ejecución de `npm run gate:local` salvo que el usuario lo pida y se hayan tocado archivos en `src/`.

## Artefactos típicos

- README nuevo o ampliado en `docs/<área>/`.
- Entrada añadida en `docs/team/README.md` o hub equivalente.
- Lista de paths para espejo en repos hermanos (Repo Sync).

## Criterios de calidad

- Cada documento nuevo tiene al menos un enlace entrante desde un hub.
- Sin rutas inventadas; sin secretos en texto.
