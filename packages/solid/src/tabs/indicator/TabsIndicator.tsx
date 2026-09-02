import { type JSX, type ValidComponent } from "@solidjs/web";
import { type Accessor, createMemo, createSignal, onCleanup, untrack } from "solid-js";

import { script as prehydrationScript } from "#prehydration/tabs/indicator";
import { EMPTY_STATE_MAPPING } from "#utils";

import { PrehydrationScript } from "../../internals/prehydration-script";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { RebaseUIComponentProps } from "../../internals/types";
import { getCssDimensions } from "../../internals/utils/getCssDimensions";
import { useTabsListContext } from "../list/TabsListContext";
import { tabsStateAttributesMapping } from "../root/stateAttributesMapping";
import type { TabsRootState } from "../root/TabsRoot";
import { useTabsRootContext } from "../root/TabsRootContext";
import type { TabsTabPosition, TabsTabSize } from "../tab/TabsTab";
import * as TabsIndicatorCssVars from "./TabsIndicatorCssVars";

export function TabsIndicator<T extends ValidComponent = "span">(props: TabsIndicator.Props<T>) {
  const [local, elementProps] = split(props as TabsIndicator.Props, { default: defaultProps }, ["as", "renderBeforeHydration"]);

  const as = untrack(() => local.as);

  const rootContext = useTabsRootContext();
  const listContext = useTabsListContext();

  const [updateCount, setUpdateCount] = createSignal(0);

  onCleanup(listContext.registerIndicatorUpdateListener(() => setUpdateCount((count) => count + 1)));

  const geometry = createMemo<Geometry>(() => {
    updateCount();

    const value = rootContext.value();
    const tabsListElement = listContext.tabsListElement();

    if (value == null || tabsListElement == null) {
      return NO_GEOMETRY;
    }

    const activeTab = rootContext.getTabElementBySelectedValue(value);

    if (activeTab == null) {
      return NO_GEOMETRY;
    }

    const { width: computedWidth, height: computedHeight } = getCssDimensions(activeTab);
    const { width: tabListWidth, height: tabListHeight } = getCssDimensions(tabsListElement);
    const tabRect = activeTab.getBoundingClientRect();
    const tabsListRect = tabsListElement.getBoundingClientRect();
    const scaleX = tabListWidth > 0 ? tabsListRect.width / tabListWidth : 1;
    const scaleY = tabListHeight > 0 ? tabsListRect.height / tabListHeight : 1;
    const hasNonZeroScale = scaleX > Number.EPSILON && scaleY > Number.EPSILON;

    let left: number;
    let top: number;

    if (hasNonZeroScale) {
      left = (tabRect.left - tabsListRect.left) / scaleX + tabsListElement.scrollLeft - tabsListElement.clientLeft;
      top = (tabRect.top - tabsListRect.top) / scaleY + tabsListElement.scrollTop - tabsListElement.clientTop;
    } else {
      left = activeTab.offsetLeft;
      top = activeTab.offsetTop;
    }

    return {
      isTabSelected: true,
      left,
      top,
      width: computedWidth,
      height: computedHeight,
      right: tabsListElement.scrollWidth - left - computedWidth,
      bottom: tabsListElement.scrollHeight - top - computedHeight,
    };
  });

  const activeTabPosition = createMemo<TabsTabPosition | null>(() => {
    const { isTabSelected, left, right, top, bottom } = geometry();
    return isTabSelected ? { left, right, top, bottom } : null;
  });

  const activeTabSize = createMemo<TabsTabSize | null>(() => {
    const { isTabSelected, width, height } = geometry();
    return isTabSelected ? { width, height } : null;
  });

  const displayIndicator = () => {
    const { isTabSelected, width, height } = geometry();
    return isTabSelected && width > 0 && height > 0;
  };

  const state: TabsIndicatorState = {
    orientation: rootContext.orientation,
    tabActivationDirection: rootContext.tabActivationDirection,
    activeTabPosition,
    activeTabSize,
  };

  const indicatorProps = {
    role: "presentation" as const,
    get style(): JSX.CSSProperties | undefined {
      const { isTabSelected, left, right, top, bottom, width, height } = geometry();

      if (!isTabSelected) {
        return undefined;
      }

      return {
        [TabsIndicatorCssVars.activeTabLeft]: `${left}px`,
        [TabsIndicatorCssVars.activeTabRight]: `${right}px`,
        [TabsIndicatorCssVars.activeTabTop]: `${top}px`,
        [TabsIndicatorCssVars.activeTabBottom]: `${bottom}px`,
        [TabsIndicatorCssVars.activeTabWidth]: `${width}px`,
        [TabsIndicatorCssVars.activeTabHeight]: `${height}px`,
      } as JSX.CSSProperties;
    },
    get hidden() {
      return !displayIndicator();
    },
  };

  const enabled = () => rootContext.value() != null;

  return (
    <>
      <RenderElement
        as={as}
        enabled={enabled}
        state={state}
        props={[indicatorProps, elementProps]}
        stateAttributesMapping={indicatorStateAttributesMapping}
      />
      {local.renderBeforeHydration ? <PrehydrationScript script={prehydrationScript} /> : null}
    </>
  );
}

const defaultProps = Object.freeze({
  as: "span",
  renderBeforeHydration: false,
} satisfies Partial<TabsIndicator.Props>);

const indicatorStateAttributesMapping: StateAttributesMapping<TabsIndicatorState> = {
  ...tabsStateAttributesMapping,
  activeTabPosition: EMPTY_STATE_MAPPING,
  activeTabSize: EMPTY_STATE_MAPPING,
};

const NO_GEOMETRY: Geometry = { isTabSelected: false, left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };

interface Geometry {
  isTabSelected: boolean;
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export interface TabsIndicatorState extends TabsRootState {
  /**
   * The active tab position.
   */
  activeTabPosition: Accessor<TabsTabPosition | null>;
  /**
   * The active tab size.
   */
  activeTabSize: Accessor<TabsTabSize | null>;
}

export interface TabsIndicatorOwnProps {
  /**
   * Whether to render itself before Solid hydrates.
   * This minimizes the time that the indicator is not visible after server-side rendering.
   * @default false
   */
  renderBeforeHydration?: boolean | undefined;
}

export type TabsIndicatorProps<T extends ValidComponent = "span"> = TabsIndicatorOwnProps & RebaseUIComponentProps<T, TabsIndicatorState>;

export namespace TabsIndicator {
  export type Props<T extends ValidComponent = "span"> = TabsIndicatorProps<T>;
  export type OwnProps = TabsIndicatorOwnProps;
  export type State = TabsIndicatorState;
}
