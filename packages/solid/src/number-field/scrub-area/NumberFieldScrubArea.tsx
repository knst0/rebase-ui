import type { ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, onCleanup, untrack } from "solid-js";

import { createGenericEventDetails, REASONS } from "../../internals/event-details";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { Orientation, RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument, ownerWindow } from "../../internals/utils/owner";
import type { NumberFieldRootState } from "../root/NumberFieldRoot";
import { useNumberFieldRootContext } from "../root/NumberFieldRootContext";
import { getViewportRect } from "../utils/getViewportRect";
import { stateAttributesMapping } from "../utils/stateAttributesMapping";
import { NumberFieldScrubAreaContext } from "./NumberFieldScrubAreaContext";

const SCRUB_AREA_STYLE = {
  "touch-action": "none",
  "-webkit-user-select": "none",
  "user-select": "none",
} as const;

function isGecko(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /gecko\/\d/i.test(navigator.userAgent) && !/like gecko/i.test(navigator.userAgent);
}

export function isWebKit(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /applewebkit/i.test(navigator.userAgent) && !/chrome|chromium/i.test(navigator.userAgent);
}

/**
 * An interactive area where the user can click and drag to change the field value.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Number Field](https://rebase-ui.knst.dev/components/number-field)
 */
export function NumberFieldScrubArea<T extends ValidComponent = "span">(props: NumberFieldScrubArea.Props<T>) {
  const [local, elementProps] = split(props as NumberFieldScrubArea.Props, { default: defaultProps }, [
    "as",
    "direction",
    "pixelSensitivity",
    "teleportDistance",
  ]);

  const as = untrack(() => local.as);

  const store = useNumberFieldRootContext();
  const { state } = store;

  const [scrubAreaElement, setScrubAreaElement] = createSignal<HTMLSpanElement | null>(null);
  const [scrubAreaCursorElement, setScrubAreaCursorElement] = createSignal<HTMLSpanElement | null>(null);

  let isScrubbingRef = false;
  let didMoveRef = false;
  let pointerDownTarget: EventTarget | null = null;
  const virtualCursorCoords = { x: 0, y: 0 };

  let exitPointerLockTimeout: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    if (exitPointerLockTimeout !== undefined) {
      clearTimeout(exitPointerLockTimeout);
    }
  });

  const [isTouchInput, setIsTouchInput] = createSignal(false);
  const [isPointerLockDenied, setIsPointerLockDenied] = createSignal(false);
  const [isScrubbing, setIsScrubbing] = createSignal(false);

  function updateCursorTransform(virtualCursor: HTMLSpanElement, x: number, y: number) {
    // Invert the visual viewport scale so the cursor matches the OS cursor, which doesn't
    // scale with the content on pinch-zoom.
    const scale = ownerWindow(virtualCursor).visualViewport?.scale ?? 1;
    virtualCursor.style.transform = `translate3d(${x}px,${y}px,0) scale(${1 / scale})`;
  }

  function handleScrub(movementX: number, movementY: number) {
    const virtualCursor = untrack(scrubAreaCursorElement);
    const scrubAreaEl = untrack(scrubAreaElement);

    if (!virtualCursor || !scrubAreaEl) {
      return;
    }

    const rect = getViewportRect(
      untrack(() => local.teleportDistance),
      scrubAreaEl,
    );

    // Wrap the cursor to the opposite edge when its center crosses a viewport bound.
    const wrap = (coord: number, halfSize: number, low: number, high: number) => {
      if (coord + halfSize < low) {
        return high - halfSize;
      }
      if (coord + halfSize > high) {
        return low - halfSize;
      }
      return coord;
    };

    const newCoords = {
      x: wrap(Math.round(virtualCursorCoords.x + movementX), virtualCursor.offsetWidth / 2, rect.left, rect.right),
      y: wrap(Math.round(virtualCursorCoords.y + movementY), virtualCursor.offsetHeight / 2, rect.top, rect.bottom),
    };

    virtualCursorCoords.x = newCoords.x;
    virtualCursorCoords.y = newCoords.y;

    updateCursorTransform(virtualCursor, newCoords.x, newCoords.y);
  }

  function handleScrubbingChange(scrubbingValue: boolean, clientX: number, clientY: number) {
    setIsScrubbing(scrubbingValue);
    store.setIsScrubbing(scrubbingValue);

    const virtualCursor = untrack(scrubAreaCursorElement);
    if (!virtualCursor || !scrubbingValue) {
      return;
    }

    const initialCoords = {
      x: clientX - virtualCursor.offsetWidth / 2,
      y: clientY - virtualCursor.offsetHeight / 2,
    };

    virtualCursorCoords.x = initialCoords.x;
    virtualCursorCoords.y = initialCoords.y;

    updateCursorTransform(virtualCursor, initialCoords.x, initialCoords.y);
  }

  createEffect(
    () => ({
      scrubbing: isScrubbing(),
      isDisabled: state.disabled(),
      isReadOnly: state.readOnly(),
      input: store.inputElement(),
      direction: local.direction,
      pixelSensitivity: local.pixelSensitivity,
    }),
    ({ scrubbing, isDisabled, isReadOnly, input, direction, pixelSensitivity }) => {
      // Only listen while actively scrubbing; avoids unrelated pointerup events committing.
      if (!input || isDisabled || isReadOnly || !scrubbing) {
        return undefined;
      }

      let cumulativeDelta = 0;

      function handleScrubPointerUp(event: PointerEvent) {
        function finish() {
          try {
            ownerDocument(untrack(scrubAreaElement)).exitPointerLock();
          } catch {
            // Ignore errors.
          } finally {
            isScrubbingRef = false;
            handleScrubbingChange(false, event.clientX, event.clientY);
            store.onValueCommitted(
              store.lastChangedValueRef.current ?? store.valueRef.current,
              createGenericEventDetails(REASONS.scrub, event),
            );

            // Manually dispatch a click event if no movement happened, since
            // preventDefault on pointerdown prevents the browser click event.
            const target = pointerDownTarget;
            const inputEl = untrack(store.inputElement);
            if (!didMoveRef && target != null && inputEl) {
              target.dispatchEvent(
                new (ownerWindow(inputEl).MouseEvent)("click", {
                  bubbles: true,
                  cancelable: true,
                }),
              );
            }

            didMoveRef = false;
            pointerDownTarget = null;
          }
        }

        if (isGecko()) {
          // Firefox needs a small delay here when soft-clicking as the pointer
          // lock will not release otherwise.
          exitPointerLockTimeout = setTimeout(finish, 20);
        } else {
          finish();
        }
      }

      function handleScrubPointerMove(event: PointerEvent) {
        // The ref is the source of truth for whether a pointer is actually down.
        if (!isScrubbingRef) {
          return;
        }

        // Prevent text selection.
        event.preventDefault();

        handleScrub(event.movementX, event.movementY);

        const { movementX, movementY } = event;

        cumulativeDelta += direction === "vertical" ? movementY : movementX;

        if (Math.abs(cumulativeDelta) >= pixelSensitivity) {
          cumulativeDelta = 0;
          didMoveRef = true;
          const dValue = direction === "vertical" ? -movementY : movementX;
          const stepAmount = store.getStepAmount(event);
          const rawAmount = dValue * stepAmount;

          if (rawAmount !== 0) {
            store.allowInputSyncRef.current = true;
            store.incrementValue(Math.abs(rawAmount), {
              direction: rawAmount >= 0 ? 1 : -1,
              event,
              reason: REASONS.scrub,
            });
          }
        }
      }

      const win = ownerWindow(input);
      win.addEventListener("pointerup", handleScrubPointerUp, true);
      win.addEventListener("pointermove", handleScrubPointerMove, true);

      return () => {
        if (exitPointerLockTimeout !== undefined) {
          clearTimeout(exitPointerLockTimeout);
          exitPointerLockTimeout = undefined;
        }
        win.removeEventListener("pointerup", handleScrubPointerUp, true);
        win.removeEventListener("pointermove", handleScrubPointerMove, true);
      };
    },
  );

  // If the scrub area unmounts mid-scrub, release pointer lock and clear the root's scrubbing
  // state so it doesn't stay locked or stuck. (No commit: there's no pointer release here.)
  onCleanup(() => {
    if (isScrubbingRef) {
      isScrubbingRef = false;
      store.setIsScrubbing(false);
      try {
        ownerDocument(untrack(scrubAreaElement)).exitPointerLock();
      } catch {
        // Ignore errors.
      }
    }
  });

  // Prevent scrolling using touch input when scrubbing.
  createEffect(
    () => ({ element: scrubAreaElement(), isDisabled: state.disabled(), isReadOnly: state.readOnly() }),
    ({ element, isDisabled, isReadOnly }) => {
      if (!element || isDisabled || isReadOnly) {
        return undefined;
      }

      function handleTouchStart(event: TouchEvent) {
        if (event.touches.length === 1) {
          event.preventDefault();
        }
      }

      element.addEventListener("touchstart", handleTouchStart, { passive: false });
      return () => {
        element.removeEventListener("touchstart", handleTouchStart);
      };
    },
  );

  async function handlePointerDown(event: PointerEvent & { currentTarget: HTMLSpanElement }) {
    if (event.defaultPrevented || untrack(state.readOnly) || event.button || untrack(state.disabled)) {
      return;
    }

    const isTouch = event.pointerType === "touch";
    setIsTouchInput(isTouch);

    if (event.pointerType === "mouse") {
      event.preventDefault();
      store.focusInput();
    }

    isScrubbingRef = true;
    didMoveRef = false;
    pointerDownTarget = event.target;
    handleScrubbingChange(true, event.clientX, event.clientY);

    // WebKit causes significant layout shift with the native message, so pointer lock isn't used there.
    if (!isTouch && !isWebKit()) {
      try {
        // Avoid non-deterministic errors in testing environments. This error sometimes
        // appears: "The root document of this element is not valid for pointer lock."
        await ownerDocument(untrack(scrubAreaElement)).body.requestPointerLock();
        setIsPointerLockDenied(false);
      } catch {
        setIsPointerLockDenied(true);
      } finally {
        // The scrubbing state was already emitted above; re-emit it (no extra nesting) to
        // reflect the resolved pointer-lock result on the cursor.
        if (isScrubbingRef) {
          handleScrubbingChange(true, event.clientX, event.clientY);
        }
      }
    }
  }

  const scrubAreaHandlers = (externalProps: Record<string, any>) => {
    const target: Record<string, any> = {};

    for (const key in externalProps) {
      if (key === "onPointerDown") {
        continue;
      }
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    const external = externalProps.onPointerDown as ((event: PointerEvent) => void) | undefined;
    target.onPointerDown = (event: PointerEvent) => {
      external?.(event);
      if (event.defaultPrevented) {
        return;
      }
      void handlePointerDown(event as PointerEvent & { currentTarget: HTMLSpanElement });
    };

    return target;
  };

  const contextValue: NumberFieldScrubAreaContext = {
    isScrubbing,
    isTouchInput,
    isPointerLockDenied,
    scrubAreaCursorElement,
    setScrubAreaCursorElement,
  };

  return (
    <NumberFieldScrubAreaContext value={contextValue}>
      <RenderElement
        as={as}
        state={state}
        props={[
          {
            role: "presentation",
            style: SCRUB_AREA_STYLE,
          },
          elementProps,
          scrubAreaHandlers,
          {
            ref: (element: HTMLSpanElement | null) => {
              setScrubAreaElement(element);
            },
          },
        ]}
        stateAttributesMapping={stateAttributesMapping}
      />
    </NumberFieldScrubAreaContext>
  );
}

const defaultProps = Object.freeze({
  as: "span",
  direction: "horizontal",
  pixelSensitivity: 2,
} satisfies Partial<NumberFieldScrubArea.Props>);

export interface NumberFieldScrubAreaState extends NumberFieldRootState {}

export interface NumberFieldScrubAreaOwnProps {
  /**
   * Cursor movement direction in the scrub area.
   * @default 'horizontal'
   */
  direction?: Orientation | undefined;
  /**
   * Determines how many pixels the cursor must move before the value changes.
   * A higher value will make scrubbing less sensitive.
   * @default 2
   */
  pixelSensitivity?: number | undefined;
  /**
   * If specified, determines the distance that the cursor may move from the center
   * of the scrub area before it will loop back around.
   */
  teleportDistance?: number | undefined;
}

export type NumberFieldScrubAreaProps<T extends ValidComponent = "span"> = NumberFieldScrubAreaOwnProps &
  RebaseUIComponentProps<T, NumberFieldScrubAreaState>;

export namespace NumberFieldScrubArea {
  export type State = NumberFieldScrubAreaState;
  export type Props<T extends ValidComponent = "span"> = NumberFieldScrubAreaProps<T>;
}
