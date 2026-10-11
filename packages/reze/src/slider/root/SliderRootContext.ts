import { createContext, useContext } from "reze-js";

import type { CreateFieldValidationReturnValue } from "../../field/root/createFieldValidation";
import type { CompositeMetadata } from "../../internals/composite/list/CompositeListContext";
import type { RegisteredLabelIdSetter } from "../../internals/labelable-provider/createRegisteredLabelId";
import type { Orientation } from "../../internals/types";
import type { ThumbMetadata } from "../thumb/SliderThumb";
import type { SliderRoot, SliderRootStateSelectors, SliderThumbCollisionBehavior } from "./SliderRoot";

export interface SliderRootContext {
  /**
   * The index of the active thumb.
   */
  active: () => number;
  /**
   * The index of the most recently interacted thumb.
   */
  lastUsedThumbIndex: () => number;
  controlElement: () => HTMLElement | null;
  dragging: () => boolean;
  disabled: () => boolean;
  validation: CreateFieldValidationReturnValue;
  /**
   * Options to format the value.
   */
  format: () => Intl.NumberFormatOptions | undefined;
  handleInputChange: (valueInput: number, index: number, event: KeyboardEvent | Event) => void;
  indicatorPosition: () => (number | undefined)[];
  inset: () => boolean;
  /**
   * Whether the slider value is an array, including single-thumb arrays.
   */
  isArrayValue: () => boolean;
  labelId: () => string | undefined;
  rootLabelId: () => string | undefined;
  /**
   * The large step value of the slider when incrementing or decrementing while the shift key is held,
   * or when using Page-Up or Page-Down keys. Snaps to multiples of this value.
   * @default 10
   */
  largeStep: () => number;
  lastChangeReason: () => SliderRoot.ChangeEventReason;
  setLastChangeReason: (reason: SliderRoot.ChangeEventReason) => void;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   */
  locale: () => Intl.LocalesArgument | undefined;
  /**
   * The maximum allowed value of the slider.
   */
  max: () => number;
  /**
   * The minimum allowed value of the slider.
   */
  min: () => number;
  /**
   * The minimum steps between values in a range slider.
   */
  minStepsBetweenValues: () => number;
  form: () => string | undefined;
  name: () => string | undefined;
  /**
   * Function to be called when drag ends and the pointer is released.
   */
  onValueCommitted: (newValue: number | readonly number[], data: SliderRoot.CommitEventDetails) => void;
  /**
   * The component orientation.
   * @default 'horizontal'
   */
  orientation: () => Orientation;
  pressedThumbCenterOffset: () => number | null;
  setPressedThumbCenterOffset: (offset: number | null) => void;
  pressedThumbIndex: () => number;
  setPressedThumbIndex: (index: number) => void;
  pressedValues: () => readonly number[] | null;
  setPressedValues: (values: readonly number[] | null) => void;
  renderBeforeHydration: () => boolean;
  registerFieldControlRef: (element: HTMLElement | null) => void;
  setActive: (index: number) => void;
  setDragging: (dragging: boolean) => void;
  setIndicatorPosition: (next: (number | undefined)[] | ((prev: (number | undefined)[]) => (number | undefined)[])) => void;
  setLabelId: RegisteredLabelIdSetter;
  /**
   * Applies a new value through `onValueChange` for keyboard, input, track-press,
   * and drag interactions. Returns `true` when the value was applied, or `false`
   * when it was invalid (NaN), unchanged, or the change was canceled.
   */
  setValue: (newValue: number | number[], details: SliderRoot.ChangeEventDetails) => boolean;
  state: SliderRootStateSelectors;
  /**
   * The step increment of the slider when incrementing or decrementing. It will snap
   * to multiples of this value. Decimal values are supported.
   * @default 1
   */
  step: () => number;
  thumbCollisionBehavior: () => SliderThumbCollisionBehavior;
  thumbMap: () => Map<HTMLElement, CompositeMetadata<ThumbMetadata>>;
  thumbRefs: () => readonly HTMLElement[];
  /**
   * The value(s) of the slider
   */
  values: () => readonly number[];
}

export const SliderRootContext = createContext<SliderRootContext | undefined>(undefined);

export function useSliderRootContext(): SliderRootContext {
  const context = useContext(SliderRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: SliderRootContext is missing. Slider parts must be placed within <Slider.Root>.");
  }

  return context;
}
