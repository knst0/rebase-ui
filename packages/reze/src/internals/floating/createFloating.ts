import { autoUpdate, computePosition } from "@floating-ui/dom";
import { isElement } from "@floating-ui/utils/dom";
import { effect, onCleanup, store as createStore, untrack } from "reze-js";

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
  UseFloatingOptions,
  UseFloatingReturn,
  VirtualElement,
} from "./types";
import { useFloatingRootContext } from "./useFloatingRootContext";

/**
 * Provides data to position a floating element and context to add interactions.
 * Reze port of upstream `useFloating`; positioning runs on `@floating-ui/dom`
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
  const placementOption = untrack(() => options.placement ?? "bottom");
  const strategy = untrack(() => options.strategy ?? "absolute");
  const middlewareOption = untrack(() => options.middleware ?? []);
  const platform = untrack(() => options.platform);
  const whileElementsMounted = untrack(() => options.whileElementsMounted ?? autoUpdate);

  // Resolved live so anchor locks feed back into the requested placement. Read untracked:
  // `update` runs from autoUpdate callbacks and effect applies, which must not subscribe.
  function readPlacement(): Placement {
    return untrack(() => (typeof placementOption === "function" ? (placementOption as () => Placement)() : placementOption));
  }

  function readMiddleware(): Array<Middleware> {
    return untrack(() =>
      (typeof middlewareOption === "function"
        ? (middlewareOption as () => Array<Middleware | null | undefined>)()
        : (middlewareOption as Array<Middleware | null | undefined>)
      ).filter(Boolean),
    ) as Array<Middleware>;
  }

  const referenceElement = store.useState("referenceElement");
  const floatingElement = store.useState("floatingElement");
  const domReferenceElement = store.useState("domReferenceElement");
  const open = store.useState("open");
  const floatingId = store.useState("floatingId");

  const state = createStore({
    positionReference: null as ReferenceType | null,
    localDomReference: undefined as NarrowedElement<ReferenceType> | null | undefined,
    localFloatingElement: undefined as HTMLElement | null | undefined,
    x: 0,
    y: 0,
    currentPlacement: readPlacement(),
    currentStrategy: strategy,
    middlewareData: {} as MiddlewareData,
    isPositioned: false,
  });

  const domReference: ExtendedRefs["domReference"] = { current: null };

  const tree = useFloatingTree(externalTree);

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
      placement: readPlacement(),
      strategy,
      middleware: readMiddleware(),
      ...(platform !== undefined ? { platform } : {}),
    }).then(({ x: nextX, y: nextY, placement: nextPlacement, strategy: nextStrategy, middlewareData: nextMiddlewareData }) => {
      // Writes are microtask-batched by the runtime; no explicit batching needed.
      untrack(() => {
        state.x = nextX;
        state.y = nextY;
        state.currentPlacement = nextPlacement;
        state.currentStrategy = nextStrategy;
        state.middlewareData = nextMiddlewareData;
        state.isPositioned = true;
      });
    });
  }

  // Takes over the synced reference once an element is set locally (e.g. cursor
  // tracking). While unset, nothing is written, so a stale effect apply can never
  // clobber the element synced from the popup store (e.g. the active trigger).
  effect(() => {
    const local = state.localDomReference;
    // One-shot sync write: the value only steers this write.
    untrack(() => {
      if (local === undefined) {
        return;
      }
      store.set("referenceElement", local);
      store.set("domReferenceElement", isElement(local) ? (local as Element) : null);
    });
  });
  store.useSyncedValue("floatingElement", () => {
    const local = state.localFloatingElement;
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
    untrack(() => {
      state.positionReference = computedPositionReference;
    });
    refs.reference.current = computedPositionReference;
  }

  function setReference(node: ReferenceType | null) {
    if (isElement(node) || node === null) {
      domReference.current = node;
      untrack(() => {
        state.localDomReference = node as NarrowedElement<ReferenceType> | null;
      });
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
    untrack(() => {
      state.localFloatingElement = node;
    });
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
      return state.x;
    },
    get y() {
      return state.y;
    },
    get placement() {
      return state.currentPlacement;
    },
    get strategy() {
      return state.currentStrategy;
    },
    get middlewareData() {
      return state.middlewareData;
    },
    get isPositioned() {
      return state.isPositioned;
    },
    get floatingStyles() {
      return { position: state.currentStrategy, top: state.y, left: state.x };
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

  effect(() => {
    const element = domReferenceElement();
    // One-shot mirror write: the value only steers the mirror.
    untrack(() => {
      if (element) {
        domReference.current = element as NarrowedElement<ReferenceType> | null;
      }
    });
  });

  effect(() => {
    open();
    // One-shot context registration: the open value only re-arms the links.
    untrack(() => {
      store.context.dataRef.current.floatingContext = context;

      const node = tree?.nodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        node.context = context;
      }
    });
  });

  effect(() => {
    // Subscribe to every element source; refs mirrors are refreshed in the untracked side.
    const reference = state.positionReference ?? referenceElement();
    const floating = floatingElement();
    const localReference = state.localDomReference;
    const localFloating = state.localFloatingElement;
    void localReference;
    void localFloating;
    let cleanup: (() => void) | undefined;
    // One-shot positioning: the values only steer the subscription.
    untrack(() => {
      refs.reference.current = reference;
      refs.floating.current = floating;
      if (!reference || !floating) {
        if (state.isPositioned !== false) {
          state.isPositioned = false;
        }
        return;
      }
      const stop = whileElementsMounted(reference, floating, update);
      update();
      cleanup = stop;
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  return {
    get x() {
      return state.x;
    },
    get y() {
      return state.y;
    },
    get placement() {
      return state.currentPlacement;
    },
    get strategy() {
      return state.currentStrategy;
    },
    get middlewareData() {
      return state.middlewareData;
    },
    get isPositioned() {
      return state.isPositioned;
    },
    get floatingStyles() {
      return { position: state.currentStrategy, top: state.y, left: state.x };
    },
    update,
    context,
    refs,
    elements,
  } as UseFloatingReturn;
}

export type { UseFloatingOptions, UseFloatingReturn };
