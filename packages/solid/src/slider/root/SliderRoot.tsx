import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createSignal, createUniqueId, untrack } from "solid-js";

import type { FieldRootState } from "../../field/root/FieldRoot";
import { CompositeListContext, createCompositeList } from "../../internals/composite";
import { createControllableSignal } from "../../internals/createControllableSignal";
import {
  createChangeEventDetails,
  createGenericEventDetails,
  REASONS,
  type RebaseUIChangeEventDetails,
  type RebaseUIGenericEventDetails,
} from "../../internals/event-details";
import { createRegisterFieldControl } from "../../internals/field-register-control";
import { useFieldRootContext } from "../../internals/field-root-context";
import { useFormContext } from "../../internals/form-context";
import { useLabelableContext } from "../../internals/labelable-provider";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import { stableCallback } from "../../internals/stableCallback";
import type { Orientation, RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument } from "../../internals/utils/owner";
import type { ThumbMetadata } from "../thumb/SliderThumb";
import { areArraysEqual } from "../utils/areArraysEqual";
import { asc } from "../utils/asc";
import { clamp } from "../utils/clamp";
import { getSliderValue } from "../utils/getSliderValue";
import { validateMinimumDistance } from "../utils/validateMinimumDistance";
import { SliderRootContext } from "./SliderRootContext";
import { sliderStateAttributesMapping } from "./stateAttributesMapping";

function areValuesEqual(newValue: number | readonly number[], oldValue: number | readonly number[]) {
  return newValue === oldValue || (Array.isArray(newValue) && Array.isArray(oldValue) && areArraysEqual(newValue, oldValue));
}

export function getDefaultLabelId(id: string | null | undefined) {
  return id == null ? undefined : `${id}-label`;
}

function resolveAriaLabelledBy(fieldLabelId: string | undefined, localLabelId: string | undefined) {
  return fieldLabelId ?? localLabelId;
}

/**
 * Groups all parts of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Slider](https://rebase-ui.knst.dev/components/slider)
 */
export function SliderRoot<Value extends number | readonly number[], T extends ValidComponent = "div">(props: SliderRoot.Props<Value, T>) {
  const [local, elementProps] = split(props as SliderRoot.Props, { default: defaultProps }, [
    "as",
    "aria-labelledby",
    "defaultValue",
    "disabled",
    "id",
    "format",
    "largeStep",
    "locale",
    "max",
    "min",
    "minStepsBetweenValues",
    "form",
    "name",
    "onValueChange",
    "onValueCommitted",
    "orientation",
    "step",
    "thumbAlignment",
    "thumbCollisionBehavior",
    "value",
  ]);

  const as = untrack(() => local.as);

  const generatedId = createUniqueId();
  // `||` rather than `??`: an empty or removed `id` falls back to the generated one.
  const id = () => local.id || generatedId;
  const defaultLabelId = () => getDefaultLabelId(id());

  const onValueChange = stableCallback(
    () => local.onValueChange as ((value: number | number[], eventDetails: SliderRoot.ChangeEventDetails) => void) | undefined,
  );
  const onValueCommitted = stableCallback(
    () => local.onValueCommitted as ((value: number | readonly number[], eventDetails: SliderRoot.CommitEventDetails) => void) | undefined,
  );

  const { clearErrors } = useFormContext();
  const {
    state: fieldState,
    disabled: fieldDisabled,
    name: fieldName,
    setTouched,
    setDirty,
    validityData,
    validation,
  } = useFieldRootContext();
  const { labelId: fieldLabelId } = useLabelableContext();
  const [labelId, setLabelId] = createSignal<string | undefined>(undefined);

  const ariaLabelledby = () => (local["aria-labelledby"] || undefined) ?? resolveAriaLabelledBy(fieldLabelId(), labelId());
  const disabled = createMemo(() => fieldDisabled() === true || local.disabled === true);
  const name = () => fieldName() ?? local.name;

  // The internal value is potentially unsorted, e.g. to support frozen arrays
  // https://github.com/mui/material-ui/pull/28472
  const [valueUnwrapped, setValueUnwrapped] = createControllableSignal<Value>({
    value: () => local.value as Value | undefined,
    defaultValue: () => (local.defaultValue ?? local.min) as Value,
  });

  let sliderElement: HTMLElement | null = null;
  let controlElement: HTMLElement | null = null;
  // The px distance between the pointer and the center of a pressed thumb.
  let pressedThumbCenterOffset: number | null = null;
  // The index of the pressed thumb, or the closest thumb if the `Control` was pressed.
  // This is updated on pointerdown, which is sooner than the `active/activeIndex`
  // state which is updated later when the nested `input` receives focus.
  let pressedThumbIndex = -1;
  // The values when the current drag interaction started.
  let pressedValues: readonly number[] | null = null;
  let lastChangeReason: SliderRoot.ChangeEventReason = REASONS.none;

  // We can't use the :active browser pseudo-classes.
  // - The active state isn't triggered when clicking on the rail.
  // - The active state isn't transferred when inversing a range slider.
  const [active, setActiveState] = createSignal(-1);
  const [lastUsedThumbIndex, setLastUsedThumbIndex] = createSignal(-1);
  const [dragging, setDragging] = createSignal(false);
  const thumbList = createCompositeList<ThumbMetadata>();
  const [indicatorPosition, setIndicatorPosition] = createSignal<(number | undefined)[]>([undefined, undefined]);

  const setActive = (value: number) => {
    setActiveState(value);

    if (value !== -1) {
      setLastUsedThumbIndex(value);
    }
  };

  const registerFieldControlRef = (element: HTMLElement | null) => {
    if (element) {
      controlElement = element;
    }
  };

  // Stable ref identity: recreating this callback would re-fire the root ref,
  // which cascades into redundant registry/effect work on every update.
  const setSliderRef = (element: HTMLElement | null) => {
    sliderElement = element;
  };

  const range = () => Array.isArray(valueUnwrapped());

  const values = createMemo(() => {
    const unwrapped = valueUnwrapped();
    const min = local.min;
    const max = local.max;

    if (!Array.isArray(unwrapped)) {
      return [clamp(unwrapped as number, min, max)];
    }
    return (unwrapped as readonly number[]).map((value) => clamp(value, min, max)).sort(asc);
  });

  const fieldValue = () => (range() ? values() : values()[0]);

  createRegisterFieldControl({
    controlElement: () => controlElement,
    id: () => id(),
    value: fieldValue,
    enabled: () => !disabled(),
    name: () => local.name,
  });

  let previousFieldValue = untrack(fieldValue);
  createEffect(
    () => fieldValue(),
    (nextFieldValue) => {
      if (previousFieldValue === nextFieldValue) {
        return;
      }

      previousFieldValue = nextFieldValue;
      const currentName = untrack(name);

      clearErrors(currentName);
      validation.change(nextFieldValue);

      const initialValue = untrack(() => validityData.initialValue) as number | readonly number[] | undefined;
      let isDirty: boolean;
      if (Array.isArray(nextFieldValue) && Array.isArray(initialValue)) {
        isDirty = !areArraysEqual(nextFieldValue, initialValue);
      } else {
        isDirty = nextFieldValue !== initialValue;
      }
      setDirty(isDirty);
    },
  );

  function setValue(newValue: number | number[], details: SliderRoot.ChangeEventDetails): boolean {
    if (typeof newValue === "number" && Number.isNaN(newValue)) {
      return false;
    }

    if (areValuesEqual(newValue, valueUnwrapped())) {
      return false;
    }

    // Redefine target to allow name and value to be read.
    // This allows seamless integration with the most popular form libraries.
    // https://github.com/mui/material-ui/issues/13485#issuecomment-676048492
    // Clone the event to not override `target` of the original event.
    const nativeEvent = details.event;
    const EventConstructor = nativeEvent.constructor as typeof Event;
    const clonedEvent = new EventConstructor(nativeEvent.type, nativeEvent);

    Object.defineProperty(clonedEvent, "target", {
      writable: true,
      value: { value: newValue, name: name() },
    });

    (details as { event: Event }).event = clonedEvent;

    onValueChange(newValue, details);

    if (details.isCanceled) {
      return false;
    }

    lastChangeReason = details.reason;

    setValueUnwrapped(newValue as Value);

    return true;
  }

  function handleInputChange(valueInput: number, index: number, event: KeyboardEvent | Event): void {
    const newValue = getSliderValue(valueInput, index, local.min, local.max, range(), values());

    if (validateMinimumDistance(newValue, local.step, local.minStepsBetweenValues)) {
      const reason = "key" in event ? REASONS.keyboard : REASONS.inputChange;
      const applied = setValue(
        newValue,
        createChangeEventDetails(reason, event as never, undefined, {
          activeThumbIndex: index,
        }),
      );
      setTouched(true);

      if (applied) {
        onValueCommitted(newValue, createGenericEventDetails(reason, event as never));
      }
    }
  }

  createEffect(
    () => ({ isDisabled: disabled(), activeIndex: active() }),
    ({ isDisabled, activeIndex }) => {
      if (!isDisabled) {
        return;
      }

      const activeElement = ownerDocument(sliderElement).activeElement as HTMLElement | null;
      if (sliderElement && activeElement && sliderElement.contains(activeElement)) {
        // This is necessary because Firefox and Safari will keep focus
        // on a disabled element:
        // https://codesandbox.io/p/sandbox/mui-pr-22247-forked-h151h?file=/src/App.js
        activeElement.blur();
      }

      if (activeIndex !== -1) {
        setActive(-1);
      }
    },
  );

  const state: SliderRootState = {
    ...fieldState,
    activeThumbIndex: active,
    disabled,
    dragging,
    orientation: () => local.orientation,
    max: () => local.max,
    min: () => local.min,
    minStepsBetweenValues: () => local.minStepsBetweenValues,
    step: () => local.step,
    values,
  };

  const contextValue: SliderRootContext = {
    active,
    controlElement: () => controlElement,
    disabled,
    dragging,
    validation,
    format: () => local.format,
    handleInputChange,
    indicatorPosition,
    inset: () => local.thumbAlignment !== "center",
    labelId: ariaLabelledby,
    rootLabelId: defaultLabelId,
    largeStep: () => local.largeStep,
    lastUsedThumbIndex,
    lastChangeReason: () => lastChangeReason,
    form: () => local.form,
    locale: () => local.locale,
    max: () => local.max,
    min: () => local.min,
    minStepsBetweenValues: () => local.minStepsBetweenValues,
    name,
    onValueCommitted,
    orientation: () => local.orientation,
    pressedThumbCenterOffset: () => pressedThumbCenterOffset,
    pressedThumbIndex: () => pressedThumbIndex,
    pressedValues: () => pressedValues,
    registerFieldControlRef,
    renderBeforeHydration: () => local.thumbAlignment === "edge",
    setActive,
    setDragging,
    setIndicatorPosition,
    setLabelId,
    setLastChangeReason: (reason) => {
      lastChangeReason = reason;
    },
    setPressedThumbCenterOffset: (offset) => {
      pressedThumbCenterOffset = offset;
    },
    setPressedThumbIndex: (index) => {
      pressedThumbIndex = index;
    },
    setPressedValues: (values) => {
      pressedValues = values;
    },
    setValue,
    state,
    step: () => local.step,
    thumbCollisionBehavior: () => local.thumbCollisionBehavior,
    thumbMap: thumbList.map,
    thumbRefs: thumbList.elements,
    values,
  };

  return (
    <SliderRootContext value={contextValue}>
      <CompositeListContext value={thumbList.contextValue}>
        <RenderElement
          as={as}
          state={state}
          props={[
            {
              get "aria-labelledby"() {
                return ariaLabelledby();
              },
              get id() {
                return id();
              },
              role: "group" as const,
            },
            elementProps,
            (props) => validation.getValidationProps(disabled(), props),
            {
              ref: setSliderRef,
            },
          ]}
          stateAttributesMapping={sliderStateAttributesMapping}
        />
      </CompositeListContext>
    </SliderRootContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  disabled: false,
  largeStep: 10,
  max: 100,
  min: 0,
  minStepsBetweenValues: 0,
  orientation: "horizontal",
  step: 1,
  thumbAlignment: "center",
  thumbCollisionBehavior: "push",
} satisfies Partial<SliderRoot.Props>);

export interface SliderRootState extends FieldRootState {
  /**
   * The index of the active thumb.
   */
  activeThumbIndex: Accessor<number>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  /**
   * Whether the thumb is currently being dragged.
   */
  dragging: Accessor<boolean>;
  /**
   * The maximum value.
   */
  max: Accessor<number>;
  /**
   * The minimum value.
   */
  min: Accessor<number>;
  /**
   * The minimum steps between values in a range slider.
   * @default 0
   */
  minStepsBetweenValues: Accessor<number>;
  /**
   * The component orientation.
   */
  orientation: Accessor<Orientation>;
  /**
   * The step increment of the slider when incrementing or decrementing. It will snap
   * to multiples of this value. Decimal values are supported.
   * @default 1
   */
  step: Accessor<number>;
  /**
   * The raw number value of the slider.
   */
  values: Accessor<readonly number[]>;
}

export interface SliderRootOwnProps<Value extends number | readonly number[] = number | readonly number[]> {
  /**
   * The uncontrolled value of the slider when it's initially rendered.
   *
   * To render a controlled slider, use the `value` prop instead.
   */
  defaultValue?: Value | undefined;
  /**
   * Whether the slider should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum allowed value of the slider.
   * Should not be equal to min.
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum allowed value of the slider.
   * Should not be equal to max.
   * @default 0
   */
  min?: number | undefined;
  /**
   * The minimum steps between values in a range slider.
   * @default 0
   */
  minStepsBetweenValues?: number | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the slider inputs.
   * Useful when the slider is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The component orientation.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
  /**
   * The granularity with which the slider can step through values. (A "discrete" slider.)
   * The `min` prop serves as the origin for the valid values.
   * We recommend (max - min) to be evenly divisible by the step.
   * @default 1
   */
  step?: number | undefined;
  /**
   * The granularity with which the slider can step through values when using Page Up/Page Down or Shift + Arrow Up/Arrow Down.
   * @default 10
   */
  largeStep?: number | undefined;
  /**
   * How the thumb(s) are aligned relative to `Slider.Control` when the value is at `min` or `max`:
   * - `center`: The center of the thumb is aligned with the control edge
   * - `edge`: The thumb is inset within the control such that its edge is aligned with the control edge
   * - `edge-client-only`: Same as `edge` but renders after React hydration on the client, reducing bundle size in return
   * @default 'center'
   */
  thumbAlignment?: "center" | "edge" | "edge-client-only" | undefined;
  /**
   * Controls how thumbs behave when they collide during pointer interactions.
   *
   * - `'push'` (default): Thumbs push each other without restoring their previous positions when dragged back.
   * - `'swap'`: Thumbs swap places when dragged past each other.
   * - `'none'`: Thumbs cannot move past each other; excess movement is ignored.
   *
   * @default 'push'
   */
  thumbCollisionBehavior?: SliderThumbCollisionBehavior | undefined;
  /**
   * The value of the slider.
   * For range sliders, provide an array with one value per thumb.
   */
  value?: Value | undefined;
  /**
   * Callback function that is fired when the slider's value changed.
   * Receives the new value as the first argument; the originating event is
   * available as `eventDetails.event`. The value is also reflected on
   * `eventDetails.event.target.value` for form integration.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   *
   * - `'input-change'` when the hidden range input emits a change event (for example, via form integration)
   * - `'track-press'` when the control track is pressed
   * - `'drag'` while dragging a thumb
   * - `'keyboard'` for keyboard input
   * - `'none'` when the change is triggered without a specific interaction
   */
  onValueChange?: ((value: Value extends number ? number : Value, eventDetails: SliderRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Callback function that is fired when a value change is committed.
   * Does not fire if the value did not change, or if the change was canceled.
   * **Warning**: This is a generic event, not a change event.
   *
   * The `eventDetails.reason` indicates what triggered the commit:
   *
   * - `'drag'` while dragging a thumb
   * - `'track-press'` when the control track is pressed
   * - `'keyboard'` for keyboard input
   * - `'input-change'` when the hidden range input emits a change event (for example, via form integration)
   * - `'none'` when the commit occurs without a specific interaction
   */
  onValueCommitted?: ((value: Value extends number ? number : Value, eventDetails: SliderRoot.CommitEventDetails) => void) | undefined;
}

export type SliderThumbCollisionBehavior = "push" | "swap" | "none";

export interface SliderRootChangeEventCustomProperties {
  /**
   * The index of the active thumb at the time of the change.
   */
  activeThumbIndex: number;
}

export type SliderRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.trackPress
  | typeof REASONS.drag
  | typeof REASONS.keyboard
  | typeof REASONS.none;
export type SliderRootChangeEventDetails = RebaseUIChangeEventDetails<SliderRoot.ChangeEventReason, SliderRootChangeEventCustomProperties>;

export type SliderRootCommitEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.trackPress
  | typeof REASONS.drag
  | typeof REASONS.keyboard
  | typeof REASONS.none;
export type SliderRootCommitEventDetails = RebaseUIGenericEventDetails<SliderRoot.CommitEventReason>;

export type SliderRootProps<
  Value extends number | readonly number[] = number | readonly number[],
  T extends ValidComponent = "div",
> = SliderRootOwnProps<Value> & RebaseUIComponentProps<T, SliderRootState>;

export namespace SliderRoot {
  export type ThumbCollisionBehavior = SliderThumbCollisionBehavior;
  export type State = SliderRootState;
  export type Props<
    Value extends number | readonly number[] = number | readonly number[],
    T extends ValidComponent = "div",
  > = SliderRootProps<Value, T>;
  export type OwnProps<Value extends number | readonly number[] = number | readonly number[]> = SliderRootOwnProps<Value>;
  export type ChangeEventReason = SliderRootChangeEventReason;
  export type ChangeEventDetails = SliderRootChangeEventDetails;
  export type CommitEventReason = SliderRootCommitEventReason;
  export type CommitEventDetails = SliderRootCommitEventDetails;
}
