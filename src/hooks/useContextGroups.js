/**
 * Panelin Multi-Context Agent — ContextGroup state (Claude-style tab groups).
 * Persist groups in localStorage; one chat history key per groupId (caller).
 */
import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "bmc.panelin.contextGroups.v1";

const KIND_LABELS = {
  email: "Email",
  admin: "Admin",
  calc: "Calc",
  note: "Nota",
  crm: "CRM",
};

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultGroup() {
  const emailId = uid("email");
  const adminId = uid("admin");
  const calcId = uid("calc");
  return {
    id: uid("g"),
    label: "Workspace",
    focusTabId: calcId,
    tabs: [
      { id: emailId, kind: "email", label: "Email", ref: {}, summary: "" },
      { id: adminId, kind: "admin", label: "Admin", ref: { workbook: "admin" }, summary: "" },
      { id: calcId, kind: "calc", label: "Calc", ref: {}, summary: "" },
    ],
    sharedMemory: { clientName: null, flags: [] },
  };
}

function loadGroups() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.groups) || parsed.groups.length === 0) return null;
    return {
      groups: parsed.groups,
      activeGroupId: parsed.activeGroupId || parsed.groups[0].id,
    };
  } catch {
    return null;
  }
}

/**
 * @returns {{
 *   groups: object[],
 *   activeGroup: object,
 *   activeGroupId: string,
 *   setActiveGroupId: (id: string) => void,
 *   setFocusTab: (tabId: string) => void,
 *   addTab: (kind: string, label?: string, ref?: object) => void,
 *   removeTab: (tabId: string) => void,
 *   renameGroup: (label: string) => void,
 *   addGroup: () => void,
 *   workspacePayload: object,
 *   kindLabel: (kind: string) => string,
 * }}
 */
export function useContextGroups() {
  const initial = useMemo(() => {
    const loaded = typeof localStorage !== "undefined" ? loadGroups() : null;
    if (loaded) return loaded;
    const g = defaultGroup();
    return { groups: [g], activeGroupId: g.id };
  }, []);

  const [groups, setGroups] = useState(initial.groups);
  const [activeGroupId, setActiveGroupId] = useState(initial.activeGroupId);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ groups, activeGroupId }));
    } catch {
      /* ignore quota */
    }
  }, [groups, activeGroupId]);

  const activeGroup = groups.find((g) => g.id === activeGroupId) || groups[0];

  const patchActive = useCallback((fn) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === activeGroupId ? fn(g) : g)),
    );
  }, [activeGroupId]);

  const setFocusTab = useCallback((tabId) => {
    patchActive((g) => ({ ...g, focusTabId: tabId }));
  }, [patchActive]);

  const addTab = useCallback((kind, label, ref = {}) => {
    const k = String(kind || "note").toLowerCase();
    const id = uid(k);
    patchActive((g) => ({
      ...g,
      focusTabId: id,
      tabs: [
        ...g.tabs,
        {
          id,
          kind: k,
          label: label || KIND_LABELS[k] || k,
          ref,
          summary: "",
        },
      ].slice(0, 12),
    }));
  }, [patchActive]);

  const removeTab = useCallback((tabId) => {
    patchActive((g) => {
      const tabs = g.tabs.filter((t) => t.id !== tabId);
      if (tabs.length === 0) return g;
      const focusTabId = g.focusTabId === tabId ? tabs[0].id : g.focusTabId;
      return { ...g, tabs, focusTabId };
    });
  }, [patchActive]);

  const renameGroup = useCallback((label) => {
    const s = String(label || "").trim().slice(0, 60);
    if (!s) return;
    patchActive((g) => ({ ...g, label: s }));
  }, [patchActive]);

  const addGroup = useCallback(() => {
    const g = defaultGroup();
    g.label = `Grupo ${groups.length + 1}`;
    setGroups((prev) => [...prev, g]);
    setActiveGroupId(g.id);
  }, [groups.length]);

  const workspacePayload = useMemo(() => {
    if (!activeGroup) return null;
    return {
      groupId: activeGroup.id,
      groupLabel: activeGroup.label,
      focusTabId: activeGroup.focusTabId,
      tabs: activeGroup.tabs,
      sharedMemory: activeGroup.sharedMemory || { clientName: null, flags: [] },
    };
  }, [activeGroup]);

  return {
    groups,
    activeGroup,
    activeGroupId,
    setActiveGroupId,
    setFocusTab,
    addTab,
    removeTab,
    renameGroup,
    addGroup,
    workspacePayload,
    kindLabel: (kind) => KIND_LABELS[kind] || kind,
  };
}
