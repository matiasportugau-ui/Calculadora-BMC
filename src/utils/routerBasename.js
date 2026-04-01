/**
 * React Router `basename` from Vite `import.meta.env.BASE_URL` (leading slash, no trailing slash).
 * Root deploy: `undefined` so BrowserRouter uses `/`.
 */
export function getRouterBasename() {
  const raw = import.meta.env.BASE_URL || "/";
  const b = String(raw).replace(/\/+$/, "");
  if (b === "") return undefined;
  return b;
}
