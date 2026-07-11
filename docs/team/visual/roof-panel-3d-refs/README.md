# Referencias 3D reales — descargadas de bmcuruguay.com.uy (Shopify)

Descargadas 2026-07-11 durante la investigación de sourcing de assets para
[`VISOR-3D-QUALITY-REWORK-SPEC.md`](../../ux-feedback/VISOR-3D-QUALITY-REWORK-SPEC.md) §1.4/§2.2.
Confirman que BMC (o su proveedor/agencia) ya tiene modelos 3D fuente detrás de estos renders —
son **renders 3D reales, no fotos** (visible en la geometría/sombreado y en el prefijo de archivo
`3D-*` del original en Shopify).

| Archivo | Fuente | Qué muestra |
|---|---|---|
| `isodec-ficha-tecnica.png` | `bmcuruguay.com.uy` producto ISODEC EPS | Render 3D del panel + specs |
| `isodec-pir-ficha-tecnica.png` | `bmcuruguay.com.uy` producto ISODEC PIR | Render 3D + tabla de espesores/autoportancia + **corte técnico acotado en mm con recuadro "Detalle engrafe"** (unión entre paneles) |
| `isodec-dims-flyer.jpg` | `bmcuruguay.com.uy` producto ISODEC EPS | Render 3D limpio mostrando el perfil de engrafado (nervaduras) con largo/ancho/caída de agua |
| `isoroof-foil-flyer.jpg` | `bmcuruguay.com.uy` producto ISOROOF FOIL | Render 3D del panel trapezoidal + **íconos 3D renderizados de cada accesorio de borde** (Babeta, Gotero Superior/Lateral/Frontal, Cumbrera) |
| `cumbrera-3d-render.png` | `bmcuruguay.com.uy` producto `cumbrera-isoroof-3g` (uno de 3 colores) | Render CAD del perfil de Cumbrera — geometría precisa: cresta simétrica, pestañas, muescas de calce con la greca del panel |

**Uso recomendado:** referencia de proporciones para autorear `roofPerfilCrossSections.js` y
`roofPanelModelUrls.js` (spec §1.3/§2.2), y como evidencia concreta al pedirle a BMC/Kingspan
Uruguay (ex-Bromyros) el archivo 3D fuente (spec §1.4, Opción D) — mostrar estas imágenes deja
claro exactamente qué formato/vistas ya existen en algún lado de su pipeline.

**No son el asset final** — son renders planos (PNG/JPG), no `.glb`/`.fbx`/`.blend` navegables.
