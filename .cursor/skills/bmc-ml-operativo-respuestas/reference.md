# BMC — ML operativo: referencia rápida (`curl` / `jq`)

Base local por defecto: `http://127.0.0.1:3001`. Sustituir `TOKEN` por `API_AUTH_TOKEN` del `.env` (no commitear).

## Auth

```bash
export API_BASE="http://127.0.0.1:3001"
export TOKEN="…"   # API_AUTH_TOKEN
```

## Preguntas (lista)

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/ml/questions" | jq '.[:5]'
```

Filtrar **UNANSWERED** en un export de corpus (ruta del archivo según el último export):

```bash
jq '[.[] | select(.status == "UNANSWERED")] | length' ML-CORPUS-FULL-*.json
jq '[.[] | select(.status == "UNANSWERED") | {id, status, text: .text[0:120]}]' ML-CORPUS-FULL-*.json
```

## Publicar respuesta

```bash
QID="13562857868"
curl -sS -X POST "$API_BASE/ml/questions/$QID/answer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hola. … USD 1.625,76 IVA inc. …"}'
```

## Cotizar (ejemplos mínimos)

**Fachada / cerramiento** (ajustar cuerpo a lo que exija tu `calc.js`):

```bash
curl -sS -X POST "$API_BASE/calc/cotizar" \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "solo_fachada",
    "listaPrecios": "web",
    "panel": "ISOPANEL_EPS",
    "espesorMm": 100,
    "alto": 2.5,
    "perimetro": 6.8,
    "numEsqExt": 2,
    "numEsqInt": 0,
    "flete": 0
  }' | jq .
```

**Presupuesto libre (m² panel):**

```bash
curl -sS -X POST "$API_BASE/calc/cotizar/presupuesto-libre" \
  -H "Content-Type: application/json" \
  -d '{"metrosCuadrados": 5.25, "listaPrecios": "web"}' | jq .
```

## OAuth / estado ML

```bash
curl -sS "$API_BASE/auth/ml/status" | jq .
# Flujo interactivo: ver docs/ML-OAUTH-SETUP.md y npm run ml:verify
```

## Normalización de moneda (servidor)

Ruta: [`server/lib/mlAnswerText.js`](../../../server/lib/mlAnswerText.js) — función `normalizeMlAnswerCurrencyText`.

- Entrada con `U$S 1.625,76` → envío a ML con prefijo **USD** y sin `$` ASCII problemático.
- Tests: [`tests/validation.js`](../../../tests/validation.js) (buscar `normalizeMlAnswerCurrencyText`).
