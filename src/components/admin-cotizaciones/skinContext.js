import { createContext } from "react";

export const DEFAULT_SKIN = "macos";

export const SkinContext = createContext({ skin: DEFAULT_SKIN, setSkin: () => {} });
