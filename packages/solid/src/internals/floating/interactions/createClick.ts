import { createEffect, untrack } from "solid-js";

import { createChangeEventDetails } from "../../event-details/createEventDetails";
import { REASONS } from "../../event-details/reasons";
import type { FloatingContext } from "../types";
import { getTarget, isTypeableElement } from "../utils/element";
import { isMouseLikePointerType, isVirtualPointerEvent } from "../utils/event";

export interface CreateClickProps {
  /** Whether the interaction is enabled. Read once; not reactive. @default true */
  enabled?: boolean | undefined;
  /** Which mouse event counts as a click. Read once. @default 'click' */
  event?: "click" | "mousedown" | "mousedown-only" | undefined;
  /** Whether repeated clicks toggle the open state. Read once. @default true */
  toggle?: boolean | undefined;
  /** Whether to ignore mouse input. Read once. @default false */
  ignoreMouse?: boolean | undefined;
  /**
   * Whether a first click keeps an already-open floating element open.
   * A function is resolved lazily on every press; a boolean is read once. @default true
   */
  stickIfOpen?: boolean | (() => boolean) | undefined;
  /** Touch-only delay (ms) before opening. Read once. @default 0 */
  touchOpenDelay?: number | undefined;
  /** Reason reported for the open change. Read once. @default REASONS.triggerPress */
  reason?: typeof REASONS.triggerPress | typeof REASONS.inputPress | undefined;
}

export interface ClickReferenceProps {
  onPointerDown: (event: PointerEvent) => void;
  onMouseDown: (event: MouseEvent) => void;
  onClick: (event: MouseEvent) => void;
  onKeyDown: () => void;
}

export interface CreateClickResult {
  /** Getter returning props to spread onto the Solid reference element. */
  reference: () => ClickReferenceProps;
}

/**
 * Opens or closes the floating element when clicking the reference element.
 * Solid port of upstream `useClick` (mui/base-ui v1.8.0).
 * Handlers receive native DOM events (no `nativeEvent` wrapper); consumers
 * spread `reference()` onto a Solid element. Event prop names match upstream
 * (`onClick`, `onMouseDown`, ...) since Solid JSX uses the same names.
 */
export function createClick(context: FloatingContext, props: CreateClickProps = {}): CreateClickResult {
  const store = context.rootStore;
  const dataRef = store.context.dataRef;

  const enabled = untrack(() => props.enabled ?? true);
  const eventOption = untrack(() => props.event ?? "click");
  const toggle = untrack(() => props.toggle ?? true);
  const ignoreMouse = untrack(() => props.ignoreMouse ?? false);
  const stickIfOpenOption = untrack(() => props.stickIfOpen ?? true);

  function getStickIfOpen(): boolean {
    return typeof stickIfOpenOption === "function" ? (stickIfOpenOption as () => boolean)() : stickIfOpenOption;
  }
  const touchOpenDelay = untrack(() => props.touchOpenDelay ?? 0);
  const reason = untrack(() => props.reason ?? REASONS.triggerPress);

  let pointerType: string | undefined;
  let frameId: number | undefined;
  let frameTimer: ReturnType<typeof setTimeout> | undefined;
  let touchTimer: ReturnType<typeof setTimeout> | undefined;

  // Clear pending async opens when the interaction owner disposes.
  createEffect(
    () => undefined,
    () => () => {
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
        frameId = undefined;
      }
      clearTimeout(frameTimer);
      clearTimeout(touchTimer);
    },
  );

  function requestFrame(callback: () => void) {
    if (typeof requestAnimationFrame === "function") {
      frameId = requestAnimationFrame(() => {
        frameId = undefined;
        callback();
      });
    } else {
      clearTimeout(frameTimer);
      frameTimer = setTimeout(callback, 0);
    }
  }

  function setOpenWithTouchDelay(nextOpen: boolean, nativeEvent: MouseEvent, target: Element, currentPointerType: string | undefined) {
    const details = createChangeEventDetails(reason, nativeEvent, target as HTMLElement);

    if (nextOpen && currentPointerType === "touch" && touchOpenDelay > 0) {
      clearTimeout(touchTimer);
      touchTimer = setTimeout(() => {
        store.setOpen(true, details);
      }, touchOpenDelay);
    } else {
      store.setOpen(nextOpen, details);
    }
  }

  function getNextOpen(open: boolean, currentTarget: EventTarget | null, isClickLikeOpenEvent: (eventType: string | undefined) => boolean) {
    const openEvent = dataRef.current.openEvent;
    const hasClickedOnInactiveTrigger = store.select("domReferenceElement") !== currentTarget;

    if (open && hasClickedOnInactiveTrigger) {
      return true;
    }

    if (!open) {
      return true;
    }

    if (!toggle) {
      return true;
    }

    if (openEvent && getStickIfOpen()) {
      return !isClickLikeOpenEvent(openEvent.type);
    }

    return false;
  }

  const referenceProps: ClickReferenceProps = {
    onPointerDown(event) {
      pointerType = isMouseLikePointerType(event.pointerType, true) && isVirtualPointerEvent(event) ? "virtual" : event.pointerType;
    },
    onMouseDown(event) {
      const currentPointerType = pointerType;
      const open = store.select("open");

      if (event.button !== 0 || eventOption === "click" || (isMouseLikePointerType(currentPointerType, true) && ignoreMouse)) {
        return;
      }

      const nextOpen = getNextOpen(
        open,
        event.currentTarget,
        (openEventType) => openEventType === "click" || openEventType === "mousedown",
      );

      const target = getTarget(event);

      if (isTypeableElement(target)) {
        setOpenWithTouchDelay(nextOpen, event, target as unknown as Element, currentPointerType);
        return;
      }

      const eventCurrentTarget = event.currentTarget as Element | null;

      // Wait until focus is set on the element. This is an alternative to
      // `event.preventDefault()` to avoid :focus-visible from appearing when using a pointer.
      requestFrame(() => {
        if (eventCurrentTarget) {
          setOpenWithTouchDelay(nextOpen, event, eventCurrentTarget, currentPointerType);
        }
      });
    },
    onClick(event) {
      if (eventOption === "mousedown-only") {
        return;
      }

      const currentPointerType = pointerType;

      if (eventOption === "mousedown" && currentPointerType) {
        pointerType = undefined;
        return;
      }

      if (isMouseLikePointerType(currentPointerType, true) && ignoreMouse) {
        return;
      }

      const open = store.select("open");
      const nextOpen = getNextOpen(
        open,
        event.currentTarget,
        (openEventType) =>
          openEventType === "click" || openEventType === "mousedown" || openEventType === "keydown" || openEventType === "keyup",
      );
      const currentTarget = event.currentTarget as Element | null;
      if (currentTarget) {
        setOpenWithTouchDelay(nextOpen, event, currentTarget, currentPointerType);
      }
    },
    onKeyDown() {
      pointerType = undefined;
    },
  };

  const reference = () => (enabled ? referenceProps : ({} as ClickReferenceProps));

  return { reference };
}
