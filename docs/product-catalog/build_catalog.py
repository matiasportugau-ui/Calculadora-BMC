#!/usr/bin/env python3
"""
Generador de la base de conocimiento de productos BMC.

Fuente de verdad: una sola lista PRODUCTS (abajo), poblada desde el catalogo
Shopify de BMC URUGUAY (bmcuruguay.com.uy) via Shopify Admin API el 2026-06-12.
Emite dos artefactos sincronizados en este mismo directorio:

  - catalog.json  -> fuente estructurada (la lee Claude / el modulo de productos)
  - README.md     -> vista legible por humanos (fotos + links para mandar a clientes)

Re-correr:  python3 docs/product-catalog/build_catalog.py

NOTA precios: Shopify guarda precios CON contexto de tienda (lista "web"). Para
paneles el precio canonico de cotizacion vive en Matriz/ledger (ex-IVA) y puede
diferir del de Shopify (ver isofrig_canonical y los flags `price_note`).
"""

import json
import os
from datetime import date

SHOP = "bmcuruguay.com.uy"
STORE_BASE = f"https://{SHOP}/products/"
SNAPSHOT_DATE = "2026-06-12"
TOTAL_IN_SHOPIFY = 97  # paginas 1+2, hasNextPage=false

# Categorias en orden de presentacion + etiqueta legible
CATEGORIES = [
    ("paneles", "Paneles aislantes (sandwich)"),
    ("perfiles_panel", "Perfiles y angulos de panel (U / G2 / K2 / G4)"),
    ("accesorios_isoroof", "Accesorios ISOROOF (cumbreras, goteros, babetas, canalon)"),
    ("accesorios_isodec", "Accesorios ISODEC (cumbreras, goteros, babetas, canalon)"),
    ("accesorios_hiansa", "Accesorios Hiansa-Panel"),
    ("accesorios_panel", "Accesorios comunes de panel"),
    ("chapas", "Chapas y autoportantes"),
    ("fijaciones", "Fijaciones y ferreteria"),
    ("quimicos", "Quimicos / selladores / espumas"),
    ("impermeabilizacion", "Impermeabilizacion (membranas)"),
    ("impermeabilizacion_hm", "Linea HM-rubber (caucho liquido / impermeabilizantes)"),
    ("perfiles_estructural", "Perfiles estructurales (aluminio)"),
    ("galpones", "Galpones de jardin prefabricados"),
]

# p = precio "desde" (minVariantPrice, USD). img = featuredMedia (None si no hay).
# Campos: handle, title, status, vendor, ptype, p, img, cat
def P(handle, title, status, vendor, ptype, p, img, cat):
    return {
        "handle": handle, "title": title, "status": status, "vendor": vendor,
        "product_type": ptype or None, "price_from_usd": p, "image": img,
        "category": cat, "url": STORE_BASE + handle,
    }

CDN = "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/"

PRODUCTS = [
    # ---- PANELES ----
    P("hiansa-panel-trapezoidal-5g-becam", "Hiansa-Panel (Trapezoidal 5G) - BECAM", "ACTIVE", "My Store", "", 46.73, CDN+"HIANZA-PUR-5G-BECAM-GRIS.webp?v=1748592601", "paneles"),
    P("isodec®-pir", "ISODEC PIR (Techos y Cubiertas) / 50 - 80 - 120 mm", "ACTIVE", "My Store", "", 51.02, CDN+"Isodec_PIR.png?v=1755503238", "paneles"),
    P("isopanel-isodec-eps-cubiertas-bmc-reloaded", "ISODEC EPS (Techos y Cubiertas) / 100 - 150 - 200 - 250 mm", "ACTIVE", "My Store", "", 46.07, CDN+"ISODEC_GRIS.png?v=1756747335", "paneles"),
    P("isoroof-3g-gris-rojo-blanco-bromyros", "ISOROOF 3G / 30 - 50 - 80 mm", "ACTIVE", "Bromyros by KINGSPAN", "Panel Aislante", 48.74, CDN+"file.jpg?v=1752178338", "paneles"),
    P("iagro30", "ISOROOF FOIL 3G / 30 - 50 mm", "ACTIVE", "KINGSPAN", "Panel Aislante", 39.54, CDN+"file.jpg?v=1752178338", "paneles"),
    P("iroof80-pls", "ISOROOF PLUS 3G / 80 mm", "ACTIVE", "KINGSPAN", "Panel", 71.76, CDN+"file.jpg?v=1752178338", "paneles"),
    P("isopanel-eps-paredes-y-fachadas", "ISOPANEL EPS (Paredes y Fachadas) / 50 - 100 - 150 - 200 - 250 mm", "ACTIVE", "My Store", "", 41.88, CDN+"1e03a1_6071dc1dcd5743968a0bbe3e23fce220_mv2.png?v=1752607327", "paneles"),
    P("isowall-®-pir", "ISOWALL PIR - Fachadas / 50 - 80 mm", "ACTIVE", "My Store", "", 54.65, CDN+"isowall_jpg.webp?v=1756840865", "paneles"),
    P("isofrig-®", "ISOFRIG Panel Frigorifico / 40 - 60 - 80 - 100 - 120 - 150 - 180 mm", "DRAFT", "My Store", "", 53.11, CDN+"ISOWALL_PIR.png?v=1755385123", "paneles"),
    P("pu20mm-gris-sin-cielorraso-pvc", "PU20mm Gris sin Cielorraso (PVC)", "DRAFT", "My Store", "", 36.00, None, "paneles"),

    # ---- PERFILES / ANGULOS DE PANEL ----
    P("perfiles-u", "PERFIL U (ISOPANEL - ISOWALL - ISOFRIG) / 40 a 180 mm", "ACTIVE", "My Store", "", 14.23, CDN+"PERFILU100.jpg?v=1755271238", "perfiles_panel"),
    P("angulo-plegado-g2-l-exterior", "ANGULO EXTERIOR (Perfil G2) / 50 a 250 mm", "ACTIVE", "My Store", "Accesorio", 19.17, CDN+"GoteroSupdeCamara.jpg?v=1755215533", "perfiles_panel"),
    P("angulo-interior-perfil-k2", "ANGULO INTERIOR (Perfil K2)", "ACTIVE", "My Store", "", 14.92, CDN+"AnguloInterior_PerfilK2_2.jpg?v=1755031842", "perfiles_panel"),
    P("angulo-plegado-g4-40x40", "Angulo G4 - (40x40)", "ACTIVE", "My Store", "", 18.85, CDN+"3D-AnguloG4exterior--Renderizado-WEB02.png?v=1748580715", "perfiles_panel"),

    # ---- ACCESORIOS ISOROOF ----
    P("cumbrera-isoroof-3g", "CUMBRERA - ISOROOF 3G", "ACTIVE", "My Store", "", 58.23, CDN+"3D-CumbreraIsoroof3G-Rojo-WEB01.png?v=1759860971", "accesorios_isoroof"),
    P("canalon-doble-isoroof-bandeja-tapas-agujero-bajada", "Canalon Doble - ISOROOF (Kit)", "ACTIVE", "My Store", "", 118.76, CDN+"CANALONISODEC_EPS_PIR_Gris_2.jpg?v=1755206403", "accesorios_isoroof"),
    P("soporte-para-canalon-isoroof", "Soporte para Canalon - Isoroof", "ACTIVE", "My Store", "", 18.66, CDN+"SoportedeCanalonIsoroof.jpg?v=1755206907", "accesorios_isoroof"),
    P("arandela-trapezoidal-caballete-roof", "Caballete - Arandela trapezoidal - ISOROOF (x10)", "ACTIVE", "My Store", "", 9.20, CDN+"20250709_155024.jpg?v=1755369402", "accesorios_isoroof"),
    P("babeta-de-atornillar-lateral-isoroof", "Babeta de Atornillar Lateral - ISOROOF", "ACTIVE", "My Store", "", 37.81, CDN+"BabetadeAtornillarIsodec.jpg?v=1755206215", "accesorios_isoroof"),
    P("babeta-de-atornillar-superior-3g-isoroof", "Babeta de Atornillar Superior 3G - ISOROOF", "ACTIVE", "My Store", "", 39.24, CDN+"BabetadeAtornillarSuperior3G-ISOROOF_1.jpg?v=1755204832", "accesorios_isoroof"),
    P("babeta-de-empotrar-lateral-isoroof", "Babeta de Empotrar Lateral - ISOROOF", "ACTIVE", "BMC URUGUAY", "", 37.81, CDN+"BabetadeAdosar-ISODEC_4.jpg?v=1755372738", "accesorios_isoroof"),
    P("babeta-de-empotrar-superior-3g-isoroof-bmc-reloaded", "Babeta de Empotrar Superior 3G - ISOROOF", "ACTIVE", "My Store", "", 20.92, CDN+"BabetadeEmpotrarSuperior3G-Terracota.png?v=1755372214", "accesorios_isoroof"),
    P("gotero-lateral-de-camara-isoroof", "Gotero Lateral de Camara - Isoroof", "ACTIVE", "My Store", "", 36.89, CDN+"Modelo3dG.LateralCamara-Gris-WEB01.png?v=1752240908", "accesorios_isoroof"),
    P("gotero-lateral-isoroof", "Gotero Lateral - ISOROOF", "ACTIVE", "My Store", "", 36.08, CDN+"GoteroLateralIsoroof.jpg?v=1755204383", "accesorios_isoroof"),
    P("gotero-superior-de-camara-isoroof", "Gotero Superior de Camara - ISOROOF", "ACTIVE", "My Store", "", 37.86, CDN+"3D-GoteroSuperiordeCamaraIsoroof3G-Gris-WEB01.png?v=1752254989", "accesorios_isoroof"),
    P("gotero-superior-3g-isoroof", "GOTERO SUPERIOR 3G - ISOROOF", "ACTIVE", "My Store", "", 46.65, CDN+"IMG_3399-Edit.jpg?v=1755365558", "accesorios_isoroof"),
    P("gotero-frontal-con-greca-isoroof", "Gotero Frontal con Greca - ISOROOF", "ACTIVE", "My Store", "", 27.45, CDN+"GoteroFrontalconGreca-ISOROOF.png?v=1755369232", "accesorios_isoroof"),
    P("gotero-frontal-simple-isoroof", "Gotero Frontal Simple - ISOROOF", "ACTIVE", "My Store", "", 26.18, CDN+"IMG_3364-Edit_996789a1-58c1-4911-b775-eada26867d06.jpg?v=1755202546", "accesorios_isoroof"),
    P("embudo-conector-de-bajada-pvc-para-canaleta-100mm", "Embudo Conector de Bajada PVC para Canaleta (100mm)", "ACTIVE", "BMC URUGUAY", "Accesorio", 18.73, CDN+"Gemini_Generated_Image_yk2nc5yk2nc5yk2n.png?v=1761766537", "accesorios_isoroof"),

    # ---- ACCESORIOS ISODEC ----
    P("soporte-de-canalon-isodec", "SOPORTE de CANALON - ISODEC (EPS & PIR)", "ACTIVE", "My Store", "", 22.68, CDN+"IMG_3329_f9af623c-7cb2-4a8b-822f-77fbb4daff15.jpg?v=1755201993", "accesorios_isodec"),
    P("canalon-isodec-kit-completo", "CANALON ISODEC (EPS & PIR) - KIT COMPLETO", "ACTIVE", "My Store", "", 98.98, CDN+"IMG_3324-Edit.jpg?v=1755201703", "accesorios_isodec"),
    P("cumbrera-isodec", "CUMBRERA para ISODEC", "ACTIVE", "My Store", "", 33.54, CDN+"3D-PerfilCumbreraISODEC-Blanco-Renderizado-WEB01.png?v=1748581588", "accesorios_isodec"),
    P("babeta-de-empotrar-isodec", "BABETA ISODEC - Empotrar", "ACTIVE", "My Store", "", 17.35, CDN+"Babeta_de_Empotrar_Blanca.jpg?v=1755375091", "accesorios_isodec"),
    P("babeta-isodec-adosar", "BABETA ISODEC - Adosar", "ACTIVE", "My Store", "", 17.35, CDN+"Babeta_de_adosar_blanca.jpg?v=1755374853", "accesorios_isodec"),
    P("gotero-lateral-de-camara-isodec", "GOTERO LATERAL de CAMARA - ISODEC (EPS & PIR)", "ACTIVE", "My Store", "", 33.26, CDN+"3D-GoteroLateraldeCamaraISODEC-Blanco-Renderizado-WEB01.png?v=1748581487", "accesorios_isodec"),
    P("gotero-frontal-isodec", "Gotero Frontal para ISODEC (EPS & PIR)", "ACTIVE", "My Store", "Accesorio", 22.31, CDN+"GoteroFrontalparaISODEC2.jpg?v=1755373732", "accesorios_isodec"),
    P("gotero-lateral-para-isodec-copia", "Gotero Lateral y Superior para ISODEC (EPS & PIR)", "ACTIVE", "My Store", "Accesorio", 29.57, CDN+"GoteroLateralIsodecEPS_PIR4.jpg?v=1755373177", "accesorios_isodec"),

    # ---- ACCESORIOS HIANSA ----
    P("cumbrera-hiansa-panel-5g-becam", "Cumbrera Hiansa-panel 5G (BECAM)", "ACTIVE", "My Store", "", 22.85, CDN+"CumbreraLisaconCrestaHianza-Panel5G-GRIS.png?v=1748593998", "accesorios_hiansa"),
    P("perfil-lateral-hiansa-panel-becam", "Perfil Lateral Derecho Hiansa-Panel", "ACTIVE", "My Store", "", 31.12, CDN+"PerfilLateralDerechoHainza-Gris-01.png?v=1748594991", "accesorios_hiansa"),
    P("perfil-lateral-hiansa-panel-becam-bmc-reloaded", "Perfil Lateral Izquierdo Hiansa-Panel", "ACTIVE", "My Store", "", 31.12, CDN+"file_b430e1c6-0b07-4496-9501-1274c1d58909.jpg?v=1747885616", "accesorios_hiansa"),
    P("frontalin-hiansa-panel", "Frontalin Hiansa-Panel", "ACTIVE", "My Store", "", 21.47, CDN+"Frontalin_Hiansa-Panel_Gris.jpg?v=1755367061", "accesorios_hiansa"),

    # ---- ACCESORIOS COMUNES DE PANEL ----
    P("cinta-butilo", "Cinta Butilo 2mm x 15mm x 22.5m - ISOROOF/ISODEC/ISOPANEL", "ACTIVE", "My Store", "", 22.48, CDN+"Cinta_Butilo_01.jpg?v=1755215262", "accesorios_panel"),

    # ---- CHAPAS / AUTOPORTANTES ----
    P("chapa-trapezoidal-bc-35-prepintada", "CHAPA TRAPEZOIDAL (BC-35) PREPINTADA", "DRAFT", "My Store", "", 14.92, None, "chapas"),
    P("chapa-trapezoidal-bc-35-aluzinc", "CHAPA TRAPEZOIDAL (BC-35) - ALUZINC", "DRAFT", "My Store", "", 5.59, None, "chapas"),
    P("chapa-sinuzoidal-bc-18-aluzinc", "CHAPA SINUZOIDAL (BC-18) - ALUZINC", "DRAFT", "My Store", "", 5.59, None, "chapas"),
    P("chapa-sinuzoidal-bc-18-prepintada", "CHAPA Sinuzoidal (BC-18) PREPINTADA", "DRAFT", "My Store", "", 14.92, None, "chapas"),
    P("chapa-sinuzoidal-bc-18-aluzinc-con-variables", "CHAPA SINUZOIDAL (BC-18) - ALUZINC (variantes)", "DRAFT", "My Store", "", 11.53, None, "chapas"),
    P("chapa-sinuzoidal-bc-18-prepintada-con-variantes", "CHAPA Sinuzoidal (BC-18) PREPINTADA (variantes)", "DRAFT", "My Store", "", 14.92, None, "chapas"),
    P("chapa-trapezoidal-bc-35-aluzinc-con-variantes", "CHAPA TRAPEZOIDAL (BC-35) - ALUZINC (variantes)", "DRAFT", "My Store", "", 11.53, None, "chapas"),
    P("chapa-trapezoidal-bc-35-prepintada-con-variantes", "CHAPA TRAPEZOIDAL (BC-35) PREPINTADA (variantes)", "DRAFT", "My Store", "", 14.92, None, "chapas"),
    P("chapa-lisa-galvanizada", "Chapa Lisa Galvanizada", "DRAFT", "My Store", "", 27.65, None, "chapas"),
    P("chapa-lisa-aluzinc", "Chapa Lisa Aluzinc", "DRAFT", "My Store", "", 5.59, None, "chapas"),
    P("autoportante-prepintada-cal-24-esp-0-50-mm", "Autoportante Prepintada Cal. 24 / 0.50 mm", "DRAFT", "My Store", "", 19.42, None, "chapas"),
    P("autoportante-prepintada-cal-26-esp-0-41-mm", "Autoportante Prepintada Cal. 26 / 0.41 mm", "DRAFT", "My Store", "", 14.92, None, "chapas"),
    P("autoportante-galvanizado-bc-120-cal-19-esp-1-11-mm", "Autoportante Galvanizado BC-120 Cal. 19 / 1.11 mm", "DRAFT", "My Store", "", 33.83, None, "chapas"),
    P("autoportante-galvanizado-bc-120-cal-20-esp-0-89-mm", "Autoportante Galvanizado BC-120 Cal. 20 / 0.89 mm", "DRAFT", "My Store", "", 27.65, None, "chapas"),
    P("autoportante-aluzinc-bc-120-cal-22-esp-0-70-mm", "Autoportante Aluzinc BC-120 Cal. 22 / 0.70 mm", "DRAFT", "My Store", "", 22.66, None, "chapas"),
    P("autoportante-aluzinc-bc-120-cal-24-esp-0-50-mm", "Autoportante Aluzinc BC-120 Cal. 24 / 0.50 mm", "DRAFT", "My Store", "", 14.13, None, "chapas"),
    P("autoportante-aluzinc-bc-120-cal-26-esp-0-41-mm", "Autoportante Aluzinc BC-120 Cal. 26 / 0.41 mm", "DRAFT", "My Store", "", 11.53, None, "chapas"),
    P("chapateja-prepintada-cal-24-esp-0-50-mm", "Chapateja Prepintada Cal. 24 / 0.50 mm", "DRAFT", "My Store", "", 19.42, None, "chapas"),
    P("chapateja-prepintada-cal-27-esp-0-41-mm", "Chapateja Prepintada Cal. 27 / 0.41 mm", "DRAFT", "My Store", "", 15.04, None, "chapas"),
    P("chapateja-prepintada-cal-26-esp-0-41-mm", "Chapateja Prepintada Cal. 26 / 0.41 mm", "DRAFT", "My Store", "", 14.92, None, "chapas"),
    P("chapa-prepintada-cal-24-bc18-bc30-bc35-esp-0-50-mm", "Chapa Prepintada Cal. 24 - BC18/BC30/BC35 / 0.50 mm", "DRAFT", "My Store", "", 19.42, None, "chapas"),
    P("chapa-prepintada-cal-26-bc18-bc30-bc35-esp-0-41-mm", "Chapa Prepintada Cal. 26 - BC18/BC30/BC35 / 0.41 mm", "DRAFT", "My Store", "", 14.92, None, "chapas"),

    # ---- FIJACIONES / FERRETERIA ----
    P("caja-remaches-pop-blancos-para-isopanel-1000-u", "Remache POP Blanco (Caja 1000 un.) - Isopanel", "ACTIVE", "My Store", "", 122.79, CDN+"RemachePOP5_32x1_2ZincBlanco.jpg?v=1753467339", "fijaciones"),
    P("remache-pop-5-32-x-1-2-zinc-blanco", "Remache POP 5/32 x 1/2 Zinc Blanco (x50)", "ACTIVE", "BMC URUGUAY", "", 5.00, CDN+"RemachePOP5_32x1_2ZincBlanco.jpg?v=1753467339", "fijaciones"),
    P("arandela-polipropileno-tortuga", 'ARANDELA DE POLIPROPILENO - "Tortuga" (x10)', "ACTIVE", "BMC URUGUAY", "", 26.20, CDN+"ArandelaPolipropilenoGris_5aa4f3d4-2310-41ae-9896-8c080a8d6c14.jpg?v=1753477945", "fijaciones"),
    P("arandela-carrocero-3-8-galvanizada", 'ARANDELA CARROCERO 3/8" - Galvanizada (x10)', "ACTIVE", "BMC URUGUAY", "", 32.70, CDN+"ArandelaCarroceroGalv.01.jpg?v=1753478029", "fijaciones"),
    P("arandela-plana-galv-3-8", 'Arandela Plana Galvanizada 3/8" (x10)', "ACTIVE", "BMC URUGUAY", "", 4.00, CDN+"ArandelaplanaGalv.3_801.jpg?v=1753466704", "fijaciones"),
    P("arandela-plana-galvanizada-5-16", "Arandela Plana Galvanizada 5/16 (x10)", "ACTIVE", "BMC URUGUAY", "", 2.90, CDN+"ArandelaplanaGalv.5_16.jpg?v=1753466766", "fijaciones"),
    P("tuerca-bsw-3-8-galvanizada", 'TUERCA HEXAGONAL BSW 3/8" (x10)', "ACTIVE", "BMC URUGUAY", "", 2.00, CDN+"Tuerca_Gal._BSW_3_8_01.jpg?v=1753462996", "fijaciones"),
    P("tuerca-hexagonal-bsw-5-16", 'TUERCA HEXAGONAL BSW 5/16" (x10)', "ACTIVE", "BMC URUGUAY", "", 2.00, CDN+"Tuerca_Gal._BSW_3_8_01.jpg?v=1753462996", "fijaciones"),
    P("varilla-roscada-bsw-3_8", 'VARILLA ROSCADA BSW 3/8" (x5, 1m)', "ACTIVE", "BMC URUGUAY", "", 19.90, CDN+"VarillaRoscadaBSW3_8.jpg?v=1753468133", "fijaciones"),
    P("varilla-roscada-bsw-5_16", 'VARILLA ROSCADA BSW 5/16" (x5, 1m)', "ACTIVE", "BMC URUGUAY", "", 16.20, CDN+"VarillaRoscadaBSW5_16_0680ce07-3220-405e-8e29-4d732c16f8d9.jpg?v=1753478261", "fijaciones"),
    P("taco-expansivo-3-8-para-hormigon", 'Taco Expansivo 3/8" - Hormigon - Drop In (x10)', "ACTIVE", "BMC URUGUAY", "", 8.70, CDN+"Taco_Expansivo_3_8_H_01.jpg?v=1753463085", "fijaciones"),
    P("taco-expansivo-5-16-para-hormigon-drop-in", 'Taco Expansivo 5/16" - Hormigon - Drop In (x10)', "ACTIVE", "BMC URUGUAY", "", 6.70, CDN+"TacoExpansivo5_16_H01.jpg?v=1753468000", "fijaciones"),
    P("kit-anclaje-a-h-tornillo-n-º-10-arandela-taco", "Kit Anclaje a Hormigon - Tornillo N.10 + arandela + taco (x10)", "ACTIVE", "BMC URUGUAY", "", 11.80, CDN+"KitAnclajeaH_-TornilloN._10_arandela_taco.jpg?v=1753467235", "fijaciones"),
    P("tornillo-t1-p-mecha-01", "Tornillo T1 P. Mecha (x50)", "ACTIVE", "BMC URUGUAY", "", 5.00, CDN+"T1P.Mecha01.jpg?v=1753467423", "fijaciones"),
    P("tornillos-punta-aguja-5-pulgadas", 'Tornillos Punta Aguja 5" (x10)', "ACTIVE", "BMC URUGUAY", "", 17.00, CDN+"TornillosPuntaAguja5pulgadas.jpg?v=1753468032", "fijaciones"),
    P("tornillos-punta-mecha-4-pulgadas", "Tornillos Punta Mecha 4\" 14x4 (x10)", "ACTIVE", "BMC URUGUAY", "", 14.40, CDN+"TornillosPuntaMecha4pulgadas.jpg?v=1753468065", "fijaciones"),

    # ---- QUIMICOS / SELLADORES ----
    P("bromplast-8-silicona-neutra", "Bromplast 8 - Silicona Neutra (refil 600g)", "ACTIVE", "My Store", "", 13.07, CDN+"BromplastSiliconaNeutra_Salchicha.jpg?v=1753466136", "quimicos"),
    P("silicona-neutra-pomo-premium", "Silicona Neutra (Pomo) PREMIUM - 280 ml", "ACTIVE", "BMC URUGUAY", "", 11.89, CDN+"SiliconaNeutra_Pomo_PREMIUM.jpg?v=1753467388", "quimicos"),
    P("espuma-poliuretano-expansiva", "Espuma Poliuretano Expansiva URUPEGA 750 ml", "ACTIVE", "BMC URUGUAY", "", 17.11, CDN+"EspumaPoliuretanoExpansiva.jpg?v=1753467197", "quimicos"),
    P("pistola-para-silicona-bromplast", "Aplicador para Silicona Bromplast", "ACTIVE", "BMC URUGUAY", "", 40.26, CDN+"PistolaparaSiliconaBromplast_80a6938c-a669-4553-aeb8-18ecf783771b.jpg?v=1753478217", "quimicos"),

    # ---- IMPERMEABILIZACION (membranas) ----
    P("membrana-auto-adhesiva", "Membrana Auto-adhesiva Denverfita 10m x 30cm", "ACTIVE", "BMC URUGUAY", "", 40.26, CDN+"MembranaAuto-adhesiva.jpg?v=1753467277", "impermeabilizacion"),

    # ---- LINEA HM-RUBBER ----
    P("hm-rubber-aerosol-caucho-liquido-7-en-1-goma-liquida", "HM-rubber Caucho Liquido 7en1 - Aerosol (240g/400ml)", "ACTIVE", "BMC URUGUAY", "Accesorio", 15.45, CDN+"HMR_EmbalagemSpray7em1-Mockup.png?v=1756231789", "impermeabilizacion_hm"),
    P("hm-rubber-caucho-liquido-7-en-1-lata-900-ml", "HM-rubber Caucho Liquido 7en1 - Lata (900 ml)", "ACTIVE", "BMC URUGUAY", "Accesorio", 29.92, CDN+"7EM1LATA900ML.png?v=1756312047", "impermeabilizacion_hm"),
    P("hm-rubber-caucho-liquido-7-en-1-lata-3-6-kg", "HM-rubber Caucho Liquido 7en1 - Lata (3,6 kg)", "ACTIVE", "BMC URUGUAY", "Accesorio", 123.17, CDN+"7EM1Galon3_6kg.png?v=1756312675", "impermeabilizacion_hm"),
    P("hm-rubber-sellador-flex-pro-lata-900-ml", "HM-rubber Caucho Liquido Base - Balde (18 kg) Industrial", "ACTIVE", "BMC URUGUAY", "Accesorio", 403.61, CDN+"balde-maior.png?v=1756399639", "impermeabilizacion_hm"),
    P("hm-rubber-impertech-3-en-1-balde-14-kg", "HM-rubber Impertech 3en1 - Balde (14 kg)", "ACTIVE", "BMC URUGUAY", "Accesorio", 205.05, CDN+"IMPERTECH3EM1-MOCKUP14L.png?v=1756322236", "impermeabilizacion_hm"),
    P("hm-rubber-malla-estructurante", "HM-rubber Malla Estructurante (10 cm x 50 m)", "ACTIVE", "BMC URUGUAY", "Accesorio", 59.18, CDN+"HMTelaEstruturante-LinhaCompleta.png?v=1756231790", "impermeabilizacion_hm"),
    P("hm-doble-funcion-balde-18-kg-linea-industrial", "HM-rubber Doble Funcion Premium - Balde (18 kg) Industrial", "ACTIVE", "BMC URUGUAY", "Accesorio", 438.73, CDN+"2-Balde-Industria-WEB.png?v=1756399639", "impermeabilizacion_hm"),
    P("hm-sellador-de-grafeno-balde-18-kg-linea-industrial", "HM-rubber Sellador de Grafeno - Balde (18 kg) Industrial", "ACTIVE", "BMC URUGUAY", "Accesorio", 417.00, CDN+"2-Balde-Industria-WEB.png?v=1756399639", "impermeabilizacion_hm"),
    P("hm-rubber-hm-solv-solvencte-para-caucho-liquido", "HM-rubber HM Solv (Solvente para caucho liquido)", "ACTIVE", "BMC URUGUAY", "Accesorio", 12.88, CDN+"MOCKUPSOLVENTE500ML-1.png?v=1756480060", "impermeabilizacion_hm"),

    # ---- PERFILES ESTRUCTURALES ----
    P("perfil-aluminizado-5852-anodizado-estructural-de-6-8-mts", "ANGULO ALUMINIO ANODIZADO 5852 - Estructural 6,8m (2x2\")", "ACTIVE", "BMC URUGUAY", "", 90.01, CDN+"Anguloestructural-PerfilAluminioTipoK6_8m.jpg?v=1755192296", "perfiles_estructural"),

    # ---- GALPONES ----
    P("galpon-de-jardin-modelo-cardelino", "Galpon de Jardin Modelo Cardelino (2,60x1,80x1,90 m)", "ACTIVE", "My Store", "", 670.00, CDN+"MedidasCardelinoIMG.png?v=1750791490", "galpones"),
    P("galpon-de-jardin-modelo-zorzal", "Galpon de Jardin Modelo Zorzal (3,65x2,69x2,05 m)", "ACTIVE", "My Store", "", 880.00, CDN+"MedidasZorzalIMG.png?v=1750791068", "galpones"),
]

# Detalle estructurado de paneles (relevante para la calculadora / modulo productos).
# ancho_util en m; espesores_mm en mm. price_source: de donde sale el precio canonico.
PANELS_DETAIL = {
    "hiansa-panel-trapezoidal-5g-becam": {"tipo": "techo", "nucleo": "PUR", "ancho_util_m": 1.00, "espesores_mm": [30], "vendor": "BECAM"},
    "isodec®-pir": {"tipo": "techo", "nucleo": "PIR", "ancho_util_m": 1.12, "espesores_mm": [50, 80, 120]},
    "isopanel-isodec-eps-cubiertas-bmc-reloaded": {"tipo": "techo", "nucleo": "EPS", "ancho_util_m": 1.12, "espesores_mm": [100, 150, 200, 250]},
    "isoroof-3g-gris-rojo-blanco-bromyros": {"tipo": "techo", "nucleo": "PIR/Foil", "ancho_util_m": 1.00, "espesores_mm": [30, 50, 80], "vendor": "Bromyros by KINGSPAN"},
    "iagro30": {"tipo": "techo", "nucleo": "PIR/Foil", "ancho_util_m": 1.00, "espesores_mm": [30, 50], "vendor": "KINGSPAN"},
    "iroof80-pls": {"tipo": "techo", "nucleo": "PIR", "ancho_util_m": 1.00, "espesores_mm": [80], "vendor": "KINGSPAN"},
    "isopanel-eps-paredes-y-fachadas": {"tipo": "pared", "nucleo": "EPS", "ancho_util_m": 1.14, "espesores_mm": [50, 100, 150, 200, 250]},
    "isowall-®-pir": {"tipo": "pared", "nucleo": "PIR", "ancho_util_m": 1.10, "espesores_mm": [50, 80]},
    "isofrig-®": {"tipo": "pared/camara_frig", "nucleo": "PIR", "ancho_util_m": 1.14, "espesores_mm": [40, 60, 80, 100, 120, 150, 180],
                   "price_note": "Shopify=DRAFT con precios legacy desactualizados; canonico de cotizacion = isofrig_canonical (Matriz/ledger WOLF-2026-0001)."},
    "pu20mm-gris-sin-cielorraso-pvc": {"tipo": "pared", "nucleo": "PU/PVC", "ancho_util_m": None, "espesores_mm": [20]},
}

# ISOFRIG: precio canonico de cotizacion (ex-IVA, lista web) - fuente Matriz/ledger WOLF-2026-0001.
# La fila 200 mm de Matriz es un CLON de la 150 (error de fuente) -> excluida.
ISOFRIG_CANONICAL = {
    "source": "Matriz tab BROMYROS + ledger BUG-TRIAGE-RAMIRO WOLF-2026-0001",
    "lista": "web", "moneda": "USD", "iva": "ex-IVA",
    "precios_web_por_espesor": {
        "40": 55.3384, "60": 62.8919, "80": 69.3770, "100": 76.9454,
        "120": 89.4740, "150": 93.3436, "180": 111.4058,
    },
    "excluido_200mm": {"valor_clonado": 111.0032, "motivo": "SKU/nombre clonados de IF150 en Matriz; cargar solo si Matias corrige la fuente."},
    "shopify_draft_precios": {"40": 53.11, "60": 57.83, "80": 63.80, "100": 70.77, "120": 84.59,
                               "nota": "= precios build legacy; 150 y 180 no capturados en snapshot; NO usar para cotizar."},
}


def build_json():
    by_cat = {}
    for p in PRODUCTS:
        by_cat.setdefault(p["category"], []).append(p)
    active = sum(1 for p in PRODUCTS if p["status"] == "ACTIVE")
    return {
        "meta": {
            "store": "BMC URUGUAY",
            "domain": SHOP,
            "snapshot_date": SNAPSHOT_DATE,
            "source": "Shopify Admin API (paginas 1+2, hasNextPage=false)",
            "currency": "USD",
            "total_in_shopify": TOTAL_IN_SHOPIFY,
            "total_documented": len(PRODUCTS),
            "active": active,
            "draft": len(PRODUCTS) - active,
            "price_field": "price_from_usd = minVariantPrice (precio 'desde'). Precios con IVA segun config de tienda; para cotizacion usar listas ex-IVA del motor.",
            "categories": dict(CATEGORIES),
        },
        "panels_detail": PANELS_DETAIL,
        "isofrig_canonical": ISOFRIG_CANONICAL,
        "products_by_category": by_cat,
        "products": PRODUCTS,
    }


def build_md(data):
    L = []
    m = data["meta"]
    L.append("# Catalogo de productos BMC URUGUAY")
    L.append("")
    L.append(f"> Base de conocimiento auto-generada por Claude desde el Shopify de "
             f"[{m['store']}](https://{m['domain']}) el **{m['snapshot_date']}**. "
             f"{m['total_documented']} productos ({m['active']} ACTIVE / {m['draft']} DRAFT). "
             f"Moneda: {m['currency']}.")
    L.append(">")
    L.append("> **No editar a mano.** Regenerar con `python3 docs/product-catalog/build_catalog.py`. "
             "Fuente estructurada: `catalog.json`.")
    L.append("")
    L.append("Precio = *desde* (variante mas barata). Link lleva a la ficha en la tienda "
             "(productos DRAFT no son publicos todavia).")
    L.append("")

    # Tabla resumen de paneles
    L.append("## Paneles (resumen tecnico)")
    L.append("")
    L.append("| Panel | Tipo | Nucleo | Ancho util | Espesores (mm) | Desde | Estado |")
    L.append("|-------|------|--------|-----------|----------------|-------|--------|")
    for p in data["products_by_category"].get("paneles", []):
        d = data["panels_detail"].get(p["handle"], {})
        au = d.get("ancho_util_m")
        au_s = f"{au:.2f} m" if au else "-"
        esp = ", ".join(str(x) for x in d.get("espesores_mm", [])) or "-"
        L.append(f"| [{p['title']}]({p['url']}) | {d.get('tipo','-')} | {d.get('nucleo','-')} "
                 f"| {au_s} | {esp} | {p['price_from_usd']:.2f} | {p['status']} |")
    L.append("")
    iso = data["isofrig_canonical"]
    L.append("### ISOFRIG - precio canonico de cotizacion (ex-IVA, lista web)")
    L.append("")
    L.append(f"Fuente: {iso['source']}. La fila 200 mm de Matriz es un clon de la de 150 mm -> excluida.")
    L.append("")
    L.append("| Espesor (mm) | Web ex-IVA (USD) |")
    L.append("|--------------|------------------|")
    for esp, val in iso["precios_web_por_espesor"].items():
        L.append(f"| {esp} | {val:.4f} |")
    L.append("")
    L.append(f"> Shopify tiene ISOFRIG en **DRAFT** con precios legacy desactualizados "
             f"(40mm={iso['shopify_draft_precios']['40']}); no usar esos para cotizar.")
    L.append("")

    # Resto por categoria
    for cat_key, cat_label in CATEGORIES:
        items = data["products_by_category"].get(cat_key, [])
        if not items:
            continue
        L.append(f"## {cat_label}")
        L.append("")
        L.append("| Producto | Desde (USD) | Estado | Foto | Link |")
        L.append("|----------|-------------|--------|------|------|")
        for p in items:
            img = f"![]({p['image']})" if p["image"] else "-"
            L.append(f"| {p['title']} | {p['price_from_usd']:.2f} | {p['status']} | {img} "
                     f"| [ficha]({p['url']}) |")
        L.append("")
    return "\n".join(L) + "\n"


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    data = build_json()
    with open(os.path.join(here, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    with open(os.path.join(here, "README.md"), "w", encoding="utf-8") as f:
        f.write(build_md(data))
    print(f"OK: {len(PRODUCTS)} productos -> catalog.json + README.md")


if __name__ == "__main__":
    main()
