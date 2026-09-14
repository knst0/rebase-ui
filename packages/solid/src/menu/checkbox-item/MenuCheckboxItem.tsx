import type { ValidComponent } from "@solidjs/web";
import { createUniqueId, untrack } from "solid-js";

import { NOOP } from "#utils/empty";

import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import { stableCallback } from "../../internals/stableCallback";
import type { NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { REGULAR_ITEM, useMenuItem, useMenuListItem } from "../item/useMenuItem";
import type { MenuRoot } from "../root/MenuRoot";
import { useMenuRootContext } from "../root/MenuRootContext";
import { menuCheckableItemStateMapping, menuItemStateMapping } from "../utils/stateAttributesMapping";
import { MenuCheckboxItemContext } from "./MenuCheckboxItemContext";

/**
 * A menu item that toggles a setting on or off.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuCheckboxItem<T extends ValidComponent = "div">(props: MenuCheckboxItem.Props<T>) {
  const [local, elementProps] = split(props as MenuCheckboxItem.Props, { default: defaultProps }, [
    "as",
    "id",
    "label",
    "nativeButton",
    "disabled",
    "closeOnClick",
    "checked",
    "defaultChecked",
    "onCheckedChange",
  ]);

  const as = untrack(() => local.as);

  const listItem = useMenuListItem(() => local.label);
  const id = untrack(() => local.id) ?? createUniqueId();

  const { store } = useMenuRootContext();
  const rootDisabled = () => (store.select("disabled") as boolean) ?? false;
  const disabled = () => local.disabled || rootDisabled();
  const highlighted = () => (store.select("isActive", listItem.index()) as boolean) ?? false;

  const [checked, setCheckedUnwrapped] = createControllableSignal({
    value: () => local.checked,
    defaultValue: () => local.defaultChecked ?? false,
  });

  const onCheckedChange = stableCallback(() => local.onCheckedChange);

  function setChecked(nextChecked: boolean, event: MouseEvent) {
    const details = createChangeEventDetails(REASONS.itemPress, event, undefined, {
      preventUnmountOnClose: NOOP,
    }) as MenuCheckboxItem.ChangeEventDetails;

    onCheckedChange(nextChecked, details);

    if (details.isCanceled) {
      return;
    }

    setCheckedUnwrapped(nextChecked);
  }

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

  const state: MenuCheckboxItemState = {
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

  // Injects the checkbox role, checked state, and toggle before the shared item props resolve:
  // external values win and the toggle runs before the close-on-click handler, mirroring the
  // upstream layer order.
  function getItemProps(externalProps?: Record<string, any>) {
    return baseGetItemProps({
      ...externalProps,
      role: "menuitemcheckbox",
      "aria-checked": checked() ? "true" : "false",
      onClick: (event: MouseEvent) => {
        externalProps?.onClick?.(event);
        setChecked(!untrack(checked), event);
      },
    });
  }

  const ref = mergeRefs<HTMLElement | null>(buttonRef, itemRef, listItem.ref);

  return (
    <MenuCheckboxItemContext
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
    </MenuCheckboxItemContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  nativeButton: false,
  disabled: false,
  closeOnClick: false,
  defaultChecked: false,
} satisfies Partial<MenuCheckboxItem.Props>);

export interface MenuCheckboxItemState {
  /**
   * Whether the checkbox item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the checkbox item is currently highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the checkbox item is currently ticked.
   */
  checked: boolean;
}

export interface MenuCheckboxItemOwnProps extends NonNativeButtonProps {
  /**
   * Whether the checkbox item is currently ticked.
   *
   * To render an uncontrolled checkbox item, use the `defaultChecked` prop instead.
   */
  checked?: boolean | undefined;
  /**
   * Whether the checkbox item is initially ticked.
   *
   * To render a controlled checkbox item, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Event handler called when the checkbox item is ticked or unticked.
   */
  onCheckedChange?: ((checked: boolean, eventDetails: MenuCheckboxItem.ChangeEventDetails) => void) | undefined;
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

export type MenuCheckboxItemChangeEventReason = MenuRoot.ChangeEventReason;
export type MenuCheckboxItemChangeEventDetails = MenuRoot.ChangeEventDetails;

export type MenuCheckboxItemProps<T extends ValidComponent = "div"> = MenuCheckboxItemOwnProps &
  RebaseUIComponentProps<T, MenuCheckboxItemState>;

export namespace MenuCheckboxItem {
  export type State = MenuCheckboxItemState;
  export type Props<T extends ValidComponent = "div"> = MenuCheckboxItemProps<T>;
  export type OwnProps = MenuCheckboxItemOwnProps;
  export type ChangeEventReason = MenuCheckboxItemChangeEventReason;
  export type ChangeEventDetails = MenuCheckboxItemChangeEventDetails;
}
