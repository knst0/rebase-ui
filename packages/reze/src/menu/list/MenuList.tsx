import { createUniqueId, dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { resolvePopupLabel } from "../../internals/resolvePopupLabel";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuFilterImpl } from "../filter-root/MenuFilterContext";
import { useMenuRootContext } from "../root/MenuRootContext";

function MenuListPlain<T extends JSX.ElementType = "div">(props: MenuList.Props<T>) {
  const rest = omitProps(props, "as", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { store, orientation } = useMenuRootContext();

  const activeTriggerId = () => store.select("activeTriggerId") as string | null;
  const activeTriggerElement = () => store.select("activeTriggerElement") as Element | null;

  const id = props.id ?? createUniqueId();

  function ref(element: HTMLElement | null) {
    store.set("listElement", element);
    (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={id}
      role="menu"
      // The popup focuses the list on a pointer open in place of itself.
      tabindex={-1}
      // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
      aria-orientation={orientation === "horizontal" ? "horizontal" : undefined}
      aria-labelledby={resolvePopupLabel({}, activeTriggerElement(), activeTriggerId())}
      class={resolveClassValue(props.class, {})}
      style={resolveStyleValue(props.style, {})}
      ref={ref}
    >
      {resolveChildrenValue(children, () => ({}))}
    </Tag>
  );
}

/**
 * Groups menu items so other content, such as a filter input, can share the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuList<T extends JSX.ElementType = "div">(props: MenuList.Props<T>) {
  const List = useMenuFilterImpl()?.List ?? MenuListPlain;
  return <List {...(props as Record<string, unknown>)} />;
}

export interface MenuListState {}

export type MenuListProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, MenuListState>;

export namespace MenuList {
  export type Props<T extends JSX.ElementType = "div"> = MenuListProps<T>;
  export type State = MenuListState;
}
