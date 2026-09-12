import { createEffect, createSignal, untrack } from "solid-js";

import type { FloatingContext, ReferenceType, VirtualElement } from "../types";
import { contains, getTarget } from "../utils/element";
import { isMouseLikePointerType } from "../utils/event";

export interface CreateClientPointProps {
  /** Whether the interaction is enabled. Read once. @default true */
  enabled?: boolean | undefined;
  /** Restricts the client point to an axis, using the reference element for the other. Read once. @default 'both' */
  axis?: "x" | "y" | "both" | undefined;
}

export interface ClientPointReferenceProps {
  onPointerDown: (event: PointerEvent) => void;
  onPointerEnter: (event: PointerEvent) => void;
  onMouseMove: (event: MouseEvent) => void;
  onMouseEnter: (event: MouseEvent) => void;
}

export interface CreateClientPointResult {
  /** Getter returning props to spread onto the Solid reference element. */
  reference: () => ClientPointReferenceProps;
  /** Alias of `reference` for trigger-style composition (mirrors upstream). */
  trigger: () => ClientPointReferenceProps;
}

interface VirtualPointData {
  axis: "x" | "y" | "both";
  dataRef: FloatingContext["dataRef"];
  pointerType: string | undefined;
  x: number | null;
  y: number | null;
}

function ownerWindow(node: Element | null | undefined): Window {
  return node?.ownerDocument?.defaultView ?? window;
}

function createVirtualElement(domElement: Element | null | undefined, data: VirtualPointData): VirtualElement {
  let offsetX: number | null = null;
  let offsetY: number | null = null;
  let isAutoUpdateEvent = false;

  return {
    contextElement: (domElement ?? undefined) as Element | undefined,
    getBoundingClientRect() {
      const domRect = domElement?.getBoundingClientRect() ?? { width: 0, height: 0, x: 0, y: 0 };
      const isXAxis = data.axis === "x" || data.axis === "both";
      const isYAxis = data.axis === "y" || data.axis === "both";
      const canTrackCursorOnAutoUpdate =
        ["mouseenter", "mousemove"].includes(data.dataRef.current.openEvent?.type ?? "") && data.pointerType !== "touch";

      let width = domRect.width;
      let height = domRect.height;
      let x = domRect.x;
      let y = domRect.y;

      if (offsetX == null && data.x && isXAxis) {
        offsetX = domRect.x - data.x;
      }
      if (offsetY == null && data.y && isYAxis) {
        offsetY = domRect.y - data.y;
      }

      x -= offsetX || 0;
      y -= offsetY || 0;
      width = 0;
      height = 0;

      if (!isAutoUpdateEvent || canTrackCursorOnAutoUpdate) {
        width = data.axis === "y" ? domRect.width : 0;
        height = data.axis === "x" ? domRect.height : 0;
        x = isXAxis && data.x != null ? data.x : x;
        y = isYAxis && data.y != null ? data.y : y;
      } else if (isAutoUpdateEvent && !canTrackCursorOnAutoUpdate) {
        height = data.axis === "x" ? domRect.height : height;
        width = data.axis === "y" ? domRect.width : width;
      }

      isAutoUpdateEvent = true;

      return { width, height, x, y, top: y, right: x + width, bottom: y + height, left: x } as DOMRect;
    },
  };
}

function isMouseBasedEvent(event: Event | undefined): event is MouseEvent {
  return event != null && (event as MouseEvent).clientX != null;
}

/**
 * Positions the floating element relative to a client point such as the mouse
 * cursor. Solid port of upstream `useClientPoint` (mui/base-ui v1.8.0).
 * Handlers receive native DOM events; consumers spread `reference()` onto a
 * Solid element.
 */
export function createClientPoint(context: FloatingContext, props: CreateClientPointProps = {}): CreateClientPointResult {
  const store = context.rootStore;
  const dataRef = store.context.dataRef;

  const enabled = untrack(() => props.enabled ?? true);
  const axis = untrack(() => props.axis ?? "both");

  let initial = false;
  let pointerType: string | undefined;
  let cleanupListener: (() => void) | null = null;

  function resetReference(reference: Element | null) {
    store.set("positionReference", reference as ReferenceType | null);
  }

  function setReference(newX: number | null, newY: number | null, referenceElement?: Element | null) {
    if (initial) {
      return;
    }
    // Skip when the open event was not mouse-like (e.g. focus opened it).
    if (dataRef.current.openEvent && !isMouseBasedEvent(dataRef.current.openEvent)) {
      return;
    }
    store.set(
      "positionReference",
      createVirtualElement(referenceElement ?? store.select("domReferenceElement"), {
        x: newX,
        y: newY,
        axis,
        dataRef,
        pointerType,
      }) as ReferenceType,
    );
  }

  // Bumped when the cursor re-enters the reference while open so the
  // window listener below re-subscribes (mirrors upstream's `reactive` state).
  const [resubscribeVersion, setResubscribeVersion] = createSignal(0, { ownedWrite: true });

  function handleReferenceEnterOrMove(event: MouseEvent) {
    if (!store.select("open")) {
      setReference(event.clientX, event.clientY, event.currentTarget as Element);
    } else if (!cleanupListener) {
      // No listener means the cursor came back from the floating element.
      setReference(event.clientX, event.clientY, event.currentTarget as Element);
      setResubscribeVersion((version) => version + 1);
    }
  }

  // Follow the cursor with a window-level listener while open (or while the
  // floating element exists for mouse-like pointers, covering transitions).
  createEffect(
    () => ({
      open: store.select("open"),
      floating: store.select("floatingElement"),
      domReference: store.select("domReferenceElement"),
      resubscribe: resubscribeVersion(),
    }),
    ({ open, floating, domReference }) => {
      if (!enabled) {
        resetReference(domReference);
        return undefined;
      }

      const openCheck = isMouseLikePointerType(pointerType) ? floating : open;
      if (!openCheck) {
        return undefined;
      }

      function cleanup() {
        cleanupListener?.();
        cleanupListener = null;
      }

      const win = ownerWindow(floating);

      function handleMouseMove(event: MouseEvent) {
        const target = getTarget(event) as Element | null;
        if (!contains(floating, target)) {
          setReference(event.clientX, event.clientY);
        } else {
          cleanup();
        }
      }

      if (!dataRef.current.openEvent || isMouseBasedEvent(dataRef.current.openEvent)) {
        win.addEventListener("mousemove", handleMouseMove);
        cleanupListener = () => {
          win.removeEventListener("mousemove", handleMouseMove);
        };
      } else {
        resetReference(domReference);
      }

      return cleanup;
    },
  );

  createEffect(
    () => ({ floating: store.select("floatingElement"), open: store.select("open") }),
    ({ floating, open }) => {
      if (enabled && !floating) {
        initial = false;
      }
      if (!enabled && open) {
        initial = true;
      }
    },
  );

  // Clear virtual cursor references when the interaction owner disposes.
  createEffect(
    () => undefined,
    () => () => {
      store.set("positionReference", null);
    },
  );

  const referenceProps: ClientPointReferenceProps = {
    onPointerDown(event) {
      pointerType = event.pointerType;
    },
    onPointerEnter(event) {
      pointerType = event.pointerType;
    },
    onMouseMove: handleReferenceEnterOrMove,
    onMouseEnter: handleReferenceEnterOrMove,
  };

  const empty = {} as ClientPointReferenceProps;
  const reference = () => (enabled ? referenceProps : empty);
  const trigger = () => (enabled ? referenceProps : empty);

  return { reference, trigger };
}
