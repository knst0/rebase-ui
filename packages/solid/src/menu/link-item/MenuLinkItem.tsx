import type { ValidComponent } from "@solidjs/web";
import { createUniqueId, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { REGULAR_ITEM, useMenuItem, useMenuListItem } from "../item/useMenuItem";
import { useMenuRootContext } from "../root/MenuRootContext";
import { menuItemStateMapping } from "../utils/stateAttributesMapping";

/**
 * A link in the menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuLinkItem<T extends ValidComponent = "a">(props: MenuLinkItem.Props<T>) {
  const [local, elementProps] = split(props as MenuLinkItem.Props, { default: defaultProps }, ["as", "id", "label", "closeOnClick"]);

  const as = untrack(() => local.as);

  const listItem = useMenuListItem(() => local.label);
  const id = untrack(() => local.id) ?? createUniqueId();

  const { store } = useMenuRootContext();
  const highlighted = () => (store.select("isActive", listItem.index()) as boolean) ?? false;

  const { getItemProps, getButtonProps, itemRef, buttonRef } = useMenuItem({
    closeOnClick: () => local.closeOnClick,
    disabled: () => false,
    highlighted,
    id,
    store,
    nativeButton: () => false,
    itemMetadata: REGULAR_ITEM,
  });

  const state: MenuLinkItemState = {
    get highlighted() {
      return highlighted();
    },
  };

  const storeItemProps = () => store.select("itemProps") as Record<string, unknown>;

  const ref = mergeRefs<HTMLElement | null>(itemRef, buttonRef, listItem.ref);

  return (
    <RenderElement
      as={as}
      state={state}
      props={[storeItemProps, elementProps, getItemProps, getButtonProps, { ref }]}
      stateAttributesMapping={menuItemStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "a",
  closeOnClick: false,
} satisfies Partial<MenuLinkItem.Props>);

export interface MenuLinkItemState {
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface MenuLinkItemOwnProps {
  /**
   * Overrides the text label to use when the item is matched during keyboard text navigation.
   */
  label?: string | undefined;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Whether to close the menu when the item is clicked.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export type MenuLinkItemProps<T extends ValidComponent = "a"> = MenuLinkItemOwnProps & RebaseUIComponentProps<T, MenuLinkItemState>;

export namespace MenuLinkItem {
  export type State = MenuLinkItemState;
  export type Props<T extends ValidComponent = "a"> = MenuLinkItemProps<T>;
  export type OwnProps = MenuLinkItemOwnProps;
}
