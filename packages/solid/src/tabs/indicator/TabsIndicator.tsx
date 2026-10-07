import type { JSX, ValidComponent } from "@solidjs/web";
import { type Accessor, createMemo, createSignal, onCleanup, untrack } from "solid-js";
import { getParentNode, isHTMLElement, isLastTraversableNode } from "@floating-ui/utils/dom";

import { script as prehydrationScript } from "#prehydration/tabs/indicator";
import { EMPTY_STATE_MAPPING } from "#utils/empty";

import { PrehydrationScript } from "../../internals/prehydration-script";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { RebaseUIComponentProps } from "../../internals/types";
import { getCssDimensions } from "../../internals/utils/getCssDimensions";
import { ownerWindow } from "../../internals/utils/owner";
import { useTabsListContext } from "../list/TabsListContext";
import { tabsStateAttributesMapping } from "../root/stateAttributesMapping";
import type { TabsRootState } from "../root/TabsRoot";
import { useTabsRootContext } from "../root/TabsRootContext";
import type { TabsTabPosition, TabsTabSize } from "../tab/TabsTab";
import * as TabsIndicatorCssVars from "./TabsIndicatorCssVars";

/**
 * A visual indicator that can be styled to match the position of the currently active tab.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/tabs)
 */
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

    // Layout offsets are immune to transforms, but lose sub-pixel precision.
    const layoutOffset = getLayoutOffset(activeTab, tabsListElement);
    let left = layoutOffset.left;
    let top = layoutOffset.top;

    const rectLeft =
      (tabRect.left - tabsListRect.left) / scaleX + tabsListElement.scrollLeft - tabsListElement.clientLeft;
    const rectTop =
      (tabRect.top - tabsListRect.top) / scaleY + tabsListElement.scrollTop - tabsListElement.clientTop;

    // The rect-based offset is sub-pixel-precise but is derived from projected viewport
    // geometry: a rotation, skew, flip, perspective, or 3D transform on the tab or any
    // ancestor warps it beyond what the scale division can undo. When it agrees with the
    // layout offset (up to layout rounding), no distortion is in effect and the more
    // precise value is safe to use. A tab list scaled to zero divides by zero just above,
    // and the resulting `NaN`/`Infinity` fails this same check, leaving the layout offset
    // in place — so a degenerate scale needs no guard of its own.
    //
    // The active tab's own translation moves the rect but not the layout offset, so
    // strip it from the comparison. This lets the indicator follow tab-local animations
    // (e.g. `transform: translateX(12px)` on the selected tab) — the indicator is a
    // sibling of the tab and does not inherit its transform.
    const tabTranslation = getActiveTabTranslation(activeTab);
    if (
      Math.abs(rectLeft - tabTranslation.x - left) <= MAX_LAYOUT_ROUNDING_ERROR &&
      Math.abs(rectTop - tabTranslation.y - top) <= MAX_LAYOUT_ROUNDING_ERROR
    ) {
      left = rectLeft;
      top = rectTop;
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
      };
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

// `offsetLeft`/`offsetTop` are rounded to whole pixels and the error can compound
// across the offset parent chain.
const MAX_LAYOUT_ROUNDING_ERROR = 2;

function getLayoutOffset(element: HTMLElement, ancestor: HTMLElement) {
  const elementOffset = getCumulativeOffset(element);
  const ancestorOffset = getCumulativeOffset(ancestor);

  let left = elementOffset.left - ancestorOffset.left - ancestor.clientLeft;
  let top = elementOffset.top - ancestorOffset.top - ancestor.clientTop;

  // `offsetLeft`/`offsetTop` describe layout, and scrolling doesn't change layout: a scroll
  // container between the tab and the list moves the tab on screen while its layout slot stays
  // put. Subtract that scroll so this offset remains comparable with the rect-based one below —
  // otherwise the difference reads as transform distortion, the rect offset is rejected, and the
  // indicator is left behind by the full scroll amount. The list's own scroll is deliberately
  // excluded: the indicator sits inside it and scrolls along with the tab.
  //
  // `getParentNode` crosses shadow boundaries (and slots), so a tab inside a shadow root still
  // reaches the scroll containers between it and the list.
  let node: Node | null = getParentNode(element);
  while (isHTMLElement(node) && node !== ancestor && !isLastTraversableNode(node)) {
    left -= node.scrollLeft;
    top -= node.scrollTop;
    node = getParentNode(node);
  }

  return { left, top };
}

function getCumulativeOffset(element: HTMLElement) {
  let left = 0;
  let top = 0;
  let currentElement: HTMLElement | null = element;

  while (currentElement != null) {
    left += currentElement.offsetLeft;
    top += currentElement.offsetTop;

    const offsetParent = currentElement.offsetParent as HTMLElement | null;
    if (offsetParent != null) {
      left += offsetParent.clientLeft;
      top += offsetParent.clientTop;
    }

    currentElement = offsetParent;
  }

  return { left, top };
}

/**
 * Extracts the 2D translation and scale from the element's computed `transform` matrix.
 * Note that the `translate`, `rotate`, and `scale` longhands are separate properties and
 * are not reflected in the computed `transform` value.
 *
 * Pass `computedStyle` when the caller has already resolved it to avoid a second lookup.
 */
function getElementTransform(element: HTMLElement, computedStyle?: CSSStyleDeclaration) {
  const transform = (computedStyle ?? ownerWindow(element).getComputedStyle(element)).transform;
  let translateX = 0;
  let translateY = 0;
  let scale = 1;

  if (transform && transform !== "none") {
    const matrix = transform.match(/matrix(?:3d)?\(([^)]+)\)/);
    if (matrix) {
      const values = matrix[1].split(", ").map(parseFloat);
      if (values.length === 6) {
        translateX = values[4];
        translateY = values[5];
        scale = Math.sqrt(values[0] * values[0] + values[1] * values[1]);
      } else if (values.length === 16) {
        translateX = values[12];
        translateY = values[13];
        scale = values[0];
      }
    }
  }

  return { x: translateX, y: translateY, scale };
}

// Returns the active tab's own 2D translation, in CSS pixels: the translation component of
// the computed `transform` matrix plus the `translate` longhand. CSS composes the two as
// `translate → rotate → scale → transform`, so adding them is only exact when no rotation or
// scale is in play. That is enough here: with either of those present the caller's agreement
// check rejects the rect-based offset regardless of the translation, and the tab's layout
// slot is used instead.
function getActiveTabTranslation(element: HTMLElement) {
  const computedStyle = ownerWindow(element).getComputedStyle(element);
  const { x, y } = getElementTransform(element, computedStyle);
  let translateX = x;
  let translateY = y;

  // The `translate` longhand is a separate property and is not reflected in the
  // computed `transform` matrix that `getElementTransform` reads. `getComputedStyle`
  // resolves absolute and font-relative lengths to pixels but keeps percentages, which
  // resolve against the tab's border box.
  const { translate } = computedStyle;
  if (translate && translate !== "none") {
    const parts = translate.split(" ");
    translateX += resolveTranslateLength(parts[0], element.offsetWidth);
    translateY += resolveTranslateLength(parts[1], element.offsetHeight);
  }

  return { x: translateX, y: translateY };
}

// Resolves a single `translate` longhand component to pixels. Percentages resolve against
// the given border-box size; anything that isn't a plain number or percentage (e.g.
// `calc(...)`) is treated as no translation, so the indicator falls back to the tab's
// layout slot rather than guessing.
function resolveTranslateLength(value: string | undefined, referenceSize: number): number {
  if (!value) {
    return 0;
  }
  const numeric = parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return value.endsWith("%") ? (numeric / 100) * referenceSize : numeric;
}
