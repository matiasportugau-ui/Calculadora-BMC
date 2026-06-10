// Wolfboard (Admin Cotizaciones) — dual auth: API_AUTH_TOKEN | identity JWT (admin+).

import { requireServiceOrUser } from "./requireServiceOrUser.js";

export const requireWolfboardRead = requireServiceOrUser({ role: "admin" });
export const requireWolfboardWrite = requireServiceOrUser({ role: "admin" });

export default requireWolfboardRead;