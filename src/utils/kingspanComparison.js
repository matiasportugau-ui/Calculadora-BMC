// src/utils/kingspanComparison.js
// Generates a side-by-side comparison between BMC calc logic and Kingspan approach
// for each inspector module. Read-only — does not affect any calculation.

import {
  KINGSPAN_FASTENER_PHILOSOPHY,
  KINGSPAN_SEALANTS,
} from '../data/kingspanKB.js';

/**
 * Returns comparison rows for a given CalcLogicInspector module.
 * Each row: { concepto, bmc, kingspan, nota, status }
 * status: 'match' | 'partial' | 'differs' | 'bmc_only' | 'ks_only'
 */
export function compareKingspanVsBMC(moduleId) {
  switch (moduleId) {
    case 'paneles-techo':
      return {
        title: 'Paneles de Techo — BMC vs Kingspan',
        rows: [
          {
            concepto: 'Familia principal',
            bmc: 'ISODEC PIR / EPS (ancho nominal 1.18m)',
            kingspan: 'KS1000 RW o KS1000 FF (ancho nominal 1000mm)',
            nota: 'Ambos usan PIR como aislante premium. Diferente ancho nominal.',
            status: 'partial',
          },
          {
            concepto: 'Ancho útil (au)',
            bmc: 'ISODEC: au = 1.12m (solape de costilla ya descontado del nominal)',
            kingspan: 'KS1000 RW: ancho de cobertura = 1000mm (solape integrado en costilla, sin deducción externa)',
            nota: 'Diferente convención: BMC deduce el solape explícitamente; Kingspan publica 1000mm como ancho efectivo directo. Fórmula cantP = ⌈ancho/au⌉ es idéntica en ambos.',
            status: 'partial',
          },
          {
            concepto: 'Fórmula de cantidad',
            bmc: 'cantP = ⌈ancho / au⌉',
            kingspan: 'cantP = ⌈ancho / au⌉ (igual principio)',
            nota: 'Lógica idéntica. Ambas calculadoras usan techo arriba.',
            status: 'match',
          },
          {
            concepto: 'Largo máximo de panel',
            bmc: 'ISODEC: hasta 12m',
            kingspan: 'KS1000 RW: hasta 13.6m — KS1000 FF: hasta 10m',
            nota: 'Kingspan RW permite largos mayores. FF es similar a ISODEC.',
            status: 'partial',
          },
          {
            concepto: 'Espesores disponibles',
            bmc: '80, 100, 150, 200, 250mm',
            kingspan: '40 a 200mm (series de 20mm)',
            nota: 'Kingspan cubre espesores menores (40, 60mm). BMC llega a 250mm.',
            status: 'partial',
          },
        ],
      };

    case 'autoportancia':
      return {
        title: 'Autoportancia — BMC vs Kingspan',
        rows: [
          {
            concepto: 'Quién calcula los apoyos',
            bmc: 'La calculadora BMC (automático según tabla ap interna)',
            kingspan: 'El calculista estructural por proyecto técnico',
            nota: 'BMC automatiza para obra chica; Kingspan lo delega al ingeniero.',
            status: 'differs',
          },
          {
            concepto: 'Parámetros de cálculo',
            bmc: 'Solo espesor del panel y largo del faldón',
            kingspan: 'Cargas de nieve, viento, deflexión, tipo de apoyo, zona geográfica',
            nota: 'La lógica de BMC es una simplificación conservadora válida para la región.',
            status: 'partial',
          },
          {
            concepto: 'Fórmula de apoyos intermedios',
            bmc: 'apoyos = ⌈largo / ap⌉ + 1 (incluye extremos)',
            kingspan: 'Tablas de vano máximo en documentación técnica por familia y espesor',
            nota: 'Ambos llegan al mismo concepto: si el largo supera el vano, hay que agregar correa.',
            status: 'partial',
          },
          {
            concepto: 'Vano mínimo de apoyo (X-DEK flat)',
            bmc: 'No aplica (ISODEC es techo inclinado)',
            kingspan: 'Ancho mínimo de apoyo: 50mm (simple) / 90mm (continuo extremo L<4m)',
            nota: 'Kingspan especifica ancho de apoyo para techo plano. BMC no tiene techo plano.',
            status: 'ks_only',
          },
        ],
      };

    case 'fij-isodec':
      return {
        title: 'Fijaciones ISODEC (varilla) vs Kingspan RW/FF',
        subtitle: KINGSPAN_FASTENER_PHILOSOPHY[0],
        rows: [
          {
            concepto: 'Sistema de fijación a estructura',
            bmc: 'Varilla roscada 3/8" traversante — atraviesa el panel',
            kingspan: 'Tornillo autoroscante P01/P02 desde cara superior del panel a purlin',
            nota: 'Sistemas completamente diferentes: BMC traversa el panel; Kingspan fija desde arriba.',
            status: 'differs',
          },
          {
            concepto: 'Grilla de puntos de fijación',
            bmc: 'cantP × (apoyos + 2) + perim. lateral cada 2.5m',
            kingspan: 'Sin fórmula fija — por calculista estructural por proyecto',
            nota: 'BMC cuantifica automáticamente. Kingspan requiere diseño por ingeniería.',
            status: 'differs',
          },
          {
            concepto: 'Costura de solape lateral',
            bmc: 'No aplica — costillas ISODEC encajan sin costura',
            kingspan: 'P03 (costura) cada 500mm a lo largo del solape',
            nota: 'ISODEC no necesita costura lateral. Kingspan RW/FF sí la requiere.',
            status: 'differs',
          },
          {
            concepto: 'Anclaje a hormigón',
            bmc: 'Taco expansivo 3/8" + varilla extra 20cm (rosca_extra_hormigon_m)',
            kingspan: 'No especificado — guía asume estructura metálica o madera',
            nota: 'BMC tiene lógica específica para hormigón. Kingspan no la documenta.',
            status: 'bmc_only',
          },
          {
            concepto: 'Sellado de fijación',
            bmc: 'Tortuga PVC + cinta butilo sobre el panel',
            kingspan: 'Arandela EPDM presellada incorporada en el tornillo P02',
            nota: 'Ambos sellan la penetración del techo. Diferente componente.',
            status: 'partial',
          },
        ],
      };

    case 'fij-isoroof':
      return {
        title: 'Fijaciones ISOROOF (caballete) vs Kingspan RW/FF',
        rows: [
          {
            concepto: 'Pieza de fijación principal',
            bmc: 'Caballete metálico que abraza la costilla + tornillo mecha/aguja',
            kingspan: 'Tornillo P01/P02 directo en costilla del panel a purlin',
            nota: 'BMC usa caballete físico separado. Kingspan usa tornillo directo.',
            status: 'differs',
          },
          {
            concepto: 'Espaciado interior (grilla)',
            bmc: '1 caballete cada 2.9m de largo (factor_largo configurable)',
            kingspan: 'No fijo — por calculista estructural (típicamente 1/purlin)',
            nota: 'BMC fija 2.9m como criterio por defecto. Kingspan lo deja al proyecto.',
            status: 'differs',
          },
          {
            concepto: 'Costura de solape lateral',
            bmc: 'Caballete perimetral cada 30cm en bordes laterales',
            kingspan: 'P03 cada 500mm en toda la longitud del solape',
            nota: 'BMC a 300mm vs Kingspan a 500mm. BMC es más estricto en el borde.',
            status: 'partial',
          },
          {
            concepto: 'Compatibilidad de estructura',
            bmc: 'Metal (tornillo mecha) o madera (tornillo aguja)',
            kingspan: 'Metal (P02) o madera (P04)',
            nota: 'Misma lógica dual metal/madera. Componentes equivalentes.',
            status: 'match',
          },
        ],
      };

    case 'perfileria-techo':
      return {
        title: 'Perfilería de Techo — BMC vs Kingspan',
        rows: [
          {
            concepto: 'Canalón',
            bmc: 'Canalón en U, soportes cada 30cm. ML calculado por largo',
            kingspan: 'Canalón Highline: secciones de 3000mm, riel a 666mm',
            nota: 'BMC calcula por ML. Kingspan especifica tramos fijos de 3m.',
            status: 'partial',
          },
          {
            concepto: 'Babeta / Flashing',
            bmc: 'Babeta lateral, babeta fondo — cuantificadas en ML',
            kingspan: 'Trim pieces por catálogo, cuantificación en proyecto',
            nota: 'BMC cuantifica automáticamente los flashings. Kingspan los deja al proyecto.',
            status: 'partial',
          },
          {
            concepto: 'Gotero frontal',
            bmc: 'Gotero frontal en ML calculado por ancho cubierta',
            kingspan: 'Trim de alero de catálogo — concepto equivalente',
            nota: 'Concepto idéntico. BMC lo cuantifica en ml.',
            status: 'match',
          },
          {
            concepto: 'Guardanieves',
            bmc: 'No incluido en perfilería BMC',
            kingspan: 'Guardanieves Z14 de aluminio, espaciado 333mm',
            nota: 'Kingspan tiene accesorio específico. BMC no lo cuantifica.',
            status: 'ks_only',
          },
        ],
      };

    case 'selladores-techo':
      return {
        title: 'Selladores de Techo — BMC vs Kingspan',
        rows: [
          {
            concepto: 'Junta longitudinal (entre paneles)',
            bmc: 'Silicona Bromplast 600ml neutra en junta',
            kingspan: KINGSPAN_SEALANTS.Neutral_silicon.label + ' — ' + KINGSPAN_SEALANTS.Neutral_silicon.description,
            nota: 'Concepto idéntico. Kingspan especifica rango térmico −40°C a +150°C.',
            status: 'match',
          },
          {
            concepto: 'Sello de solape superior',
            bmc: 'Cinta butilo adhesiva sobre el solape del panel',
            kingspan: 'Cinta PE 20×5mm compresiva en costilla de solape',
            nota: 'Similar función. Cinta PE (Kingspan) es compresiva; cinta butilo (BMC) es adhesiva.',
            status: 'partial',
          },
          {
            concepto: 'Barrera de vapor',
            bmc: 'No cuantificada explícitamente',
            kingspan: 'Cinta butilo (vapor-proof) en juntas críticas',
            nota: 'Kingspan especifica barrera de vapor con cinta butilo. BMC no la cuantifica.',
            status: 'ks_only',
          },
          {
            concepto: 'Sellado UV para juntas expuestas',
            bmc: 'No especificado',
            kingspan: 'Cinta PVC UV resistente para juntas al sol',
            nota: 'Kingspan tiene producto UV específico. BMC usa silicona general.',
            status: 'ks_only',
          },
          {
            concepto: 'Relleno de huecos',
            bmc: 'Espuma PU pistola',
            kingspan: 'Espuma PU pistola (gaps >5cm: aplicar en capas)',
            nota: 'Idéntico producto. Kingspan agrega instrucción: para huecos >5cm, en capas.',
            status: 'match',
          },
          {
            concepto: 'Sello impermeabilizante solape (agua)',
            bmc: 'Membrana PVC en perímetro',
            kingspan: 'Cinta PU expansiva (50→30%) en solape de costilla',
            nota: 'Materiales diferentes, función similar de estanqueidad al agua.',
            status: 'partial',
          },
        ],
      };

    case 'paneles-pared':
      return {
        title: 'Paneles de Pared — BMC vs Kingspan',
        rows: [
          {
            concepto: 'Familia principal',
            bmc: 'ISOWALL (ancho útil 1.14m)',
            kingspan: 'KS1000 TF/TL/NC/NF (visible) o AWP (oculta)',
            nota: 'ISOWALL equivale a familia TF/NC de Kingspan. BMC no tiene fijación oculta.',
            status: 'partial',
          },
          {
            concepto: 'Fórmula de cantidad',
            bmc: 'cantP = ⌈perímetro / au⌉',
            kingspan: 'Mismo principio (ceil(perímetro/au))',
            nota: 'Lógica idéntica.',
            status: 'match',
          },
          {
            concepto: 'Largo máximo',
            bmc: 'ISOWALL: hasta 12m',
            kingspan: 'TF/TL/NC/NF/AWP: hasta 13.6m',
            nota: 'Kingspan cubre alturas mayores que BMC estándar.',
            status: 'partial',
          },
          {
            concepto: 'Fijación oculta (arquitectónica)',
            bmc: 'No disponible en rango ISOWALL estándar',
            kingspan: 'KS1000 AWP — fijación secreta con Z15a spread washer',
            nota: 'Kingspan ofrece fachada sin tornillos visibles. BMC no tiene equivalente.',
            status: 'ks_only',
          },
        ],
      };

    case 'fij-pared':
      return {
        title: 'Fijaciones de Pared — BMC vs Kingspan',
        rows: [
          {
            concepto: 'Tornillo a estructura metálica',
            bmc: 'Tornillo T2 (Tek #14) a 5.5 unid/m²',
            kingspan: 'P02/P02p por purlin — cantidad por calculista estructural',
            nota: 'BMC cuantifica por densidad/m². Kingspan cuantifica por línea de purlin.',
            status: 'partial',
          },
          {
            concepto: 'Arandela de distribución',
            bmc: 'Sin arandela específica en T2 estándar',
            kingspan: 'Arandela Ø16mm estándar acompañando P02',
            nota: 'Kingspan especifica arandela; BMC no la incluye para T2.',
            status: 'partial',
          },
          {
            concepto: 'Costura entre paneles adyacentes',
            bmc: 'Remache POP 2 por panel en junta vertical',
            kingspan: 'Tornillo P03 de costura — cantidad por proyecto',
            nota: 'BMC usa remache; Kingspan usa tornillo de costura equivalente al P03 de techo.',
            status: 'partial',
          },
          {
            concepto: 'Anclaje de base',
            bmc: 'Anclaje H cada 30cm en base del perfil U',
            kingspan: 'Prescrito por proyecto estructural',
            nota: 'BMC cuantifica la base explícitamente. Kingspan lo deja al ingeniero.',
            status: 'partial',
          },
          {
            concepto: 'Fijación AWP (oculta)',
            bmc: 'No aplica',
            kingspan: 'P04 + arandela Z15a spread washer en nervio del panel',
            nota: 'Solo en Kingspan AWP. BMC no tiene sistema equivalente.',
            status: 'ks_only',
          },
        ],
      };

    case 'perfiles-pared':
      return {
        title: 'Perfilería de Pared — BMC vs Kingspan',
        rows: [
          {
            concepto: 'Perfil de base y coronación',
            bmc: 'Perfil U en base + coronación, calculado por perímetro',
            kingspan: 'No especificado en guía de instalación — parte del proyecto',
            nota: 'BMC cuantifica el perfil U. Kingspan lo asume como parte del sistema de estructura.',
            status: 'bmc_only',
          },
          {
            concepto: 'Junta vertical entre paneles',
            bmc: 'Perfil K2 externo entre paneles adyacentes',
            kingspan: 'Junta T+G (macho-hembra) integrada en el perfil del panel',
            nota: 'Kingspan tiene junta integrada. BMC usa pieza K2 externa.',
            status: 'differs',
          },
          {
            concepto: 'Perfil de esquina',
            bmc: 'Esquinero G2 (chapa doblada en L)',
            kingspan: 'Corner panel prefabricado — D≤120mm (TF/TL/NC/NF), D≤100mm (AWP)',
            nota: 'Concepto similar. Kingspan limita la profundidad del esquinero.',
            status: 'partial',
          },
        ],
      };

    case 'esquineros':
      return {
        title: 'Esquineros — BMC vs Kingspan',
        rows: [
          {
            concepto: 'Esquinero exterior',
            bmc: 'Chapa doblada en L, longitud = alto del edificio',
            kingspan: 'Corner panel prefabricado — profundidad máx. D=120mm en TF/TL/NC/NF',
            nota: 'Kingspan limita D del esquinero a 120mm (ó 100mm en AWP). BMC sin límite.',
            status: 'partial',
          },
          {
            concepto: 'Esquinero interior',
            bmc: 'Perfil angular interior, longitud = alto',
            kingspan: 'Interior corner piece de catálogo',
            nota: 'Mismo concepto. Ambos se miden en ml y se cortan a medida.',
            status: 'match',
          },
          {
            concepto: 'Material',
            bmc: 'Chapa galvanizada / prepintada (igual que panel)',
            kingspan: 'Acero prepintado a juego con el panel',
            nota: 'Idéntico material y acabado.',
            status: 'match',
          },
        ],
      };

    case 'selladores-pared':
      return {
        title: 'Selladores de Pared — BMC vs Kingspan',
        rows: [
          {
            concepto: 'Sello de junta vertical',
            bmc: 'Silicona Bromplast 600ml en junta entre paneles',
            kingspan: 'Silicona neutra exterior + cinta PE en junta macho-hembra',
            nota: 'Kingspan usa doble sistema: cinta compresiva + silicona. BMC solo silicona.',
            status: 'partial',
          },
          {
            concepto: 'Cinta de solape del panel',
            bmc: 'Cinta autoadhesiva en contorno del panel',
            kingspan: 'Cinta PE 20×5mm en junta macho-hembra de la costilla del panel',
            nota: 'Función equivalente. Cinta PE de Kingspan es compresiva.',
            status: 'partial',
          },
          {
            concepto: 'Membrana de zócalo',
            bmc: 'Membrana PVC perimetral en base de pared',
            kingspan: 'No especificada en guía de instalación',
            nota: 'BMC incluye membrana base como estándar. Kingspan la omite en guía.',
            status: 'bmc_only',
          },
          {
            concepto: 'Sellado en esquinas',
            bmc: 'No especificado por separado (incluido en perimetral)',
            kingspan: 'Cinta PE + silicona en esquinas según detalle',
            nota: 'Kingspan especifica tratamiento de esquinas. BMC lo incluye en total perimetral.',
            status: 'partial',
          },
          {
            concepto: 'Relleno de huecos',
            bmc: 'Espuma PU pistola para bordes y huecos',
            kingspan: 'Espuma PU pistola (gaps >5cm: en capas sucesivas)',
            nota: 'Idéntico producto. Kingspan da instrucción adicional para huecos grandes.',
            status: 'match',
          },
        ],
      };

    default:
      return null;
  }
}

/** Status color for comparison rows */
export function statusColor(status) {
  switch (status) {
    case 'match':    return '#34C759';
    case 'partial':  return '#FF9F0A';
    case 'differs':  return '#E44C4C';
    case 'bmc_only': return '#0071E3';
    case 'ks_only':  return '#AF52DE';
    default:         return '#6E6E73';
  }
}

/** Status label for comparison rows */
export function statusLabel(status) {
  switch (status) {
    case 'match':    return 'Equivalente';
    case 'partial':  return 'Parcial';
    case 'differs':  return 'Diferente';
    case 'bmc_only': return 'Solo BMC';
    case 'ks_only':  return 'Solo KS';
    default:         return '—';
  }
}
