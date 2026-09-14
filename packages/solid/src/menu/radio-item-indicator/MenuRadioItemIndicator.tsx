import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuRadioItemContext } from "../radio-item/MenuRadioItemContext";
import { menuCheckableItemStateMapping, menuItemStateMapping } from "../utils/stateAttributesMapping";

/**
 * Indicates whether the radio item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRadioItemIndicator<T extends ValidComponent = "span">(props: MenuRadioItemIndicator.Props<T>) {
  const [local, elementProps] = split(props as MenuRadioItemIndicator.Props, { default: defaultProps }, ["as", "keepMounted"]);

  const as = untrack(() => local.as);

  const item = useMenuRadioItemContext();

  const rendered = () => item.checked;

  const { mounted, transitionStatus, setMounted } = createTransitionStatus(rendered);

  let indicatorElement: HTMLElement | null = null;

  runOnOpenChangeComplete({
    open: rendered,
    ref: () => indicatorElement,
    onComplete() {
      if (!untrack(rendered)) {
        setMounted(false);
      }
    },
  });

  const state: MenuRadioItemIndicatorState = {
    get checked() {
      return item.checked;
    },
    get disabled() {
      return item.disabled;
    },
    get highlighted() {
      return item.highlighted;
    },
    transitionStatus,
  };

  const shouldRender = () => local.keepMounted || mounted();

  return (
    <RenderElement
      as={as}
      enabled={shouldRender}
      state={state}
      stateAttributesMapping={{ ...menuItemStateMapping, ...menuCheckableItemStateMapping }}
      props={[
        {
          "aria-hidden": "true" as const,
        },
        elementProps,
        {
          ref: (element: HTMLElement | null) => {
            indicatorElement = element;
          },
        },
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "span",
  keepMounted: false,
} satisfies Partial<MenuRadioItemIndicator.Props>);

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
  transitionStatus: () => TransitionStatus;
}

export interface MenuRadioItemIndicatorOwnProps {
  /**
   * Whether to keep the HTML element in the DOM when the radio item is inactive.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type MenuRadioItemIndicatorProps<T extends ValidComponent = "span"> = MenuRadioItemIndicatorOwnProps &
  RebaseUIComponentProps<T, MenuRadioItemIndicatorState>;

export namespace MenuRadioItemIndicator {
  export type State = MenuRadioItemIndicatorState;
  export type Props<T extends ValidComponent = "span"> = MenuRadioItemIndicatorProps<T>;
  export type OwnProps = MenuRadioItemIndicatorOwnProps;
}
