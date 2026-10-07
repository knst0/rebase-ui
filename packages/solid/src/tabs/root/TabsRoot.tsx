import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createRenderEffect, createSignal, createUniqueId, untrack } from "solid-js";

import { type CompositeItemMetadata, sortByDocumentPosition, type TextDirection } from "../../internals/composite";
import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { Orientation as BaseOrientation, RebaseUIComponentProps } from "../../internals/types";
import type { TabsTab, TabsTabActivationDirection, TabsTabMetadata, TabsTabValue } from "../tab/TabsTab";
import { tabsStateAttributesMapping } from "./stateAttributesMapping";
import { TabsRootContext } from "./TabsRootContext";
import { tabsValueKey } from "./tabsValueKey";

/**
 * Groups the tabs and the corresponding panels.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/tabs)
 */
export function TabsRoot<T extends ValidComponent = "div">(props: TabsRoot.Props<T>) {
  const [local, elementProps] = split(props as TabsRoot.Props, { default: defaultProps }, [
    "as",
    "defaultValue",
    "onValueChange",
    "orientation",
    "value",
  ]);

  const as = untrack(() => local.as);

  const hasExplicitDefaultValue = untrack(() => (props as TabsRoot.Props).defaultValue !== undefined);
  const initialDefaultValue = untrack(() => local.defaultValue);

  const rootId = createUniqueId();

  const [tabMap, setTabMap] = createSignal(new Map<HTMLElement, CompositeItemMetadata>());
  const [panelElements, setPanelElements] = createSignal<HTMLElement[]>([]);

  const registry = createMemo<TabRegistry>(() => {
    const map = tabMap();
    const byValue = new Map<TabsTabValue, TabEntry>();

    let firstElement: HTMLElement | undefined;
    let index = 0;

    for (const [element, rawMetadata] of map) {
      const metadata = rawMetadata as TabsTabMetadata;

      if (index === 0) {
        firstElement = element;
      }

      if (!byValue.has(metadata.value)) {
        byValue.set(metadata.value, { element, metadata, index });
      }

      index += 1;
    }

    return { byValue, size: map.size, firstElement, textDirection: undefined };
  });

  const [value, setValue] = createControllableSignal<TabsTabValue>({
    value: () => local.value,
    defaultValue: () => local.defaultValue,
    onChange: () => {},
  });

  const isControlled = () => local.value !== undefined;

  const getTabElementBySelectedValue = (selectedValue: TabsTabValue): HTMLElement | null =>
    registry().byValue.get(selectedValue)?.element ?? null;

  const [activationDirectionState, setActivationDirectionState] = createSignal<ActivationDirectionState>({
    previousValue: untrack(value),
    tabActivationDirection: "none",
  });

  const activation = createMemo(() => {
    const committed = activationDirectionState();
    const currentValue = value();

    if (committed.previousValue === currentValue) {
      return { direction: committed.tabActivationDirection, nextPreviousValue: currentValue };
    }

    const current = registry();
    const direction = computeActivationDirection(committed.previousValue, currentValue, local.orientation, current);
    const incomplete = committed.previousValue != null && currentValue != null && !current.byValue.has(currentValue);

    return { direction, nextPreviousValue: incomplete ? committed.previousValue : currentValue };
  });

  const tabActivationDirection = () => activation().direction;

  createRenderEffect(activation, (next) => {
    const committed = untrack(activationDirectionState);

    if (committed.previousValue === next.nextPreviousValue && committed.tabActivationDirection === next.direction) {
      return;
    }

    setActivationDirectionState({ previousValue: next.nextPreviousValue, tabActivationDirection: next.direction });
  });

  const onValueChange = (newValue: TabsTabValue, eventDetails: TabsRootChangeEventDetails) => {
    eventDetails.activationDirection = computeActivationDirection(untrack(value), newValue, local.orientation, untrack(registry));

    local.onValueChange?.(newValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValue(newValue);
  };

  const notifyAutomaticValueChange = (nextValue: TabsTabValue, reason: TabsRootChangeEventReason) => {
    untrack(() => local.onValueChange)?.(
      nextValue,
      createChangeEventDetails(reason, undefined, undefined, {
        activationDirection: "none" as TabsTabActivationDirection,
      }),
    );
  };

  const panelMountCounts = new Map<string, ReturnType<typeof createSignal<number>>>();

  const panelMountCount = (key: string) => {
    let signal = panelMountCounts.get(key);
    if (signal === undefined) {
      signal = createSignal(0);
      panelMountCounts.set(key, signal);
    }
    return signal;
  };

  const registerMountedTabPanel = (panelValue: TabsTabValue) => {
    const [, setCount] = panelMountCount(tabsValueKey(panelValue));
    setCount((count) => count + 1);

    return () => {
      setCount((count) => count - 1);
    };
  };

  const registerTabPanelElement = (element: HTMLElement) => {
    setPanelElements((previous) => sortByDocumentPosition(previous, element));

    return () => {
      setPanelElements((previous) => previous.filter((current) => current !== element));
    };
  };

  const getTabPanelIndex = (element: HTMLElement | null) => (element === null ? -1 : panelElements().indexOf(element));

  const getTabPanelId = (tabValue: TabsTabValue) => `${rootId}p${tabsValueKey(tabValue)}`;

  const getTabPanelIdByValue = (tabValue: TabsTabValue) => {
    const key = tabsValueKey(tabValue);
    const [count] = panelMountCount(key);
    return count() > 0 ? `${rootId}p${key}` : undefined;
  };

  const getTabIdByPanelValue = (tabPanelValue: TabsTabValue) => registry().byValue.get(tabPanelValue)?.metadata.id;

  const selectedTabMetadata = createMemo(() => registry().byValue.get(value())?.metadata);

  const firstEnabledTabValue = createMemo(() => {
    for (const metadata of tabMap().values()) {
      if (!(metadata as TabsTabMetadata).disabled) {
        return (metadata as TabsTabMetadata).value;
      }
    }
    return undefined;
  });

  let shouldNotifyInitialValueChange = !hasExplicitDefaultValue;
  let shouldHonorDisabledDefaultValue = hasExplicitDefaultValue;
  let didRegisterTabs = false;
  let lastKnownTabElement: HTMLElement | undefined;

  createEffect(
    () => {
      const selected = selectedTabMetadata();
      return {
        controlled: isControlled(),
        map: registry(),
        selectionIsDisabled: selected?.disabled ?? false,
        selectionExists: selected != null,
        fallback: firstEnabledTabValue(),
        current: value(),
      };
    },
    ({ controlled, map, selectionIsDisabled, selectionExists, fallback, current }) => {
      if (controlled) {
        return;
      }

      const commitAutomaticValueChange = (fallbackValue: TabsTabValue, fallbackReason: TabsRootChangeEventReason) => {
        setValue(fallbackValue);
        setActivationDirectionState({ previousValue: fallbackValue, tabActivationDirection: "none" });
        notifyAutomaticValueChange(fallbackValue, fallbackReason);
        shouldNotifyInitialValueChange = false;
      };

      if (map.size === 0) {
        if (didRegisterTabs && current !== null && !lastKnownTabElement?.isConnected) {
          commitAutomaticValueChange(null, REASONS.missing);
        }
        return;
      }

      didRegisterTabs = true;
      lastKnownTabElement = map.firstElement;

      const selectionIsMissing = !selectionExists && current !== null;

      if (!selectionIsDisabled && current === initialDefaultValue) {
        shouldHonorDisabledDefaultValue = false;
      }

      if (shouldHonorDisabledDefaultValue && selectionIsDisabled && current === initialDefaultValue) {
        return;
      }

      const notifyInitial = shouldNotifyInitialValueChange;

      if (selectionIsDisabled || selectionIsMissing) {
        const fallbackValue = fallback ?? null;

        if (current === fallbackValue) {
          shouldNotifyInitialValueChange = false;
          return;
        }

        let fallbackReason: TabsRootChangeEventReason = REASONS.missing;

        if (notifyInitial) {
          fallbackReason = REASONS.initial;
        } else if (selectionIsDisabled) {
          fallbackReason = REASONS.disabled;
        }

        commitAutomaticValueChange(fallbackValue, fallbackReason);
        return;
      }

      if (notifyInitial && selectionExists) {
        notifyAutomaticValueChange(current, REASONS.initial);
        shouldNotifyInitialValueChange = false;
      }
    },
  );

  const state: TabsRootState = {
    orientation: () => local.orientation,
    tabActivationDirection,
  };

  const contextValue: TabsRootContext = {
    value,
    onValueChange,
    orientation: () => local.orientation,
    tabActivationDirection,
    getTabElementBySelectedValue,
    getTabIdByPanelValue,
    getTabPanelId,
    getTabPanelIdByValue,
    registerMountedTabPanel,
    registerTabPanelElement,
    getTabPanelIndex,
    setTabMap,
  };

  return (
    <TabsRootContext value={contextValue}>
      <RenderElement as={as} state={state} props={[elementProps]} stateAttributesMapping={tabsStateAttributesMapping} />
    </TabsRootContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  defaultValue: 0,
  orientation: "horizontal",
} satisfies Partial<TabsRoot.Props>);

function getTextDirection(registry: TabRegistry): TextDirection {
  if (registry.textDirection === undefined) {
    const element = registry.firstElement;
    registry.textDirection =
      element === undefined || typeof getComputedStyle !== "function" || getComputedStyle(element).direction !== "rtl" ? "ltr" : "rtl";
  }

  return registry.textDirection;
}

function computeActivationDirection(
  oldValue: TabsTabValue,
  newValue: TabsTabValue,
  orientation: TabsRoot.Orientation,
  registry: TabRegistry,
): TabsTabActivationDirection {
  if (oldValue == null || newValue == null) {
    return "none";
  }

  const [backward, forward] = orientation === "horizontal" ? (["left", "right"] as const) : (["up", "down"] as const);

  const oldTab = registry.byValue.get(oldValue);
  const newTab = registry.byValue.get(newValue);

  if (oldTab === undefined || newTab === undefined) {
    if (oldTab !== newTab && (typeof oldValue === "number" || typeof oldValue === "string") && typeof oldValue === typeof newValue) {
      return newValue > oldValue ? forward : backward;
    }
    return "none";
  }

  if (oldTab.index === newTab.index) {
    return "none";
  }

  const isLater = newTab.index > oldTab.index;
  const isReversed = orientation === "horizontal" && getTextDirection(registry) === "rtl";

  return isLater !== isReversed ? forward : backward;
}

interface ActivationDirectionState {
  previousValue: TabsTabValue;
  tabActivationDirection: TabsTabActivationDirection;
}

interface TabEntry {
  element: HTMLElement;
  metadata: TabsTabMetadata;
  index: number;
}

interface TabRegistry {
  byValue: Map<TabsTabValue, TabEntry>;
  size: number;
  firstElement: HTMLElement | undefined;
  textDirection: TextDirection | undefined;
}

export type TabsRootOrientation = BaseOrientation;

export interface TabsRootState {
  /**
   * The component orientation.
   */
  orientation: Accessor<TabsRoot.Orientation>;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: Accessor<TabsTabActivationDirection>;
}

export interface TabsRootOwnProps {
  /**
   * The value of the currently active `Tab`. Use when the component is controlled.
   * When the value is `null`, no Tab will be active.
   */
  value?: TabsTab.Value | undefined;
  /**
   * The default value. Use when the component is not controlled.
   * When the value is `null`, no Tab will be active.
   * @default 0
   */
  defaultValue?: TabsTab.Value | undefined;
  /**
   * The component orientation (layout flow direction).
   * @default 'horizontal'
   */
  orientation?: TabsRoot.Orientation | undefined;
  /**
   * Callback invoked when new value is being set.
   *
   * The event `reason` is `'none'` for user-initiated changes, such as a click
   * or keyboard navigation; `'initial'` for the first automatic selection or
   * fallback in uncontrolled roots when `defaultValue` is omitted or
   * `undefined`, including when the implicit initial value is disabled or
   * missing; `'disabled'` for automatic fallback when the selected tab becomes
   * disabled in uncontrolled roots; or `'missing'` for automatic fallback when
   * the selected tab is removed, or when an explicit `defaultValue` never
   * matches a mounted tab in uncontrolled roots.
   *
   * Automatic changes cannot be canceled; calling `eventDetails.cancel()` for
   * `'initial'`, `'disabled'`, or `'missing'` has no effect.
   */
  onValueChange?: ((value: TabsTab.Value, eventDetails: TabsRoot.ChangeEventDetails) => void) | undefined;
}

export type TabsRootProps<T extends ValidComponent = "div"> = TabsRootOwnProps & RebaseUIComponentProps<T, TabsRootState>;

export type TabsRootChangeEventReason = typeof REASONS.none | typeof REASONS.disabled | typeof REASONS.missing | typeof REASONS.initial;

export type TabsRootChangeEventDetails = RebaseUIChangeEventDetails<
  TabsRootChangeEventReason,
  { activationDirection: TabsTabActivationDirection }
>;

export namespace TabsRoot {
  export type Props<T extends ValidComponent = "div"> = TabsRootProps<T>;
  export type OwnProps = TabsRootOwnProps;
  export type State = TabsRootState;
  export type Orientation = TabsRootOrientation;
  export type ChangeEventReason = TabsRootChangeEventReason;
  export type ChangeEventDetails = TabsRootChangeEventDetails;
}
