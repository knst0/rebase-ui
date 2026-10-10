import type { ValidComponent } from "@solidjs/web";
import { createUniqueId, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { resolvePopupLabel } from "../../internals/resolvePopupLabel";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuFilterImpl } from "../filter-root/MenuFilterContext";
import { useMenuRootContext } from "../root/MenuRootContext";

function MenuListPlain<T extends ValidComponent = "div">(props: MenuList.Props<T>) {
  const [local, elementProps] = split(props as MenuList.Props, { default: defaultProps }, ["as", "id", "ref"]);

  const as = untrack(() => local.as);
  const { store, orientation } = useMenuRootContext();

  const activeTriggerId = () => store.select("activeTriggerId") as string | null;
  const activeTriggerElement = () => store.select("activeTriggerElement") as Element | null;

  const id = untrack(() => local.id) ?? createUniqueId();

  const ref = mergeRefs<HTMLElement | null>(local.ref as ((element: HTMLElement | null) => void) | undefined, (element) => {
    store.set("listElement", element);
  });

  const listProps: Record<string, unknown> = {
    id,
    role: "menu",
    // The popup focuses the list on a pointer open in place of itself.
    tabIndex: -1,
    // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
    "aria-orientation": orientation === "horizontal" ? "horizontal" : undefined,
    get "aria-labelledby"() {
      return resolvePopupLabel({}, activeTriggerElement(), activeTriggerId());
    },
  };

  return <RenderElement as={as} props={[listProps, elementProps, { ref }]} />;
}

/**
 * Groups menu items so other content, such as a filter input, can share the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuList<T extends ValidComponent = "div">(props: MenuList.Props<T>) {
  const List = useMenuFilterImpl()?.List ?? MenuListPlain;
  return <List {...(props as Record<string, unknown>)} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<MenuList.Props>);

export interface MenuListState {}

export type MenuListProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, MenuListState>;

export namespace MenuList {
  export type Props<T extends ValidComponent = "div"> = MenuListProps<T>;
  export type State = MenuListState;
}
