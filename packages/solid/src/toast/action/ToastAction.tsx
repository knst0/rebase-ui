import type { ValidComponent } from "@solidjs/web";
import { Show, untrack } from "solid-js";

import { createButton } from "../../internals/create-button";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useToastRootContext } from "../root/ToastRootContext";
import { isRenderableNode } from "../utils/isRenderableNode";
import { toastActionStateMapping } from "../utils/stateAttributesMapping";

/**
 * Performs an action when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastAction<T extends ValidComponent = "button">(props: ToastAction.Props<T>) {
  const [local, elementProps] = split(props as ToastAction.Props, { default: defaultProps }, [
    "as",
    "disabled",
    "nativeButton",
    "children",
  ]);

  const as = untrack(() => local.as);

  const { toast } = useToastRootContext();

  const computedChildren = () => toast().actionProps?.children ?? local.children;

  const disabled = () => local.disabled ?? false;

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => local.nativeButton ?? true,
  });

  const state: ToastActionState = {
    get type() {
      return toast().type;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, buttonRef),
  });

  // Renders only when there is renderable content (matching upstream
  // `hasRenderableChildren`, which also counts a `render` prop's own children).
  const shouldRender = () => isRenderableNode(computedChildren());

  return (
    <Show when={shouldRender()}>
      <RenderElement
        as={as}
        state={state}
        props={[
          elementProps,
          (externalProps: Record<string, any>) => ({ ...externalProps, ...toast().actionProps }) as Record<string, any>,
          getButtonProps,
          {
            get children() {
              return computedChildren();
            },
          },
          refProps,
        ]}
        stateAttributesMapping={toastActionStateMapping}
      />
    </Show>
  );
}

const defaultProps = Object.freeze({
  as: "button",
  nativeButton: true,
} satisfies Partial<ToastAction.Props>);

export interface ToastActionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastActionOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type ToastActionProps<T extends ValidComponent = "button"> = ToastActionOwnProps & RebaseUIComponentProps<T, ToastActionState>;

export namespace ToastAction {
  export type State = ToastActionState;
  export type Props<T extends ValidComponent = "button"> = ToastActionProps<T>;
  export type OwnProps = ToastActionOwnProps;
}
