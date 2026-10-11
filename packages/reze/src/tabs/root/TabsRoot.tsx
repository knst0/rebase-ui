import { createUniqueId, dynamicElement, effect, getOwner, omitProps, runWithOwner, store, untrack, type JSX } from "reze-js";

import { sortByDocumentPosition, type CompositeItemMetadata, type TextDirection } from "../../internals/composite";
import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { stableCallback } from "../../internals/stableCallback";
import type { ChildrenValue, Orientation as BaseOrientation, RebaseUIComponentProps } from "../../internals/types";
import type { TabsTab, TabsTabActivationDirection, TabsTabMetadata, TabsTabValue } from "../tab/TabsTab";
import { TabsRootContext, useTabsRootContext } from "./TabsRootContext";
import { tabsValueKey } from "./tabsValueKey";

/**
 * Groups the tabs and the corresponding panels.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/tabs)
 */
export function TabsRoot<T extends JSX.ElementType = "div">(props: TabsRoot.Props<T>) {
  const rest = omitProps(props, "as", "defaultValue", "onValueChange", "orientation", "value", "class", "style", "children", "ref");

  const hasExplicitDefaultValue = props.defaultValue !== undefined;
  const initialDefaultValue = props.defaultValue;

  const rootId = createUniqueId();

  // Plain collections outside the store, with a version field each: readers
  // subscribe through the version while sharing the collection identity.
  let tabMap: Map<HTMLElement, CompositeItemMetadata> = new Map();
  let panelElements: HTMLElement[] = [];
  const panelMountCounts = new Map<string, number>();
  const collectionsVersion = store({ tabMap: 0, panels: 0, panelMounts: 0 });

  function currentTabMap(): Map<HTMLElement, CompositeItemMetadata> {
    void collectionsVersion.tabMap;
    return tabMap;
  }

  function currentPanelElements(): HTMLElement[] {
    void collectionsVersion.panels;
    return panelElements;
  }

  function setTabMap(map: Map<HTMLElement, CompositeItemMetadata>): void {
    tabMap = map;
    untrack(() => {
      collectionsVersion.tabMap += 1;
    });
  }

  function orientation(): TabsRoot.Orientation {
    return props.orientation ?? "horizontal";
  }

  function registry(): TabRegistry {
    const map = currentTabMap();
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
  }

  let textDirectionMap: Map<HTMLElement, CompositeItemMetadata> | undefined;
  let textDirection: TextDirection | undefined;

  function getTextDirection(map: Map<HTMLElement, CompositeItemMetadata>, firstElement: HTMLElement | undefined): TextDirection {
    if (textDirection === undefined || textDirectionMap !== map) {
      textDirectionMap = map;
      textDirection =
        firstElement === undefined || typeof getComputedStyle !== "function" || getComputedStyle(firstElement).direction !== "rtl"
          ? "ltr"
          : "rtl";
    }

    return textDirection;
  }

  function computeActivationDirection(
    oldValue: TabsTabValue,
    newValue: TabsTabValue,
    orientationValue: TabsRoot.Orientation,
    current: TabRegistry,
  ): TabsTabActivationDirection {
    if (oldValue == null || newValue == null) {
      return "none";
    }

    const [backward, forward] = orientationValue === "horizontal" ? (["left", "right"] as const) : (["up", "down"] as const);

    const oldTab = current.byValue.get(oldValue);
    const newTab = current.byValue.get(newValue);

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
    const isReversed = orientationValue === "horizontal" && getTextDirection(tabMap, current.firstElement) === "rtl";

    return isLater !== isReversed ? forward : backward;
  }

  const [value, setValue] = createControllableSignal<TabsTabValue>({
    value: () => props.value,
    defaultValue: () => props.defaultValue ?? 0,
    onChange: () => {},
  });

  const isControlled = () => props.value !== undefined;

  const getTabElementBySelectedValue = (selectedValue: TabsTabValue): HTMLElement | null =>
    registry().byValue.get(selectedValue)?.element ?? null;

  const activationStore = store({
    previousValue: untrack(value) as TabsTabValue,
    tabActivationDirection: "none" as TabsTabActivationDirection,
  });

  function tabActivationDirection(): TabsTabActivationDirection {
    return activationStore.tabActivationDirection;
  }

  effect(() => {
    const committedPreviousValue = activationStore.previousValue;
    const committedDirection = activationStore.tabActivationDirection;
    const currentValue = value();
    const current = registry();
    const orientationValue = orientation();

    // The apply half runs one-shot: it only writes the committed activation
    // state, so the writes never resubscribe this effect.
    untrack(() => {
      let direction: TabsTabActivationDirection;
      let nextPreviousValue: TabsTabValue;

      if (committedPreviousValue === currentValue) {
        direction = committedDirection;
        nextPreviousValue = currentValue;
      } else {
        direction = computeActivationDirection(committedPreviousValue, currentValue, orientationValue, current);
        const incomplete = committedPreviousValue != null && currentValue != null && !current.byValue.has(currentValue);
        nextPreviousValue = incomplete ? committedPreviousValue : currentValue;
      }

      if (committedPreviousValue === nextPreviousValue && committedDirection === direction) {
        return;
      }

      activationStore.previousValue = nextPreviousValue;
      activationStore.tabActivationDirection = direction;
    });
  });

  const onValueChangeProp = stableCallback(() => props.onValueChange);

  const onValueChange = (newValue: TabsTabValue, eventDetails: TabsRootChangeEventDetails) => {
    eventDetails.activationDirection = untrack(() => computeActivationDirection(value(), newValue, orientation(), registry()));

    onValueChangeProp(newValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValue(newValue);
  };

  const notifyAutomaticValueChange = (nextValue: TabsTabValue, reason: TabsRootChangeEventReason) => {
    untrack(() => props.onValueChange)?.(
      nextValue,
      createChangeEventDetails(reason, undefined, undefined, {
        activationDirection: "none" as TabsTabActivationDirection,
      }),
    );
  };

  function panelMountCount(key: string): number {
    void collectionsVersion.panelMounts;
    return panelMountCounts.get(key) ?? 0;
  }

  const registerMountedTabPanel = (panelValue: TabsTabValue) => {
    const key = tabsValueKey(panelValue);
    panelMountCounts.set(key, (panelMountCounts.get(key) ?? 0) + 1);
    untrack(() => {
      collectionsVersion.panelMounts += 1;
    });

    return () => {
      panelMountCounts.set(key, (panelMountCounts.get(key) ?? 1) - 1);
      untrack(() => {
        collectionsVersion.panelMounts += 1;
      });
    };
  };

  const registerTabPanelElement = (element: HTMLElement) => {
    untrack(() => {
      panelElements = sortByDocumentPosition(panelElements, element);
      collectionsVersion.panels += 1;
    });

    return () => {
      untrack(() => {
        panelElements = panelElements.filter((current) => current !== element);
        collectionsVersion.panels += 1;
      });
    };
  };

  const getTabPanelIndex = (element: HTMLElement | null) => (element === null ? -1 : currentPanelElements().indexOf(element));

  const getTabPanelId = (tabValue: TabsTabValue) => `${rootId}p${tabsValueKey(tabValue)}`;

  const getTabPanelIdByValue = (tabValue: TabsTabValue) => {
    const key = tabsValueKey(tabValue);
    return panelMountCount(key) > 0 ? `${rootId}p${key}` : undefined;
  };

  const getTabIdByPanelValue = (tabPanelValue: TabsTabValue) => registry().byValue.get(tabPanelValue)?.metadata.id;

  let shouldNotifyInitialValueChange = !hasExplicitDefaultValue;
  let shouldHonorDisabledDefaultValue = hasExplicitDefaultValue;
  let didRegisterTabs = false;
  let lastKnownTabElement: HTMLElement | undefined;

  effect(() => {
    const current = registry();
    const valueNow = value();
    const selected = current.byValue.get(valueNow)?.metadata;
    const inputs = {
      controlled: isControlled(),
      size: current.size,
      firstElement: current.firstElement,
      selectionIsDisabled: selected?.disabled ?? false,
      selectionExists: selected != null,
      fallback: firstEnabledTabValue(current),
      current: valueNow,
    };

    // The apply half runs one-shot: automatic value commits and notifications
    // never resubscribe this effect.
    untrack(() => {
      const { controlled, size, firstElement, selectionIsDisabled, selectionExists, fallback, current } = inputs;

      if (controlled) {
        return;
      }

      const commitAutomaticValueChange = (fallbackValue: TabsTabValue, fallbackReason: TabsRootChangeEventReason) => {
        setValue(fallbackValue);
        activationStore.previousValue = fallbackValue;
        activationStore.tabActivationDirection = "none";
        notifyAutomaticValueChange(fallbackValue, fallbackReason);
        shouldNotifyInitialValueChange = false;
      };

      if (size === 0) {
        if (didRegisterTabs && current !== null && !lastKnownTabElement?.isConnected) {
          commitAutomaticValueChange(null, REASONS.missing);
        }
        return;
      }

      didRegisterTabs = true;
      lastKnownTabElement = firstElement;

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
    });
  });

  function snapshot(): TabsRootState {
    return { orientation: orientation(), tabActivationDirection: tabActivationDirection() };
  }

  const contextValue: TabsRootContext = {
    value,
    onValueChange,
    orientation,
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

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the tabs parts without context. Children
  // resolve in TabsRootContent below so they are created inside the provider.
  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling
  // mounts or unmounts. The default path renders a static `<div>`; only a customized
  // `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        data-orientation={orientation()}
        data-activation-direction={tabActivationDirection()}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        <TabsRootContext value={contextValue}>
          <TabsRootContent>{props.children}</TabsRootContent>
        </TabsRootContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-orientation={orientation()}
      data-activation-direction={tabActivationDirection()}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      <TabsRootContext value={contextValue}>
        <TabsRootContent>{props.children}</TabsRootContent>
      </TabsRootContext>
    </Tag>
  );
}

/**
 * Resolves the root children inside the tabs context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the state changes, matching the Solid layer where the children
 * memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function TabsRootContent(props: { children: ChildrenValue<TabsRootState> }) {
  const children = props.children;

  const { orientation, tabActivationDirection } = useTabsRootContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: TabsRootState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the tabs context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: TabsRootState = { orientation: orientation(), tabActivationDirection: tabActivationDirection() };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

function firstEnabledTabValue(current: TabRegistry): TabsTabValue | undefined {
  for (const entry of current.byValue.values()) {
    if (!entry.metadata.disabled) {
      return entry.metadata.value;
    }
  }
  return undefined;
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
  orientation: TabsRoot.Orientation;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: TabsTab.ActivationDirection;
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

export type TabsRootProps<T extends JSX.ElementType = "div"> = TabsRootOwnProps & RebaseUIComponentProps<T, TabsRootState>;

export type TabsRootChangeEventReason = typeof REASONS.none | typeof REASONS.disabled | typeof REASONS.missing | typeof REASONS.initial;

export type TabsRootChangeEventDetails = RebaseUIChangeEventDetails<
  TabsRootChangeEventReason,
  { activationDirection: TabsTabActivationDirection }
>;

export namespace TabsRoot {
  export type Props<T extends JSX.ElementType = "div"> = TabsRootProps<T>;
  export type OwnProps = TabsRootOwnProps;
  export type State = TabsRootState;
  export type Orientation = TabsRootOrientation;
  export type ChangeEventReason = TabsRootChangeEventReason;
  export type ChangeEventDetails = TabsRootChangeEventDetails;
}
