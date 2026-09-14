import type { ValidComponent } from "@solidjs/web";
import { createUniqueId, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useMenuRootContext } from "../root/MenuRootContext";
import { menuItemStateMapping } from "../utils/stateAttributesMapping";
import { REGULAR_ITEM, useMenuItem, useMenuListItem } from "./useMenuItem";

/**
 * An individual interactive item in the menu.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuItem<T extends ValidComponent = "div">(props: MenuItem.Props<T>) {
  const [local, elementProps] = split(props as MenuItem.Props, { default: defaultProps }, [
    "as",
    "id",
    "label",
    "nativeButton",
    "disabled",
    "closeOnClick",
  ]);

  const as = untrack(() => local.as);

  const listItem = useMenuListItem(() => local.label);
  const id = untrack(() => local.id) ?? createUniqueId();

  const { store } = useMenuRootContext();
  const rootDisabled = () => (store.select("disabled") as boolean) ?? false;
  const disabled = () => local.disabled || rootDisabled();
  const highlighted = () => (store.select("isActive", listItem.index()) as boolean) ?? false;

  const { getItemProps, getButtonProps, itemRef, buttonRef } = useMenuItem({
    closeOnClick: () => local.closeOnClick,
    disabled,
    highlighted,
    id,
    store,
    nativeButton: () => local.nativeButton,
    itemMetadata: REGULAR_ITEM,
  });

  const state: MenuItemState = {
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
  };

  const storeItemProps = () => store.select("itemProps") as Record<string, unknown>;

  const ref = mergeRefs<HTMLElement | null>(buttonRef, itemRef, listItem.ref);

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
  as: "div",
  nativeButton: false,
  disabled: false,
  closeOnClick: true,
} satisfies Partial<MenuItem.Props>);

export interface MenuItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface MenuItemOwnProps extends NonNativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
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
   *
   * @default true
   */
  closeOnClick?: boolean | undefined;
}

export type MenuItemProps<T extends ValidComponent = "div"> = MenuItemOwnProps & RebaseUIComponentProps<T, MenuItemState>;

export namespace MenuItem {
  export type State = MenuItemState;
  export type Props<T extends ValidComponent = "div"> = MenuItemProps<T>;
  export type OwnProps = MenuItemOwnProps;
}
