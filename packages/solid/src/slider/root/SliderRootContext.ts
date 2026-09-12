import type { Accessor, Setter } from "solid-js";

import type { CreateFieldValidationReturnValue } from "../../field/root/createFieldValidation";
import type { CompositeMetadata } from "../../internals/composite/list/CompositeListContext";
import { createContext, useContext } from "../../internals/context";
import type { Orientation } from "../../internals/types";
import type { ThumbMetadata } from "../thumb/SliderThumb";
import type { SliderRoot, SliderRootState, SliderThumbCollisionBehavior } from "./SliderRoot";

export interface SliderRootContext {
  /**
   * The index of the active thumb.
   */
  active: Accessor<number>;
  /**
   * The index of the most recently interacted thumb.
   */
  lastUsedThumbIndex: Accessor<number>;
  controlElement: Accessor<HTMLElement | null>;
  dragging: Accessor<boolean>;
  disabled: Accessor<boolean>;
  validation: CreateFieldValidationReturnValue;
  /**
   * Options to format the value.
   */
  format: Accessor<Intl.NumberFormatOptions | undefined>;
  handleInputChange: (valueInput: number, index: number, event: KeyboardEvent | Event) => void;
  indicatorPosition: Accessor<(number | undefined)[]>;
  inset: Accessor<boolean>;
  labelId: Accessor<string | undefined>;
  rootLabelId: Accessor<string | undefined>;
  /**
   * The large step value of the slider when incrementing or decrementing while the shift key is held,
   * or when using Page-Up or Page-Down keys. Snaps to multiples of this value.
   * @default 10
   */
  largeStep: Accessor<number>;
  lastChangeReason: Accessor<SliderRoot.ChangeEventReason>;
  setLastChangeReason: (reason: SliderRoot.ChangeEventReason) => void;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   */
  locale: Accessor<Intl.LocalesArgument | undefined>;
  /**
   * The maximum allowed value of the slider.
   */
  max: Accessor<number>;
  /**
   * The minimum allowed value of the slider.
   */
  min: Accessor<number>;
  /**
   * The minimum steps between values in a range slider.
   */
  minStepsBetweenValues: Accessor<number>;
  form: Accessor<string | undefined>;
  name: Accessor<string | undefined>;
  /**
   * Function to be called when drag ends and the pointer is released.
   */
  onValueCommitted: (newValue: number | readonly number[], data: SliderRoot.CommitEventDetails) => void;
  /**
   * The component orientation.
   * @default 'horizontal'
   */
  orientation: Accessor<Orientation>;
  pressedThumbCenterOffset: Accessor<number | null>;
  setPressedThumbCenterOffset: (offset: number | null) => void;
  pressedThumbIndex: Accessor<number>;
  setPressedThumbIndex: (index: number) => void;
  pressedValues: Accessor<readonly number[] | null>;
  setPressedValues: (values: readonly number[] | null) => void;
  renderBeforeHydration: Accessor<boolean>;
  registerFieldControlRef: (element: HTMLElement | null) => void;
  setActive: (index: number) => void;
  setDragging: Setter<boolean>;
  setIndicatorPosition: Setter<(number | undefined)[]>;
  setLabelId: Setter<string | undefined>;
  /**
   * Applies a new value through `onValueChange` for keyboard, input, track-press,
   * and drag interactions. Returns `true` when the value was applied, or `false`
   * when it was invalid (NaN), unchanged, or the change was canceled.
   */
  setValue: (newValue: number | number[], details: SliderRoot.ChangeEventDetails) => boolean;
  state: SliderRootState;
  /**
   * The step increment of the slider when incrementing or decrementing. It will snap
   * to multiples of this value. Decimal values are supported.
   * @default 1
   */
  step: Accessor<number>;
  thumbCollisionBehavior: Accessor<SliderThumbCollisionBehavior>;
  thumbMap: Accessor<Map<HTMLElement, CompositeMetadata<ThumbMetadata>>>;
  thumbRefs: Accessor<readonly (HTMLElement | null)[]>;
  /**
   * The value(s) of the slider
   */
  values: Accessor<readonly number[]>;
}

export const SliderRootContext = createContext<SliderRootContext>();

export function useSliderRootContext(): SliderRootContext {
  const context = useContext(SliderRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: SliderRootContext is missing. Slider parts must be placed within <Slider.Root>.");
  }

  return context;
}
