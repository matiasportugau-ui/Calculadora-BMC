# White-label BC — presupuesto propio en deploy paralelo

Un socio corre **su** calculadora, con **su** presupuesto en PDF, sin tocar la
producción BMC. Mismo repo, mismo código: cambia una variable de entorno.

- Marca comercial: **BC** (logo arriba del presupuesto).
- Razón social, RUT y dirección: **sólo** en el pie legal, al final del documento.
- Producción BMC (`calculadora-bmc.vercel.app`): **no cambia nada**.

## Cómo se enciende

| Dónde | Variable |
|---|---|
| Frontend (build de Vite) | `VITE_WHITELABEL=bc` |
| API (Node / Cloud Run) | `WHITELABEL=bc` |

Sin la variable, todo queda como está: el layout `bc` **ni siquiera aparece** en
el selector de PDF y el default sigue siendo `simple`.

Con la variable encendida:

- el selector de PDF ofrece **un único layout** (`Presupuesto BC`) y es el default;
- cualquier otro layout que se pida —un `bmc.pdfLayout` viejo en el localStorage
  del navegador, un `body.template` a mano contra la API— **cae igual** en el
  layout de la marca. Es a propósito: si no, se escapa un PDF con branding BMC
  desde la calculadora del socio.

## Qué NO hace todavía

Sólo cambia el **PDF**. La UI de la calculadora es la misma (no se pidió
tocarla). Branding en pantalla, rutas recortadas y precios del socio son pasos
aparte.

## Archivos

| Archivo | Rol |
|---|---|
| `src/config/whitelabel.js` | Lee el env en Vite **y** en Node; define el perfil de marca |
| `src/pdf-templates/bc.js` | El template (logo vectorial, paleta, secciones) |
| `src/pdf-templates/index.js` | Filtra el selector, fija el default, fuerza el layout |
| `tests/whitelabel-bc-pdf.test.js` | Fija el contrato (corre en `npm run test:api`) |

## Datos de la marca

Viven en `WHITELABEL_BRANDS.bc` (`src/config/whitelabel.js`):

```
marca         BC                     ← lo que se ve arriba
razonSocial   Jenerik Bentancor      ← sólo pie legal
rut           150633750010           ← pie legal + datos bancarios
direccion     Florencio Sánchez y Ruta 5 vieja, Progreso
banco         (vacío → "A completar")
telefono      (vacío → "A completar")
```

**Pendiente de completar con el socio:** cuenta bancaria y teléfono de consultas.
Mientras estén vacíos, el PDF los muestra como `A completar` en rojo — no se
inventan datos financieros.

El modelo de cotización puede traer un `branding` que pisa estos campos uno por
uno (`mergeBranding`), para cuando el socio cargue lo suyo desde la app. Un
branding parcial no borra los defaults.

## Decisiones que conviene no deshacer

**El pie legal va en el flujo, al final — no fijo por página.** Se intentó con
`position: fixed`; el pipeline de producción (`server/lib/quotePdf.js`) imprime
con `preferCSSPageSize: true` y sin header/footer de Chromium, y en ese modo
Chromium **no** repite el elemento fijo: lo dibuja una sola vez y encima del
contenido. Chromium tampoco soporta `@page` margin boxes, así que no hay
numeración de páginas por CSS.

**Los márgenes van en `@page`,** no en las opciones de `page.pdf()`: producción
usa `preferCSSPageSize`, que hace ganar al CSS.

**Las condiciones comerciales se reescriben con la marca del socio.**
`QUOTE_TERMS` es compartido y una cláusula nombra a BMC ("BMC no asume
responsabilidad…"); en el PDF del socio sale con su marca. `Bromyros` queda como
está: es la planta real de retiro, no branding.

**Los precios unitarios sub-centavo se muestran con 4 decimales.** Un remache a
`0.0213` mostrado como `0.02` hace que `cant. × P.U.` no reproduzca el total y el
presupuesto parezca mal sumado.

## Verificar antes de deployar

```bash
npm run lint
node --test tests/whitelabel-bc-pdf.test.js
BMC_DISK_PRECHECK_SKIP=1 VITE_WHITELABEL=bc npm run build
```

El test cubre lo que importa: que la prod BMC no cambie, que el socio vea un
único layout, y que **ningún** PDF del socio contenga `BMC`, `Metalog`,
`bmcuruguay` ni el RUT de METALOG.

## Deploy paralelo

La infraestructura del deploy paralelo (`vercel.paid.json`, workflow
`deploy-paid-parallel.yml`, plan `paid` y `identity.users.branding`) vive en el
PR #1051 `feat/paid-white-label-presupuestos`. Este cambio es independiente y
funciona solo: alcanza con un proyecto Vercel aparte que buildee con
`VITE_WHITELABEL=bc`, apuntando a una API con `WHITELABEL=bc`.

Cuando #1051 esté mergeado, el `branding` por usuario entra por `q.branding` sin
tocar el template.
