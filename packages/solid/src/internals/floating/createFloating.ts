import { autoUpdate, computePosition } from "@floating-ui/dom";
import { isElement } from "@floating-ui/utils/dom";
import { createEffect, createSignal, untrack } from "solid-js";

import { FloatingRootStore } from "./tree/FloatingRootStore";
import { useFloatingTree } from "./tree/FloatingTree";
import type {
  ExtendedElements,
  ExtendedRefs,
  FloatingContext,
  Middleware,
  MiddlewareData,
  NarrowedElement,
  Placement,
  ReferenceType,
  Strategy,
  UseFloatingOptions,
  UseFloatingReturn,
  VirtualElement,
} from "./types";
import { useFloatingRootContext } from "./useFloatingRootContext";

/**
 * Provides data to position a floating element and context to add interactions.
 * Solid port of upstream `useFloating`; positioning runs on `@floating-ui/dom`
 * `computePosition`/`autoUpdate` directly instead of the React binding.
 * @see https://floating-ui.com/docs/useFloating
 */
export function createFloating(options: UseFloatingOptions = {}): UseFloatingReturn {
  const internalStore = useFloatingRootContext({
    open: options.open,
    onOpenChange: (open, eventDetails) => options.onOpenChange?.(open, eventDetails),
    elements: options.elements,
  });
  const store = (options.rootContext ?? internalStore) as FloatingRootStore;

  return createFloatingWithStore(options, store);
}

/**
 * Port of Base UI's private `useBaseUIFloating` path. The caller supplies the root
 * store, so this skips the internal root-context hook used by the public API.
 */
export function createBaseUIFloating(options: UseFloatingOptions & { rootContext: FloatingRootStore }): UseFloatingReturn {
  return createFloatingWithStore(options, options.rootContext);
}

function createFloatingWithStore(options: UseFloatingOptions, store: FloatingRootStore): UseFloatingReturn {
  const nodeId = untrack(() => options.nodeId);
  const externalTree = untrack(() => options.externalTree);
  const placement = untrack(() => options.placement ?? "bottom");
  const strategy = untrack(() => options.strategy ?? "absolute");
  const middleware = untrack(() => options.middleware ?? []);
  const platform = untrack(() => options.platform);
  const whileElementsMounted = untrack(() => options.whileElementsMounted ?? autoUpdate);

  const referenceElement = store.useState("referenceElement");
  const floatingElement = store.useState("floatingElement");
  const domReferenceElement = store.useState("domReferenceElement");
  const open = store.useState("open");
  const floatingId = store.useState("floatingId");

  const [positionReference, setPositionReferenceRaw] = createSignal<ReferenceType | null>(null, {
    ownedWrite: true,
  });
  const [localDomReference, setLocalDomReference] = createSignal<NarrowedElement<ReferenceType> | null | undefined>(undefined, {
    ownedWrite: true,
  });
  const [localFloatingElement, setLocalFloatingElement] = createSignal<HTMLElement | null | undefined>(undefined, { ownedWrite: true });

  const domReference: ExtendedRefs["domReference"] = { current: null };

  const tree = useFloatingTree(externalTree);

  const [x, setX] = createSignal(0, { ownedWrite: true });
  const [y, setY] = createSignal(0, { ownedWrite: true });
  const [currentPlacement, setCurrentPlacement] = createSignal<Placement>(placement, {
    ownedWrite: true,
  });
  const [currentStrategy, setCurrentStrategy] = createSignal<Strategy>(strategy, {
    ownedWrite: true,
  });
  const [middlewareData, setMiddlewareData] = createSignal<MiddlewareData>({}, { ownedWrite: true });
  const [isPositioned, setIsPositioned] = createSignal(false, { ownedWrite: true });

  const refs: ExtendedRefs = {
    reference: { current: null },
    floating: { current: null },
    domReference,
    setReference,
    setFloating,
    setPositionReference,
  };

  function update() {
    const reference = refs.reference.current;
    const floating = refs.floating.current;
    if (!reference || !floating) {
      return;
    }

    void computePosition(reference, floating, {
      placement,
      strategy,
      middleware: middleware.filter(Boolean) as Array<Middleware>,
      ...(platform !== undefined ? { platform } : {}),
    }).then(({ x: nextX, y: nextY, placement: nextPlacement, strategy: nextStrategy, middlewareData: nextMiddlewareData }) => {
      // Writes are microtask-batched by the runtime; no explicit batching needed.
      setX(nextX);
      setY(nextY);
      setCurrentPlacement(nextPlacement);
      setCurrentStrategy(nextStrategy);
      setMiddlewareData(nextMiddlewareData);
      setIsPositioned(true);
    });
  }

  // Takes over the synced reference once an element is set locally (e.g. cursor
  // tracking). While unset, nothing is written, so a stale effect apply can never
  // clobber the element synced from the popup store (e.g. the active trigger).
  createEffect(
    () => localDomReference(),
    (local) => {
      if (local === undefined) {
        return undefined;
      }
      store.set("referenceElement", local);
      store.set("domReferenceElement", isElement(local) ? (local as Element) : null);
      return undefined;
    },
  );
  store.useSyncedValue("floatingElement", () => {
    const local = localFloatingElement();
    return local === undefined ? floatingElement() : local;
  });

  function setPositionReference(node: ReferenceType | null) {
    const computedPositionReference = isElement(node)
      ? ({
          getBoundingClientRect: () => node.getBoundingClientRect(),
          getClientRects: () => node.getClientRects(),
          contextElement: node,
        } satisfies VirtualElement)
      : node;
    // Store the positionReference in state if the DOM reference is specified externally via the
    // `elements.reference` option. This ensures that it won't be overridden on future renders.
    setPositionReferenceRaw(computedPositionReference);
    refs.reference.current = computedPositionReference;
  }

  function setReference(node: ReferenceType | null) {
    if (isElement(node) || node === null) {
      domReference.current = node;
      setLocalDomReference(node as NarrowedElement<ReferenceType> | null);
    }

    // Backwards-compatibility for passing a virtual element to `reference`
    // after it has set the DOM reference.
    if (
      isElement(refs.reference.current) ||
      refs.reference.current === null ||
      // Don't allow setting virtual elements using the old technique back to
      // `null` to support `positionReference` + an unstable `reference`
      // callback ref.
      (node !== null && !isElement(node))
    ) {
      refs.reference.current = node;
    }
  }

  function setFloating(node: HTMLElement | null) {
    refs.floating.current = node;
    setLocalFloatingElement(node);
  }

  const elements: ExtendedElements = {
    get reference() {
      return refs.reference.current;
    },
    get floating() {
      return refs.floating.current;
    },
    get domReference() {
      return domReference.current;
    },
  };

  const context: FloatingContext = {
    get x() {
      return x();
    },
    get y() {
      return y();
    },
    get placement() {
      return currentPlacement();
    },
    get strategy() {
      return currentStrategy();
    },
    get middlewareData() {
      return middlewareData();
    },
    get isPositioned() {
      return isPositioned();
    },
    get floatingStyles() {
      return { position: currentStrategy(), top: y(), left: x() };
    },
    update,
    get open() {
      return open();
    },
    onOpenChange: store.setOpen,
    events: store.context.events,
    dataRef: store.context.dataRef,
    nodeId,
    get floatingId() {
      return floatingId();
    },
    refs,
    elements,
    rootStore: store,
  };

  createEffect(
    () => domReferenceElement(),
    (element) => {
      if (element) {
        domReference.current = element as NarrowedElement<ReferenceType> | null;
      }
    },
  );

  createEffect(
    () => open(),
    () => {
      store.context.dataRef.current.floatingContext = context;

      const node = tree?.nodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        node.context = context;
      }
    },
  );

  createEffect(
    () => {
      // Subscribe to every element source; refs mirrors are refreshed in the apply side.
      const reference = positionReference() ?? referenceElement();
      const floating = floatingElement();
      const localReference = localDomReference();
      const localFloating = localFloatingElement();
      void localReference;
      void localFloating;
      return { reference, floating };
    },
    ({ reference, floating }) => {
      refs.reference.current = reference;
      refs.floating.current = floating;
      if (!reference || !floating) {
        setIsPositioned(false);
        return;
      }
      const cleanup = whileElementsMounted(reference, floating, update);
      update();
      return cleanup;
    },
  );

  return {
    get x() {
      return x();
    },
    get y() {
      return y();
    },
    get placement() {
      return currentPlacement();
    },
    get strategy() {
      return currentStrategy();
    },
    get middlewareData() {
      return middlewareData();
    },
    get isPositioned() {
      return isPositioned();
    },
    get floatingStyles() {
      return { position: currentStrategy(), top: y(), left: x() };
    },
    update,
    context,
    refs,
    elements,
  } as UseFloatingReturn;
}

export type { UseFloatingOptions, UseFloatingReturn };
