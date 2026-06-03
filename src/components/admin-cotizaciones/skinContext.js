import { createContext } from "react";

const DEFAULT_SKIN = "macos";

export const SkinContext = createContext({ skin: DEFAULT_SKIN, setSkin: () => {} });
