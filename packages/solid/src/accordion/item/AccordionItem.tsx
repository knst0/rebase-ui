import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createSignal, createUniqueId, untrack } from "solid-js";

import type { CollapsibleRootChangeEventDetails, CollapsibleRootState } from "../../collapsible/root/CollapsibleRoot";
import { CollapsibleRootContext } from "../../collapsible/root/CollapsibleRootContext";
import { useCompositeListItem } from "../../internals/composite";
import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { AccordionRootState } from "../root/AccordionRoot";
import { useAccordionRootContext } from "../root/AccordionRootContext";
import { AccordionItemContext } from "./AccordionItemContext";
import { accordionStateAttributesMapping } from "./stateAttributesMapping";

export function AccordionItem<T extends ValidComponent = "div">(props: AccordionItem.Props<T>) {
  const [local, elementProps] = split(props as AccordionItem.Props, { default: defaultProps }, ["as", "disabled", "onOpenChange", "value"]);

  const as = untrack(() => local.as);

  const rootContext = useAccordionRootContext();

  const { ref: listItemRef, index } = useCompositeListItem();

  const fallbackValue = createUniqueId();

  const value = () => local.value ?? fallbackValue;

  const disabled = () => local.disabled || rootContext.disabled();

  const isOpen = () => rootContext.value().includes(value());

  const onOpenChange = (nextOpen: boolean, eventDetails: CollapsibleRootChangeEventDetails) => {
    local.onOpenChange?.(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    rootContext.handleValueChange(value(), nextOpen, eventDetails);
  };

  const [open, setOpen] = createControllableSignal<boolean>({
    value: isOpen,
    defaultValue: () => false,
  });

  const { mounted, setMounted, transitionStatus } = createTransitionStatus(open, true, true);

  const [panelId, setPanelId] = createSignal(createUniqueId());
  const [triggerId, setTriggerId] = createSignal(createUniqueId());

  const handleTrigger = (event: MouseEvent | KeyboardEvent) => {
    const nextOpen = !untrack(open);
    const eventDetails = createChangeEventDetails(REASONS.triggerPress, event);

    onOpenChange(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setOpen(nextOpen);
  };

  const collapsibleState: CollapsibleRootState = {
    open,
    disabled,
    transitionStatus,
  };

  const collapsibleContext: CollapsibleRootContext = {
    disabled,
    handleTrigger,
    mounted,
    onOpenChange,
    open,
    panelId,
    setMounted,
    setOpen,
    setPanelId,
    state: collapsibleState,
    transitionStatus,
  };

  const state: AccordionItemState = {
    ...rootContext.state,
    disabled,
    hidden: () => !isOpen() && !mounted(),
    index,
    open: isOpen,
    transitionStatus,
  };

  const accordionItemContext: AccordionItemContext = {
    open: isOpen,
    state,
    setTriggerId,
    triggerId,
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, listItemRef),
  });

  return (
    <CollapsibleRootContext value={collapsibleContext}>
      <AccordionItemContext value={accordionItemContext}>
        <RenderElement as={as} state={state} props={[elementProps, refProps]} stateAttributesMapping={accordionStateAttributesMapping} />
      </AccordionItemContext>
    </CollapsibleRootContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  disabled: false,
} satisfies Partial<AccordionItem.Props>);

export interface AccordionItemState extends AccordionRootState {
  /**
   * Whether the accordion item's panel is currently hidden.
   */
  hidden: Accessor<boolean>;
  /**
   * The item index.
   */
  index: Accessor<number>;
  /**
   * Whether the component is open.
   */
  open: Accessor<boolean>;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface AccordionItemOwnProps {
  /**
   * A unique value that identifies this accordion item.
   * If no value is provided, a unique ID will be generated automatically.
   * Use when controlling the accordion programmatically, or to set an initial
   * open state.
   * @example
   * ```tsx
   * <Accordion.Root value={['a']}>
   *   <Accordion.Item value="a" /> // initially open
   *   <Accordion.Item value="b" /> // initially closed
   * </Accordion.Root>
   * ```
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * If `undefined`, defaults to the `disabled` prop of the root.
   */
  disabled?: boolean | undefined;
  /**
   * Event handler called when the panel is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: AccordionItemChangeEventDetails) => void) | undefined;
}

export type AccordionItemProps<T extends ValidComponent = "div"> = AccordionItemOwnProps & RebaseUIComponentProps<T, AccordionItemState>;

export type AccordionItemChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;

export type AccordionItemChangeEventDetails = RebaseUIChangeEventDetails<AccordionItemChangeEventReason>;

export namespace AccordionItem {
  export type State = AccordionItemState;
  export type Props<T extends ValidComponent = "div"> = AccordionItemProps<T>;
  export type OwnProps = AccordionItemOwnProps;
  export type ChangeEventReason = AccordionItemChangeEventReason;
  export type ChangeEventDetails = AccordionItemChangeEventDetails;
}
