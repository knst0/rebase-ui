import type { ValidComponent } from "@solidjs/web";
import { createEffect, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectItemContext } from "../item/SelectItemContext";
import { useSelectRootContext } from "../root/SelectRootContext";

/**
 * A text label of the select item.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItemText<T extends ValidComponent = "div">(props: SelectItemText.Props<T>) {
  const [local, elementProps] = split(props as SelectItemText.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = useSelectRootContext();
  const item = useSelectItemContext();

  let textNode: HTMLElement | null = null;

  // Re-registers the label refs whenever the item index or the focus-selected item changes,
  // mirroring upstream's ref callback keyed on `[index, selectedByFocus]`.
  createEffect(
    () => ({ itemIndex: item.index(), isSelectedByFocus: item.selectedByFocus() }),
    ({ itemIndex, isSelectedByFocus }) => {
      const node = textNode;
      if (node === null) {
        return undefined;
      }

      item.textRef.current = node;

      if (itemIndex === 0) {
        store.context.firstItemTextRef.current = node;
      }
      if (isSelectedByFocus) {
        store.context.selectedItemTextRef.current = node;
      }
      return undefined;
    },
  );

  return (
    <RenderElement
      as={as}
      props={[
        elementProps,
        {
          ref: (element: HTMLElement | null) => {
            textNode = element;
            if (element !== null) {
              item.textRef.current = element;
            }
          },
        },
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<SelectItemText.Props>);

export interface SelectItemTextState {}

export type SelectItemTextProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, SelectItemTextState>;

export namespace SelectItemText {
  export type State = SelectItemTextState;
  export type Props<T extends ValidComponent = "div"> = SelectItemTextProps<T>;
}
