import type { ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { createTransitionStatus, type TransitionStatus, transitionStatusMapping } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectItemContext } from "../item/SelectItemContext";

/**
 * Indicates whether the select item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItemIndicator<T extends ValidComponent = "span">(props: SelectItemIndicator.Props<T>) {
  const [local, elementProps] = split(props as SelectItemIndicator.Props, { default: defaultProps }, ["as", "keepMounted"]);

  const as = untrack(() => local.as);

  const item = useSelectItemContext();

  const rendered = () => item.selected();

  const { mounted, transitionStatus, setMounted } = createTransitionStatus(rendered);

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

  const state: SelectItemIndicatorState = {
    selected: rendered,
    transitionStatus,
  };

  const stateAttributesMapping = {
    ...transitionStatusMapping,
  } as StateAttributesMapping<SelectItemIndicatorState>;

  const shouldRender = () => local.keepMounted || mounted();

  return (
    <RenderElement
      as={as}
      enabled={shouldRender}
      state={state}
      stateAttributesMapping={stateAttributesMapping}
      props={[
        {
          "aria-hidden": "true" as const,
          children: "✔️",
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
} satisfies Partial<SelectItemIndicator.Props>);

export interface SelectItemIndicatorState {
  /**
   * Whether the item is selected.
   */
  selected: Accessor<boolean>;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface SelectItemIndicatorOwnProps {
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type SelectItemIndicatorProps<T extends ValidComponent = "span"> = SelectItemIndicatorOwnProps &
  RebaseUIComponentProps<T, SelectItemIndicatorState>;

export namespace SelectItemIndicator {
  export type State = SelectItemIndicatorState;
  export type Props<T extends ValidComponent = "span"> = SelectItemIndicatorProps<T>;
  export type OwnProps = SelectItemIndicatorOwnProps;
}
