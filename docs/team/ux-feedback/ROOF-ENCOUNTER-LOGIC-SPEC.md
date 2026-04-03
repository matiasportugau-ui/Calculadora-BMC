# Especificación: encuentros entre zonas (techo multizona)

Objetivo: modelar **qué pasa en el tramo compartido** entre dos zonas para accesorios/BOM y para coherencia con la vista en planta y el paso 10 (3D).

## Cuatro modos (estado máquina)

1. **Continuo** — Mismo plano, sin cambio de pendiente ni quiebre de cubierta en la unión; no lleva perfil en ese tramo compartido (`none` en cotización para ese lado compartido).

2. **Pretil** — Hay terminación tipo pretil en la unión. **Dos decisiones**: perfil (o accesorio) del lado de **esta zona** y perfil del lado de la **zona vecina**. En datos: `modo: "pretil"`, `perfil`, `perfilVecino`. Cuando la geometría resuelve vecino (`resolveNeighborSharedSide`), el UI sincroniza el objeto espejado en el borde opuesto del vecino.

3. **Cumbrera (dos aguas compartida)** — Dos faldones distintos que comparten **un solo perfil** en la cumbrera. `modo: "cumbrera"`, `cumbreraUnida: true`, un único `perfil` aplicado en ambos lados del encuentro (escritura duplicada en cada `preview.encounters` para lectura simple del BOM).

4. **Desnivel / dos techos** — No es continuidad de un solo plano: distinta cota o dos cubiertas que se encuentran (p. ej. techo inferior cerrando contra muro / soporte del superior). **Dos perfiles** posibles: `desnivel.perfilBajo`, `desnivel.perfilAlto` (y `perfil` como respaldo legacy para el motor hasta que el BOM discrimine tramos). La cotización MVP usa `encounterBorderPerfil()` (prioriza `perfilBajo`).

## Forma del objeto guardado (`preview.encounters[side]`)

Retrocompatible con `tipo: "continuo" | "perfil"`:

```json
{
  "tipo": "continuo",
  "modo": "continuo",
  "perfil": null,
  "perfilVecino": null
}
```

```json
{
  "tipo": "perfil",
  "modo": "pretil",
  "perfil": "id_accesorio_zona_actual",
  "perfilVecino": "id_accesorio_zona_vecina"
}
```

```json
{
  "tipo": "perfil",
  "modo": "cumbrera",
  "cumbreraUnida": true,
  "perfil": "id_unico"
}
```

```json
{
  "tipo": "perfil",
  "modo": "desnivel",
  "perfil": "id_respaldo_bom",
  "desnivel": { "perfilBajo": "…", "perfilAlto": "…" }
}
```

Normalización y helpers: `src/utils/roofEncounterModel.js`.

## BOM / `effectiveBorders`

- Lado **compartido** y modo continuo: `none`.
- Resto: `encounterBorderPerfil(enc)` (ver helper).

Pendiente de producto: partir el encuentro en **dos partidas** cuando pretil tenga perfiles distintos sin duplicar metros, y reglas de desnivel por tramo (alto/bajo) en `calcTechoCompleto`.

## Orientación 3D vs planta (relacionado)

Si el frente/fondo en 3D no coincide con la brújula de planta, revisar mapping `preview.x/y` → `offsetX`/`offsetZ`, posible **yaw** por zona (`preview.meshYawRad`) y alineación de la rejilla de paneles con `slopeMark`. No forma parte del modelo de encuentros pero afecta la percepción del usuario.
