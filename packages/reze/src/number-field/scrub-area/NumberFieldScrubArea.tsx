import { dynamicElement, effect, getOwner, omitProps, onCleanup, runWithOwner, store, untrack, type JSX } from "reze-js";

import { createGenericEventDetails, REASONS } from "../../internals/event-details";
import { FieldRootContext, useFieldRootContext } from "../../internals/field-root-context";
import { FormContext, useFormContext } from "../../internals/form-context";
import { LabelableContext, useLabelableContext } from "../../internals/labelable-provider";
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, ChildrenValue, Orientation, RebaseUIComponentProps } from "../../internals/types";
import { getNumberFieldStateSnapshot, type NumberFieldRootState } from "../root/NumberFieldRoot";
import { NumberFieldRootContext, useNumberFieldRootContext } from "../root/NumberFieldRootContext";
import { getViewportRect } from "../utils/getViewportRect";
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
export function NumberFieldScrubArea<T extends JSX.ElementType = "span">(props: NumberFieldScrubArea.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "direction",
    "pixelSensitivity",
    "teleportDistance",
    "onPointerDown",
    "class",
    "style",
    "children",
    "ref",
  );
  // Deliberately not hoisted: reading the children getter here would create the child
  // components in this body, outside the context provider below. It is passed through
  // JSX instead, so the children are created inside the provider by NumberFieldScrubAreaContent.
  const root = useNumberFieldRootContext();
  const { state } = root;
  const field = useFieldRootContext();
  const form = useFormContext();
  const parentLabelable = useLabelableContext();

  const scrubAreaState = store({
    element: null as HTMLSpanElement | null,
    cursorElement: null as HTMLSpanElement | null,
    scrubbing: false,
    touchInput: false,
    pointerLockDenied: false,
  });

  function scrubAreaElement(): HTMLSpanElement | null {
    return scrubAreaState.element;
  }

  function scrubAreaCursorElement(): HTMLSpanElement | null {
    return scrubAreaState.cursorElement;
  }

  function setScrubAreaCursorElement(element: HTMLSpanElement | null): void {
    scrubAreaState.cursorElement = element;
  }

  function isScrubbing(): boolean {
    return scrubAreaState.scrubbing;
  }

  function isTouchInput(): boolean {
    return scrubAreaState.touchInput;
  }

  function isPointerLockDenied(): boolean {
    return scrubAreaState.pointerLockDenied;
  }

  function snapshot(): NumberFieldScrubAreaState {
    return getNumberFieldStateSnapshot(state);
  }

  let isScrubbingRef = false;
  let didMoveRef = false;
  let pointerDownTarget: EventTarget | null = null;
  let nativeClickReceived = false;
  const virtualCursorCoords = { x: 0, y: 0 };

  let exitPointerLockTimeout: ReturnType<typeof setTimeout> | undefined;
  let syntheticClickTimeout: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    if (exitPointerLockTimeout !== undefined) {
      clearTimeout(exitPointerLockTimeout);
    }
    if (syntheticClickTimeout !== undefined) {
      clearTimeout(syntheticClickTimeout);
    }
  });

  // Listen in the capture phase explicitly (upstream `onClickCapture`).
  // Tracks the browser's own click so `finish()` only synthesizes one when the
  // native click was swallowed (e.g. retargeted by pointer lock).
  effect(() => {
    const element = scrubAreaElement();

    untrack(() => {
      if (!element) {
        return;
      }

      function handleNativeClickCapture(): void {
        nativeClickReceived = true;
      }

      element.addEventListener("click", handleNativeClickCapture, { capture: true });
      onCleanup(() => {
        element.removeEventListener("click", handleNativeClickCapture, { capture: true });
      });
    });
  });

  function updateCursorTransform(virtualCursor: HTMLSpanElement, x: number, y: number): void {
    // Invert the visual viewport scale so the cursor matches the OS cursor, which doesn't
    // scale with the content on pinch-zoom.
    const scale = virtualCursor.ownerDocument?.defaultView?.visualViewport?.scale ?? 1;
    virtualCursor.style.transform = `translate3d(${x}px,${y}px,0) scale(${1 / scale})`;
  }

  function handleScrub(movementX: number, movementY: number): void {
    const virtualCursor = scrubAreaCursorElement();
    const scrubAreaEl = scrubAreaElement();

    if (!virtualCursor || !scrubAreaEl) {
      return;
    }

    const rect = getViewportRect(props.teleportDistance, scrubAreaEl);

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

  function handleScrubbingChange(scrubbingValue: boolean, clientX: number, clientY: number): void {
    scrubAreaState.scrubbing = scrubbingValue;
    root.setIsScrubbing(scrubbingValue);

    const virtualCursor = scrubAreaCursorElement();
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

  effect(() => {
    const scrubbing = isScrubbing();
    const isDisabled = state.disabled();
    const isReadOnly = state.readOnly();
    const input = root.inputElement();
    const direction = props.direction ?? "horizontal";
    const pixelSensitivity = props.pixelSensitivity ?? 2;

    untrack(() => {
      // Only listen while actively scrubbing; avoids unrelated pointerup events committing.
      if (!input || isDisabled || isReadOnly || !scrubbing) {
        return;
      }

      let cumulativeDelta = 0;

      function handleScrubPointerUp(event: PointerEvent): void {
        function finish(): void {
          try {
            (scrubAreaElement()?.ownerDocument ?? document).exitPointerLock();
          } catch {
            // Ignore errors.
          } finally {
            isScrubbingRef = false;
            handleScrubbingChange(false, event.clientX, event.clientY);
            root.onValueCommitted(
              root.lastChangedValueRef.current ?? root.valueRef.current,
              createGenericEventDetails(REASONS.scrub, event),
            );

            // Dispatch a click if no movement happened. While the pointer is locked, the
            // browser targets its click at the lock element instead of the scrub area.
            // Without a lock (WebKit, or a denied request) the native click still arrives,
            // and it is dispatched after pointerup in the same task, so wait one task and
            // only synthesize the click if the native one didn't reach the scrub area.
            const target = pointerDownTarget;
            const inputEl = root.inputElement();
            if (!didMoveRef && target != null && inputEl) {
              const MouseEventConstructor = (inputEl.ownerDocument?.defaultView ?? window).MouseEvent;
              if (syntheticClickTimeout !== undefined) {
                clearTimeout(syntheticClickTimeout);
              }
              syntheticClickTimeout = setTimeout(() => {
                syntheticClickTimeout = undefined;
                if (nativeClickReceived) {
                  return;
                }
                target.dispatchEvent(
                  new MouseEventConstructor("click", {
                    bubbles: true,
                    cancelable: true,
                  }),
                );
              }, 0);
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

      function handleScrubPointerMove(event: PointerEvent): void {
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
          const stepAmount = root.getStepAmount(event);
          const rawAmount = dValue * stepAmount;

          if (rawAmount !== 0) {
            root.allowInputSyncRef.current = true;
            root.incrementValue(Math.abs(rawAmount), {
              direction: rawAmount >= 0 ? 1 : -1,
              event,
              reason: REASONS.scrub,
            });
          }
        }
      }

      const win = input.ownerDocument?.defaultView ?? window;
      win.addEventListener("pointerup", handleScrubPointerUp, true);
      win.addEventListener("pointermove", handleScrubPointerMove, true);

      onCleanup(() => {
        if (exitPointerLockTimeout !== undefined) {
          clearTimeout(exitPointerLockTimeout);
          exitPointerLockTimeout = undefined;
        }
        win.removeEventListener("pointerup", handleScrubPointerUp, true);
        win.removeEventListener("pointermove", handleScrubPointerMove, true);
      });
    });
  });

  // If the scrub area unmounts mid-scrub, release pointer lock and clear the root's scrubbing
  // state so it doesn't stay locked or stuck. (No commit: there's no pointer release here.)
  onCleanup(() => {
    if (isScrubbingRef) {
      isScrubbingRef = false;
      root.setIsScrubbing(false);
      try {
        (scrubAreaElement()?.ownerDocument ?? document).exitPointerLock();
      } catch {
        // Ignore errors.
      }
    }
  });

  // Prevent scrolling using touch input when scrubbing.
  effect(() => {
    const element = scrubAreaElement();
    const isDisabled = state.disabled();
    const isReadOnly = state.readOnly();

    untrack(() => {
      if (!element || isDisabled || isReadOnly) {
        return;
      }

      function handleTouchStart(event: TouchEvent): void {
        if (event.touches.length === 1) {
          event.preventDefault();
        }
      }

      element.addEventListener("touchstart", handleTouchStart, { passive: false });
      onCleanup(() => {
        element.removeEventListener("touchstart", handleTouchStart);
      });
    });
  });

  async function handlePointerDownInternal(event: PointerEvent): Promise<void> {
    if (event.defaultPrevented || state.readOnly() || event.button || state.disabled()) {
      return;
    }

    const isTouch = event.pointerType === "touch";
    scrubAreaState.touchInput = isTouch;

    if (event.pointerType === "mouse") {
      event.preventDefault();
      root.focusInput();
    }

    isScrubbingRef = true;
    didMoveRef = false;
    nativeClickReceived = false;
    if (syntheticClickTimeout !== undefined) {
      clearTimeout(syntheticClickTimeout);
      syntheticClickTimeout = undefined;
    }
    pointerDownTarget = event.target;
    handleScrubbingChange(true, event.clientX, event.clientY);

    // WebKit causes significant layout shift with the native message, so pointer lock isn't used there.
    if (!isTouch && !isWebKit()) {
      try {
        // Avoid non-deterministic errors in testing environments. This error sometimes
        // appears: "The root document of this element is not valid for pointer lock."
        await (scrubAreaElement()?.ownerDocument ?? document).body.requestPointerLock();
        scrubAreaState.pointerLockDenied = false;
      } catch {
        scrubAreaState.pointerLockDenied = true;
      } finally {
        // The scrubbing state was already emitted above; re-emit it (no extra nesting) to
        // reflect the resolved pointer-lock result on the cursor.
        if (isScrubbingRef) {
          handleScrubbingChange(true, event.clientX, event.clientY);
        }
      }
    }
  }

  function handlePointerDown(event: PointerEvent): void {
    (props.onPointerDown as unknown as ((event: PointerEvent) => void) | undefined)?.(event);
    if (event.defaultPrevented) {
      return;
    }
    void handlePointerDownInternal(event);
  }

  function setScrubAreaRef(element: HTMLElement | null): void {
    scrubAreaState.element = element as HTMLSpanElement | null;
    (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);
  }

  const contextValue: NumberFieldScrubAreaContext = {
    isScrubbing,
    isTouchInput,
    isPointerLockDenied,
    scrubAreaCursorElement,
    setScrubAreaCursorElement,
  };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  // The providers live inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the scrub area parts without context. The root,
  // field, form, and parent labelable scopes are re-provided by identity so parts
  // below the tag keep seeing them. Children resolve in NumberFieldScrubAreaContent
  // below so they are created inside the providers.
  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="presentation"
      style={mergeStyleValue(SCRUB_AREA_STYLE, resolveStyleValue(props.style, snapshot()))}
      data-disabled={state.disabled() ? "" : undefined}
      data-readonly={state.readOnly() ? "" : undefined}
      data-required={state.required() ? "" : undefined}
      data-scrubbing={state.scrubbing() ? "" : undefined}
      data-valid={state.valid() === true ? "" : undefined}
      data-invalid={state.valid() === false ? "" : undefined}
      data-touched={state.touched() ? "" : undefined}
      data-dirty={state.dirty() ? "" : undefined}
      data-filled={state.filled() ? "" : undefined}
      data-focused={state.focused() ? "" : undefined}
      data-validating={state.validating() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      onPointerDown={handlePointerDown}
      ref={setScrubAreaRef}
    >
      <FieldRootContext value={field}>
        <FormContext value={form}>
          <LabelableContext value={parentLabelable}>
            <NumberFieldRootContext value={root}>
              <NumberFieldScrubAreaContext value={contextValue}>
                <NumberFieldScrubAreaContent>{props.children}</NumberFieldScrubAreaContent>
              </NumberFieldScrubAreaContext>
            </NumberFieldRootContext>
          </LabelableContext>
        </FormContext>
      </FieldRootContext>
    </Tag>
  );
}

/**
 * Resolves the scrub area children inside the scrub area context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the field state changes, matching the Solid layer where the
 * children memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function NumberFieldScrubAreaContent(props: { children: ChildrenValue<NumberFieldScrubAreaState> }) {
  const children = props.children;

  const { state } = useNumberFieldRootContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: NumberFieldScrubAreaState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the number field context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot = getNumberFieldStateSnapshot(state);

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

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

export type NumberFieldScrubAreaProps<T extends JSX.ElementType = "span"> = NumberFieldScrubAreaOwnProps &
  Pick<ButtonEventHandlers, "onClick" | "onPointerDown"> &
  RebaseUIComponentProps<T, NumberFieldScrubAreaState>;

export namespace NumberFieldScrubArea {
  export type State = NumberFieldScrubAreaState;
  export type Props<T extends JSX.ElementType = "span"> = NumberFieldScrubAreaProps<T>;
}
