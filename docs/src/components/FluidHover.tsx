import type { JSX } from "@solidjs/web";
import { createEffect, createSignal, onCleanup, onSettled, untrack, type Accessor } from "solid-js";

/**
 * Fluid hover (https://www.fluidfunctionalism.com/docs/fluid-hover): one highlight per list that
 * follows the pointer to the nearest item and never blinks between rows.
 */

export type ItemRect = { top: number; left: number; width: number; height: number };

type Axis = "x" | "y" | "xy";

export type FluidHoverOptions = {
  /** `y` for lists, `x` for strips, `xy` for grids. */
  axis?: Axis;
  /** Items of the list, in hit-testing order. */
  itemSelector?: string;
};

export type FluidHover = {
  /** Container ref; the container must be `position: relative` (the highlight's offset parent). */
  ref: (element: HTMLElement) => void;
  handlers: {
    onMouseEnter: () => void;
    onMouseMove: (event: MouseEvent) => void;
    onMouseLeave: () => void;
    onClick: (event: MouseEvent) => void;
  };
  /** Rect of the lit item, or `null`; only set once every item has been measured. */
  activeRect: Accessor<ItemRect | null>;
  /** Rect of the first item matching `selector`, for a fresh entry to fade in from. */
  rectOf: (selector: string) => ItemRect | null;
};

export const ACTIVE_ATTR = "data-fluid-hover-active";

const ACTIVATOR_SELECTOR =
  "a[href], button, [role='menuitem'], [role='menuitemradio'], [role='menuitemcheckbox'], [role='option'], [role='radio'], [role='checkbox'], [role='tab'], [role='link'], [role='button']";

const CONTROL_SELECTOR =
  "input, textarea, select, button, a, summary, [contenteditable], [role='textbox'], [role='searchbox'], [role='button']";

/**
 * An item the pointer is inside always wins; otherwise the item whose center is nearest does, so a
 * pointer in a gap, in the padding, or past the last row still lands. Ties keep the first item.
 */
function pickNearest(axis: Axis, point: { x: number; y: number }, rects: readonly ItemRect[], container: HTMLElement): number | null {
  const bounds = container.getBoundingClientRect();
  const scaleX = container.offsetWidth > 0 ? bounds.width / container.offsetWidth : 1;
  const scaleY = container.offsetHeight > 0 ? bounds.height / container.offsetHeight : 1;
  const originX = bounds.left + (container.clientLeft - container.scrollLeft) * scaleX;
  const originY = bounds.top + (container.clientTop - container.scrollTop) * scaleY;
  let closest: number | null = null;
  let closestDistance = Infinity;
  let containing: number | null = null;

  rects.forEach((rect, index) => {
    const left = originX + rect.left * scaleX;
    const top = originY + rect.top * scaleY;
    const width = rect.width * scaleX;
    const height = rect.height * scaleY;
    const insideX = point.x >= left && point.x <= left + width;
    const insideY = point.y >= top && point.y <= top + height;
    const dx = point.x - (left + width / 2);
    const dy = point.y - (top + height / 2);
    const inside = axis === "xy" ? insideX && insideY : axis === "x" ? insideX : insideY;
    const distance = axis === "xy" ? Math.hypot(dx, dy) : Math.abs(axis === "x" ? dx : dy);
    if (inside && containing === null) containing = index;
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = index;
    }
  });

  return containing ?? closest;
}

/** Layout rect in the container's coordinate space; `offset*` ignores transforms on ancestors. */
function measure(element: HTMLElement, container: HTMLElement): ItemRect | undefined {
  if (element.offsetParent === null && element.offsetWidth === 0 && element.offsetHeight === 0) return undefined;
  let top = element.offsetTop;
  let left = element.offsetLeft;
  let ancestor = element.offsetParent as HTMLElement | null;
  while (ancestor !== null && ancestor !== container && container.contains(ancestor)) {
    top += ancestor.offsetTop + ancestor.clientTop;
    left += ancestor.offsetLeft + ancestor.clientLeft;
    ancestor = ancestor.offsetParent as HTMLElement | null;
  }
  return { top, left, width: element.offsetWidth, height: element.offsetHeight };
}

export function createFluidHover(options: FluidHoverOptions = {}): FluidHover {
  const axis = options.axis ?? "y";
  const itemSelector = options.itemSelector ?? "[data-fluid-hover-item]";
  const [activeIndex, setActiveIndex] = createSignal<number | null>(null);
  const [rects, setRects] = createSignal<readonly ItemRect[]>([]);
  const [measured, setMeasured] = createSignal(false);
  // Handlers and frames read these plain copies: they run outside any tracking scope.
  let container: HTMLElement | undefined;
  let measuredRects: readonly ItemRect[] = [];
  let items: HTMLElement[] = [];
  let litIndex: number | null = null;
  let lit: HTMLElement | undefined;
  let moveFrame: number | undefined;
  let measureFrame: number | undefined;

  const light = (index: number | null) => {
    litIndex = index;
    const next = index === null ? undefined : items[index];
    if (next === lit) return;
    lit?.removeAttribute(ACTIVE_ATTR);
    next?.setAttribute(ACTIVE_ATTR, "");
    lit = next;
    setActiveIndex(index);
  };

  /** Publishes every item's rect; a pass with an unlaid-out item is dropped so the last complete one stands. */
  const runMeasurement = (): boolean => {
    const element = container;
    if (element === undefined) return false;
    items = Array.from(element.querySelectorAll<HTMLElement>(itemSelector));
    const next: ItemRect[] = [];
    for (const item of items) {
      const rect = measure(item, element);
      if (rect === undefined) return false;
      next.push(rect);
    }
    measuredRects = next;
    setRects(next);
    return true;
  };

  /** Coalesces every trigger into one pass on the next frame, retrying up to 3 frames while there is no layout. */
  const scheduleMeasurement = (attempts = 3) => {
    if (measureFrame !== undefined) cancelAnimationFrame(measureFrame);
    measureFrame = requestAnimationFrame(() => {
      measureFrame = undefined;
      if (runMeasurement()) setMeasured(true);
      else if (attempts > 1) scheduleMeasurement(attempts - 1);
    });
  };

  onSettled(() => {
    const element = container;
    if (element === undefined) return;
    const resize = new ResizeObserver(() => scheduleMeasurement());
    const mutation = new MutationObserver(() => {
      light(null);
      scheduleMeasurement();
    });
    resize.observe(element);
    mutation.observe(element, { childList: true, subtree: true });
    scheduleMeasurement();
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  });

  onCleanup(() => {
    if (moveFrame !== undefined) cancelAnimationFrame(moveFrame);
    if (measureFrame !== undefined) cancelAnimationFrame(measureFrame);
  });

  const activeRect = (): ItemRect | null => {
    const index = activeIndex();
    return measured() && index !== null ? (rects()[index] ?? null) : null;
  };

  return {
    ref: (element) => (container = element),
    activeRect,
    rectOf(selector) {
      const target = container?.querySelector<HTMLElement>(selector);
      return container === undefined || target == null ? null : (measure(target, container) ?? null);
    },
    handlers: {
      onMouseEnter() {
        scheduleMeasurement();
      },
      onMouseMove(event) {
        const element = event.currentTarget as HTMLElement;
        if (event.target instanceof Node && !element.contains(event.target)) return;
        const point = { x: event.clientX, y: event.clientY };
        if (moveFrame !== undefined) cancelAnimationFrame(moveFrame);
        moveFrame = requestAnimationFrame(() => {
          moveFrame = undefined;
          light(pickNearest(axis, point, measuredRects, element));
        });
      },
      onMouseLeave() {
        if (moveFrame !== undefined) cancelAnimationFrame(moveFrame);
        moveFrame = undefined;
        light(null);
      },
      // What is lit is what a click hits: a click between items goes to the lit one.
      onClick(event) {
        const target = event.target;
        if (!(target instanceof Element) || !target.isConnected) return;
        if (items.some((item) => item.contains(target))) return;
        if (target.closest(CONTROL_SELECTOR) !== null) return;
        const item = litIndex === null ? undefined : items[litIndex];
        if (item === undefined) return;
        (item.matches(ACTIVATOR_SELECTOR) ? item : (item.querySelector<HTMLElement>(ACTIVATOR_SELECTOR) ?? item)).click();
      },
    },
  };
}

// spring.fast: 0.08s, critically damped. Exits are one tier quicker tweens with no bounce.
const TRAVEL = "80ms cubic-bezier(0.25, 1, 0.5, 1)";
const ENTER = "opacity 80ms ease-out";
const EXIT = "opacity 60ms ease-in";

/**
 * The single highlight of a fluid hover list: pinned to the container's padding corner and moved on
 * a transform. A fresh entry fades in at `from` (or the lit row) instead of sliding over from where
 * the pointer last left.
 */
export function FluidHoverHighlight(props: { hover: FluidHover; from?: () => ItemRect | null; class?: string }): JSX.Element {
  let element: HTMLDivElement | undefined;
  let visible = false;
  const reducedMotion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined;

  const place = (target: HTMLDivElement, rect: ItemRect) => {
    target.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    target.style.width = `${rect.width}px`;
    target.style.height = `${rect.height}px`;
  };

  createEffect(
    () => props.hover.activeRect(),
    (rect) => {
      if (element === undefined) return;
      if (rect === null) {
        element.style.transition = EXIT;
        element.style.opacity = "0";
        visible = false;
        return;
      }
      if (!visible) {
        element.style.transition = "none";
        place(element, untrack(() => props.from?.()) ?? rect);
        // Commit the start position before re-enabling transitions, so the entry fades in instead of sliding.
        element.getBoundingClientRect();
      }
      element.style.transition = reducedMotion?.matches ? ENTER : `transform ${TRAVEL}, width ${TRAVEL}, height ${TRAVEL}, ${ENTER}`;
      place(element, rect);
      element.style.opacity = "1";
      visible = true;
    },
  );

  return (
    <div
      ref={(value) => (element = value)}
      aria-hidden="true"
      data-slot="fluid-hover-highlight"
      class={["pointer-events-none absolute top-0 left-0 opacity-0", props.class]}
    />
  );
}
