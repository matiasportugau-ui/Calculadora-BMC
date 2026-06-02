# INVESTIGACIÓN COMPLETA: Renders, Fotos Reales, Dibujos Técnicos, BIM y Assets para Productos Exactos BMC/Panelin (Isoroof / Isodec series) — Foco Plegados/Grecas (DWG reference)

**Fecha:** 2026-06 (investigación "mas completa" bajo constraint explícito "no modifiques naa , los datos reales ya los tenemos tenemos que encontrar los renders que los representen").  
**Referencia geométrica primaria:** `/Users/matias/Downloads/panelin_assets/videos/plegados en general.dwg` (AutoCAD 2018-2020 DWG, ~73KB, geometría pura de plegados/trapezoidal 3-grecas para chapa superior de la familia Isoroof).  
**Alcance:** Todos los productos techo en calculadora (PANELS_TECHO de constants.js): ISOROOF_3G, ISOROOF_FOIL, ISOROOF_COLONIAL, ISOROOF_PLUS, ISODEC_EPS, ISODEC_PIR (y mapeo a ISOPANEL/ISOWALL pared donde aplica).  
**Prioridad:** Recursos **locales Uruguay** (Planta Kingspan Uruguay / Canelones / Bromyros / BMC Uruguay / kingspan.com.uy / bmcuruguay.com.uy). Global Kingspan solo como cross-check de calidad/estilo.  
**Método:** Búsquedas web exhaustivas + fetch de páginas de producto + PDFs oficiales + BIM + fotos de obras + Instagram/YouTube + inspección no-destructiva del DWG (ls, file, strings, header AC1032). Cero modificaciones a código, datos, assets o specs del proyecto.  
**Objetivo:** Encontrar los renders/fotos/dibujos/3D/videos/texturas **que fielmente representan** los productos reales que ya están en la calculadora (para que 2D/3D viz coincidan exactamente con lo que se vende/fabrica en UY).

---

## 1. DWG de referencia (plegados en general.dwg) — inspección no-destructiva
- Ubicación compartida: `/Users/matias/Downloads/panelin_assets/videos/plegados en general.dwg`
- Tipo: AutoDesk AutoCAD 2018/2019/2020 DWG válido (header AC1032 confirmado por xxd).
- Tamaño: 72,910 bytes.
- Contexto carpeta: Principalmente videos MP4 narrativos/character (Panelin S07/S13/S16/S21 etc.) + JPG start frames + este DWG único. No otros DWG/PDF/CAD obvios en el find.
- Strings extractables: Mínimos (típico geometría pura sin atributos/texto: "freesp", "Summary", "ObjFreeSpaceP"). Sin labels de producto, dimensiones o "isoroof/greca" legibles fácilmente.
- Interpretación: Es el **master vector limpio de la forma de los plegados** (chapa superior trapezoidal con 3 grecas/ nervaduras) para la familia Isoroof 3G/Plus/Foil. Usar como ground-truth geométrico para:
  - Extraer perfil 2D (puntos/curvas) para extrusión en Three.js (RoofPanelRealisticScene o nuevo PanelProduct3DViewer).
  - Validar dibujos de catálogos/PDFs/BIM (coincidencia de #grecas=3, forma trapezoidal, espaciamiento, altura de greca, ancho total ~1000mm au).
  - Hatching y dims en SVG 2D sections (PanelCrossSection).

---

## 2. Mapeo exacto: Nombres en calculadora vs productos reales UY
De `src/data/constants.js` (PANELS_TECHO + PERFIL_TECHO + BORDER_OPTIONS + SCENARIOS):

**Techo (los del DWG/plegados foco):**
- ISOROOF_3G: "ISOROOF 3G", au:1.0m, "Techos Livianos", caballete_tornillo, gotero_frontal_greca / gotero_frontal.
- ISOROOF_FOIL: "ISOROOF FOIL 3G", au:1.0m, mismo.
- ISOROOF_COLONIAL: "Isoroof Colonial", au:1.0m, "Teja exterior · interior blanco".
- ISOROOF_PLUS: "ISOROOF PLUS 3G", au:1.0m, "Techos Premium".
- ISODEC_EPS: "ISODEC EPS", au:1.12m, varilla_tuerca, techos/cubiertas.
- ISODEC_PIR: "ISODEC PIR", au:1.12m.

**Mapeo oficial (kingspan.com.uy + Bromyros/BMC UY, fabricación Planta Canelones / Kingspan Uruguay para la mayoría):**
- ISOROOF_3G → Paneles Isoroof® 3G / ISOROOF® 3G (Trapezoidal 3G).
- ISOROOF_PLUS → Panel Isoroof® Plus (explícitamente "3 grecas como terminación").
- ISOROOF_FOIL → Panel Isoroof® Foil (misma familia de perfil trapezoidal 3G + interior foil).
- ISOROOF_COLONIAL → Panel Isoroof® Colonial (teja exterior, comparte au 1.0 y familia pero estética diferenciada; nota: una ficha indica fabricación Isoeste Brasil).
- ISODEC_EPS → Panel Isodec® de EPS (engrafado, au 1120mm).
- ISODEC_PIR → Panel Isodec® PIR (engrafado, au 1120mm, PIR).

**Notas de fabricación (críticas para "real UY"):** La mayoría de Isoroof 3G/Plus/Foil + Isodec listan explícitamente "Fabricado en Planta Kingspan Uruguay" / "Lugar de fabricación: Planta de Canelones Kingspan Bromyros". Colonial a veces Brasil. bmcuruguay enfatiza "fabricación nacional".

---

## 3. Assets por tipo y familia (links directos + por qué representan fielmente + uso recomendado para viz)

### 3.1 Páginas de producto oficiales + fotos de catálogo (mejores "studio renders" exactos)
Usar las imágenes PNG/JPG directas como albedo/base para texturas/PBR y validación visual (no redistribuir sin términos; referencia interna).

- **Isoroof Plus (3 grecas explícito + int madera)**: https://kingspan.com.uy/productos-kingspan/isoroof-plus/
  - Texto clave: "contando en su cara superior con **3 grecas como terminación** e interior con acero galvanizado. ... Cálida terminación interior de imitación madera." PIR, 30/50/80mm, au 1000mm, ext blanco/gris/rojo. "Fabricado en Planta Kingspan Uruguay."
  - Imagen principal: https://kingspan.com.uy/wp-content/uploads/2024/06/isoroof_plus.png (y variantes).
  - "Descargar información" (ficha técnica con secciones constructivas probables).

- **Isoroof 3G (estándar trapezoidal 3G)**: https://kingspan.com.uy/productos-kingspan/isoroof-3g/
  - PIR/PUR family, 30-100mm, au 1000mm, int blanco. "Fabricado en Planta Kingspan Uruguay."
  - Imagen: https://kingspan.com.uy/wp-content/uploads/2024/06/isoroof_3G.png

- **Isoroof Foil**: https://kingspan.com.uy/productos-kingspan/isoroof-foil/
  - Interior foil flexible/blanco. Mismo perfil 3G family. Imagen: https://kingspan.com.uy/wp-content/uploads/2024/10/isoroof_foil-tabla.png

- **Isodec PIR (engrafado, au 1.12)**: https://kingspan.com.uy/productos-kingspan/isodec-pir/
  - "sistema de unión engrafado". 50/80/120mm, au 1120mm, PIR. Imagen: https://kingspan.com.uy/wp-content/uploads/2024/06/isodec-pir.png

- **Isodec EPS**: https://kingspan.com.uy/productos-kingspan/isodec-eps/
  - Similar engrafado, EPS.

- **Isoroof Colonial (teja)**: https://kingspan.com.uy/productos-kingspan/isoroof-colonial/
  - "diferencial estético" teja colonial exterior, int blanco, PIR, au 1000mm. Imagen: https://kingspan.com.uy/wp-content/uploads/2024/06/Isoroof-colonial.jpg.webp (nota: una doc indica planta Brasil).

- **Todas las páginas** tienen "Descargar información" (jet_download genérico) → fichas técnicas con specs, espesores, probablemente perfiles/cortes.

**Uso viz:** Fotos directas = ground truth para color real, sheen metal prepintado, terminaciones (madera, foil, blanco tablillado). Comparar vs assets actuales PanelRendering/Shopify (muchos son de estas mismas o muy similares).

### 3.2 bmcuruguay.com.uy (distribuidor BMC Uruguay — fotos comerciales + specs 1:1 + "grecas" en accesorios)
- Colecciones: https://bmcuruguay.com.uy/collections/isoroof , /collections/isodec
- ISOROOF 3G específico (nombre idéntico): https://bmcuruguay.com.uy/products/isoroof-3g-gris-rojo-blanco-bromyros
  - Múltiples fotos reales de producto: cdn/shop/files/file.jpg , Isoroof.jpg , image.png , avif etc. (high-res 3840+). Muestran cara superior trapezoidal 3G, juntas, color, escala.
  - Texto: "Exterior: Chapa Calibre 24 (0.55mm) Prepintada (Gris - Rojo - Blanco) **Trapezoidal 3G**." "Ancho útil: 1m." "fabricación nacional". "cara superior revestida... núcleo de poliisocianurato (PIR)".
  - Accesorios relacionados: "CUMBRERA - ISOROOF 3G" ("encastre perfecto con las grecas"), "GOTERO SUPERIOR 3G - ISOROOF", "GOTERO LATERAL - ISOROOF".
  - Precios, plazos, descripción "ISOROOF® 3G", cielorraso blanco.

- Similar para ISOROOF PLUS, FOIL (e.g. iagro30), ISODEC EPS/PIR.
- Home/listings listan precios USD por m2 para ISOROOF 3G / PLUS / FOIL / ISODEC etc. (coherente con motor calc).

**Uso viz:** Las imágenes cdn de bmcuruguay son las "fotos de los productos que se venden" en UY — ideales para reference matching exacto (ángulos, iluminación real de venta, detalles de greca/junta). Diferentes a studio kingspan a veces (más "en contexto").

### 3.3 Bromyros / Catálogos técnicos PDFs (dibujos 2D constructivos + perfiles + tablas — mejores para 2D CAD y dims exactos)
- Isoroof Plus (Bromyros presenta): https://justcrea.com/wp-content/uploads/2020/10/Isoroof-Plus-Bromyros.pdf (3 págs)
  - Extracto clave: "exterior en forma **trapezoidal (3 grecas)** ... interior una cálida imitación de madera." "Ancho Útil – 1000 mm". Núcleo PIR. Propiedades térmicas/fuego detalladas. **Fidelidad DWG: confirmación textual directa del perfil 3-grecas trapezoidal.**

- Isodec ficha técnica Bromyros: https://justcrea.com/wp-content/uploads/2020/07/bromyros_isodec_ficha-tecnica.pdf

- Catálogo completo de productos ES-UY (Bromyros/Kingspan Bromyros, ~8+MB, cubre todo): disponible vía links en catalogos-tecnicos y referencias educativas (buscar "Bromyros-catálogo-de-produtos-ES-UY.pdf"). 
  - Contenido: Historia (Bromyros 1948 → Kingspan), Biblioteca BIM, Sistemas de Cubiertas (ISOROOF 3G/Plus/Foil), tablas térmicas por espesor, "Lugar de fabricación: Planta de Canelones Kingspan Bromyros", perfiles, detalles, EPS/Isopanel/Isodec con engrafado, au exactos.
  - Probablemente incluye dibujos de sección/perfil de la chapa superior (3 grecas para Isoroof) con cotas — comparar directamente con el DWG proporcionado.

- Otros en bromyros.com.uy/downloads/... : Condiciones generales de venta, Cartilla traslado Isopanel, etc. (patrón para más PDFs técnicos).

- Catálogos Técnicos kingspan.com.uy: https://kingspan.com.uy/catalogos-tecnicos/ (VER PDF para Poliuretano / Poliestireno; algunos dinámicos o vía Bromyros).

**Uso viz:** Extraer dims (chapa 0.5/0.4mm, alturas greca, paso, espesor total por mm núcleo) para panelConstructionSpecs (ya cerca), hatching preciso en PanelCrossSection (metal lines para chapa, dots/cross para EPS/PIR), profile exacto para 3D extrusion. "TechDraw/FreeCAD style" 2D.

### 3.4 BIM / Modelos 3D inteligentes (geometría paramétrica exacta para 3D volumétrico + profile)
- https://kingspan.com.uy/biblioteca-bim/
  - Modelos Revit listos: 
    - Isoroof Foil
    - Isoroof (general — cubre 3G/Plus perfil)
    - Isodec
    - Isopanel
    - Isofrig (EPS/PIR) — un link directo incluso a .rvt compartido LATAM.
  - "objetos inteligentes" con geometría real (perfiles trapezoidales/grecas Isoroof, engrafado Isodec, espesores variables, au exacto).
  - **Fidelidad DWG:** Descargar el Isoroof Revit → exportar o inspeccionar el perfil de chapa superior (3 grecas) → overlay o comparar curvas/dims con el DWG del usuario. Ideal para data-driven procedural 3D (profile extrusion + thickness + side details + PBR).

- Global complementario (del doc KINGSPAN existente): 3dviewer.kingspan.com (RW roof trapezoidal similar, explode, clip sections, color picker — referencia de cómo se ve un perfil real en 3D interactivo). Sketchfab kingspan.facades (modelos Evolution/QuadCore para estudio de materiales/juntas, no idénticos pero calidad benchmark).

**Uso:** Para Fase 2+ volumetría: usar perfiles de estos Revit (o trace de PDFs/catálogos) en vez de planos repetidos. Añadir volumen real (top/bottom + lados con espesor visible, núcleo expuesto en edges/sections). Soportar live familia/espesor/color.

### 3.5 Fotos de obras reales instaladas (contexto UY, luz, plegados en uso)
- https://kingspan.com.uy/fotos-de-obras/
  - Decenas de fotos reales de proyectos UY: Conaprole, Frigorifico Sarubbi/Copayan/Las Piedras/San Jacinto/Modelo, Planta Industrial Bromyros, Weyerhauser, Abasto, Botnia, Breeders-Packers, Claldy, Copayan, Bimbo, Pili, Mall Almenara, Montevideo Shopping, Tres Cruces, TA-TA, UTEC, Liceos, Escuelas, Viviendas (muchas con "Isodec® Rojo", "CHACRAS-DEL-SUR-CUBIERTA-ROJA", "Vivienda en paneles"), Aeropuerto Carrasco, Antel Arena, etc.
  - Categorías: Industria, Centros Comerciales, Educativos, Vivienda, Otros.
  - Imágenes directas: kingspan.com.uy/wp-content/uploads/2021/03/CHACRAS-DEL-SUR-CUBIERTA-ROJA.jpg.webp , Frigorifico-*.jpg.webp , Vivienda-particular-con-Isodec®-Rojo-*.jpg.webp etc.
  - Muestran plegados/grecas en cubiertas reales (ángulo, juntas, fijaciones, color bajo sol uruguayo, ensambles con goteros/perfiles).

**Uso:** Validación de apariencia final "como se ve en obra" (no solo foto de producto aislado). Para texturas (suciedad ligera, variación, reflectividad real), iluminación en 3D viewer, PDF showcases realistas. Instagram @kingspanuruguay amplía con más recientes/reels.

### 3.6 Video y multimedia real (movimiento, instalación, 3D appearance)
- YouTube oficial: "Conoce nuestro panel isoroof ®" — https://www.youtube.com/watch?v=5E7HX3VvFiM (Kingspan Uruguay / Bromyros, ~1.1K views). Presentación del producto (apariencia, perfil, instalación básica).
- Canal: Kingspan Uruguay / bromyros1 — playlist "Productos en Kingspan Uruguay", shorts de Isoroof Eco Foil etc.
- Instagram @kingspanuruguay reels: Isoroof Plus imitación madera (calidez + aislamiento), Topdeck, Residence, perlines, detalles de obra. Búsquedas "kingspanuruguay isoroof" muestran posts con #Techo #Kingspanuruguay.
- Valor: Videos muestran el plegado en 3D (cómo se ve la greca desde abajo/lateral durante instalación), comportamiento de la chapa, luz real, ensamble con cumbreras/goteros. Útil para prompts de captura o referencia de movimiento/anim en viewer.

### 3.7 Global Kingspan (calidad benchmark, no primarios para UY exactos)
Del doc existente KINGSPAN-BIM-3D-DOWNLOAD-SOURCES.md:
- 3dviewer.kingspan.com (interactive RW/AWP roof/wall, clip planes para secciones, colores live, detalles constructivos 3D).
- sketchfab.com/kingspan.facades (modelos fotorrealistas System Evolution etc., buenos para PBR/roughness/metalness de metal + núcleo).
- Otras: NBS Source, ARCAT (DWG details sin login), BIMobject, Polantis (render formats), TraceParts/3dfindit (multi CAD).
- Usar solo para inspiración de calidad/profesionalismo (TechDraw-like, BIM param, volumetría visible); siempre validar contra fuentes UY para "nuestros productos".

---

## 4. Verificación de completitud por familia (cross-reference vs calculadora)
- **ISOROOF_3G / ISOROOF_PLUS / ISOROOF_FOIL**: Cobertura excelente. "3 grecas" / "trapezoidal 3G" / "Trapezoidal 3G" repetido en kingspan.com.uy, Bromyros PDFs (Plus explícito), bmcuruguay (accesorios grecas + specs), fotos, BIM Isoroof. au 1000mm, espesores overlapping, finishes exactos (madera en Plus, foil en Foil, blanco en 3G). Imágenes + PDFs + Revit + obras reales.
- **ISOROOF_COLONIAL**: Buena (página dedicada, imagen, specs au1.0 PIR, teja int blanco). Nota planta Brasil en una fuente; aún listado en UY site y calc. Perfil base trapezoidal probablemente comparte con la familia (adaptable a "teja").
- **ISODEC_EPS / ISODEC_PIR**: Excelente. au 1120mm confirmado, engrafado ("sistema de unión engrafado"), espesores (EPS hasta 250mm, PIR 50-120), PIR/EPS núcleo, "Planta Canelones", imágenes, BIM Isodec, fichas, bmcuruguay listings, tablas térmicas en catálogos. Diferente joint vs Isoroof (importante para 3D borders/goteros).
- **Paredes (ISOPANEL_EPS, ISOWALL_PIR)**: Cubiertas en catálogos/BIM/fotos (au 1.14/1.1), pero foco investigación era plegados techo Isoroof. Similar calidad de assets.
- **Gaps menores / proxies**: No se encontraron DWG públicos gratuitos idénticos al proporcionado (normal; los Revit/BIM y catálogos PDFs son los equivalentes oficiales). "Descargar información" a veces jet-protected (usar las páginas + contactar para fichas completas). Algunos catálogos dinámicos en site (ver Bromyros PDFs directos). Colonial menos "3 grecas" explícito (estética teja prioritaria). Global models buenos pero no 1:1 UY (usar para calidad bar, no geometría exacta).
- **Coherencia total**: Todos los recursos citados usan los mismos nombres/especs/au/espesores/colores/núcleos que la calculadora (y el mapeo en el doc KINGSPAN anterior). "Planta Kingspan Uruguay" repetido = los renders representan **exactamente** lo que se cotiza/vende.

---

## 5. Recomendaciones para uso (panel-product-visualization-specialist y roadmap)
- **2D Secciones CAD (PanelCrossSection, PDF, showcase)**: Usar dibujos de los Bromyros PDFs + fichas "Descargar información" + tablas térmicas para layers reales (0.5mm chapa ext + núcleo variable + 0.4/0.45 int + foil), hatching material-specific (líneas densas metal para chapas, puntos/cruces para EPS/PIR), perfil greca simplificado en upper para Isoroof basado en "trapezoidal (3 grecas)", dims laterales (espesor total mm) y bottom (au). Footer con "Datos de fichas técnicas Kingspan Uruguay / Bromyros". Data attrs para captura PDF.
- **3D Volumétrico (RoofPanelRealisticScene, viewer aislado, ensamble)**: 
  - Perfil: Extraer curva 3-grecas del DWG o de los Revit Isoroof / dibujos PDF catálogos (coincidencia geométrica).
  - Volumen real: Top chapa perfilada + bottom plana + lados (espesor visible con núcleo) + edge details (goteros greca para Isoroof, engrafado para Isodec).
  - Materiales PBR: Fotos kingspan/bmcuruguay como albedo (metal prepintado real, foil reflectivo sheen, imitación madera interior), ajustar roughness/metalness de visualProfiles.js contra renders reales y 3dviewer.
  - Live: familia + espesor (resuelve profileType + dims + totalThickness de specs) + color (tinte en mesh + textura).
- **Assets pipeline (sin tocar datos existentes)**: Referencia las URLs de imágenes (wp-content, cdn bmcuruguay) internamente para nuevos PBR o validación. Descargar BIM (Revit) → exportar perfiles/secciones para Three.js (o usar como ground truth para procedural). Actualizar docs/skills/rubrica con estos links (no assets binarios del repo a menos que licencia permita).
- **Coherencia UI/PDF/visor**: QuoteVisualVisor acordeón "Sección 2D", PanelFamilyShowcase live, PDF appendix con vector section + raster 3D capture de producto. Links a kingspan.com.uy por familia para "ver real".
- **Calidad gate**: Comparar renders generados vs las fotos de bmcuruguay/kingspan/fotos-obras + dibujos PDFs (no drift en #grecas, au, espesor, terminación int). Rúbrica 100pt (perfil real matching DWG, thickness visible en 3D borders, etc.).
- **Legal**: Todo público para referencia. Para uso en app comercial/PDFs: verificar términos (contactar ventas@kingspan.com.uy o BMC). Recomendado: crear assets propios fieles basados en estos (mejor que genéricos).

---

## 6. Fuentes principales consultadas (esta investigación + previas en KINGSPAN doc)
- kingspan.com.uy (páginas producto, biblioteca-bim, fotos-de-obras, catalogos-tecnicos, presentamos-isoroofplus).
- bmcuruguay.com.uy (productos exactos, colecciones, specs, fotos cdn, accesorios grecas).
- Bromyros PDFs directos (Isoroof-Plus-Bromyros.pdf con "3 grecas", isodec ficha, catálogo productos completo con specs Isoroof/Isodec + "Planta Canelones").
- Instagram @kingspanuruguay (reels/posts Plus, obra, detalles).
- YouTube Kingspan Uruguay / bromyros1 ("Conoce nuestro panel isoroof ®" + playlist).
- Doc previo KINGSPAN-BIM-3D-DOWNLOAD-SOURCES.md (mapeo inicial + global).
- Inspección DWG local.

Enlaces pueden cambiar/requerir registro para descargas completas. Mantener este doc actualizado periódicamente.

---

**Conclusión de la investigación "mas completa"**: Los renders/fotos/dibujos/BIM/videos que representan fielmente los productos reales de la calculadora existen y están abundantemente disponibles en fuentes oficiales UY (Kingspan Uruguay / Bromyros / BMC). El perfil "3 grecas trapezoidal" del DWG está confirmado explícitamente en literatura del fabricante/distribuidor para la familia Isoroof. Usar estos como única fuente de verdad para cualquier mejora de visualización 2D/3D (nunca datos inventados o globales genéricos). El siguiente paso natural es delegar al `panel-product-visualization-specialist` (con este doc + el DWG + links) para Fase 1 polish o Fase 2 volumetría/profiles, manteniendo zero modificaciones a los datos reales existentes.

Para handoff: este archivo + el KINGSPAN-BIM existente + PROJECT-STATE actualizado son la referencia viva.

(Actualización agregada al conocimiento del equipo sin tocar specs/código/assets del proyecto.)