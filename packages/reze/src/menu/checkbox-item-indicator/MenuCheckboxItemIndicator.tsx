import { dynamicElement, omitProps, store, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuCheckboxItemContext } from "../checkbox-item/MenuCheckboxItemContext";

/**
 * Indicates whether the checkbox item is ticked.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuCheckboxItemIndicator<T extends JSX.ElementType = "span">(props: MenuCheckboxItemIndicator.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const item = useMenuCheckboxItemContext();

  const rendered = () => item.checked;

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

  function snapshot(): MenuCheckboxItemIndicatorState {
    return {
      checked: item.checked,
      disabled: item.disabled,
      highlighted: item.highlighted,
      transitionStatus: transition.transitionStatus,
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  function shouldRender(): boolean {
    return props.keepMounted === true || transition.mounted;
  }

  function ref(element: HTMLElement | null) {
    indicatorElement = element;
    (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);
  }

  return (
    <>
      {shouldRender() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          aria-hidden="true"
          data-checked={item.checked ? "" : undefined}
          data-unchecked={item.checked ? undefined : ""}
          data-disabled={item.disabled ? "" : undefined}
          data-highlighted={item.highlighted ? "" : undefined}
          data-starting-style={transition.transitionStatus === "starting" ? "" : undefined}
          data-ending-style={transition.transitionStatus === "ending" ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={ref}
        >
          {resolveChildrenValue(children, snapshot)}
        </Tag>
      )}
    </>
  );
}

export interface MenuCheckboxItemIndicatorState {
  /**
   * Whether the checkbox item is currently ticked.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface MenuCheckboxItemIndicatorOwnProps {
  /**
   * Whether to keep the HTML element in the DOM when the checkbox item is not checked.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type MenuCheckboxItemIndicatorProps<T extends JSX.ElementType = "span"> = MenuCheckboxItemIndicatorOwnProps &
  RebaseUIComponentProps<T, MenuCheckboxItemIndicatorState>;

export namespace MenuCheckboxItemIndicator {
  export type State = MenuCheckboxItemIndicatorState;
  export type Props<T extends JSX.ElementType = "span"> = MenuCheckboxItemIndicatorProps<T>;
  export type OwnProps = MenuCheckboxItemIndicatorOwnProps;
}
