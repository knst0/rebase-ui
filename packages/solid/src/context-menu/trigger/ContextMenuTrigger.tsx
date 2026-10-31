import { isServer, type ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, onCleanup, untrack } from "solid-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { Timeout } from "../../internals/floating/interactions/createHoverInteractionSharedState";
import { contains } from "../../internals/floating/utils/element";
import { stopEvent } from "../../internals/floating/utils/event";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuRootContext } from "../../menu/root/MenuRootContext";
import { findRootOwnerId } from "../../menu/utils/findRootOwnerId";
import { menuPressableTriggerStateMapping } from "../../menu/utils/stateAttributesMapping";
import { useContextMenuRootContext } from "../root/ContextMenuRootContext";

const LONG_PRESS_DELAY = 500;
const TOUCH_MOVE_THRESHOLD = 10;

/**
 * An area that opens the menu on right click or long press.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Context Menu](https://rebase-ui.knst.dev/components/context-menu)
 */
export function ContextMenuTrigger<T extends ValidComponent = "div">(props: ContextMenuTrigger.Props<T>) {
  const [local, elementProps] = split(props as ContextMenuTrigger.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const context = useContextMenuRootContext(false);
  const { store } = useMenuRootContext();

  const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null>(null);

  let touchPosition: { x: number; y: number } | null = null;
  let allowMouseUp = false;
  let mouseUpAbortController: AbortController | null = null;
  const longPressTimeout = new Timeout();
  const allowMouseUpTimeout = new Timeout();

  onCleanup(() => {
    longPressTimeout.clear();
    allowMouseUpTimeout.clear();
    // Abort a pending mouseup listener if the trigger unmounts before it fires.
    mouseUpAbortController?.abort();
  });

  function handleLongPress(x: number, y: number, event: MouseEvent | TouchEvent) {
    const isTouchEvent = event.type.startsWith("touch");

    context.initialCursorPoint = { x, y };

    context.setAnchor({
      getBoundingClientRect() {
        return DOMRect.fromRect({
          width: isTouchEvent ? 10 : 0,
          height: isTouchEvent ? 10 : 0,
          x,
          y,
        });
      },
    });

    allowMouseUp = false;
    store.setOpen(true, createChangeEventDetails(REASONS.triggerPress, event));

    allowMouseUpTimeout.start(LONG_PRESS_DELAY, () => {
      allowMouseUp = true;
    });
  }

  function handleContextMenu(event: MouseEvent) {
    if (store.peek("disabled")) {
      return;
    }
    context.allowMouseUpTriggerRef.current = true;
    stopEvent(event);
    handleLongPress(event.clientX, event.clientY, event);
    const doc = untrack(triggerElement)?.ownerDocument ?? document;

    // Abort a listener from a previous trigger that never saw its mouseup, and scope this
    // one to a fresh controller so it's removed on unmount if the mouseup never arrives.
    mouseUpAbortController?.abort();
    mouseUpAbortController = new AbortController();
    doc.addEventListener(
      "mouseup",
      (mouseEvent) => {
        context.allowMouseUpTriggerRef.current = false;

        if (!allowMouseUp) {
          return;
        }

        allowMouseUpTimeout.clear();
        allowMouseUp = false;

        const mouseUpTarget = mouseEvent.target as Element | null;

        if (contains(store.peek("positionerElement") as Element | null, mouseUpTarget)) {
          return;
        }

        const rootId = store.peek("rootId") as string | undefined;
        if (rootId && mouseUpTarget && findRootOwnerId(mouseUpTarget) === rootId) {
          return;
        }

        store.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
      },
      { once: true, signal: mouseUpAbortController.signal },
    );
  }

  function cancelLongPress() {
    longPressTimeout.clear();
    touchPosition = null;
  }

  function handleTouchStart(event: TouchEvent) {
    if (store.peek("disabled")) {
      cancelLongPress();
      return;
    }
    context.allowMouseUpTriggerRef.current = false;
    if (event.touches.length !== 1) {
      cancelLongPress();
      return;
    }

    event.stopPropagation();
    const touch = event.touches[0]!;
    const position = { x: touch.clientX, y: touch.clientY };
    touchPosition = position;
    longPressTimeout.start(LONG_PRESS_DELAY, () => {
      handleLongPress(position.x, position.y, event);
    });
  }

  function handleTouchMove(event: TouchEvent) {
    if (event.touches.length !== 1) {
      cancelLongPress();
      return;
    }

    if (longPressTimeout.isStarted() && touchPosition) {
      const touch = event.touches[0]!;
      const deltaX = Math.abs(touch.clientX - touchPosition.x);
      const deltaY = Math.abs(touch.clientY - touchPosition.y);

      if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
        cancelLongPress();
      }
    }
  }

  if (!isServer) {
    createEffect(
      () => ({ element: triggerElement(), disabled: store.select("disabled") as boolean }),
      ({ element, disabled }) => {
        if (disabled || !element) {
          return undefined;
        }

        function handleDocumentContextMenu(event: MouseEvent) {
          const target = event.target as HTMLElement | null;
          if (contains(element, target) || contains(context.internalBackdropElement, target) || contains(context.backdropElement, target)) {
            event.preventDefault();
          }
        }

        const doc = element.ownerDocument;
        doc.addEventListener("contextmenu", handleDocumentContextMenu);
        return () => {
          doc.removeEventListener("contextmenu", handleDocumentContextMenu);
        };
      },
    );
  }

  const state: ContextMenuTriggerState = {
    get open() {
      return store.select("open") as boolean;
    },
  };

  const triggerProps = {
    onContextMenu: handleContextMenu,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: cancelLongPress,
    onTouchCancel: cancelLongPress,
    style: {
      "-webkit-touch-callout": "none" as const,
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, setTriggerElement),
  });

  return (
    <RenderElement
      as={as}
      state={state}
      props={[triggerProps, elementProps, refProps]}
      stateAttributesMapping={menuPressableTriggerStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ContextMenuTrigger.Props>);

export interface ContextMenuTriggerState {
  /**
   * Whether the context menu is currently open.
   */
  open: boolean;
}

export type ContextMenuTriggerProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, ContextMenuTriggerState>;

export namespace ContextMenuTrigger {
  export type State = ContextMenuTriggerState;
  export type Props<T extends ValidComponent = "div"> = ContextMenuTriggerProps<T>;
}
