import type { ValidComponent } from "@solidjs/web";
import { createSignal, untrack } from "solid-js";

import { createButton } from "../../internals/create-button";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useToastProviderContext } from "../provider/ToastProviderContext";
import { useToastRootContext } from "../root/ToastRootContext";
import { toastCloseStateMapping } from "../utils/stateAttributesMapping";

/**
 * Closes the toast when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastClose<T extends ValidComponent = "button">(props: ToastClose.Props<T>) {
  const [local, elementProps] = split(props as ToastClose.Props, { default: defaultProps }, ["as", "disabled", "nativeButton"]);

  const as = untrack(() => local.as);

  const store = useToastProviderContext();
  const { toast, expanded } = useToastRootContext();

  const [hasFocus, setHasFocus] = createSignal(false);

  const disabled = () => local.disabled ?? false;

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => local.nativeButton ?? true,
  });

  const state: ToastCloseState = {
    get type() {
      return toast().type;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, buttonRef),
  });

  return (
    <RenderElement
      as={as}
      state={state}
      props={[
        {
          get "aria-hidden"() {
            return !expanded() && !hasFocus() ? ("true" as const) : undefined;
          },
          onClick() {
            store.closeToast(toast().id);
          },
          onFocus() {
            setHasFocus(true);
          },
          onBlur() {
            setHasFocus(false);
          },
        },
        elementProps,
        getButtonProps,
        refProps,
      ]}
      stateAttributesMapping={toastCloseStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "button",
  nativeButton: true,
} satisfies Partial<ToastClose.Props>);

export interface ToastCloseState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastCloseOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type ToastCloseProps<T extends ValidComponent = "button"> = ToastCloseOwnProps & RebaseUIComponentProps<T, ToastCloseState>;

export namespace ToastClose {
  export type State = ToastCloseState;
  export type Props<T extends ValidComponent = "button"> = ToastCloseProps<T>;
  export type OwnProps = ToastCloseOwnProps;
}
