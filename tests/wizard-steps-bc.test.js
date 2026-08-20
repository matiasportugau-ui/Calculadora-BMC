import { describe, it, expect } from "vitest";
import { withProyectoFirst } from "../src/utils/wizardSteps.js";

describe("withProyectoFirst", () => {
  it("moves Datos del proyecto to index 0", () => {
    const steps = [
      { id: "escenario", label: "Escenario de obra" },
      { id: "color", label: "Color techo" },
      { id: "proyecto", label: "Datos del proyecto" },
    ];
    expect(withProyectoFirst(steps).map((s) => s.id)).toEqual([
      "proyecto",
      "escenario",
      "color",
    ]);
  });

  it("is a no-op when already first or missing", () => {
    expect(withProyectoFirst([{ id: "proyecto" }, { id: "escenario" }]).map((s) => s.id))
      .toEqual(["proyecto", "escenario"]);
    expect(withProyectoFirst([{ id: "escenario" }]).map((s) => s.id)).toEqual(["escenario"]);
  });
});
