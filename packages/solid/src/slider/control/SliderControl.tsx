import { isElement } from "@floating-ui/utils/dom";
import { clamp } from "@rebase-ui/core/clamp";
import { resolveThumbCollision } from "@rebase-ui/core/resolveThumbCollision";
import { roundValueToStep } from "@rebase-ui/core/roundValueToStep";
import { validateMinimumDistance } from "@rebase-ui/core/validateMinimumDistance";
import type { ValidComponent } from "@solidjs/web";
import { createEffect, onCleanup, untrack } from "solid-js";

import { createChangeEventDetails, createGenericEventDetails, REASONS } from "../../internals/event-details";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument, ownerWindow } from "../../internals/utils/owner";
import type { SliderRootState } from "../root/SliderRoot";
import { useSliderRootContext } from "../root/SliderRootContext";
import { sliderStateAttributesMapping } from "../root/stateAttributesMapping";
import { getMidpoint } from "../utils/getMidpoint";

const INTENTIONAL_DRAG_COUNT_THRESHOLD = 2;

interface Coords {
  x: number;
  y: number;
}

function getControlOffset(styles: CSSStyleDeclaration | null, vertical: boolean) {
  if (!styles) {
    return {
      start: 0,
      end: 0,
    };
  }

  function parseSize(value: string | null | undefined) {
    const parsed = value != null ? parseFloat(value) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const start = !vertical ? "InlineStart" : "Top";
  const end = !vertical ? "InlineEnd" : "Bottom";

  return {
    start:
      parseSize(styles[`border${start}Width` as keyof CSSStyleDeclaration] as unknown as string) +
      parseSize(styles[`padding${start}` as keyof CSSStyleDeclaration] as unknown as string),
    end:
      parseSize(styles[`border${end}Width` as keyof CSSStyleDeclaration] as unknown as string) +
      parseSize(styles[`padding${end}` as keyof CSSStyleDeclaration] as unknown as string),
  };
}

function getTarget(event: Event): EventTarget | null {
  return event.composedPath?.()[0] ?? event.target;
}

function getFingerCoords(event: TouchEvent | PointerEvent, touchId: number | null): Coords | null {
  // The event is TouchEvent
  if (touchId != null && (event as TouchEvent).changedTouches) {
    const touchEvent = event as TouchEvent;
    for (let i = 0; i < touchEvent.changedTouches.length; i += 1) {
      const touch = touchEvent.changedTouches[i];
      if (touch.identifier === touchId) {
        return {
          x: touch.clientX,
          y: touch.clientY,
        };
      }
    }

    return null;
  }

  // The event is PointerEvent
  return {
    x: (event as PointerEvent).clientX,
    y: (event as PointerEvent).clientY,
  };
}

/**
 * The clickable, interactive part of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Slider](https://rebase-ui.knst.dev/components/slider)
 */
export function SliderControl<T extends ValidComponent = "div">(props: SliderControl.Props<T>) {
  const [local, elementProps] = split(props as SliderControl.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const {
    disabled,
    dragging,
    inset,
    lastChangeReason,
    max,
    min,
    minStepsBetweenValues,
    onValueCommitted,
    orientation,
    pressedThumbCenterOffset,
    setPressedThumbCenterOffset,
    pressedThumbIndex,
    setPressedThumbIndex,
    pressedValues,
    setPressedValues,
    registerFieldControlRef,
    renderBeforeHydration,
    setActive,
    setDragging,
    setValue,
    state,
    step,
    thumbCollisionBehavior,
    thumbRefs,
    values,
  } = useSliderRootContext();

  // Base UI reads this from DirectionProvider, which rebase-ui does not provide yet.
  // Defaults to 'ltr', matching upstream without a provider.
  // Written as a function so the type stays a union for the directional branches below.
  const direction = (): "ltr" | "rtl" => "ltr";
  const range = () => values().length > 1;
  const vertical = () => orientation() === "vertical";

  let controlElement: HTMLElement | null = null;
  let styles: CSSStyleDeclaration | null = null;
  const setStylesRef = (element: HTMLElement | null) => {
    if (element && styles == null) {
      styles = ownerWindow(element).getComputedStyle(element);
    }
  };

  // A number that uniquely identifies the current finger in the touch session.
  let touchId: number | null = null;
  // The number of touch/pointermove events that have fired.
  let moveCount = 0;
  // The offset amount to each side of the control for inset sliders.
  // This value should be equal to the radius or half the width/height of the thumb.
  let insetThumbOffset = 0;
  let currentInteractionValue: number | number[] | null = null;
  // Intentionally a snapshot: re-synced on every interaction in `startPressing`/`setValueFromPointer`.
  let latestValues: readonly number[] = untrack(values);

  let focusFrameId: number | null = null;
  const focusFrame = {
    request(fn: () => void) {
      focusFrame.cancel();
      focusFrameId = requestAnimationFrame(() => {
        focusFrameId = null;
        fn();
      });
    },
    cancel() {
      if (focusFrameId !== null) {
        cancelAnimationFrame(focusFrameId);
        focusFrameId = null;
      }
    },
  };

  onCleanup(() => {
    controlElement?.removeEventListener("touchstart", handleTouchStart as EventListener);
    focusFrame.cancel();
    stopListening();
  });

  function getThumbInput(el: Element | null | undefined) {
    return el?.querySelector<HTMLInputElement>('input[type="range"]');
  }

  function updatePressedThumb(nextIndex: number) {
    setPressedThumbIndex(nextIndex);
    if (!thumbRefs()[nextIndex]) {
      setPressedThumbCenterOffset(null);
    }
  }

  function resetPressedThumb() {
    setPressedThumbIndex(-1);
    setPressedThumbCenterOffset(null);
  }

  function isTargetDisabledThumb(target: EventTarget | null) {
    if (!isElement(target)) {
      return false;
    }

    return thumbRefs().some((thumbEl) => {
      if (!isElement(thumbEl) || !thumbEl.contains(target)) {
        return false;
      }

      return getThumbInput(thumbEl)?.disabled === true;
    });
  }

  function getFingerState(fingerCoords: Coords): FingerState | null {
    const control = controlElement;
    const thumbIndex = pressedThumbIndex();
    const currentValues = values();

    if (!control || thumbIndex < 0 || thumbIndex >= currentValues.length) {
      if (thumbIndex >= currentValues.length) {
        currentInteractionValue = null;
      }
      return null;
    }

    const isVertical = vertical();
    const { width, height, bottom, left, right } = control.getBoundingClientRect();

    const controlOffset = getControlOffset(styles, isVertical);
    const insetThumbOffsetValue = insetThumbOffset;
    const controlSize = (isVertical ? height : width) - controlOffset.start - controlOffset.end - insetThumbOffsetValue * 2;
    const thumbCenterOffset = pressedThumbCenterOffset() ?? 0;
    const fingerX = fingerCoords.x - thumbCenterOffset;
    const fingerY = fingerCoords.y - thumbCenterOffset;

    const valueSize = isVertical
      ? bottom - fingerY - controlOffset.end
      : (direction() === "rtl" ? right - fingerX : fingerX - left) - controlOffset.start;
    // the value at the finger origin scaled down to fit the range [0, 1]
    const valueRescaled = clamp((valueSize - insetThumbOffsetValue) / controlSize, 0, 1);

    let newValue = (max() - min()) * valueRescaled + min();
    newValue = roundValueToStep(newValue, step(), min());
    newValue = clamp(newValue, min(), max());

    if (!range()) {
      return {
        value: newValue,
        thumbIndex,
        didSwap: false,
      };
    }

    return resolveThumbCollision(
      thumbCollisionBehavior(),
      currentValues,
      latestValues,
      pressedValues(),
      thumbIndex,
      newValue,
      min(),
      max(),
      step(),
      minStepsBetweenValues(),
    );
  }

  function startPressing(fingerCoords: Coords) {
    const currentValues = values();
    setPressedValues(range() ? currentValues.slice() : null);
    currentInteractionValue = null;
    latestValues = currentValues;

    // Snapshot the pre-press index: `updatePressedThumb` below mutates the
    // shared value, and the comparisons here must use the previous one.
    const previousPressedThumbIndex = pressedThumbIndex();
    let closestThumbIndex = previousPressedThumbIndex;

    if (previousPressedThumbIndex > -1 && previousPressedThumbIndex < currentValues.length) {
      if (currentValues[previousPressedThumbIndex] === max()) {
        let candidateIndex = previousPressedThumbIndex;

        while (candidateIndex > 0 && currentValues[candidateIndex - 1] === max()) {
          candidateIndex -= 1;
        }

        closestThumbIndex = candidateIndex;
      }
    } else {
      // pressed on control
      const axis = !vertical() ? "x" : "y";
      let minDistance: number | undefined;

      closestThumbIndex = -1;

      const thumbs = thumbRefs();
      for (let i = 0; i < thumbs.length; i += 1) {
        const thumbEl = thumbs[i];
        if (isElement(thumbEl) && !getThumbInput(thumbEl)?.disabled) {
          const midpoint = getMidpoint(thumbEl, vertical());
          const distance = Math.abs(fingerCoords[axis] - midpoint);

          if (minDistance === undefined || distance <= minDistance) {
            closestThumbIndex = i;
            minDistance = distance;
          }
        }
      }
    }

    if (closestThumbIndex > -1 && closestThumbIndex !== previousPressedThumbIndex) {
      updatePressedThumb(closestThumbIndex);
    }

    if (inset()) {
      const thumbEl = thumbRefs()[closestThumbIndex];
      if (isElement(thumbEl)) {
        const thumbRect = thumbEl.getBoundingClientRect();
        const side = !vertical() ? "width" : "height";
        insetThumbOffset = thumbRect[side] / 2;
      }
    }
  }

  function focusThumb(thumbIndex: number) {
    const input = getThumbInput(thumbRefs()?.[thumbIndex]);
    if (!input) {
      return;
    }

    input.focus({
      preventScroll: true,
      // Prevent pointer-driven focus rings in browsers that support this option.
      // Supported in Chrome from 144+.
      focusVisible: false,
    } as FocusOptions);
  }

  function setValueFromPointer(
    finger: FingerState,
    reason: typeof REASONS.trackPress | typeof REASONS.drag,
    nativeEvent: TouchEvent | PointerEvent,
  ) {
    const applied = setValue(
      finger.value,
      createChangeEventDetails(reason, nativeEvent as never, undefined, {
        activeThumbIndex: finger.thumbIndex,
      }),
    );

    if (applied) {
      currentInteractionValue = finger.value;
      latestValues = Array.isArray(finger.value) ? finger.value : [finger.value];

      // Only track and focus the swapped thumb once the change is actually applied so a
      // canceled swap doesn't leak the new index into subsequent moves.
      if (finger.didSwap) {
        updatePressedThumb(finger.thumbIndex);
        focusThumb(finger.thumbIndex);
      }
    }

    return applied;
  }

  function handleTouchMove(nativeEvent: TouchEvent | PointerEvent) {
    const fingerCoords = getFingerCoords(nativeEvent, touchId);

    if (fingerCoords == null) {
      return;
    }

    moveCount += 1;

    // Cancel move in case some other element consumed a pointerup event and it was not fired.
    if (nativeEvent.type === "pointermove" && (nativeEvent as PointerEvent).buttons === 0) {
      handleTouchEnd(nativeEvent);
      return;
    }

    const finger = getFingerState(fingerCoords);

    if (finger == null) {
      return;
    }

    if (validateMinimumDistance(finger.value, step(), minStepsBetweenValues())) {
      if (!dragging() && moveCount > INTENTIONAL_DRAG_COUNT_THRESHOLD) {
        setDragging(true);
      }

      setValueFromPointer(finger, REASONS.drag, nativeEvent);
    }
  }

  function handleTouchEnd(nativeEvent: TouchEvent | PointerEvent) {
    setActive(-1);
    setDragging(false);

    setPressedThumbCenterOffset(null);

    // If the value array shrank or grew mid-drag, the cached interaction value no longer
    // matches the current thumbs (the pressed index can still be in range), so dropping it
    // keeps a stale or malformed array from being committed on release.
    const interactionValue = currentInteractionValue;
    if (Array.isArray(interactionValue) && interactionValue.length !== values().length) {
      currentInteractionValue = null;
    }

    if (currentInteractionValue != null) {
      const commitReason = lastChangeReason();
      onValueCommitted(currentInteractionValue, createGenericEventDetails(commitReason, nativeEvent as never));
    }

    if ("pointerType" in nativeEvent && controlElement?.hasPointerCapture((nativeEvent as PointerEvent).pointerId)) {
      controlElement?.releasePointerCapture((nativeEvent as PointerEvent).pointerId);
    }

    setPressedThumbIndex(-1);
    touchId = null;
    stopListening();
  }

  function handleTouchStart(nativeEvent: TouchEvent) {
    if (disabled()) {
      return;
    }

    if (isTargetDisabledThumb(getTarget(nativeEvent))) {
      resetPressedThumb();
      return;
    }

    const touch = nativeEvent.changedTouches[0];
    if (touch == null) {
      return;
    }

    touchId = touch.identifier;

    const fingerCoords = { x: touch.clientX, y: touch.clientY };
    startPressing(fingerCoords);

    const finger = getFingerState(fingerCoords);

    if (finger == null) {
      return;
    }

    focusThumb(finger.thumbIndex);
    setValueFromPointer(finger, REASONS.trackPress, nativeEvent);

    moveCount = 0;
    const doc = ownerDocument(controlElement);
    doc.addEventListener("touchmove", handleTouchMove as EventListener, { passive: true });
    doc.addEventListener("touchend", handleTouchEnd as EventListener, { passive: true });
  }

  function stopListening() {
    const doc = ownerDocument(controlElement);
    doc.removeEventListener("pointermove", handleTouchMove as EventListener);
    doc.removeEventListener("pointerup", handleTouchEnd as EventListener);
    doc.removeEventListener("touchmove", handleTouchMove as EventListener);
    doc.removeEventListener("touchend", handleTouchEnd as EventListener);
    setPressedValues(null);
    currentInteractionValue = null;
  }

  createEffect(
    () => disabled(),
    (isDisabled) => {
      if (isDisabled) {
        stopListening();
      }
    },
  );

  function handlePointerDown(event: PointerEvent) {
    const control = controlElement;
    const target = getTarget(event);

    if (!control || disabled() || event.defaultPrevented || !isElement(target) || event.button !== 0) {
      return;
    }

    if (isTargetDisabledThumb(target)) {
      resetPressedThumb();
      return;
    }

    const fingerCoords = { x: event.clientX, y: event.clientY };
    startPressing(fingerCoords);

    const finger = getFingerState(fingerCoords);

    if (finger == null) {
      return;
    }

    const pressedOnFocusedThumb = thumbRefs()[finger.thumbIndex]?.contains(ownerDocument(control).activeElement as Node | null);

    if (pressedOnFocusedThumb) {
      event.preventDefault();
    } else {
      focusFrame.request(() => {
        focusThumb(finger.thumbIndex);
      });
    }

    setDragging(true);

    const pressedOnAnyThumb = pressedThumbCenterOffset() != null;
    if (!pressedOnAnyThumb) {
      setValueFromPointer(finger, REASONS.trackPress, event);
    }

    if (event.pointerId) {
      control.setPointerCapture(event.pointerId);
    }

    moveCount = 0;
    const doc = ownerDocument(control);
    doc.addEventListener("pointermove", handleTouchMove as EventListener, { passive: true });
    doc.addEventListener("pointerup", handleTouchEnd as EventListener, { once: true });
  }

  const controlHandlers = (externalProps: Record<string, any>) => {
    const target: Record<string, any> = {};

    for (const key in externalProps) {
      if (key === "onPointerDown") {
        continue;
      }
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    target.onPointerDown = (event: PointerEvent) => {
      makeEventPreventable(event as any);
      externalProps.onPointerDown?.(event);
      if ((event as any).rebaseUIHandlerPrevented) {
        return;
      }
      handlePointerDown(event);
    };

    return target;
  };

  const controlMarkerProps: Record<string, any> = {
    "data-base-ui-slider-control": renderBeforeHydration() ? "" : undefined,
  };

  // Stable ref identity with an identity guard (see `handleThumbRef` in SliderThumb):
  // re-fires with the same element must not re-run registration work or stack
  // duplicate listeners, which cascades into recomputations (update loop).
  let controlRefElement: HTMLElement | null = null;
  const handleControlRef = (element: HTMLElement | null) => {
    controlElement = element;
    if (element === controlRefElement) {
      return;
    }
    controlRefElement = element;
    registerFieldControlRef(element);
    setStylesRef(element);
    if (element) {
      element.addEventListener("touchstart", handleTouchStart as EventListener, { passive: true });
    }
  };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[
        controlMarkerProps,
        elementProps,
        controlHandlers,
        {
          ref: handleControlRef,
        },
      ]}
      stateAttributesMapping={sliderStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<SliderControl.Props>);

interface FingerState {
  value: number | number[];
  thumbIndex: number;
  didSwap: boolean;
}

export interface SliderControlState extends SliderRootState {}

export type SliderControlProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, SliderControlState>;

export namespace SliderControl {
  export type State = SliderControlState;
  export type Props<T extends ValidComponent = "div"> = SliderControlProps<T>;
}
