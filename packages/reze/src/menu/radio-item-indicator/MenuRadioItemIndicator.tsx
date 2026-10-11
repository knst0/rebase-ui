import { dynamicElement, omitProps, store, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuRadioItemContext } from "../radio-item/MenuRadioItemContext";

/**
 * Indicates whether the radio item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRadioItemIndicator<T extends JSX.ElementType = "span">(props: MenuRadioItemIndicator.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const item = useMenuRadioItemContext();

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

  function snapshot(): MenuRadioItemIndicatorState {
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

export interface MenuRadioItemIndicatorState {
  /**
   * Whether the radio item is currently selected.
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

export interface MenuRadioItemIndicatorOwnProps {
  /**
   * Whether to keep the HTML element in the DOM when the radio item is inactive.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type MenuRadioItemIndicatorProps<T extends JSX.ElementType = "span"> = MenuRadioItemIndicatorOwnProps &
  RebaseUIComponentProps<T, MenuRadioItemIndicatorState>;

export namespace MenuRadioItemIndicator {
  export type State = MenuRadioItemIndicatorState;
  export type Props<T extends JSX.ElementType = "span"> = MenuRadioItemIndicatorProps<T>;
  export type OwnProps = MenuRadioItemIndicatorOwnProps;
}
