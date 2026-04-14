// Iconos del paso 1 (Escenario de obra) — Lucide, coherente con tarjetas de escenario
import { Warehouse, Building2, HardHat, ThermometerSnowflake, FileSpreadsheet } from "lucide-react";

const MAP = {
  solo_techo: Warehouse,
  solo_fachada: Building2,
  techo_fachada: HardHat,
  camara_frig: ThermometerSnowflake,
  presupuesto_libre: FileSpreadsheet,
};

/**
 * @param {{ scenarioId: string, size?: number, color?: string, selected?: boolean }} props
 */
export default function ScenarioStepIcon({ scenarioId, size = 28, color, selected = false }) {
  const Icon = MAP[scenarioId] || Warehouse;
  const stroke = selected ? 2.25 : 1.75;
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }} aria-hidden>
      <Icon size={size} strokeWidth={stroke} color={color} />
    </span>
  );
}
