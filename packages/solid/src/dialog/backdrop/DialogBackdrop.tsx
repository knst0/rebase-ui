import type { JSX, ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useDialogRootContext } from "../root/DialogRootContext";
import { dialogTransitionStateMapping } from "../utils/stateAttributesMapping";

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogBackdrop<T extends ValidComponent = "div">(props: DialogBackdrop.Props<T>) {
  const [local, elementProps] = split(props as DialogBackdrop.Props, { default: defaultProps }, ["as", "forceRender"]);

  const as = untrack(() => local.as);
  const forceRender = untrack(() => local.forceRender);

  const store = useDialogRootContext();

  const state: DialogBackdropState = {
    open: store.open,
    transitionStatus: store.transitionStatus,
  };

  const backdropProps = {
    role: "presentation" as const,
    get hidden() {
      return !store.mounted() || undefined;
    },
    style: {
      "user-select": "none",
      "-webkit-user-select": "none",
    } satisfies JSX.CSSProperties,
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLDivElement>(externalProps.ref, store.setBackdropElement),
  });

  const enabled = () => forceRender || !store.nested;

  return (
    <RenderElement
      as={as}
      enabled={enabled}
      state={state}
      props={[backdropProps, elementProps, refProps]}
      stateAttributesMapping={dialogTransitionStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
  forceRender: false,
} satisfies Partial<DialogBackdrop.Props>);

export interface DialogBackdropState {
  /**
   * Whether the dialog is currently open.
   */
  open: Accessor<boolean>;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface DialogBackdropOwnProps {
  /**
   * Whether the backdrop is forced to render even when nested.
   * @default false
   */
  forceRender?: boolean | undefined;
}

export type DialogBackdropProps<T extends ValidComponent = "div"> = DialogBackdropOwnProps & RebaseUIComponentProps<T, DialogBackdropState>;

export namespace DialogBackdrop {
  export type State = DialogBackdropState;
  export type Props<T extends ValidComponent = "div"> = DialogBackdropProps<T>;
  export type OwnProps = DialogBackdropOwnProps;
}
