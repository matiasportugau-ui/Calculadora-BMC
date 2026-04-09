# ML gold runs — borradores corregidos → Panelin

**Propósito:** guardar en el repo la **pregunta** + **borrador IA** + **respuesta gold (humana)** antes/después de publicar en Mercado Libre, y usar ese gold para entrenar a Panelin sin perder la convención ML del KB.

**Convención ML (ya establecida):** [`../../knowledge/ML-RESPUESTAS-KB-BMC.md`](../../knowledge/ML-RESPUESTAS-KB-BMC.md) — voz BMC, plantilla §3, checklist §7, sin inventar precios.

**Flujo:**

1. Completá la columna **Respuesta gold** en el archivo `ML-GOLD-CANDIDATES-*.md` activo (texto que aprobás o que efectivamente publicaste).
2. Cargá cada par en el KB local de entrenamiento:

```bash
curl -sS -X POST "http://127.0.0.1:3001/api/agent/train" \
  -H "Authorization: Bearer $API_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "mercadolibre",
    "question": "PEGAR TEXTO COMPRADOR",
    "goodAnswer": "PEGAR RESPUESTA GOLD",
    "badAnswer": "PEGAR BORRADOR IA SI QUERÉS CONTRASTE",
    "context": "Canal: Mercado Libre | Q:1355… | item:MLU…",
    "permanent": true
  }'
```

3. En modo desarrollador del chat Panelin, los ejemplos matchean vía `GET /api/agent/training-kb/match?q=…`.

**Nota:** `data/training-kb.json` no se versiona (`.gitignore`); este directorio **sí** — es la memoria editorial del equipo.

---

## Desde el repo / Cursor (CLI)

1. **API local** (recomendado para entrenar en tu máquina): `npm run start:api` (puerto **3001**).
2. **`.env`**: `API_AUTH_TOKEN` igual al del servidor (mismo que pedís con Ctrl+Shift+D en el chat).
3. **Archivo JSON** con un array de entradas (ver [`examples/training-batch.example.json`](./examples/training-batch.example.json)).
4. Ejecutar:

```bash
npm run panelin:train:import -- --file docs/team/panelsim/reports/ml-gold-runs/examples/training-batch.example.json --dry-run
npm run panelin:train:import -- --file docs/team/panelsim/reports/ml-gold-runs/mi-lote.json
```

**Contra Cloud Run** (el KB se escribe en ese contenedor; puede no persistir tras redeploy):

```bash
BMC_API_BASE=https://panelin-calc-XXXX.run.app npm run panelin:train:import -- --file mi-lote.json
```

Luego en el chat (Vercel o local), **Developer mode** + mismo token → pestaña **KB** debería listar las entradas si apuntás al mismo API.
