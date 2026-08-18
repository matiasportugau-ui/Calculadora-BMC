# Gaps y no-goals

Este pack **no** afirma que exista un “WhatsApp Drive connector” en producción.

## 🔴 Missing (no implementar desde este PR de docs)

- Sync de hilos WA ↔ carpeta Drive.
- Indexar Drive (Docs/PDF) hacia Training KB / pgvector para sugerencias WA.
- Webhook de Drive.
- Cloud API outbound de **document/image** (hoy el core es `type: "text"`).
- Tokens Drive **por usuario** en el server (diseño: no guardar).
- Scope `drive` / `drive.readonly` para “ver todo el shared drive”.
- Auto-reply al cliente desde el webhook (sigue siendo sugerencia + humano).
- Inyectar este pack en `server/lib/knowledgeLoader.js` / `data/knowledge/` (ensuciaría **todos** los chats).

## 🟡 Partial / fácil de malinterpretar

- Omni WA canonical: documentado ON en prod; **verificar** flags Cloud Run.
- `RAG_ENABLED` a menudo off; embeddings stub → retrieval vacío.
- Cockpit fases F2–F5 en `docs/wa-cockpit/README.md` pueden estar **desfasadas** vs código (enricher, quotes, media ya existen). Confiar SOURCE-MAP + código, no la tabla de fases sola.
- Service account Drive: código existe, uploads a My Drive fallan.
- `saveRemitoToDrive` referenciado desde dashboard: verificar export real en `driveUpload.js` antes de usarlo (`#ZonaDesconocida` si no se abre el archivo).
- HTML mirrors `anyone:reader` vs archive privado: políticas distintas.

## 🟢 Reusable (no reinventar)

- `whatsappOutbound.js` / HMAC / ingest modes.
- `driveUpload.js` + naming + `drive-archive`.
- `kbBridge` + Training KB `goodAnswerWA`.
- Human gate `user_confirmed` + CRM send-approved.

## Opciones futuras (producto, no hecho)

1. Carpeta dedicada creada por el **mismo** Desktop OAuth; job que liste `drive.file` y extraiga texto → KB.
2. Shared Drive + SA Content Manager (cambio de scope/IAM).
3. Export manual Drive → `trainingKB` / GCS y dejar WA en stores actuales.

Hasta que exista (1)–(3), el conector **lee este folder de markdown** + runtime KB/RAG, y **abre** `.bmc.json` on demand.
