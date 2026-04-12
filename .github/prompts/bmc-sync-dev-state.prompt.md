---
name: "BMC Sync Dev State"
description: "Audita Calculadora-BMC para comparar estado local, git y producción, detectar drift y dejar el entorno listo para retomar desarrollo."
argument-hint: "Opcional: quick, full, local-only, git-vs-prod, prod-check, dev-ready"
agent: "agent"
---

Audita el estado actual de **Calculadora-BMC** para poder retomar desarrollo con contexto real, diferencias claras y entorno local listo.

Por defecto, este prompt debe hacer **auditoría + safe setup local** si detecta que faltan dependencias o preparación básica del workspace.

## Objetivo

Hacé una pasada de sincronización técnica enfocada en:

- comparar **local vs git vs producción**
- detectar drift entre código, documentación y despliegues
- verificar **dependencias, scripts, entorno local y readiness** para seguir desarrollando
- dejar un resumen accionable con próximos pasos

## Contexto base del repo

Usá como fuentes mínimas:

- [AGENTS.md](../../AGENTS.md)
- [package.json](../../package.json)
- [Project State](../../docs/team/PROJECT-STATE.md)
- [README](../../README.md)

Tomá como referencia pública principal:

- Frontend: `https://calculadora-bmc.vercel.app`

Si encontrás una URL canónica distinta para la API o para producción en la documentación o scripts, incluila explícitamente en el análisis.

## Qué hacer

1. **Leer el estado documentado**
   - Revisá versión actual, cambios recientes, comandos clave y pendientes.
   - Detectá si `PROJECT-STATE.md` parece adelantado, atrasado o alineado respecto del código.

2. **Inspeccionar estado git/local**
   - Revisá branch actual, working tree, archivos modificados, staged/unstaged, y diferencias relevantes respecto de `main`/`origin` si aplica.
   - Señalá si hay trabajo local sin documentar o documentación sin reflejo en código.

3. **Verificar readiness del entorno local**
   - Confirmá dependencias del proyecto, scripts de arranque y requisitos mínimos.
   - Revisá si existe `.env`; si falta y el repo requiere variables, crealo desde `.env.example` o dejá placeholders mínimos.
   - Si hace falta para dejar el workspace listo, ejecutá por defecto pasos seguros de preparación como instalar dependencias, `npm run env:ensure`, o los scripts recomendados del repo.
   - No hagas pasos destructivos ni deploys sin pedir confirmación.

4. **Comparar con producción**
   - Contrastá el estado local/documentado con la superficie pública actual.
   - Verificá, cuando tenga sentido, versión visible, salud general, endpoints o smoke checks no destructivos.
   - Marcá cualquier diferencia entre lo que dice la documentación y lo que parece estar corriendo en producción.

5. **Evaluar estado real de desarrollo**
   - Resumí en qué punto parece estar el proyecto hoy.
   - Identificá bloqueos, follow-ups probables, riesgos de drift y el siguiente paso más útil para continuar desarrollo.

## Reglas de trabajo

- Priorizá evidencia real del repo y del runtime sobre suposiciones.
- Si corrés comandos, usá primero los scripts ya definidos en `package.json` o `AGENTS.md`.
- Preferí checks seguros y reversibles.
- No despliegues, no cambies producción y no borres nada sin aprobación explícita.
- Si detectás secretos faltantes o configuración incompleta, dejá el entorno preparado de forma segura y explicá qué faltaría completar manualmente.

## Formato de salida

Respondé con estas secciones, en este orden:

1. **Estado local**
2. **Estado git**
3. **Estado producción**
4. **Diferencias detectadas**
5. **Dependencias y entorno**
6. **Qué quedó listo ahora**
7. **Próximo mejor paso**

Incluí:

- archivos clave mencionados con rutas entre backticks
- comandos ejecutados, resumidos brevemente
- cualquier bloqueo o dato no verificable marcado de forma explícita

## Variantes sugeridas

Si el argumento del prompt incluye algo como esto, ajustá el foco:

- **quick** → chequeo liviano, sin instalar ni correr gates pesados
- **audit-only** → solo diagnóstico, sin preparar el entorno local
- **full** → auditoría completa con readiness local y validaciones más profundas
- **local-only** → ignorar producción salvo referencias documentales
- **git-vs-prod** → priorizar drift entre repo y entorno público
- **dev-ready** → priorizar dejar dependencias y entorno local preparados
