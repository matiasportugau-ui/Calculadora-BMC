-- Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-19
-- Migration: 010 — Seed initial competitor universe (13 entries)
--
-- Sources:
--   • BMC Competitive Brief 2026-05-19 (6 deep entries, CSV-matrix backed)
--   • Field research universe 2026-05-15 (7 light entries for Tier 1-2 coverage)
--
-- Idempotent via INSERT ... ON CONFLICT (domain) DO UPDATE.
-- The ETL discovery (deduplication.upsertCompetitor) only updates
-- name/website_url/notes — the strategic metadata seeded here survives.

INSERT INTO bmc_market_intel.competitors (
  name, domain, website_url, notes, is_active,
  tier, type, tagline, positioning, target_audience,
  threat_score, opportunity_score,
  has_ecommerce, has_pir, has_bim, has_calculator,
  certifications, ig_handle, whatsapp_number, metadata
) VALUES

  -- ─── CSV Tier 1 · Liderazgo técnico-industrial ───────────────────
  (
    'Kingspan Bromyros',
    'kingspan.com.uy',
    'https://kingspan.com.uy/',
    'Multinacional irlandesa (Kingspan Group) vía Kingspan Isoeste Brasil. Adquirió Bromyros 2021. Planta Canelones USD 13M (2018). 650-700k m²/año, capacidad x3. Dominio paralelo bromyros.com.uy. Portfolio full: EPS/PIR/PUR/Lana de Roca/Benchmark.',
    TRUE,
    1, 'fabricante',
    'Creemos juntos edificios más sostenibles para un mundo mejor',
    'Líder técnico-industrial sostenible / referencia profesional',
    'Arquitectos, ingenieros, industria, frigoríficos, gran obra',
    5, 4,
    FALSE, TRUE, TRUE, FALSE,
    ARRAY['UNIT','CIU','AENOR','IQNET','CCU'],
    'kingspanuruguay',
    '59892818981',
    jsonb_build_object(
      'garantia', 'Por proyecto / planta certificada',
      'tono', 'Corporativo / técnico / institucional',
      'foco_servicios', ARRAY['frigorificos','revestimientos','techos','arquitectonica_premium'],
      'lineas_producto', ARRAY['Isopanel EPS','Isodec','Isofrig','Isoroof','Isowall','Isoagro','Isoluz','Tejas Residence','Panel Shingle PIR','Benchmark'],
      'blog_topics', ARRAY['eficiencia_energetica','sostenibilidad','innovacion','calidad','renovacion'],
      'aliased_domains', ARRAY['bromyros.com.uy'],
      'central_ventas', '0800 1948',
      'ano_fundacion', 1948
    )
  ),

  -- ─── CSV Tier 1 · Constructor turnkey residencial ────────────────
  (
    'Isopanel Pro Uruguay',
    'isopanelpro.com.uy',
    'https://www.isopanelpro.com.uy/',
    'Constructor/instalador (~2020). Especializado en casas llave en mano isopanel: Monoambiente 26m², 1 dorm 40m², 2 dorm 54m². SEO contratado a Wilko Marketing. Doble dominio (isopaneles.uy).',
    TRUE,
    1, 'instalador',
    'La mejor colocación al mejor precio',
    'Constructor económico orientado a familias',
    'Familias buscando vivienda llave en mano económica',
    3, 5,
    FALSE, FALSE, FALSE, FALSE,
    ARRAY[]::TEXT[],
    'isopanelprouruguay',
    NULL,
    jsonb_build_object(
      'garantia', 'No destacada',
      'tono', 'Comercial cercano / emocional',
      'foco_servicios', ARRAY['casas_turnkey','camaras_frio','chapas','aislamiento_termico'],
      'paquetes_turnkey', ARRAY['monoambiente_26m2','1_dorm_40m2','2_dorm_54m2'],
      'blog_topics', ARRAY['aislamiento_termico','construccion_rapida','casas_prefabricadas','eficiencia_energetica'],
      'aliased_domains', ARRAY['isopaneles.uy'],
      'seo_agency', 'Wilko Marketing'
    )
  ),

  -- ─── CSV Tier 2 · Constructor familiar ───────────────────────────
  (
    'Isopanel Uruguay',
    'isopaneluruguay.com',
    'https://www.isopaneluruguay.com/',
    'Empresa familiar 3 generaciones. Kits DIY "Arma tu casa" + obra a medida. Pando, Canelones.',
    TRUE,
    2, 'mixto',
    'Proveedores de Isopanel y empresa constructora',
    'Constructor familiar de confianza para autoconstructores',
    'Familias / autoconstructores que arman su casa',
    2, 4,
    FALSE, FALSE, FALSE, FALSE,
    ARRAY[]::TEXT[],
    'isopaneluruguay',
    '59897433673',
    jsonb_build_object(
      'garantia', 'No publicada',
      'tono', 'Familiar / artesanal / educativo',
      'foco_servicios', ARRAY['kits_diy','obra_medida','asesoramiento_tecnico']
    )
  ),

  -- ─── CSV Tier 2 · Instalador pyme con garantía ───────────────────
  (
    'M&F Isopaneles',
    'myfisopaneles.com.uy',
    'https://www.myfisopaneles.com.uy/',
    'Constructor/instalador 15 años. Techos chapa+isopanel, cámaras frigoríficas, módulos, contenedores. Garantía real 1 año (única en el tier). Fichas técnicas descargables.',
    TRUE,
    2, 'instalador',
    'Construcciones livianas en chapa e isopaneles',
    'Instalador pyme con garantía real',
    'Pyme, ampliaciones, comercios, frigoríficos chicos',
    3, 4,
    FALSE, FALSE, FALSE, FALSE,
    ARRAY[]::TEXT[],
    NULL,
    '59894633170',
    jsonb_build_object(
      'garantia', '1 año (real, destacada)',
      'tono', 'Cercano / práctico / artesanal',
      'foco_servicios', ARRAY['techos','galpones','modulos','contenedores','camaras_frio'],
      'telefonos_adicionales', ARRAY['099105934']
    )
  ),

  -- ─── CSV Tier 3 · E-commerce competidor (Steel Frame focus) ──────
  (
    'Costa Steel',
    'costasteel.com.uy',
    'https://costasteel.com.uy/',
    'Barraca/materialista Steel Frame Ciudad de la Costa. E-commerce WooCommerce dual USD/UYU. Catálogo amplio (drywall, herrajes, ferretería, pintura, herramientas). Isopanel como una sub-categoría.',
    TRUE,
    3, 'distribuidor',
    'Tu proyecto comienza en CostaSteel',
    'Barraca técnica steel frame + complementos',
    'Steel framers, drywalleros, constructores',
    4, 3,
    TRUE, FALSE, FALSE, FALSE,
    ARRAY[]::TEXT[],
    'costasteel_insumos',
    NULL,
    jsonb_build_object(
      'garantia', 'Por producto',
      'tono', 'Comercial / práctico',
      'foco_servicios', ARRAY['steel_frame','drywall','ferreteria','pintura','herramientas'],
      'envio_horas', 24,
      'tiktok', 'costasteelbarraca'
    )
  ),

  -- ─── CSV Tier 5 · Marketplace (presión precio) ───────────────────
  (
    'MercadoLibre marketplace',
    'mercadolibre.com.uy',
    'https://listado.mercadolibre.com.uy/isopanel',
    'Marketplace agregado. Decenas de vendedores activos. Construex/Home Factory entre los más visibles. Bromyros tiene tienda oficial. Precio mínimo observado: USD 38.90/m².',
    TRUE,
    5, 'marketplace',
    NULL,
    'Marketplace abierto (precio)',
    'DIY / particulares precio-sensibles',
    5, 3,
    TRUE, FALSE, FALSE, FALSE,
    ARRAY[]::TEXT[],
    NULL,
    NULL,
    jsonb_build_object(
      'garantia', 'Por vendedor',
      'tono', 'Mixto',
      'precio_minimo_usd_m2', 38.90,
      'top_vendedores_observados', ARRAY['Construex/Home Factory','EL INSUPERABLE','CELER UY']
    )
  ),

  -- ─── Tier 1 complementario · BECAM SA (proveedor de BMC en Hiansa) ──
  (
    'BECAM SA',
    'becam.com.uy',
    'https://www.becam.com.uy',
    'Empresa familiar 75 años. FABRICA chapas/perfiles propios. IMPORTA y distribuye Hiansa-Panel 5G español. PROVEEDOR DE BMC en línea Hiansa — relación simbiótica con riesgo de desintermediación.',
    TRUE,
    1, 'mixto',
    NULL,
    'Fabricante chapas + distribuidor Hiansa',
    'Industria + construcción + arquitectura',
    4, 3,
    FALSE, TRUE, FALSE, FALSE,
    ARRAY[]::TEXT[],
    'becamsa',
    NULL,
    jsonb_build_object(
      'ano_fundacion', 1950,
      'foco_servicios', ARRAY['chapas','perfiles','Hiansa_panel_5G'],
      'relacion_bmc', 'Proveedor — riesgo desintermediación si lanzan tienda directa',
      'showroom', 'Av. Italia 3930',
      'planta', 'Besnes Irigoyen 4816 (Peñarol)'
    )
  ),

  -- ─── Tier 1 complementario · TDA Uruguay (premium PIR/Lana) ──────
  (
    'TDA Uruguay',
    'tdauruguay.com',
    'https://www.tdauruguay.com',
    'Representación exclusiva HILTI. Distribuye paneles ACH (Saint-Gobain España) lana de roca/PIR/PUR. Premium con garantía 10 años. Target industrial/grandes obras.',
    TRUE,
    1, 'importador',
    NULL,
    'Distribuidor premium ACH + HILTI',
    'Industrial / grandes obras',
    3, 2,
    FALSE, TRUE, FALSE, FALSE,
    ARRAY[]::TEXT[],
    NULL,
    NULL,
    jsonb_build_object(
      'ano_fundacion', 2015,
      'garantia', '10 años',
      'marcas_distribuidas', ARRAY['ACH (Saint-Gobain)','HILTI'],
      'nucleos', ARRAY['lana_roca','PIR','PUR']
    )
  ),

  -- ─── Tier 1 complementario · Casa del Panel ──────────────────────
  (
    'Casa del Panel',
    'casadelpanel.com',
    'https://casadelpanel.com',
    'Vinculada a Barraca Leal. Multimarca: ISOROOF Foil revende Kingspan + chapas + perfiles. Réplica digital más cercana a BMC en posicionamiento.',
    TRUE,
    1, 'mixto',
    NULL,
    'Multimarca con réplica digital de BMC',
    'Constructores pyme + autoconstructores',
    4, 3,
    TRUE, FALSE, FALSE, FALSE,
    ARRAY[]::TEXT[],
    'casadelpaneluy',
    '59893489943',
    jsonb_build_object(
      'foco_servicios', ARRAY['isopanel_revente','chapas','perfiles'],
      'vinculacion', 'Barraca Leal',
      'marcas_reventa', ARRAY['Kingspan ISOROOF Foil']
    )
  ),

  -- ─── Tier 1 complementario · Panel Sandwich Group (ES) ───────────
  (
    'Panel Sandwich Group',
    'panelsandwich.uy',
    'https://panelsandwich.uy',
    'Multinacional española >5M m²/año. SEO agresivo desde España gana top SERP UY. Sin oficina/showroom local. Entrega contenedorizada HC 40''. Precios FOB EUR 14-64/m².',
    TRUE,
    1, 'importador',
    NULL,
    'Exportador español con SEO dominante UY',
    'Proyectos grandes / contenedor completo',
    3, 3,
    FALSE, TRUE, FALSE, FALSE,
    ARRAY[]::TEXT[],
    NULL,
    NULL,
    jsonb_build_object(
      'origen', 'Zaragoza, España',
      'capacidad_anual_m2', 5000000,
      'precio_fob_eur_min', 14,
      'precio_fob_eur_max', 64,
      'modalidad', 'Contenedor HC 40 pies'
    )
  ),

  -- ─── Tier 2 · Construmec (sister de M&F) ─────────────────────────
  (
    'Construmec Isopaneles',
    'construmec-isopaneles.com.uy',
    'https://www.construmec-isopaneles.com.uy',
    'Especialista cámaras frigoríficas residenciales. Template web casi idéntico a MyF (posible mismo dueño). Garantía 1 año.',
    TRUE,
    2, 'instalador',
    NULL,
    'Instalador cámaras frigoríficas residenciales',
    'Pyme residencial',
    2, 3,
    FALSE, FALSE, FALSE, FALSE,
    ARRAY[]::TEXT[],
    NULL,
    NULL,
    jsonb_build_object(
      'garantia', '1 año',
      'foco_servicios', ARRAY['camaras_frigorificas_residenciales'],
      'relacion_observada', 'Template similar a M&F — posible mismo grupo'
    )
  ),

  -- ─── Tier 2 · ARMCO (canal barracas) ─────────────────────────────
  (
    'ARMCO',
    'armco.com.uy',
    'https://www.armco.com.uy',
    'Metalúrgica 80 años. Venta exclusiva por red barracas (Carmela, Central, Sodimac). Confort Panel chapa+PU 3-6cm, Econopanel, Tejapanel, Steel Framing. Gama económica.',
    TRUE,
    2, 'fabricante',
    NULL,
    'Fabricante chapas vía red de barracas',
    'Consumidor económico vía retail',
    3, 3,
    FALSE, FALSE, FALSE, FALSE,
    ARRAY[]::TEXT[],
    NULL,
    NULL,
    jsonb_build_object(
      'ano_fundacion', 1946,
      'productos', ARRAY['Confort Panel','Econopanel','Tejapanel','Steel Framing'],
      'canales_retail', ARRAY['Barraca Carmela','Barraca Central','Sodimac']
    )
  ),

  -- ─── Tier 2 · Galpones Duque (B2B fuerte) ────────────────────────
  (
    'Galpones Duque',
    'galponesduque.com.uy',
    'https://www.galponesduque.com.uy',
    '20+ años montaje. Garantía 5 años. Clientes B2B: LATU, Plan Ceibal, Naka, Autolan Hyundai, Sadenir, Divino, Viscofan, Nuvo, Calcar. Galpones + cámaras + mantenimiento.',
    TRUE,
    2, 'instalador',
    NULL,
    'Instalador B2B con cartera corporativa',
    'B2B / corporativo / institucional',
    3, 2,
    FALSE, FALSE, FALSE, FALSE,
    ARRAY[]::TEXT[],
    NULL,
    '59898256198',
    jsonb_build_object(
      'garantia', '5 años',
      'foco_servicios', ARRAY['galpones','camaras_frio','mantenimiento'],
      'clientes_b2b', ARRAY['LATU','Plan Ceibal','Naka SA','Autolan Hyundai','Sadenir','Divino','Viscofan','Nuvo Cosméticos','Calcar']
    )
  )

ON CONFLICT (domain) DO UPDATE SET
  -- Only refresh strategic metadata; preserve ETL-discovered name/website_url/notes
  -- if they've drifted (they shouldn't, since these are human-curated)
  tier              = EXCLUDED.tier,
  type              = EXCLUDED.type,
  tagline           = EXCLUDED.tagline,
  positioning       = EXCLUDED.positioning,
  target_audience   = EXCLUDED.target_audience,
  threat_score      = EXCLUDED.threat_score,
  opportunity_score = EXCLUDED.opportunity_score,
  has_ecommerce     = EXCLUDED.has_ecommerce,
  has_pir           = EXCLUDED.has_pir,
  has_bim           = EXCLUDED.has_bim,
  has_calculator    = EXCLUDED.has_calculator,
  certifications    = EXCLUDED.certifications,
  ig_handle         = COALESCE(EXCLUDED.ig_handle, bmc_market_intel.competitors.ig_handle),
  whatsapp_number   = COALESCE(EXCLUDED.whatsapp_number, bmc_market_intel.competitors.whatsapp_number),
  metadata          = EXCLUDED.metadata,
  updated_at        = NOW();
