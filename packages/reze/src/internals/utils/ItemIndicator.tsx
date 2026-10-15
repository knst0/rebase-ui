import { dynamicElement, omitProps, store, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../renderProps";
import { runOnOpenChangeComplete } from "../runOnOpenChangeComplete";
import { createTransitionStatus, type TransitionStatus } from "../transition-status";
import type { RebaseUIComponentProps } from "../types";

/**
 * Shared item-selected indicator for Combobox and Select. Ports upstream
 * `utils/ItemIndicator`.
 *
 * The public wrappers mount this component only when selected or kept mounted,
 * avoiding the transition costs for unselected items. Selection arrives as an
 * accessor (rather than upstream's memo-observed boolean prop) so the
 * kept-mounted element stays reactive when selection changes.
 */
export function ItemIndicator<T extends JSX.ElementType = "span">(props: ItemIndicator.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted", "selected", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const selected = props.selected as () => boolean;

  function rendered(): boolean {
    return selected();
  }

  const transition = store({ mounted: false, transitionStatus: undefined as TransitionStatus });

  function setMounted(next: boolean): void {
    if (transition.mounted !== next) {
      transition.mounted = next;
    }
  }

  function setTransitionStatus(next: TransitionStatus): void {
    if (transition.transitionStatus !== next) {
      transition.transitionStatus = next;
    }
  }

  createTransitionStatus({
    open: rendered,
    mounted: () => transition.mounted,
    transitionStatus: () => transition.transitionStatus,
    setMounted,
    setTransitionStatus,
  });

  let indicatorElement: HTMLElement | null = null;

  runOnOpenChangeComplete({
    open: rendered,
    ref: () => indicatorElement,
    onComplete() {
      if (!rendered()) {
        setMounted(false);
      }
    },
  });

  function snapshot(): ItemIndicatorState {
    return {
      selected: selected(),
      transitionStatus: transition.transitionStatus,
    };
  }

  function ref(element: HTMLElement | null): void {
    indicatorElement = element;
    (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts, which would restart the indicator's transition. The default path renders a
  // static `<span>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <span
        {...(rest as Record<string, unknown>)}
        aria-hidden="true"
        data-selected={selected() ? "" : undefined}
        data-starting-style={transition.transitionStatus === "starting" ? "" : undefined}
        data-ending-style={transition.transitionStatus === "ending" ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={ref}
      >
        {resolveChildrenValue(children ?? "✔️", snapshot)}
      </span>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      aria-hidden="true"
      data-selected={selected() ? "" : undefined}
      data-starting-style={transition.transitionStatus === "starting" ? "" : undefined}
      data-ending-style={transition.transitionStatus === "ending" ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={ref}
    >
      {resolveChildrenValue(children ?? "✔️", snapshot)}
    </Tag>
  );
}

export interface ItemIndicatorState {
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface ItemIndicatorOwnProps {
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * Whether the item is selected. Passed as an accessor so memoization observes changes.
   */
  selected: () => boolean;
}

export type ItemIndicatorProps<T extends JSX.ElementType = "span"> = ItemIndicatorOwnProps & RebaseUIComponentProps<T, ItemIndicatorState>;

export namespace ItemIndicator {
  export type State = ItemIndicatorState;
  export type Props<T extends JSX.ElementType = "span"> = ItemIndicatorProps<T>;
  export type OwnProps = ItemIndicatorOwnProps;
}
