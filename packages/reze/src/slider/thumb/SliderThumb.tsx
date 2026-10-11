import { clamp } from "@rebase-ui/core/clamp";
import { formatNumber } from "@rebase-ui/core/formatNumber";
import { getSliderValue } from "@rebase-ui/core/getSliderValue";
import { getDecimalPrecision, roundValueToStep } from "@rebase-ui/core/roundValueToStep";
import { valueToPercent } from "@rebase-ui/core/valueToPercent";
import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, store, untrack, type JSX } from "reze-js";

import { useCompositeListItem } from "../../internals/composite";
import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  COMPOSITE_KEYS,
  END,
  HOME,
  PAGE_DOWN,
  PAGE_UP,
} from "../../internals/composite/composite";
import { createSetFieldFocused, useFieldRootContext } from "../../internals/field-root-context";
import { createLabelableId } from "../../internals/labelable-provider";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { mergeRefs } from "../../internals/mergeRefs";
import { PrehydrationScript } from "../../internals/prehydration-script";
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import { ownerWindow } from "../../internals/utils/owner";
import { visuallyHidden } from "../../internals/utils/visuallyHidden";
import type { RebaseUIEvent } from "../../types";
import { getSliderStateSnapshot, type SliderRootState } from "../root/SliderRoot";
import { useSliderRootContext } from "../root/SliderRootContext";
import { createIsHydrating } from "../utils/createIsHydrating";
import { getMidpoint } from "../utils/getMidpoint";
import { script as prehydrationScript } from "./prehydrationScript.min";

const ALL_KEYS = new Set([...COMPOSITE_KEYS, PAGE_UP, PAGE_DOWN]);

function getDefaultAriaValueText(
  values: readonly number[],
  index: number,
  format: Intl.NumberFormatOptions | undefined,
  locale: Intl.LocalesArgument | undefined,
): string | undefined {
  if (index < 0) {
    return undefined;
  }

  if (values.length === 2) {
    return `${formatNumber(values[index], locale, format)} ${index === 0 ? "start" : "end"} range`;
  }

  return format ? formatNumber(values[index], locale, format) : undefined;
}

function getNewValue(thumbValue: number, increment: number, direction: number, min: number, max: number): number {
  const value = thumbValue + increment * direction;
  const roundedValue = Number(
    value.toFixed(Math.max(getDecimalPrecision(thumbValue), getDecimalPrecision(increment), getDecimalPrecision(min))),
  );
  return clamp(roundedValue, min, max);
}

function matchesFocusVisible(element: Element | null) {
  // happy-dom doesn't match `:focus-visible` when the element has `:focus`.
  if (!element || (typeof navigator !== "undefined" && /jsdom|happy-dom/i.test(navigator.userAgent))) {
    return true;
  }
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * The draggable part of the slider at the tip of the indicator.
 * Renders a `<div>` element and a nested `<input type="range">`.
 *
 * Documentation: [Rebase UI Slider](https://rebase-ui.knst.dev/components/slider)
 */
export function SliderThumb<T extends JSX.ElementType = "div">(props: SliderThumb.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "aria-describedby",
    "aria-label",
    "aria-labelledby",
    "aria-valuetext",
    "children",
    "disabled",
    "getAriaLabel",
    "getAriaValueText",
    "id",
    "index",
    "inputRef",
    "onBlur",
    "onFocus",
    "onKeyDown",
    "onPointerDown",
    "style",
    "tabIndex",
    "class",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  // Passed through untouched below (not resolved as a render prop), matching the Solid layer.
  const children = props.children;

  const {
    active: activeIndex,
    lastUsedThumbIndex,
    controlElement,
    disabled: contextDisabled,
    validation,
    format,
    handleInputChange,
    inset,
    isArrayValue,
    labelId,
    largeStep,
    locale,
    max,
    min,
    minStepsBetweenValues,
    form,
    name,
    orientation,
    setPressedThumbCenterOffset,
    setPressedThumbIndex,
    renderBeforeHydration,
    setActive,
    setIndicatorPosition,
    state,
    step,
    thumbRefs,
    values: sliderValues,
  } = useSliderRootContext();

  // Base UI reads this from DirectionProvider, which rebase-ui does not provide yet.
  // Defaults to 'ltr', matching upstream without a provider.
  // Written as a function so the type stays a union for the directional branches below.
  const direction = (): "ltr" | "rtl" => "ltr";
  const rtl = direction() === "rtl";

  const disabled = () => props.disabled || contextDisabled();
  const range = () => sliderValues().length > 1;
  const vertical = () => orientation() === "vertical";

  const { setTouched, validationMode } = useFieldRootContext();

  let thumbElement: HTMLElement | null = null;
  let inputElement: HTMLInputElement | null = null;
  const setFocused = createSetFieldFocused(disabled, () => inputElement);
  let restoringFocusVisible = false;

  // Attached to the `input` (not the thumb wrapper) so `event.currentTarget` is the
  // input, matching `onKeyDown`. The focus/blur dispatched while restoring
  // `:focus-visible` is internal and must not be forwarded to the user's handlers.
  function handleFocusProp(event: FocusEvent) {
    if (restoringFocusVisible) {
      return;
    }
    props.onFocus?.(event as FocusEvent & { currentTarget: HTMLInputElement });
  }

  function handleBlurProp(event: FocusEvent) {
    if (restoringFocusVisible) {
      return;
    }
    props.onBlur?.(event as FocusEvent & { currentTarget: HTMLInputElement });
  }

  const generatedThumbId = createUniqueId();
  const thumbId = () => props.id ?? generatedThumbId;

  const defaultInputId = createUniqueId();
  const labelableId = createLabelableId();
  const inputId = () => (range() ? defaultInputId : labelableId());

  const { ref: listItemRef, index: compositeIndex } = useCompositeListItem<ThumbMetadata>({
    metadata: () => ({
      inputId: inputId(),
    }),
  });

  const index = () => (!range() ? 0 : (props.index ?? compositeIndex()));
  const last = () => index() === sliderValues().length - 1;
  const thumbValue = () => sliderValues()[index()];
  const thumbValuePercent = () => valueToPercent(thumbValue() ?? min(), min(), max());

  const positionState = store({ positionPercent: undefined as number | undefined });
  const isHydrating = createIsHydrating();

  const safeLastUsedThumbIndex = () => {
    const lastUsed = lastUsedThumbIndex();
    return lastUsed >= 0 && lastUsed < sliderValues().length ? lastUsed : -1;
  };

  // Imperative measurement: runs from effect applies, a microtask and a ResizeObserver,
  // where reads cannot subscribe. The effects below track the inputs that must re-measure.
  function getInsetPosition() {
    untrack(() => {
      const control = controlElement();
      const thumb = thumbElement;
      if (!control || !thumb) {
        return;
      }

      const thumbRect = thumb.getBoundingClientRect();
      const controlRect = control.getBoundingClientRect();

      const side = vertical() ? "height" : "width";
      // the total travel distance adjusted to account for the thumb size
      const controlSize = controlRect[side] - thumbRect[side];
      // px distance from the starting edge (inline-start or bottom) to the thumb center
      const thumbOffsetFromControlEdge = thumbRect[side] / 2 + (controlSize * thumbValuePercent()) / 100;
      const nextPositionPercent = (thumbOffsetFromControlEdge / controlRect[side]) * 100;
      const nextInsetPosition = Number.isFinite(nextPositionPercent) ? nextPositionPercent : undefined;

      if (positionState.positionPercent !== nextInsetPosition) {
        positionState.positionPercent = nextInsetPosition;
      }

      if (index() === 0) {
        setIndicatorPosition((prevPosition) => [nextInsetPosition, prevPosition[1]]);
      } else if (last()) {
        setIndicatorPosition((prevPosition) => [prevPosition[0], nextInsetPosition]);
      }
    });
  }

  effect(() => {
    const isInset = inset();

    // The measurement below only writes, so the effect tracks just the inset flag above.
    untrack(() => {
      if (isInset) {
        queueMicrotask(getInsetPosition);
      }
    });
  });

  effect(() => {
    const tracked = { isInset: inset(), percent: thumbValuePercent(), isVertical: vertical() };

    // The measurement below only writes, so the effect tracks just the inset flag,
    // the value percent, and the orientation above.
    untrack(() => {
      if (tracked.isInset) {
        getInsetPosition();
      }
    });
  });

  effect(() => {
    const isInset = inset();

    untrack(() => {
      if (!isInset) {
        return;
      }

      const control = controlElement();
      const thumb = thumbElement;

      if (!control || !thumb) {
        return;
      }

      const ResizeObserverCtor = ownerWindow(control).ResizeObserver;
      if (typeof ResizeObserverCtor !== "function") {
        return;
      }

      const resizeObserver = new ResizeObserverCtor(getInsetPosition);

      resizeObserver.observe(control);
      resizeObserver.observe(thumb);

      onCleanup(() => {
        resizeObserver.disconnect();
      });
    });
  });

  const thumbZIndex = () => {
    const indexValue = index();
    if (range()) {
      if (activeIndex() === indexValue) {
        return 2;
      }
      if (safeLastUsedThumbIndex() === indexValue) {
        return 1;
      }
      return undefined;
    }
    if (activeIndex() === indexValue) {
      return 1;
    }
    return undefined;
  };

  const thumbStyle = (): JSX.CSSProperties => {
    const percent = thumbValuePercent();
    const isInset = inset();

    if (!isInset && !Number.isFinite(percent)) {
      return visuallyHidden;
    }

    const position = positionState.positionPercent;
    const hideBeforeHydration = renderBeforeHydration() && isHydrating();
    const isVertical = vertical();

    const styles: Record<string, unknown> = {
      position: "absolute",
      // NB: kebab-case is required. Object styles are applied via `CSSStyleDeclaration.setProperty`,
      // which silently ignores camelCase names such as `insetInlineStart` or `zIndex`.
      [isVertical ? "bottom" : "inset-inline-start"]: isInset ? "var(--position)" : `${percent}%`,
      [isVertical ? "left" : "top"]: "50%",
      translate: `${(isVertical || !rtl ? -1 : 1) * 50}% ${(isVertical ? 1 : -1) * 50}%`,
      "z-index": thumbZIndex(),
    };

    if (isInset) {
      styles["--position"] = `${position ?? 0}%`;
      styles.visibility = hideBeforeHydration || position === undefined ? ("hidden" as const) : undefined;
    }

    return styles as JSX.CSSProperties;
  };

  const inputWritingMode = () => {
    if (!vertical()) {
      return undefined;
    }
    return rtl ? ("vertical-rl" as const) : ("vertical-lr" as const);
  };

  const ariaLabel = () => (typeof props.getAriaLabel === "function" ? props.getAriaLabel(index()) : props["aria-label"]);

  function handleInputChangeFromEvent(event: Event & { currentTarget: HTMLInputElement }) {
    handleInputChange(event.currentTarget.valueAsNumber, index(), event);
  }

  function handleInputFocus(event: FocusEvent) {
    makeEventPreventable(event as RebaseUIEvent<FocusEvent>);
    handleFocusProp(event);
    if ((event as RebaseUIEvent<FocusEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    const wasRestoringFocusVisible = restoringFocusVisible;
    restoringFocusVisible = false;
    setActive(index());
    setFocused(true);

    if (wasRestoringFocusVisible) {
      event.stopPropagation();
    }
  }

  function handleInputBlur(event: FocusEvent) {
    makeEventPreventable(event as RebaseUIEvent<FocusEvent>);
    handleBlurProp(event);
    if ((event as RebaseUIEvent<FocusEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    if (restoringFocusVisible) {
      event.stopPropagation();
      return;
    }

    setActive(-1);

    // Keep field-level blur logic from running while focus moves to another thumb
    // of the same slider, so validation doesn't commit mid-interaction.
    if (thumbRefs().some((thumb) => thumb?.contains(event.relatedTarget as Node | null))) {
      return;
    }

    setTouched(true);
    setFocused(false);

    if (validationMode === "onBlur") {
      void validation.commit(getSliderValue(thumbValue() ?? min(), index(), min(), max(), isArrayValue(), sliderValues()));
    }
  }

  function handleInputKeyDown(event: KeyboardEvent) {
    makeEventPreventable(event as RebaseUIEvent<KeyboardEvent>);
    props.onKeyDown?.(event as KeyboardEvent & { currentTarget: HTMLInputElement });
    if ((event as RebaseUIEvent<KeyboardEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    if (event.defaultPrevented) {
      return;
    }

    if (!ALL_KEYS.has(event.key)) {
      return;
    }

    if (COMPOSITE_KEYS.has(event.key)) {
      event.stopPropagation();
    }

    let newValue: number | null = null;
    let directionValue = 0;
    let increment = event.shiftKey ? largeStep() : step();
    const currentValue = thumbValue() ?? min();
    const roundedValue = roundValueToStep(currentValue, step(), min());
    const currentValues = sliderValues();
    switch (event.key) {
      case ARROW_UP:
        directionValue = 1;
        break;
      case ARROW_RIGHT:
        directionValue = rtl ? -1 : 1;
        break;
      case ARROW_DOWN:
        directionValue = -1;
        break;
      case ARROW_LEFT:
        directionValue = rtl ? 1 : -1;
        break;
      case PAGE_UP:
        increment = largeStep();
        directionValue = 1;
        break;
      case PAGE_DOWN:
        increment = largeStep();
        directionValue = -1;
        break;
      case END:
        newValue =
          range() && Number.isFinite(currentValues[index() + 1]) ? currentValues[index() + 1] - step() * minStepsBetweenValues() : max();
        break;
      case HOME:
        newValue =
          range() && Number.isFinite(currentValues[index() - 1]) ? currentValues[index() - 1] + step() * minStepsBetweenValues() : min();
        break;
      default:
        break;
    }

    if (directionValue !== 0) {
      newValue = getNewValue(roundedValue, increment, directionValue, min(), max());
    }

    if (newValue !== null) {
      const input = event.currentTarget as HTMLInputElement;

      if (!matchesFocusVisible(input)) {
        restoringFocusVisible = true;
        input.blur();
        input.focus({
          preventScroll: true,
          // Show `:focus-visible` after keyboard interaction, even if the
          // thumb was previously focused by a pointer.
          focusVisible: true,
        } as FocusOptions);
      }

      handleInputChange(newValue, index(), event);
      event.preventDefault();
    }
  }

  function handleThumbPointerDown(event: PointerEvent) {
    // Keep disabled thumbs from writing transient pointer state.
    if (disabled()) {
      return;
    }

    const currentTarget = event.currentTarget as HTMLElement;
    setPressedThumbIndex(index());
    const midpoint = getMidpoint(currentTarget, vertical());
    setPressedThumbCenterOffset((vertical() ? event.clientY : event.clientX) - midpoint);
  }

  function handleWrapperPointerDown(event: PointerEvent): void {
    makeEventPreventable(event as RebaseUIEvent<PointerEvent>);
    (props.onPointerDown as unknown as ((event: PointerEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<PointerEvent>).rebaseUIHandlerPrevented) {
      return;
    }
    handleThumbPointerDown(event);
  }

  const mergedInputRef = mergeRefs(
    (element: HTMLInputElement | null) => {
      inputElement = element;
      if (element) {
        validation.registerInput(element, {
          get controlElement() {
            return controlElement();
          },
          value: undefined,
        });
      }
    },
    props.inputRef as ((element: HTMLInputElement | null) => void) | undefined,
  );

  const inputAriaValueText = () =>
    typeof props.getAriaValueText === "function"
      ? props.getAriaValueText(formatNumber(thumbValue() ?? min(), locale(), format()), thumbValue() ?? min(), index())
      : (props["aria-valuetext"] ?? getDefaultAriaValueText(sliderValues(), index(), format(), locale()));

  const externalInputValidationProps: Record<string, any> = {};
  Object.defineProperty(externalInputValidationProps, "aria-describedby", {
    enumerable: true,
    configurable: true,
    get: () => props["aria-describedby"],
  });
  const inputValidationProps = validation.getValidationProps(disabled, externalInputValidationProps);

  function snapshot(): SliderThumbState {
    return getSliderStateSnapshot(state);
  }

  // Stable ref identity with an identity guard: an unstable merged ref from a custom
  // `render` component re-fires with the same element on every update. Propagating each
  // re-fire would unregister/re-register the thumb in the composite registry, bumping
  // its version and cascading into recomputations (update loop). Only genuine
  // attach/detach transitions reach the registry.
  let thumbRefElement: HTMLElement | null = null;
  function handleThumbRef(element: HTMLElement | null): void {
    thumbElement = element;
    if (element === thumbRefElement) {
      return;
    }
    thumbRefElement = element;
    listItemRef(element);
  }

  const ref = mergeRefs(handleThumbRef, props.ref as ((element: HTMLElement | null) => void) | undefined);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts, which would drop the thumb's listeners every time a sibling appears or
  // disappears. The default path renders a static `<div>` so updates patch it in place; only a
  // customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        id={thumbId()}
        data-index={index()}
        data-dragging={state.dragging() ? "" : undefined}
        data-orientation={state.orientation()}
        data-disabled={state.disabled() ? "" : undefined}
        data-valid={state.valid() === true ? "" : undefined}
        data-invalid={state.valid() === false ? "" : undefined}
        data-touched={state.touched() ? "" : undefined}
        data-dirty={state.dirty() ? "" : undefined}
        data-filled={state.filled() ? "" : undefined}
        data-focused={state.focused() ? "" : undefined}
        data-validating={state.validating() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={mergeStyleValue(thumbStyle() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
        onPointerDown={handleWrapperPointerDown}
        ref={ref}
      >
        {children as JSX.Element}
        <input
          aria-label={ariaLabel()}
          aria-labelledby={props["aria-labelledby"] ?? (ariaLabel() == null ? labelId() : undefined)}
          aria-describedby={inputValidationProps["aria-describedby"]}
          aria-orientation={orientation()}
          aria-valuenow={thumbValue()}
          aria-valuetext={inputAriaValueText()}
          aria-invalid={inputValidationProps["aria-invalid"]}
          bool:disabled={disabled()}
          form={form()}
          id={inputId()}
          max={max()}
          min={min()}
          name={name()}
          step={step()}
          tabindex={props.tabIndex}
          type="range"
          value={thumbValue() ?? ""}
          style={{ ...visuallyHidden, width: "100%", height: "100%", "writing-mode": inputWritingMode() }}
          onChange={handleInputChangeFromEvent}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          ref={mergedInputRef}
        />
        {/* Rendered with the last thumb to ensure all preceding thumbs are already in the DOM. */}
        {inset() && last() && renderBeforeHydration() ? <PrehydrationScript script={prehydrationScript} /> : null}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={thumbId()}
      data-index={index()}
      data-dragging={state.dragging() ? "" : undefined}
      data-orientation={state.orientation()}
      data-disabled={state.disabled() ? "" : undefined}
      data-valid={state.valid() === true ? "" : undefined}
      data-invalid={state.valid() === false ? "" : undefined}
      data-touched={state.touched() ? "" : undefined}
      data-dirty={state.dirty() ? "" : undefined}
      data-filled={state.filled() ? "" : undefined}
      data-focused={state.focused() ? "" : undefined}
      data-validating={state.validating() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(thumbStyle() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
      onPointerDown={handleWrapperPointerDown}
      ref={ref}
    >
      {children as JSX.Element}
      <input
        aria-label={ariaLabel()}
        aria-labelledby={props["aria-labelledby"] ?? (ariaLabel() == null ? labelId() : undefined)}
        aria-describedby={inputValidationProps["aria-describedby"]}
        aria-orientation={orientation()}
        aria-valuenow={thumbValue()}
        aria-valuetext={inputAriaValueText()}
        aria-invalid={inputValidationProps["aria-invalid"]}
        bool:disabled={disabled()}
        form={form()}
        id={inputId()}
        max={max()}
        min={min()}
        name={name()}
        step={step()}
        tabindex={props.tabIndex}
        type="range"
        value={thumbValue() ?? ""}
        style={{ ...visuallyHidden, width: "100%", height: "100%", "writing-mode": inputWritingMode() }}
        onChange={handleInputChangeFromEvent}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        ref={mergedInputRef}
      />
      {/* Rendered with the last thumb to ensure all preceding thumbs are already in the DOM. */}
      {inset() && last() && renderBeforeHydration() ? <PrehydrationScript script={prehydrationScript} /> : null}
    </Tag>
  );
}

export interface ThumbMetadata {
  inputId: string | undefined;
}

export interface SliderThumbState extends SliderRootState {}

export interface SliderThumbOwnProps {
  /**
   * Whether the thumb should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A string value forwarded to the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the `input`.
   * Ignored when `getAriaValueText` is provided.
   */
  "aria-valuetext"?: string | undefined;
  /**
   * A function which returns a string value for the [`aria-label`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label) attribute of the `input`.
   */
  getAriaLabel?: ((index: number) => string) | null | undefined;
  /**
   * A function which returns a string value for the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the `input`.
   * This is important for screen reader users.
   */
  getAriaValueText?: ((formattedValue: string, value: number, index: number) => string) | null | undefined;
  /**
   * The index of the thumb which corresponds to the index of its value in the
   * `value` or `defaultValue` array.
   * This prop is required to support server-side rendering for range sliders
   * with multiple thumbs.
   * @example
   * ```tsx
   * <Slider.Root value={[10, 20]}>
   *   <Slider.Thumb index={0} />
   *   <Slider.Thumb index={1} />
   * </Slider.Root>
   * ```
   */
  index?: number | undefined;
  /**
   * A ref to access the nested input element.
   */
  inputRef?: ((element: HTMLInputElement) => void) | undefined;
  /**
   * A blur handler forwarded to the `input`.
   */
  onBlur?: ((event: FocusEvent & { currentTarget: HTMLInputElement }) => void) | undefined;
  /**
   * A focus handler forwarded to the `input`.
   */
  onFocus?: ((event: FocusEvent & { currentTarget: HTMLInputElement }) => void) | undefined;
  /**
   * A keydown handler forwarded to the `input`.
   */
  onKeyDown?: ((event: KeyboardEvent & { currentTarget: HTMLInputElement }) => void) | undefined;
  /**
   * Optional tab index attribute forwarded to the `input`.
   */
  tabIndex?: number | undefined;
}

export type SliderThumbProps<T extends JSX.ElementType = "div"> = SliderThumbOwnProps &
  Pick<ButtonEventHandlers, "onPointerDown"> &
  RebaseUIComponentProps<T, SliderThumbState>;

export namespace SliderThumb {
  export type State = SliderThumbState;
  export type Props<T extends JSX.ElementType = "div"> = SliderThumbProps<T>;
  export type OwnProps = SliderThumbOwnProps;
}
