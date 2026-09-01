import type { ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, untrack } from "solid-js";

import { EMPTY_ARRAY } from "#utils";

import { CompositeRoot, type DisabledIndices } from "../../internals/composite";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { tabsStateAttributesMapping } from "../root/stateAttributesMapping";
import type { TabsRootState } from "../root/TabsRoot";
import { useTabsRootContext } from "../root/TabsRootContext";
import { TabsListContext } from "./TabsListContext";

export function TabsList<T extends ValidComponent = "div">(props: TabsList.Props<T>) {
  const [local, elementProps] = split(props as TabsList.Props, { default: defaultProps }, ["as", "activateOnFocus", "loopFocus"]);

  const as = untrack(() => local.as);

  const rootContext = useTabsRootContext();

  const [highlightedTabIndex, setHighlightedTabIndex] = createSignal(0);
  const [tabsListElement, setTabsListElement] = createSignal<HTMLElement | null>(null);

  const indicatorUpdateListeners = new Set<() => void>();
  const tabResizeObserverElements = new Set<HTMLElement>();
  let resizeObserver: ResizeObserver | null = null;

  createEffect(tabsListElement, (element) => {
    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      for (const listener of indicatorUpdateListeners) {
        listener();
      }
    });

    resizeObserver = observer;

    if (element !== null) {
      observer.observe(element);
    }

    for (const tabElement of tabResizeObserverElements) {
      observer.observe(tabElement);
    }

    return () => {
      observer.disconnect();
      resizeObserver = null;
    };
  });

  const registerIndicatorUpdateListener = (listener: () => void) => {
    indicatorUpdateListeners.add(listener);
    return () => {
      indicatorUpdateListeners.delete(listener);
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
