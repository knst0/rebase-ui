import type { ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, onCleanup, untrack } from "solid-js";

import { EMPTY_ARRAY } from "#utils/empty";

import { CompositeRoot, type DisabledIndices } from "../../internals/composite";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { tabsStateAttributesMapping } from "../root/stateAttributesMapping";
import type { TabsRootState } from "../root/TabsRoot";
import { useTabsRootContext } from "../root/TabsRootContext";
import { TabsListContext } from "./TabsListContext";

/**
 * Groups the individual tab buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/tabs)
 */
export function TabsList<T extends ValidComponent = "div">(props: TabsList.Props<T>) {
  const [local, elementProps] = split(props as TabsList.Props, { default: defaultProps }, ["as", "activateOnFocus", "loopFocus"]);

  const as = untrack(() => local.as);

  const rootContext = useTabsRootContext();

  const [highlightedTabIndex, setHighlightedTabIndex] = createSignal(0);
  const [tabsListElement, setTabsListElement] = createSignal<HTMLElement | null>(null);

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

  createEffect(tabsListElement, (element) => {
    if (element === null) {
      return undefined;
    }

    connectResizeObserver();
    resizeObserver?.observe(element);

    return () => {
      resizeObserver?.unobserve(element);
    };
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

  const state: TabsListState = {
    orientation: rootContext.orientation,
    tabActivationDirection: rootContext.tabActivationDirection,
  };

  const listProps = {
    role: "tablist" as const,
    get "aria-orientation"() {
      return rootContext.orientation() === "vertical" ? "vertical" : undefined;
    },
  };

  const contextValue: TabsListContext = {
    activateOnFocus: () => local.activateOnFocus,
    registerIndicatorUpdateListener,
    registerTabResizeObserverElement,
    tabsListElement,
  };

  return (
    <TabsListContext value={contextValue}>
      <CompositeRoot
        as={as}
        state={state}
        props={[listProps, elementProps]}
        stateAttributesMapping={tabsStateAttributesMapping}
        ref={setTabsListElement}
        highlightedIndex={highlightedTabIndex()}
        onHighlightedIndexChange={setHighlightedTabIndex}
        onMapChange={rootContext.setTabMap}
        orientation={rootContext.orientation()}
        loopFocus={local.loopFocus}
        disabledIndices={EMPTY_ARRAY as DisabledIndices}
        enableHomeAndEndKeys
      />
    </TabsListContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  activateOnFocus: false,
  loopFocus: true,
} satisfies Partial<TabsList.Props>);

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

export type TabsListProps<T extends ValidComponent = "div"> = TabsListOwnProps & RebaseUIComponentProps<T, TabsListState>;

export namespace TabsList {
  export type Props<T extends ValidComponent = "div"> = TabsListProps<T>;
  export type OwnProps = TabsListOwnProps;
  export type State = TabsListState;
}
