#!/usr/bin/env node
/**
 * scripts/marketing-etl/seed-competitors.mjs
 *
 * Seeds the 31 competitors of BMC Uruguay's sandwich panel market into
 * `bmc_market_intel.competitors`. Idempotent — re-running won't duplicate.
 *
 * Usage:
 *   node scripts/marketing-etl/seed-competitors.mjs
 *
 * Env vars required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Source: docs/team/projects/MARKETING-INTEL-V1-HANDOFF.md (locked decisions)
 *
 * Tier distribution (LOCKED):
 *   Tier 1 (7)  — Critical, daily refresh
 *   Tier 2 (9)  — Secondary, daily
 *   Tier 3 (6)  — Indirect/complementary, weekly
 *   Tier 4 (6)  — Watchlist, weekly-monthly
 *   Tier 5 (3+) — MLU resellers, daily bulk
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'bmc_market_intel' },
  auth: { persistSession: false }
});

// ═══════════════════════════════════════════════════════════════════════
// THE 31 COMPETITORS — DO NOT MODIFY WITHOUT MATIAS APPROVAL
// ═══════════════════════════════════════════════════════════════════════

const COMPETITORS = [
  // ─── TIER 1 · CRITICAL (7) ─────────────────────────────────────────
  {
    name: 'Kingspan Bromyros',
    tier: 1,
    type: 'fabricante',
    website: 'https://www.bromyros.com.uy',
    ig_handle: 'kingspanuruguay',
    location: 'Montevideo (Pedro Cosio 2430) + Canelones (Camino San Juan c/Ruta 101)',
    founded_year: 1948,
    notes: 'Fabricante dominante. Kingspan plc adquirió 51% en enero 2021. Dueño de marcas ISOPANEL/ISODEC/ISOROOF/ISOWALL/ISOFRIG que BMC revende. RIESGO: desintermediación si abre e-commerce directo.'
  },
  {
    name: 'Kingspan MontFrío',
    tier: 1,
    type: 'fabricante',
    website: 'https://www.montfrio.com.uy',
    ig_handle: 'montfrio_ltda',
    location: 'Montevideo (Barros Arana 5431, Jardines del Hipódromo)',
    founded_year: 1990,
    notes: 'Fabricante #2. Kingspan plc adquirió 51% en junio 2023. Sistema SPM con DAT desde marzo 2015 (Ley 18.795 vivienda interés social). Capacidad +500.000 m²/año. IG 29.000 seguidores — líder del sector.'
  },
  {
    name: 'BECAM SA',
    tier: 1,
    type: 'mixto',
    website: 'https://www.becam.com.uy',
    ig_handle: 'becamsa',
    location: 'Showroom Av. Italia 3930 + planta Besnes Irigoyen 4816 (Peñarol)',
    founded_year: 1950,
    notes: 'Empresa familiar uruguaya 75 años (2025). FABRICA chapas/perfiles propios. IMPORTA y distribuye Hiansa-Panel 5G español. PROVEEDOR DE BMC en línea Hiansa — relación simbiótica con riesgo de desintermediación.'
  },
  {
    name: 'TDA Uruguay',
    tier: 1,
    type: 'importador',
    website: 'https://www.tdauruguay.com',
    location: 'Montevideo',
    founded_year: 2015,
    notes: 'Representación exclusiva HILTI. Distribuye paneles ACH (Saint-Gobain, España) lana de roca/PIR/PUR. Premium con garantía 10 años. Target industrial/grandes obras.'
  },
  {
    name: 'Eco Panels Uruguay',
    tier: 1,
    type: 'importador',
    website: 'https://ecopanels.uy',
    ig_handle: 'ecopanelsmarindia',
    location: 'Uruguay',
    notes: 'Importador/distribuidor activo de isopaneles + chapas galvanizadas. Tel 094 029 100. IG 549 followers, 88 posts.'
  },
  {
    name: 'Panel Sandwich Group',
    tier: 1,
    type: 'importador',
    website: 'https://panelsandwich.uy',
    location: 'Zaragoza, España (exportación a UY)',
    notes: 'Multinacional española >5M m²/año. SEO agresivo desde España, gana top SERP en queries UY. Sin oficina/showroom local. Entrega contenedorizada HC 40\'. Precios FOB €14-€64/m².'
  },
  {
    name: 'Casa del Panel',
    tier: 1,
    type: 'mixto',
    website: 'https://casadelpanel.com',
    ig_handle: 'casadelpaneluy',
    location: 'Montevideo',
    notes: 'Vinculada a Barraca Leal. Tel +598 93 489 943. Multimarca (ISOROOF Foil revende Kingspan, chapas, perfiles). IG 2.514 seguidores. RÉPLICA DIGITAL MÁS CERCANA A BMC.'
  },

  // ─── TIER 2 · SECONDARY (9) ────────────────────────────────────────
  {
    name: 'ARMCO',
    tier: 2,
    type: 'fabricante',
    website: 'https://www.armco.com.uy',
    location: 'Av. de las Instrucciones 2703, Montevideo',
    founded_year: 1946,
    notes: 'Empresa metalúrgica 80 años. Venta exclusiva por red de barracas (Carmela, Central, Sodimac). Confort Panel (chapa+poliuretano 3-6cm), Econopanel, Tejapanel, Steel Framing. Gama económica.'
  },
  {
    name: 'Isopanel Pro Uruguay',
    tier: 2,
    type: 'instalador',
    website: 'https://www.isopaneles.uy',
    ig_handle: 'isopanelprouruguay',
    location: 'Montevideo y alrededores',
    notes: 'Doble dominio (isopaneles.uy + isopanelpro.com.uy). Vivienda llave en mano integral (platea + paneles + aberturas + eléctrica + sanitaria). IG 693 seguidores.'
  },
  {
    name: 'Isopanel Uruguay',
    tier: 2,
    type: 'distribuidor',
    website: 'https://www.isopaneluruguay.com',
    ig_handle: 'isopaneluruguay',
    location: 'Pando, Canelones',
    notes: 'Familia constructora 3 generaciones. Tel +598 97 433 673. Casas isopanel + kits constructivos + asesoría técnica. IG 971 seguidores.'
  },
  {
    name: 'MyF Isopaneles',
    tier: 2,
    type: 'instalador',
    website: 'https://www.myfisopaneles.com.uy',
    location: 'Montevideo (cobertura nacional)',
    notes: 'M&F Isopaneles, 15 años. Tel 094 633 170 / 099 105 934. Reventa Isopanel + instalación llave en mano + cámaras frigoríficas. Garantía 1 año mano de obra. Web template antiguo.'
  },
  {
    name: 'Construmec Isopaneles',
    tier: 2,
    type: 'instalador',
    website: 'https://www.construmec-isopaneles.com.uy',
    location: 'Montevideo (cobertura nacional)',
    notes: 'Especialista cámaras frigoríficas residenciales con puerta. Template web casi idéntico a MyF (posible mismo dueño). Garantía 1 año.'
  },
  {
    name: 'Galpones Duque',
    tier: 2,
    type: 'instalador',
    website: 'https://www.galponesduque.com.uy',
    location: 'Uruguay (cobertura nacional)',
    notes: '>20 años en montaje. Tel 098 256 198. Garantía 5 años. Clientes B2B: LATU, Plan Ceibal, Naka S.A., Autolan Hyundai, Sadenir, Divino, Viscofan, Nuvo Cosméticos, Calcar. Galpones + cámaras frío + mantenimiento.'
  },
  {
    name: 'Isopanel Flores',
    tier: 2,
    type: 'instalador',
    website: 'https://isopanelflores.uy',
    location: 'José Pedro Varela 1016, Trinidad (Flores)',
    notes: 'Tel 098 796 379. Único actor relevante interior centro-oeste UY. Mix diversificado: isopanel vivienda/galpones + estructuras metálicas + piscinas. BMC desde Maldonado pierde esta zona.'
  },
  {
    name: 'Eco Panels Ruta 8',
    tier: 2,
    type: 'distribuidor',
    website: null,
    ig_handle: 'ecopanelsruta8',
    location: 'Empalme Olmos, Canelones',
    notes: 'Tel 094 923 329. Suministro de isopaneles + fabricación propia de chapas a medida. IG 635 followers, 53 posts. Marca/negocio separado de Eco Panels Uruguay aunque comparten nombre raíz.'
  },
  {
    name: 'FOKO Construcciones',
    tier: 2,
    type: 'instalador',
    website: 'https://foko.com.uy',
    location: 'Uruguay',
    notes: 'Partner Bromyros. Instala + vende paneles livianos. Construcción liviana en isopanel.'
  },

  // ─── TIER 3 · INDIRECT/COMPLEMENTARY (6) ───────────────────────────
  {
    name: 'Group Soluciones',
    tier: 3,
    type: 'importador',
    website: 'https://groupsoluciones.uy',
    ig_handle: 'groupsolucionesuy',
    location: 'Cabari 4157 esq. Gral Flores (Piedras Blancas), Montevideo',
    founded_year: 2005,
    notes: '⚠️ RECLASIFICADO COMO INDIRECTO: core es obra seca (yeso, OSB, pisos flotantes, PVC, perfiles steel framing), NO panel sándwich metálico. Menciona paneles SIP. E-commerce activo. Marca propia Harsen®.'
  },
  {
    name: 'Reyes Refrigeración',
    tier: 3,
    type: 'mixto',
    website: 'https://reyesrefrigeracion.com.uy',
    ig_handle: 'reyesrefrigeracion',
    location: 'Ruta 7 km 28.300, Sauce, Canelones',
    founded_year: 1998,
    notes: 'Parte de Refricenter Group (filiales Perú/Colombia/Chile). Frío industrial pesado: cámaras industriales, túneles abatimiento/congelado, atmósfera controlada (Isolcell), CO₂ transcrítico. NO compite frontal con BMC — complemento estratégico potencial.'
  },
  {
    name: 'Baudin Equipamientos',
    tier: 3,
    type: 'mixto',
    website: 'https://baudinequipamientos.com',
    ig_handle: 'baudinoficial',
    location: 'Canelones (showroom)',
    founded_year: 2017,
    notes: 'Showroom desde marzo 2017. Core gastronomía profesional (+1.300 equipos). Línea cámaras frigoríficas integradas (100mm PUR). 12 cuotas sin recargo + envío gratis MVD + Ciudad de la Costa desde USD 200. IG 4.019 seguidores.'
  },
  {
    name: 'Vitrilan SA',
    tier: 3,
    type: 'distribuidor',
    website: 'https://vitrilan.com',
    location: 'Av. Gral. Flores 4440, Montevideo',
    founded_year: 1960,
    notes: 'Empresa nacional desde 1960. Foco lana de vidrio Isover + lana de roca TherMax. Indexa paneles aislantes en catálogo pero no es core.'
  },
  {
    name: 'Marbex SA',
    tier: 3,
    type: 'distribuidor',
    website: 'https://marbex.com.uy',
    location: 'Uruguay',
    notes: 'Aislantes térmicos y acústicos. Foco industrial: paneles rígidos/semirrígidos con resinas, aislaciones tuberías. Paneles en sentido amplio.'
  },
  {
    name: 'Barraca Carmela',
    tier: 3,
    type: 'distribuidor',
    website: 'https://carmela.com.uy',
    location: 'Uruguay',
    notes: 'Revende ARMCO (Econopanel, Confort Panel). Precios públicos visibles: chapa cal 24 3,66m $2.667 UYU; Confort Panel terracota 7,95m USD 430,50. Canal indirecto de ARMCO.'
  },

  // ─── TIER 4 · WATCHLIST (6) ────────────────────────────────────────
  {
    name: 'PreHouse Uruguay',
    tier: 4,
    type: 'distribuidor',
    website: 'https://construex.uy/exhibidores/pre_house',
    location: 'Uruguay',
    notes: 'Distribuidor materiales / kits constructivos. Isopanel, steel deck, perfilería, tornillería, accesorios. Presencia en Construex. Asesoramiento personalizado en kits.'
  },
  {
    name: 'Isocenter Uruguay',
    tier: 4,
    type: 'instalador',
    website: 'https://construex.uy/exhibidores/isocenter',
    location: 'Montevideo',
    notes: 'Cubiertas PPS (paneles prefabricados tipo sándwich). Presencia exclusiva por directorio Construex. Verificar actividad actual.'
  },
  {
    name: 'AG Isopaneles',
    tier: 4,
    type: 'instalador',
    website: 'https://agisopaneles.com.uy',
    location: 'Montevideo',
    notes: 'Paneles estructurales aislación térmica. Foco construcción liviana. Cotización.'
  },
  {
    name: 'Greenhouse Uruguay',
    tier: 4,
    type: 'instalador',
    website: 'https://greenhouseuruguay.com',
    location: 'Uruguay',
    notes: 'Constructora multi-sistema. Cubre isopanel EPS/PUR/PIR/SIP, steel framing, tradicional. Cotización por proyecto.'
  },
  {
    name: 'Pani Construcciones',
    tier: 4,
    type: 'instalador',
    website: 'https://paniconstrucciones.com',
    location: 'Uruguay',
    notes: 'Constructora multi-sistema con línea isopanel: viviendas, ampliaciones, dúplex, galpones. Cotización por proyecto.'
  },
  {
    name: 'Todo Casas UY / Todo Isopanel UY / Isopaneles Marcos',
    tier: 4,
    type: 'instalador',
    website: 'https://todocasas.com.uy',
    ig_handle: 'todoisopanel_uy',
    location: 'City Golf, Atlántida Norte (Ruta 11) + Progreso (Canelones)',
    notes: 'AGRUPADOS por similitud: Todo Casas UY (techos autoportantes, módulos, isopanel), Todo Isopanel UY (IG 1.806 followers, +8 años, casas prefab costa), Isopaneles Marcos/Techos Livianos (IG 3.623 followers, tel +598 93 692 139). Activos en IG con frecuencia variable.'
  },

  // ─── TIER 5 · MLU RESELLERS (3+) ───────────────────────────────────
  {
    name: 'EL INSUPERABLE',
    tier: 5,
    type: 'reseller',
    website: null,
    location: 'MercadoLibre Uruguay',
    notes: 'Top vendedor MLU sin marca propia clara. Alto volumen isopanel/isodec. Refresh diario bulk vía ML API. seller_id pendiente de captura en primer ETL run.'
  },
  {
    name: 'Otros vendedores MLU sin marca',
    tier: 5,
    type: 'reseller',
    website: null,
    location: 'MercadoLibre Uruguay',
    notes: 'Categoría agregada. >10 vendedores MLU activos sin marca registrada. Geografía típica de ofertas: MVD 88-90, Canelones 7-41, Maldonado 2-11, San José 1-5. Bulk capture vía ML API agrupado por seller_id.'
  },
  {
    name: 'CELER UY',
    tier: 5,
    type: 'reseller',
    website: 'https://articulo.mercadolibre.com.uy/MLU-616612716',
    location: 'Montevideo, Canelones, Maldonado',
    notes: 'Vendedor MLU activo. Panel sándwich poliuretano 30/50mm para techo. Precios visibles: USD 40/m (sin cielorraso 30mm), USD 44 (cielorraso 30mm), USD 48 (cielorraso 50mm). Confirmar actividad Q2.'
  }
];

// ═══════════════════════════════════════════════════════════════════════
// EXECUTION
// ═══════════════════════════════════════════════════════════════════════

async function logEtlRun(status, records, errors = null) {
  return supabase.from('etl_runs').insert({
    source: 'manual',
    trigger: 'manual',
    status,
    records,
    errors,
    ended_at: status === 'running' ? null : new Date().toISOString()
  });
}

async function seed() {
  console.log('🌱 BMC Market Intel — Seeding 31 competitors\n');

  // Validate tier distribution
  const tiers = COMPETITORS.reduce((acc, c) => {
    acc[c.tier] = (acc[c.tier] || 0) + 1;
    return acc;
  }, {});
  console.log(`📊 Tier distribution: T1=${tiers[1]} T2=${tiers[2]} T3=${tiers[3]} T4=${tiers[4]} T5=${tiers[5]} · Total=${COMPETITORS.length}`);

  const expected = { 1: 7, 2: 9, 3: 6, 4: 6, 5: 3 };
  for (const [tier, count] of Object.entries(expected)) {
    if (tiers[tier] !== count) {
      console.error(`❌ Tier ${tier} expected ${count}, got ${tiers[tier]}`);
      process.exit(1);
    }
  }
  console.log('✅ Tier distribution matches handoff document\n');

  // Start ETL run record
  const { data: runRow, error: runErr } = await supabase
    .from('etl_runs')
    .insert({ source: 'manual', trigger: 'manual', status: 'running' })
    .select()
    .single();

  if (runErr) {
    console.error('❌ Failed to create etl_run:', runErr);
    process.exit(1);
  }

  const runId = runRow.id;
  console.log(`📝 ETL run #${runId} started\n`);

  let inserted = 0;
  let updated = 0;
  let errors = [];

  for (const comp of COMPETITORS) {
    // Idempotent upsert by name (unique constraint)
    const { data, error } = await supabase
      .from('competitors')
      .upsert(comp, { onConflict: 'name', ignoreDuplicates: false })
      .select();

    if (error) {
      console.error(`  ✗ ${comp.name}: ${error.message}`);
      errors.push({ name: comp.name, error: error.message });
      continue;
    }

    // upsert doesn't tell us insert vs update, so check if it existed
    const tierLabel = `T${comp.tier}`;
    console.log(`  ✓ [${tierLabel}] ${comp.name}`);
    inserted++; // we count all successful as "applied"
  }

  // Finalize ETL run
  await supabase
    .from('etl_runs')
    .update({
      status: errors.length > 0 ? 'completed' : 'completed',
      records: inserted,
      errors: errors.length > 0 ? errors : null,
      ended_at: new Date().toISOString()
    })
    .eq('id', runId);

  console.log(`\n✅ Seed completed`);
  console.log(`   Applied: ${inserted}/${COMPETITORS.length}`);
  if (errors.length > 0) {
    console.log(`   Errors: ${errors.length}`);
  }

  // Verify final count
  const { count } = await supabase
    .from('competitors')
    .select('*', { count: 'exact', head: true });
  console.log(`\n📊 Total competitors in DB: ${count}\n`);

  if (count !== COMPETITORS.length) {
    console.warn(`⚠️  Expected ${COMPETITORS.length}, found ${count} in DB`);
  }
}

seed().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
