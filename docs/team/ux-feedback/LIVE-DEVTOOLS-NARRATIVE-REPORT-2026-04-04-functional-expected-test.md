# LIVE-DEVTOOLS-NARRATIVE-REPORT — Functional Expected Test

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `https://calculadora-bmc.vercel.app` |
| Entorno | prod |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` |
| Participantes | Usuario (narrativa) + Agente (MCP DevTools) |

## 2. Objetivo de la sesión

- **Goal (una frase):** documentar y validar correcciones funcionales usando formato `ACTION/EXPECT` con evidencia real de DevTools.
- **Criterios de éxito del usuario:** cada corrección queda registrada como caso de prueba esperado y contrastada contra consola/red/UI observada.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

_Orden cronológico. Texto tal cual o normalizado mínimo (sin inventar pasos)._

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | Paso 0 (inicio) | Abrir producción y preparar sesión Live DevTools narrative para navegar y reportar correcciones. | Tener baseline funcional para empezar test de correcciones con evidencia técnica. |
| U-02 | Paso 1 | "Document this action and expects as the functionality expected test." | Quedar documentado como test funcional esperado con tabla `ACTION/EXPECT`. |
| U-03 | Paso 2 | Open Panelin Chat and I can see previous conversation. | Not expected: al abrir el chat debería iniciar limpio (sin conversación previa persistida). |
| U-04 | Paso 3 | "It should show Dev mode option, I can't find it." | La opción Dev mode debería ser encontrable/visible sin fricción o con indicación clara de activación. |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

_Resumen de lo obtenido por tools durante baseline._

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Inicio de sesión | `take_snapshot` | Home cargada (`Calculadora BMC`) con navegación visible y chat Panelin abierto. |
| E-02 | Inicio de sesión | `list_console_messages` (`error`,`warn`) | Sin mensajes de error o warning al cargar. |
| E-03 | Inicio de sesión | `list_network_requests` | Carga base OK: requests principales `200/304`, sin `4xx/5xx` en el arranque. |
| E-04 | Paso 2 | `take_snapshot` | El diálogo "Panelin Asistente BMC" muestra historial previo visible (mensajes anteriores ya cargados al abrir). |
| E-05 | Paso 2 | `evaluate_script` sobre `localStorage` | Existe clave `panelin-chat-history` con contenido persistido (`size: 2856`), consistente con recuperación de conversación previa. |
| E-06 | Paso 2 | `list_console_messages` + `list_network_requests` | Sin errores de consola ni fallos de red en el evento; comportamiento parece lógico de producto, pero no cumple expectativa de test. |
| E-07 | Paso 3 | `take_snapshot` (antes del atajo) | Dev mode no aparece visible de entrada en la interfaz principal. |
| E-08 | Paso 3 | `press_key` (`Control+Shift+D`) | Se abre prompt: "API_AUTH_TOKEN para activar Developer Mode", confirmando activación vía atajo. |
| E-09 | Paso 3 | `take_snapshot` (después del atajo) | Aparece botón `DEV` y panel Developer Mode (`Train`, `KB`, `Prompt`, `Save correction`). |
| E-10 | Paso 3 | `list_network_requests` + `list_console_messages` | Endpoints dev responden `401` (`/api/agent/training-kb`, `/api/agent/dev-config`, `/api/agent/prompt-preview`) sin token válido. |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01, E-02, E-03 | sí | Baseline listo para comenzar los tests de corrección funcional. |
| U-02 | E-01 | sí | Estructura de test funcional esperada documentada en este reporte. |
| U-03 | E-04, E-05, E-06 | no | Se observa persistencia de historial previo en apertura de chat; expectativa era iniciar sin conversaciones previas. |
| U-04 | E-07, E-08, E-09, E-10 | parcial | El modo existe pero no es descubrible sin atajo; además requiere `API_AUTH_TOKEN` para operar. |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable (`src/` / `server/` / env / deploy) |
|----|-----------|--------|---------|-----------------------------------------------------|
| LDN-2026-04-04-01 | P2 | Baseline inicial sin errores de arranque | El estado inicial de producción es apto para ejecutar pruebas guiadas por usuario. | deploy |
| LDN-2026-04-04-02 | P1 | Persistencia no esperada de conversación en Panelin Chat | Al abrir el chat se muestra historial previo (`panelin-chat-history`), contradiciendo el criterio "start clean" del test funcional. | `src/` |
| LDN-2026-04-04-03 | P1 | Dev Mode con baja descubribilidad + barrera de auth | No se muestra de forma evidente al inicio; aparece tras atajo (`Ctrl/Cmd+Shift+D`) y, sin token, las rutas dev fallan con `401`. | `src/` + env/auth |

## 7. Recomendaciones y siguientes pasos

1. Continuar la sesión en vivo agregando cada corrección como nueva fila `U-xx` con `ACTION` y `EXPECT`.
2. Después de cada acción, capturar `E-xx` de consola + red + snapshot para cerrar el ciclo de validación.
3. Definir comportamiento deseado de sesión de chat: "siempre nueva", "nueva por usuario", o "recordar historial".
4. Si el criterio final es "siempre nueva", limpiar `panelin-chat-history` al abrir el panel o al cerrar sesión y agregar test de regresión.
5. Para Dev Mode: decidir si debe verse siempre (con badge bloqueado) o mantener atajo pero mostrar helper de descubrimiento; documentar claramente requisito `API_AUTH_TOKEN`.

## 8. Verificación (checklist)

- [x] Reproducible en URL indicada
- [x] Consola limpia de errores P0 / o documentado
- [x] Red: sin 4xx/5xx inesperados en flujo principal
- [x] Criterios de éxito del usuario (§2) cubiertos o ticket abierto

## 9. Anexos (opcional)

- Sesión DevTools activa sobre producción.
- Próximos ítems se anexan como `U-03+` y `E-04+` en este mismo archivo.
