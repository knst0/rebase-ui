import type { ValidComponent } from "@solidjs/web";
import { createUniqueId, untrack } from "solid-js";

import { NOOP } from "#utils/empty";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { REGULAR_ITEM, useMenuItem, useMenuListItem } from "../item/useMenuItem";
import { useMenuRadioGroupContext } from "../radio-group/MenuRadioGroupContext";
import { useMenuRootContext } from "../root/MenuRootContext";
import { menuCheckableItemStateMapping, menuItemStateMapping } from "../utils/stateAttributesMapping";
import { MenuRadioItemContext } from "./MenuRadioItemContext";

/**
 * A menu item that works like a radio button in a given group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRadioItem<T extends ValidComponent = "div">(props: MenuRadioItem.Props<T>) {
  const [local, elementProps] = split(props as MenuRadioItem.Props, { default: defaultProps }, [
    "as",
    "id",
    "label",
    "nativeButton",
    "disabled",
    "closeOnClick",
    "value",
  ]);

  const as = untrack(() => local.as);

  const listItem = useMenuListItem(() => local.label);
  const id = untrack(() => local.id) ?? createUniqueId();

  const { store } = useMenuRootContext();
  const highlighted = () => (store.select("isActive", listItem.index()) as boolean) ?? false;

  const radioGroup = useMenuRadioGroupContext();

  const rootDisabled = () => (store.select("disabled") as boolean) ?? false;
  const disabled = () => local.disabled || radioGroup.disabled || rootDisabled();
  const checked = () => radioGroup.value === local.value;

  const {
    getItemProps: baseGetItemProps,
    getButtonProps,
    itemRef,
    buttonRef,
  } = useMenuItem({
    closeOnClick: () => local.closeOnClick,
    disabled,
    highlighted,
    id,
    store,
    nativeButton: () => local.nativeButton,
    itemMetadata: REGULAR_ITEM,
  });

  function handleClick(event: MouseEvent) {
    const details = createChangeEventDetails(REASONS.itemPress, event, undefined, {
      preventUnmountOnClose: NOOP,
    });

    radioGroup.setValue(
      untrack(() => local.value),
      details as MenuRadioItem.ChangeEventDetails,
    );
  }

  const state: MenuRadioItemState = {
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
    get checked() {
      return checked();
    },
  };

  const storeItemProps = () => store.select("itemProps") as Record<string, unknown>;

  // Injects the radio role, checked state, and selection before the shared item props resolve:
  // external values win and the selection runs before the close-on-click handler, mirroring
  // the upstream layer order.
  function getItemProps(externalProps?: Record<string, any>) {
    return baseGetItemProps({
      ...externalProps,
      role: "menuitemradio",
      "aria-checked": checked() ? "true" : "false",
      onClick: (event: MouseEvent) => {
        externalProps?.onClick?.(event);
        handleClick(event);
      },
    });
  }

  const ref = mergeRefs<HTMLElement | null>(buttonRef, itemRef, listItem.ref);

  return (
    <MenuRadioItemContext
      value={{
        get checked() {
          return checked();
        },
        get highlighted() {
          return highlighted();
        },
        get disabled() {
          return disabled();
        },
      }}
    >
      <RenderElement
        as={as}
        state={state}
        props={[storeItemProps, elementProps, getItemProps, getButtonProps, { ref }]}
        stateAttributesMapping={{ ...menuItemStateMapping, ...menuCheckableItemStateMapping }}
      />
    </MenuRadioItemContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  nativeButton: false,
  disabled: false,
  closeOnClick: false,
} satisfies Partial<MenuRadioItem.Props>);

export interface MenuRadioItemState {
  /**
   * Whether the radio item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the radio item is currently highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the radio item is currently selected.
   */
  checked: boolean;
}

export interface MenuRadioItemOwnProps extends NonNativeButtonProps {
  /**
   * Value of the radio item.
   * This is the value that will be set in the MenuRadioGroup when the item is selected.
   */
  value: any;
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
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export type MenuRadioItemProps<T extends ValidComponent = "div"> = MenuRadioItemOwnProps & RebaseUIComponentProps<T, MenuRadioItemState>;

export namespace MenuRadioItem {
  export type State = MenuRadioItemState;
  export type Props<T extends ValidComponent = "div"> = MenuRadioItemProps<T>;
  export type OwnProps = MenuRadioItemOwnProps;
  export type ChangeEventDetails = import("../radio-group/MenuRadioGroup").MenuRadioGroup.ChangeEventDetails;
}
