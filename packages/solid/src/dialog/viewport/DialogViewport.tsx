import type { JSX, ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useDialogPortalContext } from "../portal/DialogPortalContext";
import { useDialogRootContext } from "../root/DialogRootContext";
import { dialogStateAttributesMapping } from "../utils/stateAttributesMapping";

/**
 * A positioning container for the dialog popup that can be made scrollable.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogViewport<T extends ValidComponent = "div">(props: DialogViewport.Props<T>) {
  const [local, elementProps] = split(props as DialogViewport.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const keepMounted = useDialogPortalContext();
  const store = useDialogRootContext();

  const state: DialogViewportState = {
    open: store.open,
    nested: () => store.nested,
    transitionStatus: store.transitionStatus,
    nestedDialogOpen: () => store.nestedOpenDialogCount() > 0,
  };

  const shouldRender = () => keepMounted || store.mounted();

  const viewportProps = {
    role: "presentation" as const,
    get hidden() {
      return !store.mounted() || undefined;
    },
    get style(): JSX.CSSProperties {
      return {
        "pointer-events": !store.open() ? "none" : undefined,
      };
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLDivElement>(externalProps.ref, store.setViewportElement),
  });

  return (
    <RenderElement
      as={as}
      enabled={shouldRender}
      state={state}
      props={[viewportProps, elementProps, refProps]}
      stateAttributesMapping={dialogStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<DialogViewport.Props>);

export interface DialogViewportState {
  /**
   * Whether the dialog is currently open.
   */
  open: Accessor<boolean>;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
  /**
   * Whether the dialog is nested within another dialog.
   */
  nested: Accessor<boolean>;
  /**
   * Whether the dialog has nested dialogs open.
   */
  nestedDialogOpen: Accessor<boolean>;
}

export interface DialogViewportOwnProps {}

export type DialogViewportProps<T extends ValidComponent = "div"> = DialogViewportOwnProps & RebaseUIComponentProps<T, DialogViewportState>;

export namespace DialogViewport {
  export type State = DialogViewportState;
  export type Props<T extends ValidComponent = "div"> = DialogViewportProps<T>;
  export type OwnProps = DialogViewportOwnProps;
}
