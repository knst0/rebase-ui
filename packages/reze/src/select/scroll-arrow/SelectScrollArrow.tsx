import { getMaxScrollOffset, normalizeScrollOffset, SCROLL_EDGE_TOLERANCE_PX } from "@rebase-ui/core/scrollEdges";
import { dynamicElement, omitProps, onCleanup, store as createStore, untrack, type JSX } from "reze-js";

import type { Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectRootContext } from "../root/SelectRootContext";
import type { SelectInteractionType } from "../store/SelectStore";
/**
 * Shared implementation for the select scroll arrows.
 * @internal
 */
export function SelectScrollArrow<T extends JSX.ElementType = "div">(props: SelectScrollArrow.Props<T>) {
  const rest = omitProps(props, "as", "direction", "keepMounted", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const isUp = untrack(() => props.direction) === "up";

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

  const transition = createStore({ mounted: false, transitionStatus: undefined as TransitionStatus });

  function setMounted(next: boolean): void {
    if (transition.mounted !== next) {
      transition.mounted = next;
    }
  }

  function setTransitionStatus(next: TransitionStatus): void {
    if (transition.transitionStatus !== next) {
      transition.transitionStatus = next;
    }
  }

  createTransitionStatus({
    open: visible,
    mounted: () => transition.mounted,
    transitionStatus: () => transition.transitionStatus,
    setMounted,
    setTransitionStatus,
  });

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

  function snapshot(): SelectScrollArrowState {
    return {
      direction: untrack(() => props.direction),
      visible: visible(),
      side: (store.select("popupSide") as Side | null) ?? "none",
      transitionStatus: transition.transitionStatus,
    };
  }

  function shouldRender(): boolean {
    return props.keepMounted === true || transition.mounted;
  }

  function handleMouseMove(event: MouseEvent): void {
    if ((event.movementX === 0 && event.movementY === 0) || timeout.isStarted()) {
      return;
    }

    store.set("activeIndex", null);
    timeout.start(40, scrollNextItem);
  }

  function handleMouseLeave(): void {
    timeout.clear();
  }

  function ref(element: HTMLDivElement | null): void {
    arrowElement = element;
    (props.ref as ((element: HTMLDivElement | null) => void) | undefined)?.(element);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts, which would restart the arrow's transition. The default path renders a static
  // `<div>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {shouldRender() && (
          <div
            {...(rest as Record<string, unknown>)}
            aria-hidden="true"
            data-direction={untrack(() => props.direction)}
            data-visible={visible() ? "" : undefined}
            data-side={(store.select("popupSide") as Side | null) ?? "none"}
            data-starting-style={transition.transitionStatus === "starting" ? "" : undefined}
            data-ending-style={transition.transitionStatus === "ending" ? "" : undefined}
            class={resolveClassValue(props.class, snapshot())}
            style={mergeStyleValue({ position: "absolute" }, resolveStyleValue(props.style, snapshot()))}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            ref={ref}
          >
            {resolveChildrenValue(children ?? (isUp ? "▲" : "▼"), snapshot)}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {shouldRender() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          aria-hidden="true"
          data-direction={untrack(() => props.direction)}
          data-visible={visible() ? "" : undefined}
          data-side={(store.select("popupSide") as Side | null) ?? "none"}
          data-starting-style={transition.transitionStatus === "starting" ? "" : undefined}
          data-ending-style={transition.transitionStatus === "ending" ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={mergeStyleValue({ position: "absolute" }, resolveStyleValue(props.style, snapshot()))}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          ref={ref}
        >
          {resolveChildrenValue(children ?? (isUp ? "▲" : "▼"), snapshot)}
        </Tag>
      )}
    </>
  );
}

export interface SelectScrollArrowState {
  /**
   * The direction of the element.
   */
  direction: "up" | "down";
  /**
   * Whether the element is visible.
   */
  visible: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | "none";
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectScrollArrowOwnProps {
  direction: "up" | "down";
  /**
   * Whether to keep the HTML element in the DOM while the select popup is not scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type SelectScrollArrowProps<T extends JSX.ElementType = "div"> = SelectScrollArrowOwnProps &
  RebaseUIComponentProps<T, SelectScrollArrowState>;

export namespace SelectScrollArrow {
  export type State = SelectScrollArrowState;
  export type Props<T extends JSX.ElementType = "div"> = SelectScrollArrowProps<T>;
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
