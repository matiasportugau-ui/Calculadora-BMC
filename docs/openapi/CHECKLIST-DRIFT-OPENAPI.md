# Checklist de drift — OpenAPI / GPT Builder

**Propósito:** Puntos a verificar cuando cambia OpenAPI. Guía para detectar y cerrar drift entre repo y GPT Builder.

---

## Cuando cambia OpenAPI (docs/openapi-calc.yaml)

- [ ] operationIds actualizados en el spec
- [ ] Schemas de request/response actualizados
- [ ] GPT Builder: actions apuntan a operationIds correctos
- [ ] GPT Builder: instrucciones mencionan los campos correctos
- [ ] Cloud Run: rutas implementadas coinciden con spec
- [ ] Auth: API_KEY o auth configurado en Builder

---

## Cuando cambia Cloud Run

- [ ] URL del servicio en GPT Builder es la correcta
- [ ] CORS permite orígenes de OpenAI
- [ ] Respuestas coinciden con schemas del spec

---

## Referencias

- docs/openapi-calc.yaml
- panelin-gpt-cloud-system skill
- panelin-drift-risk-closure skill
