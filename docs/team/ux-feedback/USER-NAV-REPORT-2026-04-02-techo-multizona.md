# Informe de navegación — Calculadora BMC (solo techo, multizona)

**URL:** [https://calculadora-bmc.vercel.app](https://calculadora-bmc.vercel.app)  
**Fecha:** 2026-04-02  
**Modo probado (transcripción):** escenario **solo techo**; flujo de precios (UMC), espesor **EPS ISO**, color, paneles; **Vista previa del techo** con largo ~10 m y ajuste de ancho / cantidad de paneles.

---

## Checklist previo

- [x] URL base
- [x] Transcripción (audio → texto en chat)
- [x] Capturas: 3 imágenes en sesión Cursor (rutas abajo)
- [ ] Build / commit desplegado en Vercel (opcional)

### Evidencia visual (archivos de sesión)

1. Zonas **separadas** (dos rectángulos con separación; totales por zona + suma):  
   `.cursor/projects/Users-matias-Panelin-calc-loca-Calculadora-BMC/assets/Captura_de_pantalla_2026-04-02_a_la_s__2.50.47_a._m.-e547f3d2-2fd4-42ec-9ef6-d7e3df9c7087.png`
2. Zonas **unidas en L** (alineadas; perímetro compuesto):  
   `.cursor/projects/Users-matias-Panelin-calc-loca-Calculadora-BMC/assets/Captura_de_pantalla_2026-04-02_a_la_s__2.52.21_a._m.-02b5a6eb-89a3-4676-a5d8-81c4e7433b59.png`
3. Criterio **dos aguas** / encuentro y lados compartidos (vista planta):  
   `.cursor/projects/Users-matias-Panelin-calc-loca-Calculadora-BMC/assets/Captura_de_pantalla_2026-04-02_a_la_s__2.53.01_a._m.-e11d5c39-0505-4ee5-a7b9-e29459da6c75.png`

> Recomendación repo: copiar estas capturas a `docs/team/ux-feedback/assets/2026-04-02/` cuando haya espacio en disco, y actualizar enlaces relativos.

---

## Meta

| Campo | Valor |
|-------|--------|
| **Fecha** | 2026-04-02 |
| **URL desplegada** | https://calculadora-bmc.vercel.app |
| **Alcance** | Calculadora — **solo techo**; vista previa; **multizona** |
| **Dispositivo / navegador** | NEEDS_CONFIRMATION |
| **Build / commit** | NEEDS_CONFIRMATION |

---

## Resumen ejecutivo

- El usuario valida que el flujo **solo techo** responde bien al elegir precio, **EPS ISO**, color y paneles; en **Vista previa del techo** el ajuste de **ancho** y la **cantidad de paneles** se percibe coherente (mención positiva en transcripción; detalle numérico ambiguo: “19 minutos” vs paneles).
- La necesidad central es **modelar el mismo techo con dos (o más) cuerpos**: (A) **separados** en planta → **dos perímetros independientes** y perfilería/accesorios como techos distintos (p. ej. distinto nivel); (B) **contiguos** (L o encuentro) → **un perímetro exterior compuesto**, con **lado compartido** que puede ser **cumbrera** u otro perfil según pendiente/dos aguas, y posibilidad de **elegir accesorios por borde o por tramo**, no solo el modelo actual por “lado cardinal” por zona aislada.
- En código, la vista previa (`RoofPreview.jsx`) aclara que **la posición en planta (`preview.x/y`) no alimenta el BOM**; el cálculo **por zona** usa `mergeZonaResults` sobre cada rectángulo **sin geometría de unión** (`PanelinCalculadoraV3_backup.jsx`). Eso explica el gap entre lo que el usuario ve en pantalla y lo que el presupuesto puede estar contando.

---

## Mapa de sesión (orden aproximado según transcripción)

1. Entrar a calculadora → escenario **solo techo**.
2. Flujo de precio / **UMC** → clic, baja; **EPS ISO** OK.
3. Siguiente: color, paneles.
4. **Vista previa del techo** → largo ~10 m; ajuste de ancho → **cantidad de paneles** (comentario favorable).
5. Explicación con **tres fotos**: zonas separadas vs L continua vs criterio **dos aguas** y **cumbrera** en el encuentro.

---

## Hallazgos

| ID | Tipo | Severidad | Ruta / pantalla | Evidencia | Comportamiento actual (inferido) | Comportamiento esperado (usuario) |
|----|------|-----------|-----------------|-----------|----------------------------------|-----------------------------------|
| NAV-2026-04-02-02 | UX / missing | **P0** | Vista previa del techo + resultado presupuesto | Fig. 1–3 + `RoofPreview.jsx` comentario “preview.x/y solo UI; no afecta BOM” | Arrastrar/alinear zonas **no cambia** cómo se calculan encuentros, perímetros compartidos ni perfilería entre zonas. | Si dos zonas son **el mismo techo** y se **tocan**, el sistema debe reconocer **aristas compartidas**, perímetro **exterior** neto y reglas de **cumbrera** / laterales en encuentros; si están **separadas**, tratarlas como **independientes** (doble perímetro, perfiles no compartidos). |
| NAV-2026-04-02-03 | missing | **P0** | Bordes / accesorios techo (dos aguas) | Fig. 3 + audio | Accesorios y bordes se razonan por **zona** y lados lógicos (`frente`/`fondo`/laterales) sin **tipo de encuentro** entre polígonos. | En cada **encuentro** entre cuerpos: clasificar arista (p. ej. **cumbrera**, valle, esquina, limite a patio); permitir **perfil/capa distinta** por tramo; en **dos aguas**, distinguir tramo que **sí** comparte cumbrera del que **no**. |
| NAV-2026-04-02-04 | UX | P1 | Botón **“Alinear zonas”** | Fig. 1 | El usuario usa alineación para mostrar **continuidad** del mismo techo. | Documentar o ajustar UX: aclarar si “Alinear” solo ordena vista o **declara** “mismo techo / encuentro” para cálculo; si es solo visual, ofrecer modo explícito **“Zonas enlazadas / mismo techo”** vs **“Independientes”**. |
| NAV-2026-04-02-05 | copy / clarity | P2 | Transcripción | Audio | Frase confusa: “no va a funcionar / ¿eso es todo?” (contexto perdido). | NEEDS_CONFIRMATION: ¿se refería a un paso concreto del asistente, a un límite del flujo, o a la **multizona**? Repetir captura + timestamp si aplica. |
| NAV-2026-04-02-06 | performance? | P2 | NEEDS_CONFIRMATION | Audio “19 minutos” | Incierto si es tiempo de tarea o cantidad. | Confirmar con usuario. |

**Nota:** máximo 5 P0 en informe: aquí hay **2 P0** (NAV-02, NAV-03); el resto P1/P2.

---

## Propagación

| ID / tema | `src/` | `server/` | `docs/` | Sheets / datos | env / deploy | Notas |
|-----------|--------|-----------|---------|----------------|--------------|-------|
| NAV-02 | `RoofPreview.jsx`, `PanelinCalculadoraV3_backup.jsx` (`zonasTotales`, `mergeZonaResults`, `calcTechoCompleto` por zona) | — | `docs/bmc-dashboard-modernization/IA.md` o calculadora README si se documenta regla de negocio | — | — | Posible nuevo modelo: grafo de polígonos o “grupos de techo”; impacta tests en `tests/validation.js` si existen SUITE techo. |
| NAV-03 | `calculations.js` (`calcTechoCompleto`, bordes, cumbrera), `RoofBorderSelector` | — | Misma | Catálogo perfiles en datos panel | — | Reglas **dos aguas** ya parten zona en dos faldones; falta **encuentro entre zonas**. |
| NAV-04 | `RoofPreview.jsx` (copy UI), posible estado `techo` | — | `ux-feedback` | — | — | Copy/onboarding sin tocar BOM si solo aclara. |

Ver tabla de propagación del equipo: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md`.

---

## Backlog para implementación (orden sugerido)

### NAV-2026-04-02-02 — Geometría de multizona → perímetro y BOM

- **Prioridad:** P0  
- **Pasos sugeridos:**
  1. **Especificación** (Solution/UX): definir estados “zonas independientes” vs “mismo techo (encuentro)” y cómo el usuario lo declara (toggle, snap al tocar, o asistente).
  2. A partir de posiciones en planta (o inputs explícitos), calcular **polígono unión** o **multipolígono** y aristas **internas vs externas**.
  3. Mapear aristas externas a **líneas de accesorio** (incl. cumbrera) y alimentar `calcTechoCompleto` / nuevo pipeline sin doble contar material en encuentros.
  4. Tests unitarios con casos: **dos rectángulos separados**; **L** compartiendo un segmento; **dos aguas** con cumbrera en el tramo compartido vs no compartido.
- **Criterios de aceptación:** Para el mismo conjunto de medidas que en Fig. 2, el BOM refleja **menos** metros lineales de ciertos perfiles en el tramo compartido que la suma de dos zonas aisladas; para Fig. 1, coincide con **suma de dos perímetros** si modo “independiente”.
- **Depende de:** decisión de producto en NAV-04 (cómo el usuario declara el modo).

### NAV-2026-04-02-03 — Accesorios por encuentro y dos aguas

- **Prioridad:** P0  
- **Pasos sugeridos:**
  1. Modelo de **encuentros** (lista de segmentos con metadata: longitud, tipo pendiente relativa, esCumbreraCandidata).
  2. UI mínima o tabla para **asignar perfil** por tramo (o reglas automáticas + override).
  3. Integrar con `techo.borders` / familia panel sin romper escenario una zona.
- **Criterios de aceptación:** Usuario puede reproducir verbalmente los casos de las **tres capturas** con resultados distintos en perfiles en el encuentro.
- **Depende de:** NAV-02.

### NAV-2026-04-02-04 — UX “Alinear zonas” y modo mismo techo

- **Prioridad:** P1  
- **Pasos:** copy + quizá checkbox “Estas zonas son un solo techo”; validar con una sesión corta de usuario.
- **Criterios de aceptación:** Tooltip o texto que evite la interpretación de que alinear **solo** es cosmético si el producto ya usa geometría para BOM.
- **Depende de:** NAV-02 (si el modo “mismo techo” existe).

### NAV-2026-04-02-05 — Aclarar comentario “no funciona / ¿eso es todo?”

- **Prioridad:** P2  
- **Pasos:** usuario aclara contexto; si es bug, abrir hallazgo con repro.
- **Depende de:** usuario.

---

## Riesgos y preguntas abiertas

- **Complejidad:** unión de polígonos con pendientes distintas por zona puede invalidar supuestos de rectángulos alineados; puede requerir **MVP** solo para **ejes alineados** (como en las capturas).
- **Drift Vercel vs repo:** confirmar commit desplegado vs `main` local para rutas exactas.
- No hay gates cm-0/1/2 en este informe.

---

## Apéndice — transcripción (fuente)

(Texto aproximado del audio entregado por el usuario, mezcla EN/ES.)

> Ir a la calculadora, etapa solo techo. Caída del techo a una agua. Precio UMC, click, baja, EPS ISO — bien. Siguiente color, paneles. Vista previa del techo — largo 10 m, bien; al poner ancho / cantidad de paneles hay buena diferencia (mención “19 minutos” ambigua).  
> Las zonas creadas son dos cuerpos; en la primera foto están **separadas** — deberían calcularse **dos perímetros independientes** y perfiles independientes (quizá dos niveles). En la foto **continua** (segunda) es la **misma** cubierta extendida, forma **L**, se generan varios **lados** y la **unión** entre ellos. La tercera imagen es el criterio **dos aguas**: al compartir, el lado compartido puede ser **cumbrera** o no; si están separados son dos niveles; puede haber parte que comparte cumbrera y parte que no, con otro perfil. En el conjunto L habla de **7 lados** distintos más un tramo compartido con perfil superior (cumbrera / variedades).
