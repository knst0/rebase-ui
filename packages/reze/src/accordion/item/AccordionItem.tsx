import { createUniqueId, dynamicElement, getOwner, omitProps, runWithOwner, store, type JSX } from "reze-js";

import type { CollapsibleRoot } from "../../collapsible/root/CollapsibleRoot";
import { CollapsibleRootContext } from "../../collapsible/root/CollapsibleRootContext";
import { createCollapsibleRoot } from "../../collapsible/root/createCollapsibleRoot";
import { useCompositeListItem } from "../../internals/composite";
import { REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { accessBoolean, type ReactiveBoolean } from "../../internals/maybeAccessor";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { stableCallback } from "../../internals/stableCallback";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import type { AccordionRootState, AccordionValue } from "../root/AccordionRoot";
import { useAccordionRootContext } from "../root/AccordionRootContext";
import { AccordionItemContext, useAccordionItemContext } from "./AccordionItemContext";

/**
 * Groups an accordion header with the corresponding panel.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/accordion)
 */
export function AccordionItem<T extends JSX.ElementType = "div">(props: AccordionItem.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "onOpenChange", "value", "class", "style", "children", "ref");

  const root = useAccordionRootContext();

  const listItem = useCompositeListItem();

  const fallbackValue = createUniqueId();

  function value(): any {
    return props.value ?? fallbackValue;
  }

  function disabled(): boolean {
    return accessBoolean(props.disabled) || root.disabled();
  }

  function isOpen(): boolean {
    return root.value().includes(value());
  }

  const onItemOpenChange = stableCallback(() => props.onOpenChange);

  function onOpenChange(nextOpen: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails): void {
    onItemOpenChange(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    root.handleValueChange(value(), nextOpen, eventDetails);
  }

  const itemStore = store({ triggerId: createUniqueId() });

  function triggerId(): string {
    return itemStore.triggerId;
  }

  function setTriggerId(next: string): void {
    itemStore.triggerId = next;
  }

  const collapsible = createCollapsibleRoot({
    // The collapsible reads an accessor-or-literal boolean; pass the combined
    // item-or-root disabled derivation through as a live accessor.
    disabled: () => disabled,
    onOpenChange,
    open: isOpen,
    defaultOpen: () => false,
  });

  const collapsibleContextValue: CollapsibleRootContext = {
    ...collapsible,
    onOpenChange,
    state: {
      open: collapsible.open,
      disabled: collapsible.disabled,
      transitionStatus: collapsible.transitionStatus,
    },
  };

  function hidden(): boolean {
    return !isOpen() && !collapsible.mounted();
  }

  function index(): number {
    return listItem.index();
  }

  function open(): boolean {
    return isOpen();
  }

  function snapshot(): AccordionItemState {
    return { value: root.value(), disabled: disabled(), hidden: hidden(), index: index(), open: open() };
  }

  const itemContextValue: AccordionItemContext = {
    open,
    state: { value: root.value, disabled, hidden, index, open },
    triggerId,
    setTriggerId,
  };

  const ref = mergeRefs(listItem.ref, props.ref as ((element: HTMLElement | null) => void) | undefined);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would drop the item's listeners every time
  // a neighboring panel appears or disappears. The default path renders a static
  // `<div>` so updates patch it in place; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        data-open={open() ? "" : undefined}
        data-closed={open() ? undefined : ""}
        data-index={String(index())}
        data-disabled={disabled() ? "" : undefined}
        data-hidden={hidden() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={ref}
      >
        <CollapsibleRootContext value={collapsibleContextValue}>
          <AccordionItemContext value={itemContextValue}>
            <AccordionItemContent>{props.children}</AccordionItemContent>
          </AccordionItemContext>
        </CollapsibleRootContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-open={open() ? "" : undefined}
      data-closed={open() ? undefined : ""}
      data-index={String(index())}
      data-disabled={disabled() ? "" : undefined}
      data-hidden={hidden() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={ref}
    >
      <CollapsibleRootContext value={collapsibleContextValue}>
        <AccordionItemContext value={itemContextValue}>
          <AccordionItemContent>{props.children}</AccordionItemContent>
        </AccordionItemContext>
      </CollapsibleRootContext>
    </Tag>
  );
}

/**
 * Resolves the item children inside the accordion item context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the state changes, matching the Solid layer where the children
 * memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function AccordionItemContent(props: { children: ChildrenValue<AccordionItemState> }) {
  const children = props.children;

  const { state } = useAccordionItemContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: AccordionItemState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the accordion context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: AccordionItemState = {
        value: state.value(),
        disabled: state.disabled(),
        hidden: state.hidden(),
        index: state.index(),
        open: state.open(),
      };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface AccordionItemState extends AccordionRootState {
  /**
   * Whether the accordion item's panel is currently hidden.
   */
  hidden: boolean;
  /**
   * The item index.
   */
  index: number;
  /**
   * Whether the component is open.
   */
  open: boolean;
}

/**
 * Live accessors behind {@link AccordionItemState}, shared with the header,
 * trigger, and panel through the item context.
 */
export interface AccordionItemStateAccessors {
  value: () => AccordionValue;
  disabled: () => boolean;
  hidden: () => boolean;
  index: () => number;
  open: () => boolean;
}

export interface AccordionItemOwnProps {
  /**
   * Whether the component should ignore user interaction.
   * If `undefined`, defaults to the `disabled` prop of the root.
   */
  disabled?: ReactiveBoolean | undefined;
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
   * Event handler called when the panel is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: AccordionItemChangeEventDetails) => void) | undefined;
}

export type AccordionItemProps<T extends JSX.ElementType = "div"> = AccordionItemOwnProps & RebaseUIComponentProps<T, AccordionItemState>;

export type AccordionItemChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;

export type AccordionItemChangeEventDetails = RebaseUIChangeEventDetails<AccordionItemChangeEventReason>;

export namespace AccordionItem {
  export type State = AccordionItemState;
  export type Props<T extends JSX.ElementType = "div"> = AccordionItemProps<T>;
  export type OwnProps = AccordionItemOwnProps;
  export type ChangeEventReason = AccordionItemChangeEventReason;
  export type ChangeEventDetails = AccordionItemChangeEventDetails;
}
