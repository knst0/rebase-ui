import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuCheckboxItemContext } from "../checkbox-item/MenuCheckboxItemContext";
import { menuCheckableItemStateMapping, menuItemStateMapping } from "../utils/stateAttributesMapping";

/**
 * Indicates whether the checkbox item is ticked.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuCheckboxItemIndicator<T extends ValidComponent = "span">(props: MenuCheckboxItemIndicator.Props<T>) {
  const [local, elementProps] = split(props as MenuCheckboxItemIndicator.Props, { default: defaultProps }, ["as", "keepMounted"]);

  const as = untrack(() => local.as);

  const item = useMenuCheckboxItemContext();

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

  const state: MenuCheckboxItemIndicatorState = {
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
} satisfies Partial<MenuCheckboxItemIndicator.Props>);

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
  transitionStatus: () => TransitionStatus;
}

export interface MenuCheckboxItemIndicatorOwnProps {
  /**
   * Whether to keep the HTML element in the DOM when the checkbox item is not checked.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type MenuCheckboxItemIndicatorProps<T extends ValidComponent = "span"> = MenuCheckboxItemIndicatorOwnProps &
  RebaseUIComponentProps<T, MenuCheckboxItemIndicatorState>;

export namespace MenuCheckboxItemIndicator {
  export type State = MenuCheckboxItemIndicatorState;
  export type Props<T extends ValidComponent = "span"> = MenuCheckboxItemIndicatorProps<T>;
  export type OwnProps = MenuCheckboxItemIndicatorOwnProps;
}
