# Launchpad X — Comandos recomendados para desarrollo BMC

## Comportamiento actual (Hot key launcher)

- **`npm run launchpad`** → Abre la interfaz en http://localhost:3877
- **Teclas 1-9, 0** → Ejecutan el comando (1=primero, 2=segundo, …, 0=décimo)
- **Click** → Ejecuta el comando seleccionado
- **Pads** → Solo resaltan la opción (no ejecutan)

---

## Resumen por prioridad

### Tier 1 — Uso diario (imprescindibles)

| Comando | Cuándo | Por qué |
|---------|--------|---------|
| **dev:full** | Inicio de sesión | Arranca API + Vite en un solo comando. Lo que más usás. |
| **dev** (Vite) | Solo frontend | Si la API ya corre en otro terminal. |
| **open Vite** (5173) | Abrir calculadora | La app principal de cotización. |
| **open dashboard** (3001/finanzas) | Abrir dashboard | Panel BMC Finanzas/Operaciones. |
| **build** | Antes de deploy | Compila para producción. |

### Tier 2 — Calidad y flujo (pre-commit / pre-push)

| Comando | Cuándo | Por qué |
|---------|--------|---------|
| **lint** | Antes de commit | Detecta errores de estilo y posibles bugs. |
| **test** | Antes de push | Valida reglas de negocio. |
| **test:contracts** | Tras cambios en API | Verifica que el contrato API siga cumplido. |
| **git status** | Antes de commit | Ver qué cambió. |
| **git diff** | Revisar cambios | Ver diff antes de commit. |

### Tier 3 — Git y servicios

| Comando | Cuándo | Por qué |
|---------|--------|---------|
| **git pull** | Inicio / antes de trabajar | Traer cambios remotos. |
| **start:api** | Solo API | Si querés correr solo el backend. |
| **open health** | Debug | Ver estado de la API. |

### Tier 4 — Sheets / deploy (cuando toques esas áreas)

| Comando | Cuándo | Por qué |
|---------|--------|---------|
| **map-all-sheets** | Trabajo con planillas | Mapea todas las hojas. |
| **verify-tabs** | Tras cambios en Sheets | Verifica que los tabs existan. |
| **bmc-dashboard** | Servidor Sheets API | Levanta el servidor de planillas. |
| **go-live** | Deploy | Automatización de go-live. |

### Tier 5 — Opcionales (podés quitar)

| Comando | Motivo para quitar |
|---------|--------------------|
| **open standalone** (3849) | Menos usado que Vite/dashboard. |
| **go-live** en pad | Deploy no es diario; mejor por terminal. |

---

## Layout sugerido (por filas)

Organización mental por fila para recordar rápido:

```
Fila 1 (arriba) — ARRANCAR
  dev:full | dev | start:api | build | [vacío] | [vacío] | [vacío] | [vacío]

Fila 2 — ABRIR
  open Vite | open dashboard | open health | [vacío] | [vacío] | [vacío] | [vacío] | [vacío]

Fila 3 — CALIDAD
  lint | test | test:contracts | [vacío] | [vacío] | [vacío] | [vacío] | [vacío]

Fila 4 — GIT
  git status | git diff | git pull | [vacío] | [vacío] | [vacío] | [vacío] | [vacío]

Fila 5 — SHEETS (opcional)
  map-all-sheets | verify-tabs | bmc-dashboard | [vacío] | [vacío] | [vacío] | [vacío] | [vacío]
```

---

## Set mínimo recomendado (8–10 pads)

Si querés solo lo esencial:

1. **dev:full** — arrancar todo
2. **dev** — solo Vite
3. **build** — compilar
4. **open Vite** — calculadora
5. **open dashboard** — panel BMC
6. **lint** — pre-commit
7. **test** — pre-push
8. **git status** — ver cambios
9. **git pull** — traer remoto
10. **git diff** — revisar diff

---

## Set completo (desarrollo + sheets)

Todo lo anterior +:

11. **test:contracts** — validar API
12. **start:api** — solo backend
13. **open health** — debug API
14. **map-all-sheets** — mapeo planillas
15. **verify-tabs** — verificar tabs
16. **bmc-dashboard** — servidor Sheets API

**go-live** — mejor dejarlo fuera del Launchpad; es un comando de deploy que conviene ejecutar explícitamente en terminal.
