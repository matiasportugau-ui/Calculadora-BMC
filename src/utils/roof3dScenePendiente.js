// RoofPanelRealisticScene uses `Number(pendiente) || 15`, so a literal zero
// would be rendered as 15°. Keep the workaround in a pure seam that protects
// flat-roof quotes and remains independently testable.
export const ROOF_3D_FLAT_PITCH_SENTINEL = 0.5;

export function normalizeRoof3dScenePendiente(pendiente) {
  return Number(pendiente) > 0 ? pendiente : ROOF_3D_FLAT_PITCH_SENTINEL;
}
