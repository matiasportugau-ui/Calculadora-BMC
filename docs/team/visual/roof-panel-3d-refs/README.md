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
| `isoroof-cross-section-dimensioned.png` | `bmcuruguay.com.uy` producto ISOROOF FOIL (`isoagro.png`) | **Plano técnico con cotas exactas en mm** del perfil trapezoidal: ancho total 1000, nervadura central 26×40 (ancho×alto), paso entre nervaduras 72. Fuente primaria para `roofPanelCrossSections.js` — no hace falta estimar, son las cotas reales del fabricante. |
| `isoroof-3d-render-ribs.png` | `bmcuruguay.com.uy` producto ISOROOF FOIL (`isoagro.png` variante) | Render 3D limpio del panel trapezoidal completo, útil para verificar visualmente el resultado de la extrusión paramétrica contra el original. |

**Uso recomendado:** `isoroof-cross-section-dimensioned.png` es la fuente primaria (cotas exactas)
para `roofPanelCrossSections.js` (spec §1.3, Opción E — implementación directa, sin depender de
terceros). El resto sirve de referencia de proporciones para `roofPerfilCrossSections.js` (spec
§2.2) y como evidencia concreta si igual se le pide a BMC/Kingspan Uruguay (ex-Bromyros) el archivo
3D fuente real (spec §1.4, Opción D, mejora incremental no bloqueante).

**No son el asset final para D** — son renders/planos planos (PNG/JPG), no `.glb`/`.fbx`/`.blend`
navegables. Para Opción E sí son la fuente completa (el plano acotado ES el dato necesario).
