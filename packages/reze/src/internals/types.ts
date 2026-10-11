import type { JSX, PropsOf } from "reze-js";

import type { RebaseUIEvent } from "../types";

export type Orientation = "horizontal" | "vertical";

export type ClassValue<State> =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, boolean>
  | readonly ClassValue<State>[]
  | ((state: State) => ClassValue<State>);

export type StyleValue<State> =
  | string
  | JSX.CSSProperties
  | null
  | undefined
  | ((state: State) => string | JSX.CSSProperties | null | undefined);

export type ChildrenValue<State> = JSX.Element | ((state: State) => JSX.Element) | undefined;

export interface ButtonEventHandlers {
  onClick?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onMouseDown?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onKeyUp?: ((event: RebaseUIEvent<KeyboardEvent>) => void) | undefined;
  onKeyDown?: ((event: RebaseUIEvent<KeyboardEvent>) => void) | undefined;
  onPointerDown?: ((event: RebaseUIEvent<PointerEvent>) => void) | undefined;
}

export type RebaseUIComponentProps<T extends JSX.ElementType, State> = Omit<
  PropsOf<T>,
  "as" | "children" | "class" | "style" | "ref" | "onClick" | "onMouseDown" | "onKeyUp" | "onKeyDown" | "onPointerDown"
> & {
  /**
   * Allows you to replace the component's HTML element
   * with a different tag, or compose it with another component.
   */
  as?: T | undefined;
  /**
   * CSS class applied to the element, or a function that
   * returns a class based on the component's state.
   */
  class?: ClassValue<State> | undefined;
  /**
   * Style applied to the element, or a function that
   * returns a style based on the component's state.
   */
  style?: StyleValue<State> | undefined;
  /**
   * The content of the component, or a function that
   * returns the content based on the component's state.
   */
  children?: ChildrenValue<State> | undefined;
  ref?: HTMLElement | ((element: any) => void) | undefined;
};

export interface NativeButtonProps {
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `as` prop.
   * Set to `false` if the rendered element is not a button (for example, `<span>`).
   * @default true
   */
  nativeButton?: boolean | undefined;
}

export interface NonNativeButtonProps {
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `as` prop.
   * Set to `true` if the rendered element is a native button.
   * @default false
   */
  nativeButton?: boolean | undefined;
}
