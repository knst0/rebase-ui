import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createSignal, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { createTransitionStatus, type TransitionStatus, transitionStatusMapping } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { tabsStateAttributesMapping } from "../root/stateAttributesMapping";
import type { TabsRootState } from "../root/TabsRoot";
import { useTabsRootContext } from "../root/TabsRootContext";
import type { TabsTab } from "../tab/TabsTab";

/**
 * A panel displayed when the corresponding tab is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/tabs)
 */
export function TabsPanel<T extends ValidComponent = "div">(props: TabsPanel.Props<T>) {
  const [local, elementProps] = split(props as TabsPanel.Props, { default: defaultProps }, ["as", "keepMounted", "value"]);

  const as = untrack(() => local.as);

  const {
    value,
    registerTabPanelElement,
    getTabPanelIndex,
    registerMountedTabPanel,
    tabActivationDirection,
    orientation,
    getTabIdByPanelValue,
    getTabPanelId,
  } = useTabsRootContext();

  const [panelElement, setPanelElement] = createSignal<HTMLElement | null>(null);

  const open = createMemo(() => local.value === value());

  const { mounted, setMounted, transitionStatus } = createTransitionStatus(open);

  const hidden = () => !mounted();
  const shouldRender = () => local.keepMounted || mounted();

  const index = () => getTabPanelIndex(panelElement());

  createEffect(
    () => ({ render: shouldRender(), element: panelElement() }),
    ({ render, element }) => {
      if (!render || element === null) {
        return undefined;
      }
      return registerTabPanelElement(element);
    },
  );

  createEffect(
    () => ({ isHidden: hidden(), keepMounted: local.keepMounted, value: local.value }),
    ({ isHidden, keepMounted, value }) => {
      if (isHidden && !keepMounted) {
        return undefined;
      }
      return registerMountedTabPanel(value);
    },
  );

  runOnOpenChangeComplete({
    open,
    ref: panelElement,
    onComplete() {
      if (!open()) {
        setMounted(false);
      }
    },
  });

  const state: TabsPanelState = {
    hidden,
    orientation,
    tabActivationDirection,
    transitionStatus,
  };

  const panelProps = {
    role: "tabpanel" as const,
    get id() {
      return getTabPanelId(local.value);
    },
    get "aria-labelledby"() {
      return getTabIdByPanelValue(local.value);
    },
    get hidden() {
      return hidden();
    },
    get tabIndex() {
      return open() ? 0 : -1;
    },
    get inert() {
      return open() ? undefined : true;
    },
    get "data-index"() {
      return index();
    },
  };

  return (
    <RenderElement
      as={as}
      enabled={shouldRender}
      state={state}
      props={[panelProps, elementProps, { ref: setPanelElement }]}
      stateAttributesMapping={panelStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
  keepMounted: false,
} satisfies Partial<TabsPanel.Props>);

const panelStateAttributesMapping: StateAttributesMapping<TabsPanelState> = {
  ...tabsStateAttributesMapping,
  ...transitionStatusMapping,
};

export interface TabsPanelState extends TabsRootState {
  /**
   * Whether the component is hidden.
   */
  hidden: Accessor<boolean>;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface TabsPanelOwnProps {
  /**
   * The value of the TabPanel. It will be shown when the Tab with the corresponding value is active.
   */
  value: TabsTab.Value;
  /**
   * Whether to keep the HTML element in the DOM while the panel is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type TabsPanelProps<T extends ValidComponent = "div"> = TabsPanelOwnProps & RebaseUIComponentProps<T, TabsPanelState>;

export namespace TabsPanel {
  export type Props<T extends ValidComponent = "div"> = TabsPanelProps<T>;
  export type OwnProps = TabsPanelOwnProps;
  export type State = TabsPanelState;
}
