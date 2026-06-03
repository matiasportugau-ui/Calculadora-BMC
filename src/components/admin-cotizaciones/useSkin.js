import { useContext } from "react";
import { SkinContext } from "./SkinProvider.jsx";

export function useSkin() {
  return useContext(SkinContext);
}
