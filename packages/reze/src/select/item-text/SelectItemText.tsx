import { dynamicElement, effect, omitProps, untrack, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectItemContext } from "../item/SelectItemContext";
import { useSelectRootContext } from "../root/SelectRootContext";

/**
 * A text label of the select item.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItemText<T extends JSX.ElementType = "div">(props: SelectItemText.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useSelectRootContext();
  const item = useSelectItemContext();

  let textNode: HTMLElement | null = null;

  // Re-registers the label refs whenever the item index or the focus-selected item changes,
  // mirroring upstream's ref callback keyed on `[index, selectedByFocus]`.
  effect(() => {
    const itemIndex = item.index();
    const isSelectedByFocus = item.selectedByFocus();
    // One-shot write: the values only steer this registration.
    untrack(() => {
      const node = textNode;
      if (node === null) {
        return;
      }

      item.textRef.current = node;

      if (itemIndex === 0) {
        store.context.firstItemTextRef.current = node;
      }
      if (isSelectedByFocus) {
        store.context.selectedItemTextRef.current = node;
      }
    });
  });

  function ref(element: HTMLElement | null): void {
    textNode = element;
    if (element !== null) {
      item.textRef.current = element;
    }
    (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts. The default path renders a static `<div>`; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        class={resolveClassValue(props.class, {})}
        style={resolveStyleValue(props.style, {})}
        ref={ref}
      >
        {resolveChildrenValue(children, () => ({}))}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      class={resolveClassValue(props.class, {})}
      style={resolveStyleValue(props.style, {})}
      ref={ref}
    >
      {resolveChildrenValue(children, () => ({}))}
    </Tag>
  );
}

export interface SelectItemTextState {}

export type SelectItemTextProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, SelectItemTextState>;

export namespace SelectItemText {
  export type State = SelectItemTextState;
  export type Props<T extends JSX.ElementType = "div"> = SelectItemTextProps<T>;
}
