import { createUniqueId, dynamicElement, omitProps, untrack, type JSX } from "reze-js";

import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { stableCallback } from "../../internals/stableCallback";
import type { ChildrenValue, NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useMenuFilterItem } from "../filter-root/MenuFilterContext";
import type { MenuItemEventHandlers } from "../item/MenuItem";
import { REGULAR_ITEM, useMenuItem, useMenuListItem, type MenuHTMLProps } from "../item/useMenuItem";
import type { MenuRoot } from "../root/MenuRoot";
import { useMenuRootContext } from "../root/MenuRootContext";
import { MenuCheckboxItemContext } from "./MenuCheckboxItemContext";

function noop() {}

/**
 * A menu item that toggles a setting on or off.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuCheckboxItem<T extends JSX.ElementType = "div">(props: MenuCheckboxItem.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "id",
    "label",
    "nativeButton",
    "disabled",
    "closeOnClick",
    "checked",
    "defaultChecked",
    "onCheckedChange",
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
  const rootDisabled = () => (store.select("disabled") as boolean) ?? false;
  const disabled = () => props.disabled === true || rootDisabled();
  const highlighted = () => (store.select("isActive", listItem.index()) as boolean) ?? false;

  const [checked, setCheckedUnwrapped] = createControllableSignal({
    value: () => props.checked,
    defaultValue: () => props.defaultChecked ?? false,
  });

  const onCheckedChange = stableCallback(() => props.onCheckedChange);

  function setChecked(nextChecked: boolean, event: MouseEvent) {
    const details = createChangeEventDetails(REASONS.itemPress, event, undefined, {
      preventUnmountOnClose: noop,
    }) as MenuCheckboxItem.ChangeEventDetails;

    onCheckedChange(nextChecked, details);

    if (details.isCanceled) {
      return;
    }

    setCheckedUnwrapped(nextChecked);
  }

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
    // The toggle runs after the winning onClick and before the close-on-click handler,
    // mirroring the upstream layer order.
    onClickExtra: (event: MouseEvent) => {
      setChecked(!untrack(checked), event);
    },
  });

  function snapshot(): MenuCheckboxItemState {
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

  const contextValue: MenuCheckboxItemContext = {
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
      <MenuCheckboxItemContext value={contextValue}>
        {filterItem.visible() && (
          <div
            {...(rest as Record<string, unknown>)}
            id={id}
            role="menuitemcheckbox"
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
            <MenuCheckboxItemContent checked={checked()} highlighted={highlighted()} disabled={disabled()}>
              {props.children}
            </MenuCheckboxItemContent>
          </div>
        )}
      </MenuCheckboxItemContext>
    );
  }

  return (
    <MenuCheckboxItemContext value={contextValue}>
      {filterItem.visible() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          id={id}
          role="menuitemcheckbox"
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
          <MenuCheckboxItemContent checked={checked()} highlighted={highlighted()} disabled={disabled()}>
            {props.children}
          </MenuCheckboxItemContent>
        </Tag>
      )}
    </MenuCheckboxItemContext>
  );
}

/**
 * Resolves the item children inside the checkbox item context. `children` must be read here,
 * not in the item body: reading it above the provider would create context consumers (like
 * the indicator) outside of it. Zero-argument functions pass through untouched: Reze
 * control-flow primitives return thunks, and invoking one here would resolve the subtree
 * one-shot instead of binding it.
 */
function MenuCheckboxItemContent(props: {
  children: ChildrenValue<MenuCheckboxItemState>;
  checked: boolean;
  highlighted: boolean;
  disabled: boolean;
}) {
  const children = props.children;

  function snapshot(): MenuCheckboxItemState {
    return {
      disabled: props.disabled,
      highlighted: props.highlighted,
      checked: props.checked,
    };
  }

  return <>{resolveChildrenValue(children, snapshot)}</>;
}

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

export type MenuCheckboxItemProps<T extends JSX.ElementType = "div"> = MenuCheckboxItemOwnProps &
  MenuItemEventHandlers &
  RebaseUIComponentProps<T, MenuCheckboxItemState>;

export namespace MenuCheckboxItem {
  export type State = MenuCheckboxItemState;
  export type Props<T extends JSX.ElementType = "div"> = MenuCheckboxItemProps<T>;
  export type OwnProps = MenuCheckboxItemOwnProps;
  export type ChangeEventReason = MenuCheckboxItemChangeEventReason;
  export type ChangeEventDetails = MenuCheckboxItemChangeEventDetails;
}
