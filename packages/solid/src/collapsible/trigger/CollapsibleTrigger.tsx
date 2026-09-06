import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { triggerOpenStateMapping } from "../../internals/collapsibleOpenStateMapping";
import { createButton } from "../../internals/create-button";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import type { CollapsibleRootState } from "../root/CollapsibleRoot";
import { useCollapsibleRootContext } from "../root/CollapsibleRootContext";

/**
 * A button that opens and closes the collapsible panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/collapsible)
 */
export function CollapsibleTrigger<T extends ValidComponent = "button">(props: CollapsibleTrigger.Props<T>) {
  const [local, elementProps] = split(props as CollapsibleTrigger.Props, { default: defaultProps }, ["as", "disabled", "nativeButton"]);

  const as = untrack(() => local.as);
  const rootContext = useCollapsibleRootContext();

  const disabled = () => local.disabled ?? rootContext.disabled();

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: true,
    native: () => local.nativeButton ?? true,
  });

  const triggerProps = {
    get "aria-controls"() {
      return rootContext.open() ? rootContext.panelId() : undefined;
    },
    get "aria-expanded"() {
      return rootContext.open() ? "true" : "false";
    },
    get onClick() {
      return rootContext.handleTrigger;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, buttonRef),
  });

  return (
    <RenderElement
      as={as}
      state={rootContext.state}
      props={[triggerProps, elementProps, refProps, getButtonProps]}
      stateAttributesMapping={triggerOpenStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "button",
  nativeButton: true,
} satisfies Partial<CollapsibleTrigger.Props>);

export interface CollapsibleTriggerState extends CollapsibleRootState {}

export interface CollapsibleTriggerOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * If `undefined`, defaults to the `disabled` prop of the root.
   */
  disabled?: boolean | undefined;
}

export type CollapsibleTriggerProps<T extends ValidComponent = "button"> = CollapsibleTriggerOwnProps &
  RebaseUIComponentProps<T, CollapsibleTriggerState>;

export namespace CollapsibleTrigger {
  export type State = CollapsibleTriggerState;
  export type Props<T extends ValidComponent = "button"> = CollapsibleTriggerProps<T>;
  export type OwnProps = CollapsibleTriggerOwnProps;
}
