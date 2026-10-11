import { untrack } from "reze-js";

import type { RebaseUIEvent } from "../../types";
import { createFocusableWhenDisabledProps } from "../createFocusableWhenDisabledProps";
import { dispatchClickWithModifiers } from "../dispatchClickWithModifiers";
import { makeEventPreventable } from "../makeEventPreventable";
import type { ButtonEventHandlers } from "../types";
import { error } from "../utils/error";
import { warnNestedInteractive } from "../utils/warnNestedInteractive";

export interface CreateButtonParameters extends ButtonEventHandlers {
  disabled?: boolean | undefined;
  focusableWhenDisabled?: boolean | undefined;
  nativeButton?: boolean | undefined;
  ref?: HTMLElement | ((element: any) => void) | undefined;
}

export interface CreateButtonReturnValue {
  onClick: (event: MouseEvent) => void;
  onMouseDown: (event: MouseEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onKeyUp: (event: KeyboardEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  buttonRef: (element: HTMLElement | null) => void;
  /**
   * Native button attributes. Getters read the live parameters when accessed,
   * so JSX bindings using them stay reactive.
   */
  readonly type: "button" | undefined;
  readonly role: "button" | undefined;
  readonly disabled: boolean | undefined;
  readonly tabIndex: number | undefined;
  readonly ariaDisabled: "true" | "false" | undefined;
}

/**
 * Stable button handlers and attributes over a live props object. Handlers run per event
 * and read the current prop values then; attribute getters do the same when the JSX
 * bindings using them evaluate, so everything stays reactive without subscriptions here.
 */
export function createButton(parameters: CreateButtonParameters): CreateButtonReturnValue {
  const disabled = () => parameters.disabled === true;
  const focusableWhenDisabled = () => parameters.focusableWhenDisabled;
  const isNativeButton = () => parameters.nativeButton ?? true;

  const focusableProps = () =>
    createFocusableWhenDisabledProps({
      disabled: disabled(),
      focusableWhenDisabled: focusableWhenDisabled(),
      isNativeButton: isNativeButton(),
    });

  const onClick = (event: MouseEvent) => {
    if (disabled()) {
      event.preventDefault();
      return;
    }

    (parameters.onClick as ((event: MouseEvent) => void) | undefined)?.(event);
  };

  const onMouseDown = (event: MouseEvent) => {
    if (!disabled()) {
      (parameters.onMouseDown as ((event: MouseEvent) => void) | undefined)?.(event);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (disabled() && focusableWhenDisabled() && event.key !== "Tab") {
      event.preventDefault();
    }

    if (disabled()) {
      return;
    }

    makeEventPreventable(event as RebaseUIEvent<KeyboardEvent>);
    (parameters.onKeyDown as ((event: KeyboardEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<KeyboardEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    const isCurrentTarget = event.target === event.currentTarget;
    const currentTarget = event.currentTarget as Element;
    const isButton = isButtonElement(currentTarget);
    const isSpaceKey = event.key === " ";

    const isLink = !isNativeButton() && isValidLinkElement(currentTarget);
    const shouldClick = isCurrentTarget && (isNativeButton() ? isButton : !isLink);
    const isEnterKey = event.key === "Enter";

    if (!shouldClick || isNativeButton() || (!isSpaceKey && !isEnterKey)) {
      if (isCurrentTarget && isLink && isSpaceKey) {
        event.preventDefault();
      }

      return;
    }

    if (event.defaultPrevented) {
      return;
    }

    event.preventDefault();

    if (isEnterKey) {
      (event as RebaseUIEvent<KeyboardEvent>).preventRebaseUIHandler();
      dispatchClickWithModifiers(currentTarget, event);
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (disabled()) {
      return;
    }

    makeEventPreventable(event as RebaseUIEvent<KeyboardEvent>);
    (parameters.onKeyUp as ((event: KeyboardEvent) => void) | undefined)?.(event);

    if ((event as RebaseUIEvent<KeyboardEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    if (event.target === event.currentTarget && !isNativeButton() && !event.defaultPrevented && event.key === " ") {
      (event as RebaseUIEvent<KeyboardEvent>).preventRebaseUIHandler();
      dispatchClickWithModifiers(event.currentTarget as Element, event);
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (disabled()) {
      event.preventDefault();
      return;
    }

    (parameters.onPointerDown as ((event: PointerEvent) => void) | undefined)?.(event);
  };

  const buttonRef = (element: HTMLElement | null) => {
    if (element !== null && process.env.NODE_ENV !== "production") {
      // Deferred past mount so nested children are attached before the nesting
      // check runs (mirrors Solid's `onSettled` timing).
      queueMicrotask(() => warnNestedInteractive(element));
      const isButtonTag = isButtonElement(element);

      if (isNativeButton()) {
        if (!isButtonTag) {
          error(
            "A component that acts as a button expected a native <button> because " +
              "the `nativeButton` prop is true. Rendering a non-<button> removes native button " +
              "semantics, which can impact forms and accessibility. Use a real <button> in the " +
              "`as` prop, or set `nativeButton` to `false`.",
          );
        }
      } else if (isButtonTag) {
        error(
          "A component that acts as a button expected a non-<button> because the `nativeButton` " +
            "prop is false. Rendering a <button> keeps native behavior while Rebase UI applies " +
            "non-native attributes and handlers, which can add unintended extra attributes (such " +
            "as `role` or `aria-disabled`). Use a non-<button> in the `as` prop, or set " +
            "`nativeButton` to `true`.",
        );
      }
    }

    const ref = parameters.ref;
    if (typeof ref === "function") {
      untrack(ref, element);
    }
  };

  return {
    onClick,
    onMouseDown,
    onKeyDown,
    onKeyUp,
    onPointerDown,
    buttonRef,
    get type() {
      return isNativeButton() ? "button" : undefined;
    },
    get role() {
      return isNativeButton() ? undefined : "button";
    },
    get disabled() {
      return focusableProps().disabled;
    },
    get tabIndex() {
      return focusableProps().tabIndex;
    },
    get ariaDisabled() {
      return focusableProps()["aria-disabled"];
    },
  };
}

function isHTMLElement(element: unknown): element is HTMLElement {
  return typeof HTMLElement !== "undefined" && element instanceof HTMLElement;
}

function isButtonElement(element: Element | null): element is HTMLButtonElement {
  return isHTMLElement(element) && element.tagName === "BUTTON";
}

function isValidLinkElement(element: Element | null): element is HTMLAnchorElement {
  return isHTMLElement(element) && element.tagName === "A" && Boolean((element as HTMLAnchorElement).href);
}
