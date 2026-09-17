import type { ValidComponent } from "@solidjs/web";
import { type Accessor, onCleanup, untrack } from "solid-js";

import type { Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { createTransitionStatus, type TransitionStatus, transitionStatusMapping } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectRootContext } from "../root/SelectRootContext";
import type { SelectInteractionType } from "../store/SelectStore";
import { getMaxScrollOffset, normalizeScrollOffset, SCROLL_EDGE_TOLERANCE_PX } from "../utils/scrollEdges";
/**
 * Shared implementation for the select scroll arrows.
 * @internal
 */
export function SelectScrollArrow<T extends ValidComponent = "div">(props: SelectScrollArrow.Props<T>) {
  const [local, elementProps] = split(props as SelectScrollArrow.Props, { default: defaultProps }, ["as", "direction", "keepMounted"]);

  const as = untrack(() => local.as);
  const isUp = untrack(() => local.direction) === "up";

  const store = useSelectRootContext();

  const stateVisible = () => store.select(isUp ? "scrollUpArrowVisible" : "scrollDownArrowVisible") as boolean;
  const openMethod = () => store.select("openMethod") as SelectInteractionType | null;

  // Scroll arrows are disabled for touch modality as they are a hover-only element.
  const visible = () => stateVisible() && openMethod() !== "touch";
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = {
    isStarted: () => timeoutId !== undefined,
    start: (ms: number, callback: () => void) => {
      timeout.clear();
      timeoutId = setTimeout(() => {
        timeoutId = undefined;
        callback();
      }, ms);
    },
    clear: () => {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    },
  };
  onCleanup(() => {
    clearTimeout(timeoutId);
  });

  let arrowElement: HTMLDivElement | null = null;

  const { mounted, transitionStatus, setMounted } = createTransitionStatus(visible);

  // Counts mounted scroll arrows so the list knows to reserve space for them. Runs with the
  // component (like upstream's layout effect) rather than with the DOM node, which may stay
  // unmounted while `keepMounted` is false.
  store.context.scrollArrowsMountedCountRef.current += 1;
  store.set("hasScrollArrows", true);

  onCleanup(() => {
    store.context.scrollArrowsMountedCountRef.current = Math.max(0, store.context.scrollArrowsMountedCountRef.current - 1);
    if (store.context.scrollArrowsMountedCountRef.current === 0) {
      store.set("hasScrollArrows", false);
    }
  });

  runOnOpenChangeComplete({
    open: visible,
    ref: () => arrowElement,
    onComplete() {
      if (!visible()) {
        setMounted(false);
      }
    },
  });

  function scrollNextItem() {
    const scroller = (store.peek("listElement") as HTMLDivElement | null) ?? store.context.popupRef.current;
    if (!scroller) {
      return;
    }

    store.set("activeIndex", null);
    store.context.handleScrollArrowVisibility(scroller);

    const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
    const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
    const isScrolledToEdge = scrollTop === (isUp ? 0 : maxScrollTop);
    const items = store.context.listRef.current;

    if (scrollTop !== scroller.scrollTop) {
      scroller.scrollTop = scrollTop;
    }

    if (isScrolledToEdge) {
      timeout.clear();
      return;
    }

    if (items.length > 0) {
      const scrollArrowHeight = arrowElement?.offsetHeight || 0;
      scroller.scrollTop = getTargetScrollTop(items, isUp, scrollTop, scroller.clientHeight, scrollArrowHeight, maxScrollTop);
    }

    timeout.start(40, scrollNextItem);
  }

  const state: SelectScrollArrowState = {
    direction: untrack(() => local.direction),
    visible,
    side: () => (store.select("popupSide") as Side | null) ?? "none",
    transitionStatus,
  };

  const stateAttributesMapping = {
    direction: {
      keys: ["data-direction"],
      map: (value: SelectScrollArrowState["direction"]) => ({ "data-direction": value }),
    },
    visible: {
      keys: ["data-visible"],
      map: (value: boolean) => (value ? { "data-visible": "" } : null),
    },
    side: {
      keys: ["data-side"],
      map: (value: Side | "none") => ({ "data-side": value }),
    },
    ...transitionStatusMapping,
  } as StateAttributesMapping<SelectScrollArrowState>;

  const shouldRender = () => local.keepMounted || mounted();

  return (
    <RenderElement
      as={as}
      enabled={shouldRender}
      state={state}
      stateAttributesMapping={stateAttributesMapping}
      props={[
        {
          "aria-hidden": "true" as const,
          children: isUp ? "▲" : "▼",
          get style() {
            return { position: "absolute" as const };
          },
          onMouseMove(event: MouseEvent) {
            if ((event.movementX === 0 && event.movementY === 0) || timeout.isStarted()) {
              return;
            }

            store.set("activeIndex", null);
            timeout.start(40, scrollNextItem);
          },
          onMouseLeave() {
            timeout.clear();
          },
        },
        elementProps,
        {
          ref: (element: HTMLDivElement | null) => {
            arrowElement = element;
          },
        },
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
  keepMounted: false,
} satisfies Partial<SelectScrollArrow.Props>);

export interface SelectScrollArrowState {
  /**
   * The direction of the element.
   */
  direction: "up" | "down";
  /**
   * Whether the element is visible.
   */
  visible: Accessor<boolean>;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Accessor<Side | "none">;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface SelectScrollArrowOwnProps {
  direction: "up" | "down";
  /**
   * Whether to keep the HTML element in the DOM while the select popup is not scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type SelectScrollArrowProps<T extends ValidComponent = "div"> = SelectScrollArrowOwnProps &
  RebaseUIComponentProps<T, SelectScrollArrowState>;

export namespace SelectScrollArrow {
  export type State = SelectScrollArrowState;
  export type Props<T extends ValidComponent = "div"> = SelectScrollArrowProps<T>;
  export type OwnProps = SelectScrollArrowOwnProps;
}

function getTargetScrollTop(
  items: Array<HTMLElement | null>,
  isUp: boolean,
  scrollTop: number,
  clientHeight: number,
  scrollArrowHeight: number,
  maxScrollTop: number,
) {
  if (isUp) {
    let firstVisibleIndex = 0;
    const visibleTop = scrollTop + scrollArrowHeight - SCROLL_EDGE_TOLERANCE_PX;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item && item.offsetTop >= visibleTop) {
        firstVisibleIndex = i;
        break;
      }
    }

    const targetIndex = Math.max(0, firstVisibleIndex - 1);
    const targetItem = items[targetIndex];
    return targetIndex < firstVisibleIndex && targetItem
      ? normalizeScrollOffset(targetItem.offsetTop - scrollArrowHeight, maxScrollTop)
      : 0;
  }

  let lastVisibleIndex = items.length - 1;
  const visibleBottom = scrollTop + clientHeight - scrollArrowHeight + SCROLL_EDGE_TOLERANCE_PX;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item && item.offsetTop + item.offsetHeight > visibleBottom) {
      lastVisibleIndex = Math.max(0, i - 1);
      break;
    }
  }

  const targetIndex = Math.min(items.length - 1, lastVisibleIndex + 1);
  const targetItem = items[targetIndex];
  return targetIndex > lastVisibleIndex && targetItem
    ? normalizeScrollOffset(targetItem.offsetTop + targetItem.offsetHeight - clientHeight + scrollArrowHeight, maxScrollTop)
    : maxScrollTop;
}
