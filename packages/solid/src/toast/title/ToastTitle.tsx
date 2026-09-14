import type { ValidComponent } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import { Show, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { toastTitleStateMapping } from "../utils/stateAttributesMapping";
import { useToastLabelPart } from "../utils/useToastLabelPart";

/**
 * A title that labels the toast.
 * Renders an `<h2>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastTitle<T extends ValidComponent = "h2">(props: ToastTitle.Props<T>) {
  const [local, elementProps] = split(props as ToastTitle.Props, { default: defaultProps }, ["as", "id", "children"]);

  const as = untrack(() => local.as);

  const { id, children, shouldRender, type } = useToastLabelPart(
    () => local.id,
    () => local.children,
    "title",
  );

  const state: ToastTitleState = {
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
        stateAttributesMapping={toastTitleStateMapping}
      />
    </Show>
  );
}

const defaultProps = Object.freeze({
  as: "h2",
} satisfies Partial<ToastTitle.Props>);

export interface ToastTitleState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastTitleOwnProps {
  /**
   * The `id` attribute of the title.
   */
  id?: string | undefined;
}

export type ToastTitleProps<T extends ValidComponent = "h2"> = ToastTitleOwnProps & RebaseUIComponentProps<T, ToastTitleState>;

export namespace ToastTitle {
  export type State = ToastTitleState;
  export type Props<T extends ValidComponent = "h2"> = ToastTitleProps<T>;
  export type OwnProps = ToastTitleOwnProps;
}
