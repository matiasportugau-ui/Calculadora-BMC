#!/usr/bin/env node
/**
 * scripts/seed-full-competitors.mjs
 *
 * Seeds all 31 known competitors into bmc_market_intel.competitors.
 * Idempotent — re-running won't duplicate (upsert by name).
 *
 * Usage:
 *   node scripts/seed-full-competitors.mjs
 *
 * Env vars required:
 *   DATABASE_URL
 *
 * Source: docs/team/projects/MARKETING-INTEL-V1-HANDOFF.md (locked decisions)
 */

import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Missing DATABASE_URL env var');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

const COMPETITORS = [
  // Tier 1 · Critical (7)
  {
    name: 'Kingspan Bromyros', tier: 1, type: 'fabricante',
    website: 'https://www.bromyros.com.uy', ig_handle: 'kingspanuruguay',
    location: 'Montevideo (Pedro Cosio 2430) + Canelones (Camino San Juan c/Ruta 101)',
    founded_year: 1948,
    notes: 'Fabricante dominante. Kingspan plc adquirió 51% en enero 2021. Dueño de marcas ISOPANEL/ISODEC/ISOROOF/ISOWALL/ISOFRIG que BMC revende. RIESGO: desintermediación si abre e-commerce directo.',
    threat_score: 5, opportunity_score: 2,
  },
  {
    name: 'Kingspan MontFrío', tier: 1, type: 'fabricante',
    website: 'https://www.montfrio.com.uy', ig_handle: 'montfrio_ltda',
    location: 'Montevideo (Barros Arana 5431, Jardines del Hipódromo)',
    founded_year: 1990,
    notes: 'Fabricante #2. Kingspan plc adquirió 51% en junio 2023. Sistema SPM con DAT desde marzo 2015. Capacidad +500.000 m²/año. IG 29.000 seguidores — líder del sector.',
    threat_score: 5, opportunity_score: 2,
  },
  {
    name: 'BECAM SA', tier: 1, type: 'mixto',
    website: 'https://www.becam.com.uy', ig_handle: 'becamsa',
    location: 'Showroom Av. Italia 3930 + planta Besnes Irigoyen 4816 (Peñarol)',
    founded_year: 1950,
    notes: 'Empresa familiar uruguaya 75 años (2025). FABRICA chapas/perfiles propios. IMPORTA y distribuye Hiansa-Panel 5G español. PROVEEDOR DE BMC en línea Hiansa — relación simbiótica con riesgo de desintermediación.',
    threat_score: 4, opportunity_score: 3,
  },
  {
    name: 'TDA Uruguay', tier: 1, type: 'importador',
    website: 'https://www.tdauruguay.com', location: 'Montevideo',
    founded_year: 2015,
    notes: 'Representación exclusiva HILTI. Distribuye paneles ACH (Saint-Gobain, España) lana de roca/PIR/PUR. Premium con garantía 10 años. Target industrial/grandes obras.',
    threat_score: 3, opportunity_score: 4,
  },
  {
    name: 'Eco Panels Uruguay', tier: 1, type: 'importador',
    website: 'https://ecopanels.uy', ig_handle: 'ecopanelsmarindia',
    location: 'Uruguay',
    notes: 'Importador/distribuidor activo de isopaneles + chapas galvanizadas. Tel 094 029 100.',
    threat_score: 3, opportunity_score: 3,
  },
  {
    name: 'Panel Sandwich Group', tier: 1, type: 'importador',
    website: 'https://panelsandwich.uy',
    location: 'Zaragoza, España (exportación a UY)',
    notes: 'Multinacional española >5M m²/año. SEO agresivo desde España, gana top SERP en queries UY. Sin oficina/showroom local. Precios FOB €14-€64/m².',
    threat_score: 4, opportunity_score: 2,
  },
  {
    name: 'Casa del Panel', tier: 1, type: 'mixto',
    website: 'https://casadelpanel.com', ig_handle: 'casadelpaneluy',
    location: 'Montevideo',
    notes: 'Vinculada a Barraca Leal. Multimarca (ISOROOF Foil revende Kingspan, chapas, perfiles). IG 2.514 seguidores. RÉPLICA DIGITAL MÁS CERCANA A BMC.',
    threat_score: 4, opportunity_score: 3,
  },

  // Tier 2 · Secondary (9)
  {
    name: 'ARMCO', tier: 2, type: 'fabricante',
    website: 'https://www.armco.com.uy',
    location: 'Av. de las Instrucciones 2703, Montevideo',
    founded_year: 1946,
    notes: 'Empresa metalúrgica 80 años. Venta exclusiva por red de barracas (Carmela, Central, Sodimac). Confort Panel, Econopanel, Tejapanel, Steel Framing. Gama económica.',
    threat_score: 3, opportunity_score: 3,
  },
  {
    name: 'Isopanel Pro Uruguay', tier: 2, type: 'instalador',
    website: 'https://www.isopaneles.uy', ig_handle: 'isopanelprouruguay',
    location: 'Montevideo y alrededores',
    notes: 'Doble dominio. Vivienda llave en mano integral. IG 693 seguidores.',
    threat_score: 2, opportunity_score: 3,
  },
  {
    name: 'Isopanel Uruguay', tier: 2, type: 'distribuidor',
    website: 'https://www.isopaneluruguay.com', ig_handle: 'isopaneluruguay',
    location: 'Pando, Canelones',
    notes: 'Familia constructora 3 generaciones. Casas isopanel + kits constructivos + asesoría técnica.',
    threat_score: 2, opportunity_score: 3,
  },
  {
    name: 'MyF Isopaneles', tier: 2, type: 'instalador',
    website: 'https://www.myfisopaneles.com.uy',
    location: 'Montevideo (cobertura nacional)',
    notes: 'M&F Isopaneles, 15 años. Reventa Isopanel + instalación llave en mano + cámaras frigoríficas.',
    threat_score: 2, opportunity_score: 2,
  },
  {
    name: 'Construmec Isopaneles', tier: 2, type: 'instalador',
    website: 'https://www.construmec-isopaneles.com.uy',
    location: 'Montevideo (cobertura nacional)',
    notes: 'Especialista cámaras frigoríficas residenciales con puerta.',
    threat_score: 2, opportunity_score: 2,
  },
  {
    name: 'Galpones Duque', tier: 2, type: 'instalador',
    website: 'https://www.galponesduque.com.uy',
    location: 'Uruguay (cobertura nacional)',
    notes: '>20 años en montaje. Clientes B2B: LATU, Plan Ceibal, Naka S.A., Autolan Hyundai.',
    threat_score: 2, opportunity_score: 4,
  },
  {
    name: 'Isopanel Flores', tier: 2, type: 'instalador',
    website: 'https://isopanelflores.uy',
    location: 'José Pedro Varela 1016, Trinidad (Flores)',
    notes: 'Único actor relevante interior centro-oeste UY. Mix diversificado: isopanel vivienda/galpones + estructuras metálicas + piscinas.',
    threat_score: 2, opportunity_score: 3,
  },
  {
    name: 'Eco Panels Ruta 8', tier: 2, type: 'distribuidor',
    website: null, ig_handle: 'ecopanelsruta8',
    location: 'Empalme Olmos, Canelones',
    notes: 'Suministro de isopaneles + fabricación propia de chapas a medida. Marca separada de Eco Panels Uruguay.',
    threat_score: 1, opportunity_score: 2,
  },
  {
    name: 'FOKO Construcciones', tier: 2, type: 'instalador',
    website: 'https://foko.com.uy', location: 'Uruguay',
    notes: 'Partner Bromyros. Instala + vende paneles livianos.',
    threat_score: 2, opportunity_score: 2,
  },

  // Tier 3 · Indirect/Complementary (6)
  {
    name: 'Group Soluciones', tier: 3, type: 'importador',
    website: 'https://groupsoluciones.uy', ig_handle: 'groupsolucionesuy',
    location: 'Cabari 4157 esq. Gral Flores, Montevideo',
    founded_year: 2005,
    notes: 'Core obra seca (yeso, OSB, pisos flotantes, PVC). Menciona paneles SIP. Marca propia Harsen®.',
    threat_score: 1, opportunity_score: 2,
  },
  {
    name: 'Reyes Refrigeración', tier: 3, type: 'mixto',
    website: 'https://reyesrefrigeracion.com.uy', ig_handle: 'reyesrefrigeracion',
    location: 'Ruta 7 km 28.300, Sauce, Canelones',
    founded_year: 1998,
    notes: 'Parte de Refricenter Group. Frío industrial pesado. NO compite frontal con BMC.',
    threat_score: 1, opportunity_score: 3,
  },
  {
    name: 'Baudin Equipamientos', tier: 3, type: 'mixto',
    website: 'https://baudinequipamientos.com', ig_handle: 'baudinoficial',
    location: 'Canelones', founded_year: 2017,
    notes: 'Core gastronomía profesional. Línea cámaras frigoríficas integradas. IG 4.019 seguidores.',
    threat_score: 1, opportunity_score: 3,
  },
  {
    name: 'Vitrilan SA', tier: 3, type: 'distribuidor',
    website: 'https://vitrilan.com', location: 'Av. Gral. Flores 4440, Montevideo',
    founded_year: 1960,
    notes: 'Foco lana de vidrio Isover + lana de roca TherMax.',
    threat_score: 1, opportunity_score: 2,
  },
  {
    name: 'Marbex SA', tier: 3, type: 'distribuidor',
    website: 'https://marbex.com.uy', location: 'Uruguay',
    notes: 'Aislantes térmicos y acústicos industriales.',
    threat_score: 1, opportunity_score: 2,
  },
  {
    name: 'Barraca Carmela', tier: 3, type: 'distribuidor',
    website: 'https://carmela.com.uy', location: 'Uruguay',
    notes: 'Revende ARMCO (Econopanel, Confort Panel). Precios públicos visibles.',
    threat_score: 2, opportunity_score: 2,
  },

  // Tier 4 · Watchlist (6)
  {
    name: 'PreHouse Uruguay', tier: 4, type: 'distribuidor',
    website: 'https://construex.uy/exhibidores/pre_house', location: 'Uruguay',
    notes: 'Distribuidor materiales / kits constructivos. Isopanel, steel deck, perfilería.',
    threat_score: 1, opportunity_score: 1,
  },
  {
    name: 'Isocenter Uruguay', tier: 4, type: 'instalador',
    website: 'https://construex.uy/exhibidores/isocenter', location: 'Montevideo',
    notes: 'Cubiertas PPS (paneles prefabricados tipo sándwich).',
    threat_score: 1, opportunity_score: 1,
  },
  {
    name: 'AG Isopaneles', tier: 4, type: 'instalador',
    website: 'https://agisopaneles.com.uy', location: 'Montevideo',
    notes: 'Paneles estructurales aislación térmica.',
    threat_score: 1, opportunity_score: 1,
  },
  {
    name: 'Greenhouse Uruguay', tier: 4, type: 'instalador',
    website: 'https://greenhouseuruguay.com', location: 'Uruguay',
    notes: 'Constructora multi-sistema. Isopanel EPS/PUR/PIR/SIP, steel framing.',
    threat_score: 1, opportunity_score: 1,
  },
  {
    name: 'Pani Construcciones', tier: 4, type: 'instalador',
    website: 'https://paniconstrucciones.com', location: 'Uruguay',
    notes: 'Constructora multi-sistema con línea isopanel.',
    threat_score: 1, opportunity_score: 1,
  },
  {
    name: 'Todo Casas UY / Todo Isopanel UY / Isopaneles Marcos', tier: 4, type: 'instalador',
    website: 'https://todocasas.com.uy', ig_handle: 'todoisopanel_uy',
    location: 'City Golf, Atlántida Norte + Progreso (Canelones)',
    notes: 'AGRUPADOS por similitud. IG activos con frecuencia variable.',
    threat_score: 2, opportunity_score: 2,
  },

  // Tier 5 · MLU Resellers (3)
  {
    name: 'EL INSUPERABLE', tier: 5, type: 'reseller',
    website: null, location: 'MercadoLibre Uruguay',
    notes: 'Top vendedor MLU sin marca propia clara. Alto volumen isopanel/isodec.',
    threat_score: 3, opportunity_score: 1,
  },
  {
    name: 'CELER UY', tier: 5, type: 'reseller',
    website: 'https://articulo.mercadolibre.com.uy/MLU-616612716',
    location: 'Montevideo, Canelones, Maldonado',
    notes: 'Vendedor MLU activo. Panel sándwich poliuretano 30/50mm para techo.',
    threat_score: 2, opportunity_score: 1,
  },
  {
    name: 'Otros vendedores MLU sin marca', tier: 5, type: 'reseller',
    website: null, location: 'MercadoLibre Uruguay',
    notes: 'Categoría agregada. >10 vendedores MLU activos sin marca registrada.',
    threat_score: 3, opportunity_score: 1,
  },
];

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

  // Ensure schema exists
  await pool.query(`CREATE SCHEMA IF NOT EXISTS bmc_market_intel`);

  // Ensure table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bmc_market_intel.competitors (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      tier INTEGER NOT NULL,
      type TEXT,
      website TEXT,
      ig_handle TEXT,
      location TEXT,
      founded_year INTEGER,
      notes TEXT,
      threat_score INTEGER DEFAULT 1,
      opportunity_score INTEGER DEFAULT 1,
      is_active BOOLEAN DEFAULT TRUE,
      metadata JSONB DEFAULT '{}',
      domain TEXT GENERATED ALWAYS AS (COALESCE(NULLIF(website, ''), 'N/A')) STORED,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  let inserted = 0;
  let updated = 0;
  let errors = [];

  for (const comp of COMPETITORS) {
    const { name, tier, type, website, ig_handle, location, founded_year, notes, threat_score, opportunity_score } = comp;
    const metadata = { productos: [], origen: 'seed-full-competitors.mjs' };

    const { error } = await pool.query(`
      INSERT INTO bmc_market_intel.competitors (name, tier, type, website, ig_handle, location, founded_year, notes, threat_score, opportunity_score, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (name) DO UPDATE SET
        tier = EXCLUDED.tier,
        type = EXCLUDED.type,
        website = EXCLUDED.website,
        ig_handle = EXCLUDED.ig_handle,
        location = EXCLUDED.location,
        founded_year = EXCLUDED.founded_year,
        notes = EXCLUDED.notes,
        threat_score = EXCLUDED.threat_score,
        opportunity_score = EXCLUDED.opportunity_score,
        metadata = bmc_market_intel.competitors.metadata || EXCLUDED.metadata,
        updated_at = NOW()
    `, [name, tier, type, website, ig_handle, location, founded_year, notes, threat_score, opportunity_score, JSON.stringify(metadata)]);

    if (error) {
      console.error(`  ✗ ${name}: ${error.message}`);
      errors.push({ name, error: error.message });
      continue;
    }

    const tierLabel = `T${tier}`;
    console.log(`  ✓ [${tierLabel}] ${name}`);
    inserted++;
  }

  console.log(`\n✅ Seed completed`);
  console.log(`   Applied: ${inserted}/${COMPETITORS.length}`);
  if (errors.length > 0) {
    console.log(`   Errors: ${errors.length}`);
  }

  // Verify final count
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM bmc_market_intel.competitors');
  const count = rows[0]?.count || 0;
  console.log(`\n📊 Total competitors in DB: ${count}`);

  if (count !== COMPETITORS.length) {
    console.warn(`⚠️  Expected ${COMPETITORS.length}, found ${count} in DB`);
  }

  await pool.end();
}

seed().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
