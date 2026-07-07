import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import {
  Group,
  Panel as ResizablePanel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import {
  panelLayoutArrayToMap,
  toResizablePanelSize,
} from "../utils/resizablePanelsCompat.js";

const noopStorage = {
  getItem() {
    return null;
  },
  setItem() {},
};

function getStorage(storage) {
  if (storage) return storage;
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  return noopStorage;
}

function useLegacyGroupHandle(forwardedRef, groupRef, panelIds) {
  useImperativeHandle(forwardedRef, () => ({
    getLayout() {
      return groupRef.current?.getLayout?.() || {};
    },
    setLayout(layout) {
      const nextLayout = panelLayoutArrayToMap(panelIds, layout);
      if (!nextLayout) return undefined;
      return groupRef.current?.setLayout?.(nextLayout);
    },
  }), [groupRef, panelIds]);
}

const PersistedPanelGroup = forwardRef(function PersistedPanelGroup({
  autoSaveId,
  direction,
  defaultLayout: defaultLayoutProp,
  onLayoutChanged,
  panelIds,
  storage,
  ...props
}, forwardedRef) {
  const groupRef = useRef(null);
  const defaultLayoutOverride = panelLayoutArrayToMap(panelIds, defaultLayoutProp);
  const persistedLayout = useDefaultLayout({
    id: autoSaveId,
    panelIds,
    storage: getStorage(storage),
  });

  useLegacyGroupHandle(forwardedRef, groupRef, panelIds);

  const handleLayoutChanged = useCallback((layout, meta) => {
    persistedLayout.onLayoutChanged(layout, meta);
    onLayoutChanged?.(layout, meta);
  }, [onLayoutChanged, persistedLayout]);

  return (
    <Group
      {...props}
      id={autoSaveId}
      groupRef={groupRef}
      orientation={direction}
      defaultLayout={defaultLayoutOverride || persistedLayout.defaultLayout}
      onLayoutChanged={handleLayoutChanged}
    />
  );
});

const PlainPanelGroup = forwardRef(function PlainPanelGroup({
  direction,
  defaultLayout,
  panelIds,
  ...props
}, forwardedRef) {
  const groupRef = useRef(null);
  useLegacyGroupHandle(forwardedRef, groupRef, panelIds);

  return (
    <Group
      {...props}
      groupRef={groupRef}
      orientation={direction}
      defaultLayout={panelLayoutArrayToMap(panelIds, defaultLayout)}
    />
  );
});

export const PanelGroup = forwardRef(function PanelGroup(props, forwardedRef) {
  return props.autoSaveId
    ? <PersistedPanelGroup {...props} ref={forwardedRef} />
    : <PlainPanelGroup {...props} ref={forwardedRef} />;
});

export const Panel = forwardRef(function Panel({
  collapsedSize,
  defaultSize,
  maxSize,
  minSize,
  panelRef,
  ...props
}, forwardedRef) {
  return (
    <ResizablePanel
      {...props}
      panelRef={panelRef || forwardedRef}
      collapsedSize={toResizablePanelSize(collapsedSize)}
      defaultSize={toResizablePanelSize(defaultSize)}
      maxSize={toResizablePanelSize(maxSize)}
      minSize={toResizablePanelSize(minSize)}
    />
  );
});

export const PanelResizeHandle = forwardRef(function PanelResizeHandle({
  hitAreaMargins: _hitAreaMargins,
  elementRef,
  ...props
}, forwardedRef) {
  return (
    <Separator
      {...props}
      elementRef={elementRef || forwardedRef}
    />
  );
});
