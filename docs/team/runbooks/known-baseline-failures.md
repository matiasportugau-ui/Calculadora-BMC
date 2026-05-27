# Known baseline test failures — runbook

Last updated: 2026-05-26
Owner: Matías Portugau · catálogo de failures que existen en `main` y son acknowledged como no-bloqueantes. Documentado para que devs nuevos (y returning) NO los confundan con regresiones causadas por su PR.

## Para qué sirve este runbook

`npm run gate:local` y CI **fallan algunos tests en `main`**. Cuando un dev abre un PR y corre el gate, ve esas fallas y se asusta pensando que las introdujo. Este archivo documenta cuáles son los conocidos para que puedas distinguir lo viejo de lo nuevo.

**Regla operativa:** antes de abrir un PR sustantivo, corré `gate:local` sobre `main` primero (en un worktree o clone fresh), guardá las fallas, y compará contra las fallas de tu branch. **Solo las NUEVAS importan.**

## Failures conocidos al 2026-05-26

### 1. `tests/sheetsCsvGuard.test.js` — 2 failures

| Test | Descripción |
|---|---|
| `tab prefixed` | Edge case: una celda Sheets que arranca con `\t` debería sanitarse antes de exportar a CSV. Hoy pasa sin trim. |
| `CR prefixed` | Mismo edge case con carácter `\r`. |

**Por qué se acepta como baseline:** documentado en PROJECT-STATE entradas 2026-05-20 (commit `9cfd9eb` auth/registration) y 2026-05-21 PM-2 (Tareas Stabilization Session 1) como "preexistente baseline". El call-site upstream (`server/lib/sheetsExport.js`) ya hace `trimStart()` antes de pasar el valor al guard — la falla es defensa en profundidad redundante.

**Cómo reconocerlo:** el output del test menciona literalmente `tab prefixed` o `CR prefixed` en la línea de FAIL.

**Cuándo arreglarlo:** prioridad baja. Cuando alguien edite `server/lib/sheetsCsvGuard.js` por motivos relacionados, agregar el trim ahí también.

### 2. `tests/agentTranscribe.test.js` — 2 failures (re-verificar)

**Estado:** flagged por el audit Explore agent del 2026-05-26 como `19/21 agentTranscribe passed (2 failures same prefix issue)`. **NO independientemente re-verificado** post-audit — el nombre del test específico no fue capturado.

**Acción para el próximo dev que llegue acá:** correr y completar:
```bash
npm run test 2>&1 | grep -A 6 agentTranscribe | head -30
```
y agregar a este runbook (a) qué tests específicos fallan, (b) por qué se acepta como baseline, (c) cómo arreglar eventualmente.

### 3. `src/components/activity/ActivityTracker.jsx:30` — ESLint `react-hooks/purity`

**Estado:** introducido por commit `05e51e3 feat(activity-log)` (`useRef(Date.now())` viola la regla — el inicializador del `useRef` se considera impuro porque `Date.now()` no es referencialmente transparente).

**Probablemente YA arreglado** por commit `c514a7f fix(activity-log): move Date.now() out of useRef initializer` del 2026-05-21 N. Verificar con:
```bash
npx eslint src/components/activity/ActivityTracker.jsx
```
Si el error persiste, fix correcto = inicializar con `useRef(0)` y asignar `Date.now()` en un `useEffect` montado una sola vez; o usar `useState(() => Date.now())[0]` que sí permite función inicializadora pura.

## Cómo actualizar este archivo

Después de cada sesión de audit, o cuando se agregue/quite un baseline acknowledged:

1. `npm run gate:local 2>&1 | tee /tmp/gate-output.txt` — capturá el estado actual
2. Para cada FAIL nuevo a documentar: agregá una sección con [test name | descripción | por qué se acepta | cómo arreglar eventualmente]
3. Bumpeá el "Last updated" arriba
4. Linkeá la entrada de PROJECT-STATE que documenta la decisión de aceptarlo
5. **Si un baseline se arregla, BORRALO de acá** — no dejes entradas stale, contamina el catálogo

## Qué NO es baseline

Si ves un FAIL que NO está listado acá, **es una regresión real**. Dos paths posibles:

- **Tu cambio la causó:** fix antes de mergear. Si no podés hoy, no abras el PR todavía.
- **`main`'s HEAD la causó:** abrí un issue, documentalo en la próxima entrada de PROJECT-STATE, y opcionalmente agregalo a este runbook si la decisión es aceptarlo como nuevo baseline (lo cual debería ser raro).

## Refs

- PROJECT-STATE 2026-05-20 (auth/registration): aceptación de `sheetsCsvGuard` failures
- PROJECT-STATE 2026-05-21 PM-2 (Tareas Stabilization Session 1): re-aceptación + lint failure de ActivityTracker
- PROJECT-STATE 2026-05-26 PM (Audit defensivo): este runbook + audit completo del estado del repo
