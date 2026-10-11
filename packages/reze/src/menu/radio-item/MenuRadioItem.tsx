import { createUniqueId, dynamicElement, omitProps, untrack, type JSX } from "reze-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useMenuFilterItem } from "../filter-root/MenuFilterContext";
import type { MenuItemEventHandlers } from "../item/MenuItem";
import { REGULAR_ITEM, useMenuItem, useMenuListItem, type MenuHTMLProps } from "../item/useMenuItem";
import { useMenuRadioGroupContext } from "../radio-group/MenuRadioGroupContext";
import { useMenuRootContext } from "../root/MenuRootContext";
import { MenuRadioItemContext } from "./MenuRadioItemContext";

function noop() {}

/**
 * A menu item that works like a radio button in a given group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRadioItem<T extends JSX.ElementType = "div">(props: MenuRadioItem.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "id",
    "label",
    "nativeButton",
    "disabled",
    "closeOnClick",
    "value",
    "onClick",
    "onMouseDown",
    "onMouseUp",
    "onPointerDown",
    "onPointerEnter",
    "onMouseEnter",
    "onMouseMove",
    "onMouseLeave",
    "onPointerLeave",
    "onFocus",
    "onBlur",
    "onKeyDown",
    "onKeyUp",
    "class",
    "style",
    "children",
    "ref",
  );
  const filterItem = useMenuFilterItem({ label: props.label });
  const listItem = useMenuListItem(() => props.label, { enabled: filterItem.visible });
  const id = props.id ?? createUniqueId();

  const { store } = useMenuRootContext();
  const highlighted = () => (store.select("isActive", listItem.index()) as boolean) ?? false;

  const radioGroup = useMenuRadioGroupContext();

  const rootDisabled = () => (store.select("disabled") as boolean) ?? false;
  const disabled = () => props.disabled === true || radioGroup.disabled || rootDisabled();
  const checked = () => radioGroup.value === props.value;

  // Live view of the consumer handlers omitted from the spread above.
  const userHandlers = props as unknown as MenuHTMLProps;

  const item = useMenuItem({
    closeOnClick: () => props.closeOnClick ?? false,
    disabled,
    highlighted,
    id,
    store,
    nativeButton: () => props.nativeButton ?? false,
    itemMetadata: REGULAR_ITEM,
    layers: [() => store.select("itemProps") as MenuHTMLProps | undefined, () => filterItem.props, () => userHandlers],
    // The selection runs after the winning onClick and before the close-on-click handler,
    // mirroring the upstream layer order.
    onClickExtra: (event: MouseEvent) => {
      const details = createChangeEventDetails(REASONS.itemPress, event, undefined, {
        preventUnmountOnClose: noop,
      });

      radioGroup.setValue(
        untrack(() => props.value),
        details as MenuRadioItem.ChangeEventDetails,
      );
    },
  });

  function snapshot(): MenuRadioItemState {
    return {
      disabled: disabled(),
      highlighted: highlighted(),
      checked: checked(),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  function buttonRef(element: HTMLElement | null) {
    item.button.buttonRef(element);
    item.itemRef(element);
    listItem.ref(element);
    filterItem.ref?.(element);
    (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);
  }

  const contextValue: MenuRadioItemContext = {
    get checked() {
      return checked();
    },
    get highlighted() {
      return highlighted();
    },
    get disabled() {
      return disabled();
    },
  };

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would drop the item's registry entry and
  // highlight every time an item appears or disappears. The default path renders
  // a static `<div>` so filter updates patch it in place; only a customized `as`
  // keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <MenuRadioItemContext value={contextValue}>
        {filterItem.visible() && (
          <div
            {...(rest as Record<string, unknown>)}
            id={id}
            role="menuitemradio"
            {...(item.button.type ? { type: item.button.type } : {})}
            bool:disabled={item.button.disabled}
            tabindex={item.tabIndex()}
            aria-disabled={item.button.ariaDisabled}
            aria-checked={checked() ? "true" : "false"}
            aria-selected={item.ariaSelected() ? "true" : undefined}
            onClick={item.button.onClick}
            onMouseDown={item.button.onMouseDown}
            onKeyDown={item.button.onKeyDown}
            onKeyUp={item.button.onKeyUp}
            onPointerDown={item.button.onPointerDown}
            onMouseMove={item.onMouseMove}
            onMouseUp={item.onMouseUp}
            onMouseEnter={item.onMouseEnter}
            onMouseLeave={props.onMouseLeave as ((event: MouseEvent) => void) | undefined}
            onPointerEnter={props.onPointerEnter as ((event: PointerEvent) => void) | undefined}
            onPointerLeave={item.onPointerLeave}
            onFocus={item.onFocus}
            onBlur={props.onBlur as ((event: FocusEvent) => void) | undefined}
            data-disabled={disabled() ? "" : undefined}
            data-highlighted={highlighted() ? "" : undefined}
            data-checked={checked() ? "" : undefined}
            data-unchecked={checked() ? undefined : ""}
            class={resolveClassValue(props.class, snapshot())}
            style={resolveStyleValue(props.style, snapshot())}
            ref={buttonRef}
          >
            <MenuRadioItemContent checked={checked()} highlighted={highlighted()} disabled={disabled()}>
              {props.children}
            </MenuRadioItemContent>
          </div>
        )}
      </MenuRadioItemContext>
    );
  }

  return (
    <MenuRadioItemContext value={contextValue}>
      {filterItem.visible() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          id={id}
          role="menuitemradio"
          type={item.button.type}
          bool:disabled={item.button.disabled}
          tabindex={item.tabIndex()}
          aria-disabled={item.button.ariaDisabled}
          aria-checked={checked() ? "true" : "false"}
          aria-selected={item.ariaSelected() ? "true" : undefined}
          onClick={item.button.onClick}
          onMouseDown={item.button.onMouseDown}
          onKeyDown={item.button.onKeyDown}
          onKeyUp={item.button.onKeyUp}
          onPointerDown={item.button.onPointerDown}
          onMouseMove={item.onMouseMove}
          onMouseUp={item.onMouseUp}
          onMouseEnter={item.onMouseEnter}
          onMouseLeave={props.onMouseLeave as ((event: MouseEvent) => void) | undefined}
          onPointerEnter={props.onPointerEnter as ((event: PointerEvent) => void) | undefined}
          onPointerLeave={item.onPointerLeave}
          onFocus={item.onFocus}
          onBlur={props.onBlur as ((event: FocusEvent) => void) | undefined}
          data-disabled={disabled() ? "" : undefined}
          data-highlighted={highlighted() ? "" : undefined}
          data-checked={checked() ? "" : undefined}
          data-unchecked={checked() ? undefined : ""}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={buttonRef}
        >
          <MenuRadioItemContent checked={checked()} highlighted={highlighted()} disabled={disabled()}>
            {props.children}
          </MenuRadioItemContent>
        </Tag>
      )}
    </MenuRadioItemContext>
  );
}

/**
 * Resolves the item children inside the radio item context. `children` must be read here,
 * not in the item body: reading it above the provider would create context consumers (like
 * the indicator) outside of it. Zero-argument functions pass through untouched: Reze
 * control-flow primitives return thunks, and invoking one here would resolve the subtree
 * one-shot instead of binding it.
 */
function MenuRadioItemContent(props: {
  children: ChildrenValue<MenuRadioItemState>;
  checked: boolean;
  highlighted: boolean;
  disabled: boolean;
}) {
  const children = props.children;

  function snapshot(): MenuRadioItemState {
    return {
      disabled: props.disabled,
      highlighted: props.highlighted,
      checked: props.checked,
    };
  }

  return <>{resolveChildrenValue(children, snapshot)}</>;
}

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

export type MenuRadioItemProps<T extends JSX.ElementType = "div"> = MenuRadioItemOwnProps &
  MenuItemEventHandlers &
  RebaseUIComponentProps<T, MenuRadioItemState>;

export namespace MenuRadioItem {
  export type State = MenuRadioItemState;
  export type Props<T extends JSX.ElementType = "div"> = MenuRadioItemProps<T>;
  export type OwnProps = MenuRadioItemOwnProps;
  export type ChangeEventDetails = import("../radio-group/MenuRadioGroup").MenuRadioGroup.ChangeEventDetails;
}
