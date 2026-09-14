import type { ValidComponent } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import { Show, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { toastDescriptionStateMapping } from "../utils/stateAttributesMapping";
import { useToastLabelPart } from "../utils/useToastLabelPart";

/**
 * A description that describes the toast.
 * Can be used as the default message for the toast when no title is provided.
 * Renders a `<p>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastDescription<T extends ValidComponent = "p">(props: ToastDescription.Props<T>) {
  const [local, elementProps] = split(props as ToastDescription.Props, { default: defaultProps }, ["as", "id", "children"]);

  const as = untrack(() => local.as);

  const { id, children, shouldRender, type } = useToastLabelPart(
    () => local.id,
    () => local.children,
    "description",
  );

  const state: ToastDescriptionState = {
    get type() {
      return type();
    },
  };

  return (
    <Show when={shouldRender()}>
      <RenderElement
        as={as}
        state={state}
        props={[
          {
            id,
            get children() {
              return children() as JSX.Element;
            },
          },
          elementProps,
        ]}
        stateAttributesMapping={toastDescriptionStateMapping}
      />
    </Show>
  );
}

const defaultProps = Object.freeze({
  as: "p",
} satisfies Partial<ToastDescription.Props>);

export interface ToastDescriptionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastDescriptionOwnProps {
  /**
   * The `id` attribute of the description.
   */
  id?: string | undefined;
}

export type ToastDescriptionProps<T extends ValidComponent = "p"> = ToastDescriptionOwnProps &
  RebaseUIComponentProps<T, ToastDescriptionState>;

export namespace ToastDescription {
  export type State = ToastDescriptionState;
  export type Props<T extends ValidComponent = "p"> = ToastDescriptionProps<T>;
  export type OwnProps = ToastDescriptionOwnProps;
}
