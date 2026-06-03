import { useContext } from "react";
import { SkinContext } from "./skinContext.js";

export function useSkin() {
  return useContext(SkinContext);
}
