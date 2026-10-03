import { useCallback, useState } from "react";

const BATCH_OPTS_KEY = "bmc_admin_quote_batch_opts";

export const DEFAULT_BATCH_OPTS = {
  force: false,
  syncToCrm: true,
  createCrmRows: true,
  syncQuoteLink: true,
};

export function loadBatchOpts(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(BATCH_OPTS_KEY);
    if (!raw) return { ...DEFAULT_BATCH_OPTS };
    const o = JSON.parse(raw);
    return {
      force: Boolean(o.force),
      syncToCrm: o.syncToCrm !== false,
      createCrmRows: o.createCrmRows !== false,
      syncQuoteLink: o.syncQuoteLink !== false,
    };
  } catch { return { ...DEFAULT_BATCH_OPTS }; }
}

function saveBatchOpts(opts, storage = globalThis.localStorage) {
  try { storage.setItem(BATCH_OPTS_KEY, JSON.stringify(opts)); } catch { /* ignore */ }
}

export function useBatchOpts() {
  const [batchOpts, setBatchOptsState] = useState(() => loadBatchOpts());
  const updateBatchOpts = useCallback((patch) => {
    setBatchOptsState((prev) => {
      const next = { ...prev, ...patch };
      saveBatchOpts(next);
      return next;
    });
  }, []);
  const resetBatchOpts = useCallback(() => {
    setBatchOptsState({ ...DEFAULT_BATCH_OPTS });
    saveBatchOpts(DEFAULT_BATCH_OPTS);
  }, []);
  return { batchOpts, updateBatchOpts, resetBatchOpts };
}
