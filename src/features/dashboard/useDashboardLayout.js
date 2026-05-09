import { useCallback, useEffect, useState } from 'react';
import { defaultLayouts } from './defaultLayouts.js';

const STORAGE_KEY = (scope) => `bmc_dashboard_layout_${scope}`;

export function useDashboardLayout(scope) {
  const [layouts, setLayouts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY(scope));
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load dashboard layout', e);
    }
    return defaultLayouts[scope] || { lg: [] };
  });

  const save = useCallback(
    (next) => {
      setLayouts(next);
      try {
        localStorage.setItem(STORAGE_KEY(scope), JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save dashboard layout', e);
      }
    },
    [scope]
  );

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY(scope));
    setLayouts(defaultLayouts[scope] || { lg: [] });
  }, [scope]);

  return { layouts, save, reset };
}

export function useEditMode() {
  const [editMode, setEditMode] = useState(false);
  return [editMode, setEditMode];
}

export function useDashboardScopes() {
  return ['comercial', 'crm', 'devops'];
}

// Persist global filters (range, etc.) per scope.
export function useDashboardFilters(scope) {
  const key = `bmc_dashboard_filters_${scope}`;
  const [filters, setFiltersState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return { range: '30d' };
  });
  const setFilters = (next) => {
    const merged = { ...filters, ...next };
    setFiltersState(merged);
    try {
      localStorage.setItem(key, JSON.stringify(merged));
    } catch {
      // ignore
    }
  };
  // Cross-tab sync (optional)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === key && e.newValue) {
        try { setFiltersState(JSON.parse(e.newValue)); } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);
  return [filters, setFilters];
}
