import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createRenderEffect, createSignal, untrack } from "solid-js";

import { type CompositeItemMetadata, sortByDocumentPosition } from "../../internals/composite";
import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { Orientation as BaseOrientation, RebaseUIComponentProps } from "../../internals/types";
import { TabsTab, type TabsTabActivationDirection, type TabsTabMetadata, type TabsTabValue } from "../tab/TabsTab";
import { tabsStateAttributesMapping } from "./stateAttributesMapping";
import { TabsRootContext } from "./TabsRootContext";

interface ActivationDirectionState {
  previousValue: TabsTabValue;
  tabActivationDirection: TabsTabActivationDirection;
}

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

  const [tabMap, setTabMap] = createSignal(new Map<HTMLElement, CompositeItemMetadata>());
  const [mountedTabPanels, setMountedTabPanels] = createSignal(new Map<TabsTabValue, string>());
  const [panelElements, setPanelElements] = createSignal<HTMLElement[]>([]);

  const [value, setValue] = createControllableSignal<TabsTabValue>({
    value: () => local.value,
    defaultValue: () => local.defaultValue,
    onChange: () => {},
  });

  const isControlled = () => local.value !== undefined;

  const getTabElementBySelectedValue = (selectedValue: TabsTabValue): HTMLElement | null => findTabElement(tabMap(), selectedValue);

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

    const map = tabMap();
    const direction = computeActivationDirection(committed.previousValue, currentValue, local.orientation, map);
    const incomplete = committed.previousValue != null && currentValue != null && findTabElement(map, currentValue) == null;

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
    eventDetails.activationDirection = computeActivationDirection(untrack(value), newValue, local.orientation, untrack(tabMap));

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

  const registerMountedTabPanel = (panelValue: TabsTabValue, panelId: string) => {
    setMountedTabPanels((previous) => {
      const next = new Map(previous);
      next.set(panelValue, panelId);
      return next;
    });

    return () => {
      setMountedTabPanels((previous) => {
        if (previous.get(panelValue) !== panelId) {
          return previous;
        }
        const next = new Map(previous);
        next.delete(panelValue);
        return next;
      });
    };
  };

  const registerTabPanelElement = (element: HTMLElement) => {
    setPanelElements((previous) => sortByDocumentPosition(previous, element));

    return () => {
      setPanelElements((previous) => previous.filter((current) => current !== element));
    };
  };

  const getTabPanelIndex = (element: HTMLElement | null) => (element === null ? -1 : panelElements().indexOf(element));

  const getTabPanelIdByValue = (tabValue: TabsTabValue) => mountedTabPanels().get(tabValue);

  const getTabIdByPanelValue = (tabPanelValue: TabsTabValue) => {
    for (const metadata of tabMap().values()) {
      if (tabPanelValue === (metadata as TabsTabMetadata).value) {
        return (metadata as TabsTabMetadata).id;
      }
    }
    return undefined;
  };

  const selectedTabMetadata = createMemo(() => {
    const currentValue = value();
    for (const metadata of tabMap().values()) {
      if ((metadata as TabsTabMetadata).value === currentValue) {
        return metadata as TabsTabMetadata;
      }
    }
    return undefined;
  });

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
        map: tabMap(),
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
      lastKnownTabElement = map.keys().next().value;

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

function findTabElement(tabMap: Map<HTMLElement, CompositeItemMetadata>, value: TabsTabValue): HTMLElement | null {
  for (const [tabElement, metadata] of tabMap.entries()) {
    if (value === (metadata as TabsTabMetadata).value) {
      return tabElement;
    }
  }

  return null;
}

function computeActivationDirection(
  oldValue: TabsTabValue,
  newValue: TabsTabValue,
  orientation: TabsRoot.Orientation,
  tabMap: Map<HTMLElement, CompositeItemMetadata>,
): TabsTabActivationDirection {
  if (oldValue == null || newValue == null) {
    return "none";
  }

  const [positionProp, backward, forward] =
    orientation === "horizontal" ? (["left", "left", "right"] as const) : (["top", "up", "down"] as const);

  const oldTab = findTabElement(tabMap, oldValue);
  const newTab = findTabElement(tabMap, newValue);

  if (oldTab == null || newTab == null) {
    if (oldTab !== newTab && (typeof oldValue === "number" || typeof oldValue === "string") && typeof oldValue === typeof newValue) {
      return newValue > oldValue ? forward : backward;
    }
    return "none";
  }

  const oldPosition = oldTab.getBoundingClientRect()[positionProp];
  const newPosition = newTab.getBoundingClientRect()[positionProp];

  if (newPosition < oldPosition) {
    return backward;
  }
  if (newPosition > oldPosition) {
    return forward;
  }

  return "none";
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
