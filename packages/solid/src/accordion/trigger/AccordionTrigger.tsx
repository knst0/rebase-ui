import type { ValidComponent } from "@solidjs/web";
import { createEffect, untrack } from "solid-js";

import { useCollapsibleRootContext } from "../../collapsible/root/CollapsibleRootContext";
import { createButton } from "../../internals/create-button";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import type { AccordionItemState } from "../item/AccordionItem";
import { useAccordionItemContext } from "../item/AccordionItemContext";
import * as AccordionTriggerDataAttributes from "./AccordionTriggerDataAttributes";

const PANEL_OPEN_HOOK = { [AccordionTriggerDataAttributes.panelOpen]: "" };

const triggerStateAttributesMapping: StateAttributesMapping<AccordionItemState> = {
  open: {
    keys: [AccordionTriggerDataAttributes.panelOpen],
    map: (value) => (value ? PANEL_OPEN_HOOK : null),
  },
  hidden: { keys: [], map: () => null },
  index: { keys: [], map: () => null },
  orientation: { keys: [], map: () => null },
  transitionStatus: { keys: [], map: () => null },
  value: { keys: [], map: () => null },
};

export function AccordionTrigger<T extends ValidComponent = "button">(props: AccordionTrigger.Props<T>) {
  const [local, elementProps] = split(props as AccordionTrigger.Props, { default: defaultProps }, ["as", "disabled", "id", "nativeButton"]);

  const as = untrack(() => local.as);

  const rootContext = useCollapsibleRootContext();

  const disabled = () => local.disabled || rootContext.disabled();

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: true,
    native: () => local.nativeButton ?? true,
  });

  const { state, setTriggerId, triggerId } = useAccordionItemContext();

  createEffect(
    () => ({ id: local.id || undefined }),
    ({ id }: { id: string | undefined }) => {
      if (id !== undefined) {
        setTriggerId(id);
      }
    },
  );

  const triggerProps = {
    get "aria-controls"() {
      return rootContext.open() ? rootContext.panelId() : undefined;
    },
    get "aria-expanded"() {
      return rootContext.open() ? "true" : "false";
    },
    get id() {
      return triggerId();
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
      state={state}
      props={[triggerProps, elementProps, refProps, getButtonProps]}
      stateAttributesMapping={triggerStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "button",
  nativeButton: true,
} satisfies Partial<AccordionTrigger.Props>);

export type AccordionTriggerState = AccordionItemState;

export interface AccordionTriggerOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * If `undefined`, defaults to the `disabled` prop of the item or root.
   */
  disabled?: boolean | undefined;
  /**
   * The `id` attribute of the trigger.
   */
  id?: string | undefined;
}

export type AccordionTriggerProps<T extends ValidComponent = "button"> = AccordionTriggerOwnProps &
  RebaseUIComponentProps<T, AccordionTriggerState>;

export namespace AccordionTrigger {
  export type State = AccordionTriggerState;
  export type Props<T extends ValidComponent = "button"> = AccordionTriggerProps<T>;
  export type OwnProps = AccordionTriggerOwnProps;
}
