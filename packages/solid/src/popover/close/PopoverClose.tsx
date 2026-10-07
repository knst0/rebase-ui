import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { mergeRefs } from "../../internals/mergeRefs";
import { useClosePartRegistration } from "../../internals/popups/closePart";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { usePopoverRootContext } from "../root/PopoverRootContext";

/**
 * A button that closes the popover.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverClose<T extends ValidComponent = "button">(props: PopoverClose.Props<T>) {
  const [local, elementProps] = split(props as PopoverClose.Props, { default: defaultProps }, ["as", "disabled", "nativeButton"]);

  const as = untrack(() => local.as);

  const store = usePopoverRootContext();
  useClosePartRegistration();

  const disabled = () => local.disabled ?? false;

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: false,
    native: () => local.nativeButton ?? true,
  });

  function handleClick(event: MouseEvent) {
    store.setOpen(false, createChangeEventDetails(REASONS.closePress, event));
  }

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, buttonRef),
  });

  return <RenderElement as={as} props={[{ onClick: handleClick }, elementProps, refProps, getButtonProps]} />;
}

const defaultProps = Object.freeze({
  as: "button",
  nativeButton: true,
} satisfies Partial<PopoverClose.Props>);

export interface PopoverCloseState {}

export interface PopoverCloseOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type PopoverCloseProps<T extends ValidComponent = "button"> = PopoverCloseOwnProps & RebaseUIComponentProps<T, PopoverCloseState>;

export namespace PopoverClose {
  export type State = PopoverCloseState;
  export type Props<T extends ValidComponent = "button"> = PopoverCloseProps<T>;
  export type OwnProps = PopoverCloseOwnProps;
}
