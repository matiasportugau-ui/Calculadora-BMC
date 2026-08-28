import { useEffect, useState } from "react";
import { operatorRequest } from "../utils/operatorApiClient.js";

/** Live Panelin Front sessions on the shop. Polls the operator board. */
export function useStorefrontLiveCount({ enabled = true, intervalMs = 8000 } = {}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return undefined;
    }
    let on = true;
    async function tick() {
      try {
        const { data } = await operatorRequest("/api/storefront-live");
        if (on) setCount(Array.isArray(data?.items) ? data.items.length : 0);
      } catch {
        if (on) setCount(0);
      }
    }
    tick();
    const t = setInterval(tick, intervalMs);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, [enabled, intervalMs]);

  return count;
}
