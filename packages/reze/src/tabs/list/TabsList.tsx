import { dynamicElement, effect, getOwner, omitProps, onCleanup, runWithOwner, store, untrack, type JSX } from "reze-js";

import { CompositeRootContext, useCompositeRoot, type DisabledIndices } from "../../internals/composite";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import type { TabsRootState } from "../root/TabsRoot";
import { TabsRootContext, useTabsRootContext } from "../root/TabsRootContext";
import { TabsListContext } from "./TabsListContext";

const EMPTY_DISABLED_INDICES: DisabledIndices = [];

/**
 * Groups the individual tab buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/tabs)
 */
export function TabsList<T extends JSX.ElementType = "div">(props: TabsList.Props<T>) {
  const rest = omitProps(props, "as", "activateOnFocus", "loopFocus", "class", "style", "children", "ref", "onKeyDown", "onFocus");

  const rootContext = useTabsRootContext();

  const highlightStore = store({ index: 0 });
  const listElementStore = store({ element: null as HTMLElement | null });

  function tabsListElement(): HTMLElement | null {
    return listElementStore.element;
  }

  function setTabsListElement(element: HTMLElement | null): void {
    listElementStore.element = element;
  }

  const {
    contextValue: compositeContextValue,
    getRootProps,
    rootRef: compositeRootRef,
  } = useCompositeRoot({
    orientation: () => rootContext.orientation(),
    loopFocus: () => props.loopFocus ?? true,
    enableHomeAndEndKeys: true,
    highlightedIndex: () => highlightStore.index,
    onHighlightedIndexChange: (index) => {
      highlightStore.index = index;
    },
    disabledIndices: () => EMPTY_DISABLED_INDICES,
    onMapChange: (map) => rootContext.setTabMap(map),
  });

  const indicatorUpdateListeners = new Set<() => void>();
  const tabResizeObserverElements = new Set<HTMLElement>();
  let resizeObserver: ResizeObserver | null = null;
  let pendingFrame: number | undefined;

  const notifyIndicatorUpdate = () => {
    if (pendingFrame !== undefined) {
      return;
    }

    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = undefined;
      for (const listener of indicatorUpdateListeners) {
        listener();
      }
    });
  };

  const disconnectResizeObserver = () => {
    if (pendingFrame !== undefined) {
      cancelAnimationFrame(pendingFrame);
      pendingFrame = undefined;
    }
    resizeObserver?.disconnect();
    resizeObserver = null;
  };

  const connectResizeObserver = () => {
    if (resizeObserver !== null || indicatorUpdateListeners.size === 0 || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(notifyIndicatorUpdate);
    resizeObserver = observer;

    const element = untrack(tabsListElement);
    if (element !== null) {
      observer.observe(element);
    }

    for (const tabElement of tabResizeObserverElements) {
      observer.observe(tabElement);
    }
  };

  effect(() => {
    const element = tabsListElement();

    if (element === null) {
      return;
    }

    connectResizeObserver();
    resizeObserver?.observe(element);

    onCleanup(() => {
      resizeObserver?.unobserve(element);
    });
  });

  onCleanup(disconnectResizeObserver);

  const registerIndicatorUpdateListener = (listener: () => void) => {
    indicatorUpdateListeners.add(listener);
    connectResizeObserver();

    return () => {
      indicatorUpdateListeners.delete(listener);
      if (indicatorUpdateListeners.size === 0) {
        disconnectResizeObserver();
      }
    };
  };

  const registerTabResizeObserverElement = (element: HTMLElement) => {
    tabResizeObserverElements.add(element);
    resizeObserver?.observe(element);

    return () => {
      tabResizeObserverElements.delete(element);
      resizeObserver?.unobserve(element);
    };
  };

  function activateOnFocus(): boolean {
    return props.activateOnFocus ?? false;
  }

  function snapshot(): TabsListState {
    return { orientation: rootContext.orientation(), tabActivationDirection: rootContext.tabActivationDirection() };
  }

  // Live external props: getters keep the merged handlers reactive to prop changes.
  const externalProps: Record<string, any> = {};
  Object.defineProperty(externalProps, "onKeyDown", {
    enumerable: true,
    configurable: true,
    get: () => props.onKeyDown,
  });
  Object.defineProperty(externalProps, "onFocus", {
    enumerable: true,
    configurable: true,
    get: () => props.onFocus,
  });
  const rootProps = getRootProps(externalProps);

  const contextValue: TabsListContext = {
    activateOnFocus,
    registerIndicatorUpdateListener,
    registerTabResizeObserverElement,
    tabsListElement,
  };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  const ref = mergeRefs(compositeRootRef, setTabsListElement, props.ref as ((element: HTMLElement | null) => void) | undefined);

  // The providers live inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the tabs parts without context. Children
  // resolve in TabsListContent below so they are created inside the providers.
  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling
  // mounts or unmounts, which would drop the composite's focus and listeners. The
  // default path renders a static `<div>`; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="tablist"
        aria-orientation={rootContext.orientation() === "vertical" ? "vertical" : undefined}
        data-orientation={rootContext.orientation()}
        data-activation-direction={rootContext.tabActivationDirection()}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onKeyDown={rootProps.onKeyDown}
        onFocus={rootProps.onFocus}
        ref={ref}
      >
        <CompositeRootContext value={compositeContextValue}>
          <TabsListContext value={contextValue}>
            <TabsListContent>{props.children}</TabsListContent>
          </TabsListContext>
        </CompositeRootContext>
      </div>
    );
  }

  // The dynamic tag is an owner boundary: unlike the static branch above, children
  // created inside it cannot see the root context from above. Re-provide it here so
  // tabs and the indicator resolve identically in both branches.
  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="tablist"
      aria-orientation={rootContext.orientation() === "vertical" ? "vertical" : undefined}
      data-orientation={rootContext.orientation()}
      data-activation-direction={rootContext.tabActivationDirection()}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onKeyDown={rootProps.onKeyDown}
      onFocus={rootProps.onFocus}
      ref={ref}
    >
      <TabsRootContext value={rootContext}>
        <CompositeRootContext value={compositeContextValue}>
          <TabsListContext value={contextValue}>
            <TabsListContent>{props.children}</TabsListContent>
          </TabsListContext>
        </CompositeRootContext>
      </TabsRootContext>
    </Tag>
  );
}

/**
 * Resolves the list children inside the tabs list context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the state changes, matching the Solid layer where the children
 * memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function TabsListContent(props: { children: ChildrenValue<TabsListState> }) {
  const children = props.children;

  const { orientation, tabActivationDirection } = useTabsRootContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: TabsListState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the tabs contexts (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: TabsListState = { orientation: orientation(), tabActivationDirection: tabActivationDirection() };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface TabsListState extends TabsRootState {}

export interface TabsListOwnProps {
  /**
   * Whether to automatically change the active tab on arrow key focus.
   * Otherwise, tabs will be activated using <kbd>Enter</kbd> or <kbd>Space</kbd> key press.
   * @default false
   */
  activateOnFocus?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export type TabsListProps<T extends JSX.ElementType = "div"> = TabsListOwnProps & RebaseUIComponentProps<T, TabsListState>;

export namespace TabsList {
  export type Props<T extends JSX.ElementType = "div"> = TabsListProps<T>;
  export type OwnProps = TabsListOwnProps;
  export type State = TabsListState;
}
