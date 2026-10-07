import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useDialogRootContext } from "../root/DialogRootContext";

/**
 * A button that closes the dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogClose<T extends ValidComponent = "button">(props: DialogClose.Props<T>) {
  const [local, elementProps] = split(props as DialogClose.Props, { default: defaultProps }, ["as", "disabled", "nativeButton"]);

  const as = untrack(() => local.as);

  const store = useDialogRootContext();

  const disabled = () => local.disabled ?? false;

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: true,
    native: () => local.nativeButton ?? true,
  });

  function handleClick(event: MouseEvent) {
    if (store.open()) {
      store.setOpen(false, createChangeEventDetails(REASONS.closePress, event, untrack(store.activeTriggerElement) ?? undefined));
    }
  }

  const state: DialogCloseState = {
    get disabled() {
      return disabled();
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, buttonRef),
  });

  return <RenderElement as={as} state={state} props={[{ onClick: handleClick }, elementProps, refProps, getButtonProps]} />;
}

const defaultProps = Object.freeze({
  as: "button",
  nativeButton: true,
} satisfies Partial<DialogClose.Props>);

export interface DialogCloseState {
  /**
   * Whether the button is currently disabled.
   */
  disabled: boolean;
}

export interface DialogCloseOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type DialogCloseProps<T extends ValidComponent = "button"> = DialogCloseOwnProps & RebaseUIComponentProps<T, DialogCloseState>;

export namespace DialogClose {
  export type State = DialogCloseState;
  export type Props<T extends ValidComponent = "button"> = DialogCloseProps<T>;
  export type OwnProps = DialogCloseOwnProps;
}
