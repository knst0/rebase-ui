import { createEffect, createSignal, onSettled, untrack } from "solid-js";

import { dispatchClickWithModifiers } from "#utils/dispatchClickWithModifiers";
import { error } from "#utils/error";

import type { RebaseUIEvent } from "../../types";
import { useCompositeRootContext } from "../composite";
import { createFocusableWhenDisabledProps, type FocusableWhenDisabledProps } from "../createFocusableWhenDisabledProps";
import { makeEventPreventable } from "../makeEventPreventable";

type ValueOrAccessor<T> = T | (() => T);

const HANDLER_KEY_SET = new Set<string>(["onClick", "onMouseDown", "onKeyUp", "onKeyDown", "onPointerDown"]);

const EMPTY_HANDLERS: ExternalHandlers = {};

const FOCUSABLE_WHEN_DISABLED_KEYS = ["tabIndex", "aria-disabled", "disabled"] as const satisfies Array<keyof FocusableWhenDisabledProps>;

function forwardProp(target: Record<string, any>, source: Record<string, any>, key: string) {
  Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => source[key] });
}

interface ExternalHandlers {
  onClick?: (event: RebaseUIEvent<MouseEvent>) => void;
  onMouseDown?: (event: RebaseUIEvent<MouseEvent>) => void;
  onKeyUp?: (event: RebaseUIEvent<KeyboardEvent>) => void;
  onKeyDown?: (event: RebaseUIEvent<KeyboardEvent>) => void;
  onPointerDown?: (event: RebaseUIEvent<PointerEvent>) => void;
}

export type GenericButtonProps = {
  onClick?: any;
  onMouseDown?: any;
  onKeyUp?: any;
  onKeyDown?: any;
  onPointerDown?: any;
  [key: string]: any;
};

export interface CreateButtonParameters {
  disabled?: ValueOrAccessor<boolean>;
  focusableWhenDisabled?: ValueOrAccessor<boolean | undefined>;
  tabIndex?: ValueOrAccessor<number>;
  native?: ValueOrAccessor<boolean>;
  composite?: ValueOrAccessor<boolean>;
}

export interface CreateButtonReturnValue {
  getButtonProps: (externalProps?: GenericButtonProps) => GenericButtonProps;
  buttonRef: (element: HTMLElement | null) => void;
}

export function createButton(parameters: CreateButtonParameters = {}): CreateButtonReturnValue {
  const disabled = () => resolveValueOrAccessor(parameters.disabled) ?? false;
  const focusableWhenDisabled = () => resolveValueOrAccessor(parameters.focusableWhenDisabled);
  const isNativeButton = () => resolveValueOrAccessor(parameters.native) ?? true;
  const compositeProp = () => resolveValueOrAccessor(parameters.composite);

  const compositeRootContext = useCompositeRootContext();
  const isCompositeItem = () => compositeProp() ?? !!compositeRootContext;

  const focusableWhenDisabledProps = createFocusableWhenDisabledProps({
    focusableWhenDisabled,
    disabled,
    composite: isCompositeItem,
    tabIndex: () => resolveValueOrAccessor(parameters.tabIndex),
    isNativeButton,
  });

  let externalHandlers: ExternalHandlers = EMPTY_HANDLERS;

  const handlers = {
    onClick: (event: any) => {
      if (disabled()) {
        event.preventDefault();
        return;
      }

      externalHandlers.onClick?.(event);
    },
    onMouseDown: (event: any) => {
      if (!disabled()) {
        externalHandlers.onMouseDown?.(event);
      }
    },
    onKeyDown: (event: any) => {
      focusableWhenDisabledProps.onKeyDown(event);

      if (disabled()) {
        return;
      }

      makeEventPreventable(event);
      externalHandlers.onKeyDown?.(event);
      if (event.rebaseUIHandlerPrevented) {
        return;
      }

      const isCurrentTarget = event.target === event.currentTarget;
      const currentTarget = event.currentTarget as Element;
      const isButton = isButtonElement(currentTarget);
      const isSpaceKey = event.key === " ";

      if (isCurrentTarget && isCompositeItem() && isSpaceKey) {
        const role = currentTarget.getAttribute("role");
        const isTextNavigationRole = role?.startsWith("menuitem") || role === "option" || role === "gridcell";

        if (event.defaultPrevented && isTextNavigationRole) {
          return;
        }

        event.preventDefault();

        if (!isNativeButton() || isButton) {
          event.preventRebaseUIHandler();
          dispatchClickWithModifiers(currentTarget, event);
        }

        return;
      }

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
        event.preventRebaseUIHandler();
        dispatchClickWithModifiers(currentTarget, event);
      }
    },
    onKeyUp: (event: any) => {
      if (disabled()) {
        return;
      }

      makeEventPreventable(event);
      externalHandlers.onKeyUp?.(event);

      if (
        event.target === event.currentTarget &&
        isNativeButton() &&
        isCompositeItem() &&
        isButtonElement(event.currentTarget as HTMLElement) &&
        event.key === " "
      ) {
        event.preventDefault();
        return;
      }

      if (event.rebaseUIHandlerPrevented) {
        return;
      }

      if (event.target === event.currentTarget && !isNativeButton() && !isCompositeItem() && !event.defaultPrevented && event.key === " ") {
        event.preventRebaseUIHandler();
        dispatchClickWithModifiers(event.currentTarget as Element, event);
      }
    },
    onPointerDown: (event: any) => {
      if (disabled()) {
        event.preventDefault();
        return;
      }

      externalHandlers.onPointerDown?.(event);
    },
  };

  const getButtonProps = (externalProps: GenericButtonProps = {}): GenericButtonProps => {
    externalHandlers = externalProps;

    const props: GenericButtonProps = {};

    if (untrack(isNativeButton)) {
      props.type = "button";
    } else {
      props.role = "button";
    }

    for (const key of FOCUSABLE_WHEN_DISABLED_KEYS) {
      Object.defineProperty(props, key, Object.getOwnPropertyDescriptor(focusableWhenDisabledProps, key)!);
    }

    for (const key in externalProps) {
      if (HANDLER_KEY_SET.has(key)) {
        continue;
      }
      forwardProp(props, externalProps, key);
    }

    props.onClick = handlers.onClick;
    props.onMouseDown = handlers.onMouseDown;
    props.onKeyDown = handlers.onKeyDown;
    props.onKeyUp = handlers.onKeyUp;
    props.onPointerDown = handlers.onPointerDown;

    return props;
  };

  const [buttonElement, setButtonElement] = createSignal<HTMLElement | null>(null);

  createEffect(
    () => ({
      element: buttonElement(),
      composite: isCompositeItem(),
      isDisabled: disabled(),
      focusableWhenDisabled: focusableWhenDisabledProps.disabled,
    }),
    ({ element, composite, isDisabled, focusableWhenDisabled }) => {
      if (!isButtonElement(element)) {
        return;
      }

      if (composite && isDisabled && focusableWhenDisabled === undefined && element.disabled) {
        element.disabled = false;
      }
    },
  );

  const buttonRef = (element: HTMLElement | null) => {
    setButtonElement(element);
  };

  if (process.env.NODE_ENV !== "production") {
    onSettled(() => {
      const element = buttonElement();

      if (!element) {
        return;
      }

      const isButtonTag = isButtonElement(element);

      if (isNativeButton()) {
        if (!isButtonTag) {
          error(
            "Rebase UI: A component that acts as a button expected a native <button> because " +
              "the `nativeButton` prop is true. Rendering a non-<button> removes native button " +
              "semantics, which can impact forms and accessibility. Use a real <button> in the " +
              "`render` prop, or set `nativeButton` to `false`.",
          );
        }
      } else if (isButtonTag) {
        error(
          "Rebase UI: A component that acts as a button expected a non-<button> because the `nativeButton` " +
            "prop is false. Rendering a <button> keeps native behavior while Rebase UI applies " +
            "non-native attributes and handlers, which can add unintended extra attributes (such " +
            "as `role` or `aria-disabled`). Use a non-<button> in the `render` prop, or set " +
            "`nativeButton` to `true`.",
        );
      }
    });
  }

  return {
    getButtonProps,
    buttonRef,
  };
}

function resolveValueOrAccessor<T>(value: ValueOrAccessor<T> | undefined): T | undefined {
  return typeof value === "function" ? (value as () => T)() : value;
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
