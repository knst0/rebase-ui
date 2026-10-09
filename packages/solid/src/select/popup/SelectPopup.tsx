import type { ClientRectObject } from "@floating-ui/dom";
import { rectToClientRect } from "@floating-ui/utils";
import { clamp } from "@rebase-ui/core/clamp";
import { getMaxScrollOffset } from "@rebase-ui/core/scrollEdges";
import type { JSX, ValidComponent } from "@solidjs/web";
import { createEffect, untrack } from "solid-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { FloatingFocusManager } from "../../internals/floating";
import type { FloatingFocusManagerInteractionType } from "../../internals/floating/components/FloatingFocusManager";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument, ownerWindow } from "../../internals/utils/owner";
import { useSelectPositionerContext } from "../positioner/SelectPositionerContext";
import { transformOrigin as transformOriginVar } from "../positioner/SelectPositionerCssVars";
import { useSelectRootContext, useSelectRootPropsContext } from "../root/SelectRootContext";
import { selectPopupStateMapping } from "../utils/stateAttributesMapping";
import { clearStyles, LIST_FUNCTIONAL_STYLES } from "./utils";

const SCROLL_EDGE_TOLERANCE_PX = 1;

/**
 * A container for the select list.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Select](https://rebase-ui.knst.dev/components/select)
 */
export function SelectPopup<T extends ValidComponent = "div">(props: SelectPopup.Props<T>) {
  const [local, elementProps] = split(props as SelectPopup.Props, { default: defaultProps }, ["as", "finalFocus"]);

  const as = untrack(() => local.as);

  const store = useSelectRootContext();
  const rootProps = useSelectRootPropsContext();
  const positioner = useSelectPositionerContext();

  let reachedMaxHeight = false;
  let initialPlaced = false;
  let originalPositionerStyles: Record<string, string | undefined> = {};
  // Set once aligned placement writes inline positioner styles; only those need restoring. The
  // non-aligned positioner is styled by Floating UI, and restoring the pre-placement `top`/`left`
  // on close would snap the popup to the viewport origin while its exit transition plays.
  let alignedStylesApplied = false;

  function handleScroll(scroller: HTMLDivElement) {
    const positionerElement = store.peek("positionerElement") as HTMLElement | null;
    const popupElement = store.context.popupRef.current;
    if (!positionerElement || !popupElement || !initialPlaced) {
      return;
    }

    const alignActive = store.context.alignItemWithTriggerActiveRef.current;
    const isTopPositioned = positionerElement.style.top === "0px";
    const isBottomPositioned = positionerElement.style.bottom === "0px";

    if (reachedMaxHeight || !alignActive || (!isTopPositioned && !isBottomPositioned)) {
      store.context.handleScrollArrowVisibility(scroller);
      return;
    }

    const scale = getScale(positionerElement);
    const currentHeight = normalizeSize(positionerElement.getBoundingClientRect().height, "y", scale);
    const doc = ownerDocument(positionerElement);
    const win = ownerWindow(positionerElement);
    const positionerStyles = win.getComputedStyle(positionerElement);
    const marginTop = parseFloat(positionerStyles.marginTop);
    const marginBottom = parseFloat(positionerStyles.marginBottom);
    const maxPopupHeight = getMaxPopupHeight(win.getComputedStyle(popupElement));
    const maxAvailableHeight = Math.min(doc.documentElement.clientHeight - marginTop - marginBottom, maxPopupHeight);

    const scrollTop = scroller.scrollTop;
    const maxScrollTop = getMaxScrollTop(scroller);

    // `Infinity` requests a scroll to the recomputed maximum offset.
    let nextScrollTop: number | null = null;

    function setHeight(height: number) {
      positionerElement!.style.height = `${height}px`;
    }

    const diff = isTopPositioned ? maxScrollTop - scrollTop : scrollTop;
    const nextHeight = Math.min(currentHeight + diff, maxAvailableHeight);

    if (diff <= SCROLL_EDGE_TOLERANCE_PX) {
      const heightDelta = clamp(diff, 0, maxAvailableHeight - currentHeight);
      if (heightDelta > 0) {
        // Consume the remaining scroll in height.
        setHeight(currentHeight + heightDelta);
      }
      scroller.scrollTop = isTopPositioned ? maxScrollTop : 0;
      if (maxAvailableHeight - (currentHeight + heightDelta) <= SCROLL_EDGE_TOLERANCE_PX) {
        reachedMaxHeight = true;
      }
      store.context.handleScrollArrowVisibility(scroller);
      return;
    }

    if (maxAvailableHeight - nextHeight > SCROLL_EDGE_TOLERANCE_PX) {
      nextScrollTop = isTopPositioned ? Infinity : 0;
    } else if (isBottomPositioned && scrollTop < maxScrollTop) {
      const overshoot = currentHeight + diff - maxAvailableHeight;
      nextScrollTop = scrollTop - (diff - overshoot);
    }

    const nextPositionerHeight = Math.ceil(nextHeight);

    if (nextPositionerHeight !== 0) {
      setHeight(nextPositionerHeight);
    }

    if (nextScrollTop != null) {
      // Recompute bounds after resizing (clientHeight likely changed).
      const target = clamp(nextScrollTop, 0, getMaxScrollTop(scroller));

      // Avoid adjustments that re-trigger scroll events forever.
      if (Math.abs(scroller.scrollTop - target) > SCROLL_EDGE_TOLERANCE_PX) {
        scroller.scrollTop = target;
      }
    }

    if (nextPositionerHeight >= maxAvailableHeight - SCROLL_EDGE_TOLERANCE_PX) {
      reachedMaxHeight = true;
    }

    store.context.handleScrollArrowVisibility(scroller);
  }

  store.context.scrollHandlerRef.current = handleScroll;

  runOnOpenChangeComplete({
    open: () => store.select("open"),
    ref: () => store.context.popupRef.current,
    onComplete() {
      if (store.peek("open")) {
        store.context.onOpenChangeComplete(true);
      }
    },
  });

  const state: SelectPopupState = {
    get open() {
      return store.select("open");
    },
    get transitionStatus() {
      return store.select("transitionStatus");
    },
    get side() {
      return positioner.side();
    },
    get align() {
      return positioner.align();
    },
  };

  createEffect(
    () => store.select("positionerElement") as HTMLElement | null,
    (positionerElement) => {
      if (!positionerElement || !store.context.popupRef.current || Object.keys(originalPositionerStyles).length > 0) {
        return undefined;
      }

      originalPositionerStyles = {
        top: positionerElement.style.top || "0",
        left: positionerElement.style.left || "0",
        right: positionerElement.style.right,
        height: positionerElement.style.height,
        bottom: positionerElement.style.bottom,
        "min-height": positionerElement.style.minHeight,
        "max-height": positionerElement.style.maxHeight,
        "margin-top": positionerElement.style.marginTop,
        "margin-bottom": positionerElement.style.marginBottom,
      };
      return undefined;
    },
  );

  createEffect(
    () => ({
      open: store.select("open"),
      alignActive: positioner.alignItemWithTriggerActive(),
      positionerElement: store.select("positionerElement") as HTMLElement | null,
    }),
    ({ open, alignActive, positionerElement }) => {
      if (open || alignActive) {
        return undefined;
      }

      initialPlaced = false;
      reachedMaxHeight = false;
      if (alignedStylesApplied) {
        alignedStylesApplied = false;
        clearStyles(positionerElement, originalPositionerStyles);
      }
      return undefined;
    },
  );

  createEffect(
    () => ({
      open: store.select("open"),
      triggerElement: store.select("triggerElement") as HTMLElement | null,
      positionerElement: store.select("positionerElement") as HTMLElement | null,
      alignActive: positioner.alignItemWithTriggerActive(),
      isPositioned: positioner.isPositioned(),
      listElement: store.select("listElement") as HTMLElement | null,
      highlightItemOnHover: rootProps.highlightItemOnHover,
      transitionStatus: store.select("transitionStatus"),
    }),
    (deps) => {
      const popupElement = store.context.popupRef.current;

      // Wait for Floating UI's first positioning pass before reading DOM geometry.
      // We replace the final coordinates for aligned selects, but still need middleware
      // like `size()` to set CSS variables such as `--anchor-width`.
      if (
        !deps.open ||
        !deps.triggerElement ||
        !deps.positionerElement ||
        !popupElement ||
        (deps.alignActive && !deps.isPositioned) ||
        deps.transitionStatus === "ending"
      ) {
        return undefined;
      }

      const { triggerElement, positionerElement, listElement } = deps;

      initialPlaced = true;
      popupElement.style.removeProperty(transformOriginVar);

      if (!deps.alignActive) {
        // The wrapper supplies the scroller: the list owns scrolling once it has mounted, and
        // this effect re-runs (cancelling the stale frame) when that happens.
        const scroller = listElement ?? popupElement;
        const frame = requestAnimationFrame(() => store.context.handleScrollArrowVisibility(scroller));
        return () => cancelAnimationFrame(frame);
      }

      // Ensure we remove any transforms that can affect the location of the popup
      // and therefore the calculations.
      const restoreTransformStyles = unsetTransformStyles(popupElement);

      try {
        let textElement = store.context.selectedItemTextRef.current;

        if (textElement && !textElement.isConnected) {
          textElement = null;
        }

        if (!textElement) {
          const hasSelectedValue = store.peek("hasSelectedValue") as boolean;
          textElement =
            !hasSelectedValue && store.context.firstItemTextRef.current?.isConnected ? store.context.firstItemTextRef.current : null;
        }

        const valueElement = store.context.valueRef.current;

        const win = ownerWindow(positionerElement);
        const positionerStyles = win.getComputedStyle(positionerElement);
        const popupStyles = win.getComputedStyle(popupElement);

        const doc = ownerDocument(triggerElement);
        const direction = doc.documentElement.dir === "rtl" ? "rtl" : "ltr";
        const scale = getScale(triggerElement);
        const triggerRect = normalizeRect(triggerElement.getBoundingClientRect(), scale);

        const positionerRect = normalizeRect(positionerElement.getBoundingClientRect(), scale);
        const triggerHeight = triggerRect.height;
        const scroller = listElement ?? popupElement;
        const scrollHeight = scroller.scrollHeight;

        const borderBottom = parseFloat(popupStyles.borderBottomWidth);
        // The `|| N` fallbacks cover an unset/`auto` value (parses to `NaN`). Note a literal `0`
        // also resolves to the fallback, so an explicit `margin: 0` or `min-height: 0` still takes
        // the default below.
        const marginTop = parseFloat(positionerStyles.marginTop) || 10;
        const marginBottom = parseFloat(positionerStyles.marginBottom) || 10;
        const minHeight = parseFloat(positionerStyles.minHeight) || 100;
        const maxPopupHeight = getMaxPopupHeight(popupStyles);

        const paddingLeft = 5;
        const paddingRight = 5;
        const triggerCollisionThreshold = 20;

        const viewportHeight = doc.documentElement.clientHeight - marginTop - marginBottom;
        const viewportWidth = doc.documentElement.clientWidth;
        const availableSpaceBeneathTrigger = viewportHeight - triggerRect.bottom + triggerHeight;

        let textRect: ClientRectObject | undefined;
        let alignedLeft = direction === "rtl" ? triggerRect.right - positionerRect.width : triggerRect.left;
        let offsetY = 0;

        if (textElement && valueElement) {
          const valueRect = normalizeRect(valueElement.getBoundingClientRect(), scale);
          textRect = normalizeRect(textElement.getBoundingClientRect(), scale);

          alignedLeft = positionerRect.left + (direction === "rtl" ? valueRect.right - textRect.right : valueRect.left - textRect.left);
          const valueCenterFromTriggerTop = valueRect.top - triggerRect.top + valueRect.height / 2;
          const textCenterFromPositionerTop = textRect.top - positionerRect.top + textRect.height / 2;

          offsetY = textCenterFromPositionerTop - valueCenterFromTriggerTop;
        }

        const idealHeight = availableSpaceBeneathTrigger + offsetY + marginBottom + borderBottom;
        const height = Math.min(viewportHeight, idealHeight);
        const maxHeight = viewportHeight - marginTop - marginBottom;
        const scrollTop = idealHeight - height;

        const maxRight = viewportWidth - paddingRight;

        alignedStylesApplied = true;
        positionerElement.style.left = `${clamp(alignedLeft, paddingLeft, maxRight - positionerRect.width)}px`;
        positionerElement.style.height = `${height}px`;
        // `none` (not the invalid `auto`) so the explicit height governs in align mode and isn't
        // clamped by a `max-height` from user CSS.
        positionerElement.style.maxHeight = "none";
        positionerElement.style.marginTop = `${marginTop}px`;
        positionerElement.style.marginBottom = `${marginBottom}px`;
        popupElement.style.height = "100%";

        const maxScrollTop = getMaxScrollTop(scroller);
        const isTopPositioned = scrollTop >= maxScrollTop - SCROLL_EDGE_TOLERANCE_PX;

        let finalHeight = height;
        if (isTopPositioned) {
          finalHeight = Math.min(viewportHeight, positionerRect.height) - (scrollTop - maxScrollTop);
        }

        // When the trigger is too close to the top or bottom of the viewport, or the minHeight is
        // reached, we fallback to aligning the popup to the trigger as the UX is poor otherwise.
        const fallbackToAlignPopupToTrigger =
          triggerRect.top < triggerCollisionThreshold ||
          triggerRect.bottom > viewportHeight - triggerCollisionThreshold ||
          Math.ceil(finalHeight) + SCROLL_EDGE_TOLERANCE_PX < Math.min(scrollHeight, minHeight);

        // Safari doesn't position the popup correctly when pinch-zoomed.
        const isPinchZoomed = (win.visualViewport?.scale ?? 1) !== 1 && isWebKit();

        if (fallbackToAlignPopupToTrigger || isPinchZoomed) {
          clearStyles(positionerElement, originalPositionerStyles);
          positioner.setControlledAlignItemWithTrigger(false);
          return undefined;
        }

        const initialHeight = Math.max(minHeight, finalHeight);

        if (isTopPositioned) {
          const topOffset = Math.max(0, viewportHeight - idealHeight);
          positionerElement.style.top = positionerRect.height >= maxHeight ? "0" : `${topOffset}px`;
          positionerElement.style.height = `${finalHeight}px`;
          scroller.scrollTop = getMaxScrollTop(scroller);
        } else {
          positionerElement.style.bottom = "0";
          scroller.scrollTop = scrollTop;
        }

        if (textRect) {
          const popupTop = positionerRect.top;
          const popupHeight = positionerRect.height;
          const textCenterY = textRect.top + textRect.height / 2;

          const clampedY = clamp(popupHeight > 0 ? ((textCenterY - popupTop) / popupHeight) * 100 : 50, 0, 100);

          popupElement.style.setProperty(transformOriginVar, `50% ${clampedY}%`);
        }

        if (initialHeight === viewportHeight || finalHeight >= maxPopupHeight) {
          reachedMaxHeight = true;
        }

        store.context.handleScrollArrowVisibility(scroller);

        if (
          deps.highlightItemOnHover &&
          store.peek("selectedIndex") === null &&
          store.peek("activeIndex") === null &&
          store.context.listRef.current[0] != null
        ) {
          store.set("activeIndex", 0);
        }
      } finally {
        restoreTransformStyles();
      }
      return undefined;
    },
  );

  createEffect(
    () => ({
      alignActive: positioner.alignItemWithTriggerActive(),
      positionerElement: store.select("positionerElement") as HTMLElement | null,
      open: store.select("open"),
    }),
    ({ alignActive, positionerElement, open }) => {
      if (!alignActive || !positionerElement || !open) {
        return undefined;
      }

      const win = ownerWindow(positionerElement);

      function handleResize(event: UIEvent) {
        store.context.setOpen(false, createChangeEventDetails(REASONS.windowResize, event));
      }

      win.addEventListener("resize", handleResize);
      return () => {
        win.removeEventListener("resize", handleResize);
      };
    },
  );

  const storePopupProps = () => store.select("popupProps") as Record<string, unknown>;

  const defaultPopupProps = {
    get role(): "presentation" | "listbox" {
      return store.select("listElement") ? "presentation" : "listbox";
    },
    get "aria-multiselectable"(): boolean | undefined {
      return !store.select("listElement") && rootProps.multiple ? true : undefined;
    },
    get "aria-readonly"(): boolean | undefined {
      return !store.select("listElement") && rootProps.readOnly ? true : undefined;
    },
    get id(): string | undefined {
      return store.select("listElement") ? undefined : `${store.select("id")}-list`;
    },
    onScroll(event: Event) {
      if (store.peek("listElement")) {
        return;
      }
      handleScroll(event.currentTarget as HTMLDivElement);
    },
    get style(): JSX.CSSProperties | undefined {
      if (!positioner.alignItemWithTriggerActive()) {
        return undefined;
      }
      return (store.select("listElement") ? { height: "100%" } : { ...LIST_FUNCTIONAL_STYLES }) as JSX.CSSProperties;
    },
  };

  const disabledMountTransitionStyles = {
    get style(): JSX.CSSProperties | undefined {
      return store.select("transitionStatus") === "starting" ? ({ transition: "none" } as JSX.CSSProperties) : undefined;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLDivElement>(externalProps.ref, (element: HTMLDivElement | null) => {
      store.context.popupRef.current = element;
    }),
  });

  return (
    <FloatingFocusManager
      context={store.peek("floatingRootContext")}
      modal={false}
      disabled={!store.select("mounted")}
      openInteractionType={store.peek("openMethod") as FloatingFocusManagerInteractionType | null}
      returnFocus={local.finalFocus}
      restoreFocus
    >
      <RenderElement
        as={as}
        state={state}
        props={[storePopupProps, defaultPopupProps, disabledMountTransitionStyles, elementProps, refProps]}
        stateAttributesMapping={selectPopupStateMapping}
      />
    </FloatingFocusManager>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<SelectPopup.Props>);

export interface SelectPopupState {
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | "none";
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export type SelectPopupProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, SelectPopupState> & {
  /**
   * Determines the element to focus when the select popup is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `{ current }`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | boolean
    | { current: HTMLElement | null }
    | ((closeType: FloatingFocusManagerInteractionType) => boolean | HTMLElement | null | void)
    | undefined;
};

export namespace SelectPopup {
  export type State = SelectPopupState;
  export type Props<T extends ValidComponent = "div"> = SelectPopupProps<T>;
}

function getMaxPopupHeight(popupStyles: CSSStyleDeclaration) {
  const maxHeightStyle = popupStyles.maxHeight;
  return maxHeightStyle.endsWith("px") ? parseFloat(maxHeightStyle) || Infinity : Infinity;
}

function getMaxScrollTop(scroller: HTMLElement) {
  return getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
}

function getScale(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const { offsetWidth, offsetHeight } = element;
  return {
    x: offsetWidth > 0 && rect.width > 0 ? Math.round(rect.width) / offsetWidth || 1 : 1,
    y: offsetHeight > 0 && rect.height > 0 ? Math.round(rect.height) / offsetHeight || 1 : 1,
  };
}

function normalizeSize(size: number, axis: "x" | "y", scale: { x: number; y: number }) {
  return size / scale[axis];
}

function normalizeRect(rect: DOMRect | DOMRectReadOnly, scale: { x: number; y: number }): ClientRectObject {
  return rectToClientRect({
    x: normalizeSize(rect.x, "x", scale),
    y: normalizeSize(rect.y, "y", scale),
    width: normalizeSize(rect.width, "x", scale),
    height: normalizeSize(rect.height, "y", scale),
  });
}

function isWebKit() {
  return typeof navigator !== "undefined" && /AppleWebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
}

const TRANSFORM_STYLE_RESETS = [
  ["transform", "none"],
  ["scale", "1"],
  ["translate", "0 0"],
] as const;

type TransformStyleProperty = (typeof TRANSFORM_STYLE_RESETS)[number][0];

function unsetTransformStyles(popupElement: HTMLElement) {
  const { style } = popupElement;
  const originalStyles = {} as Record<TransformStyleProperty, string>;

  for (const [property, value] of TRANSFORM_STYLE_RESETS) {
    originalStyles[property] = style.getPropertyValue(property);
    style.setProperty(property, value, "important");
  }

  return () => {
    for (const [property] of TRANSFORM_STYLE_RESETS) {
      const originalValue = originalStyles[property];
      if (originalValue) {
        style.setProperty(property, originalValue);
      } else {
        style.removeProperty(property);
      }
    }
  };
}
