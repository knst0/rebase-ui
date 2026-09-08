import type { ComponentProps, JSX, ValidComponent } from "@solidjs/web";

import type { RebaseUIEvent } from "../types";

export type ClassValue<State> =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, boolean>
  | ClassValue<State>[]
  | ((state: State) => ClassValue<State>);

type WithPreventRebaseUIHandler<T> = T extends (event: infer E) => any
  ? E extends Event
    ? (event: RebaseUIEvent<E>) => ReturnType<T>
    : T
  : T extends undefined
    ? undefined
    : T;

/**
 * Adds a `preventBaseUIHandler` method to all event handlers.
 */
export type WithRebaseUIEvent<T> = {
  [K in keyof T]: WithPreventRebaseUIHandler<T[K]>;
};

export type RebaseUIComponentProps<T extends ValidComponent, State> = Omit<
  WithRebaseUIEvent<ComponentProps<T>>,
  "children" | "class" | "defaultValue" | "defaultChecked" | "style"
> & {
  /**
   * CSS class applied to the element, or a function that
   * returns a class based on the component's state.
   */
  class?: ClassValue<State>;
  /**
   * Allows you to replace the component's HTML element
   * with a different tag, or compose it with another component.
   */
  as?: T | undefined;
  /**
   * Style applied to the element, or a function that
   * returns a style object based on the component's state.
   */
  style?: JSX.CSSProperties | ((state: State) => JSX.CSSProperties | undefined) | undefined;
  /**
   * The content of the component, or a function that
   * returns the content based on the component's state.
   */
  children?: JSX.Element | ((state: State) => JSX.Element) | undefined;
};

export interface NativeButtonProps {
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `render` prop.
   * Set to `false` if the rendered element is not a button (for example, `<div>`).
   * @default true
   */
  nativeButton?: boolean | undefined;
}

export type Orientation = "horizontal" | "vertical";

/**
 * A mutable holder for a component's imperative actions.
 * The component assigns `current` on mount and clears it on cleanup.
 */
export interface ActionsRef<Actions> {
  current: Actions | null;
}

/**
 * Identity of a component registering itself with a parent registry.
 * The registering scope's owner is used, so a registration is tied to the
 * lifetime of the component that made it.
 */
export type RegistrationSource = object;
