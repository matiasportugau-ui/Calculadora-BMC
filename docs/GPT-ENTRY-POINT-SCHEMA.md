# GPT Entry Point — Esquema de Acceso Completo

Entry point para que el GPT acceda a la Calculadora BMC y tenga **accesibilidad completa** a todas las acciones posibles.

---

## URL del Entry Point

```
GET {BASE_URL}/calc/gpt-entry-point
```

**Ejemplos:**
- Local: `http://localhost:3001/calc/gpt-entry-point`
- Cloud Run: `https://panelin-calc-xxx.run.app/calc/gpt-entry-point`

---

## Respuesta (ejemplo)

```json
{
  "ok": true,
  "version": "1.0.0",
  "description": "Entry point para GPT Builder — acceso completo a todas las acciones de la Calculadora BMC.",
  "base_url": "https://panelin-calc-xxx.run.app",
  "openapi_url": "https://panelin-calc-xxx.run.app/calc/openapi",
  "actions": [
    {
      "operationId": "obtener_informe_completo",
      "method": "GET",
      "path": "/calc/informe",
      "summary": "Informe completo con precios, reglas de asesoría y fórmulas.",
      "whenToUse": "Llamar al INICIO de sesión para cargar contexto completo.",
      "url": "https://panelin-calc-xxx.run.app/calc/informe",
      "params": [{"name": "lista", "in": "query", "type": "string", "enum": ["venta", "web"]}]
    },
    ...
  ],
  "recommended_flow": [
    "1. GET /calc/informe (o /calc/catalogo + /calc/escenarios) al inicio para cargar contexto.",
    "2. Recopilar datos del usuario: escenario, dimensiones, panel, color, opciones.",
    "3. POST /calc/cotizar para calcular y mostrar resumen.",
    "4. Si el cliente quiere PDF: POST /calc/cotizar/pdf con objeto cliente.",
    "5. Compartir pdf_url con el cliente."
  ],
  "escenarios": ["solo_techo", "solo_fachada", "techo_fachada", "camara_frig"],
  "listas_precio": ["venta", "web"]
}
```

---

## Acciones Disponibles

| operationId | Método | Path | Cuándo usar |
|-------------|--------|------|-------------|
| `obtener_punto_entrada_gpt` | GET | /calc/gpt-entry-point | Descubrir todas las acciones al configurar el GPT |
| `obtener_esquema_openapi` | GET | /calc/openapi | Obtener schema OpenAPI completo (YAML) para GPT Actions |
| `obtener_informe_completo` | GET | /calc/informe | **Inicio de sesión** — contexto completo (precios, reglas, fórmulas) |
| `obtener_catalogo` | GET | /calc/catalogo | Familias, espesores, colores, precios por m² |
| `obtener_escenarios` | GET | /calc/escenarios | Campos requeridos y opcionales por escenario |
| `calcular_cotizacion` | POST | /calc/cotizar | Calcular cotización con BOM, precios, textos |
| `generar_cotizacion_pdf` | POST | /calc/cotizar/pdf | Generar PDF profesional y link para compartir |
| `listar_cotizaciones_generadas` | GET | /calc/cotizaciones | Historial de cotizaciones generadas |
| `ver_pdf_cotizacion` | GET | /calc/pdf/{id} | Abrir cotización HTML (imprimir como PDF) |

---

## Configuración en GPT Builder

1. **Schema URL**: Usar `{BASE_URL}/calc/openapi` como URL del schema en GPT Actions.
2. **Auth**: Si la API requiere autenticación, configurar según `API_AUTH_TOKEN` o `API_KEY`.
3. **Server**: El servidor debe ser `{BASE_URL}` (ej. `https://panelin-calc-xxx.run.app`).

---

## Flujo Recomendado

1. **Inicio**: `GET /calc/informe?lista=venta` — cargar contexto completo.
2. **Recopilar**: Preguntar escenario, dimensiones, panel, color, opciones.
3. **Calcular**: `POST /calc/cotizar` con body completo.
4. **PDF**: Si el cliente quiere PDF → `POST /calc/cotizar/pdf` con `cliente`.
5. **Compartir**: Enviar `pdf_url` al cliente.

---

## Referencias

- [openapi-calc.yaml](./openapi-calc.yaml) — Schema OpenAPI completo
- [AGENTS.md](./AGENTS.md) — Agentes del proyecto
- [planilla-inventory.md](./google-sheets-module/planilla-inventory.md) — Estructura de Sheets
