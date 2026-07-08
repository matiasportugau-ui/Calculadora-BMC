import React, {
  Children,
  Fragment,
  cloneElement,
  forwardRef,
  isValidElement,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  Group,
  Panel as ResizablePanel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import {
  layoutArrayToObject,
  layoutObjectToArray,
  panelPercentSize,
} from "../utils/resizablePanelsCompat.js";

const NOOP_STORAGE = {
  getItem() {
    return null;
  },
  setItem() {},
};

function isCompatPanelElement(child) {
  return child.type === Panel || child.type?.displayName === "Panel";
}

function prepareResizableChildren(children) {
  const panelIds = [];
  let implicitPanelIndex = 0;

  const visit = (nodes) => Children.map(nodes, (child) => {
    if (!isValidElement(child)) return child;

    if (child.type === Fragment) {
      return (
        <Fragment key={child.key}>
          {visit(child.props.children)}
        </Fragment>
      );
    }

    if (isCompatPanelElement(child)) {
      const id = child.props.id ?? `panel-${implicitPanelIndex}`;
      implicitPanelIndex += 1;
      panelIds.push(String(id));
      return child.props.id == null ? cloneElement(child, { id }) : child;
    }

    return child;
  });

  return {
    children: visit(children),
    panelIds,
  };
}

function callRef(ref, value) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

export const Panel = forwardRef(function PanelCompat({
  collapsedSize,
  defaultSize,
  maxSize,
  minSize,
  panelRef,
  ...props
}, forwardedRef) {
  const assignPanelRef = (handle) => {
    callRef(panelRef, handle);
    callRef(forwardedRef, handle);
  };

  return (
    <ResizablePanel
      {...props}
      collapsedSize={panelPercentSize(collapsedSize)}
      defaultSize={panelPercentSize(defaultSize)}
      maxSize={panelPercentSize(maxSize)}
      minSize={panelPercentSize(minSize)}
      panelRef={assignPanelRef}
    />
  );
});

Panel.displayName = "Panel";

export const PanelResizeHandle = forwardRef(function PanelResizeHandleCompat({
  disableDoubleClick = true,
  elementRef,
  hitAreaMargins: _hitAreaMargins,
  ...props
}, forwardedRef) {
  const assignElementRef = (element) => {
    callRef(elementRef, element);
    callRef(forwardedRef, element);
  };

  return (
    <Separator
      {...props}
      disableDoubleClick={disableDoubleClick}
      elementRef={assignElementRef}
    />
  );
});

PanelResizeHandle.displayName = "PanelResizeHandle";

export const PanelGroup = forwardRef(function PanelGroupCompat({
  autoSaveId,
  children,
  defaultLayout,
  direction = "horizontal",
  groupRef,
  onLayout,
  onLayoutChange,
  onLayoutChanged,
  storage,
  ...props
}, forwardedRef) {
  const prepared = useMemo(() => prepareResizableChildren(children), [children]);
  const internalGroupRef = useRef(null);
  const persistence = useDefaultLayout({
    id: autoSaveId || "__panelin-resizable-panels-no-autosave__",
    panelIds: prepared.panelIds,
    storage: autoSaveId ? storage : NOOP_STORAGE,
  });

  useImperativeHandle(forwardedRef, () => ({
    getLayout() {
      return layoutObjectToArray(prepared.panelIds, internalGroupRef.current?.getLayout?.());
    },
    setLayout(layout) {
      return internalGroupRef.current?.setLayout?.(
        layoutArrayToObject(prepared.panelIds, layout),
      );
    },
  }), [prepared.panelIds]);

  const assignGroupRef = (handle) => {
    internalGroupRef.current = handle;
    callRef(groupRef, handle);
  };

  const resolvedDefaultLayout =
    persistence.defaultLayout ?? layoutArrayToObject(prepared.panelIds, defaultLayout);

  return (
    <Group
      {...props}
      defaultLayout={resolvedDefaultLayout}
      groupRef={assignGroupRef}
      onLayoutChange={(layout) => {
        onLayoutChange?.(layout);
        onLayout?.(layoutObjectToArray(prepared.panelIds, layout));
      }}
      onLayoutChanged={(layout, meta) => {
        persistence.onLayoutChanged(layout, meta);
        onLayoutChanged?.(layout, meta);
      }}
      orientation={direction}
    >
      {prepared.children}
    </Group>
  );
});

PanelGroup.displayName = "PanelGroup";
