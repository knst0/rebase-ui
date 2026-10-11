import { createUniqueId, dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import { useMenuFilterItem } from "../filter-root/MenuFilterContext";
import { useMenuRootContext } from "../root/MenuRootContext";
import { REGULAR_ITEM, useMenuItem, useMenuListItem, type MenuHTMLProps } from "./useMenuItem";

/**
 * An individual interactive item in the menu.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuItem<T extends JSX.ElementType = "div">(props: MenuItem.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "id",
    "label",
    "nativeButton",
    "disabled",
    "closeOnClick",
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
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const filterItem = useMenuFilterItem({ label: props.label });
  const listItem = useMenuListItem(() => props.label, { enabled: filterItem.visible });
  const id = props.id ?? createUniqueId();

  const { store } = useMenuRootContext();
  const rootDisabled = () => (store.select("disabled") as boolean) ?? false;
  const disabled = () => props.disabled === true || rootDisabled();
  const highlighted = () => (store.select("isActive", listItem.index()) as boolean) ?? false;

  // Live view of the consumer handlers omitted from the spread above.
  const userHandlers = props as unknown as MenuHTMLProps;

  const item = useMenuItem({
    closeOnClick: () => props.closeOnClick ?? true,
    disabled,
    highlighted,
    id,
    store,
    nativeButton: () => props.nativeButton ?? false,
    itemMetadata: REGULAR_ITEM,
    layers: [() => store.select("itemProps") as MenuHTMLProps | undefined, () => filterItem.props, () => userHandlers],
  });

  function snapshot(): MenuItemState {
    return {
      disabled: disabled(),
      highlighted: highlighted(),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  const ref = mergeRefs<HTMLElement | null>(
    (element: HTMLElement | null) => {
      item.itemRef(element);
    },
    listItem.ref,
    filterItem.ref,
    props.ref as ((element: HTMLElement | null) => void) | undefined,
  );

  function buttonRef(element: HTMLElement | null) {
    item.button.buttonRef(element);
    ref(element);
  }

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would drop the item's registry entry and
  // highlight every time an item appears or disappears. The default path renders
  // a static `<div>` so filter updates patch it in place; only a customized `as`
  // keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {filterItem.visible() && (
          <div
            {...(rest as Record<string, unknown>)}
            id={id}
            role="menuitem"
            {...(item.button.type ? { type: item.button.type } : {})}
            bool:disabled={item.button.disabled}
            tabindex={item.tabIndex()}
            aria-disabled={item.button.ariaDisabled}
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
            class={resolveClassValue(props.class, snapshot())}
            style={resolveStyleValue(props.style, snapshot())}
            ref={buttonRef}
          >
            {resolveChildrenValue(children, snapshot)}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {filterItem.visible() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          id={id}
          role="menuitem"
          type={item.button.type}
          bool:disabled={item.button.disabled}
          tabindex={item.tabIndex()}
          aria-disabled={item.button.ariaDisabled}
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
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={buttonRef}
        >
          {resolveChildrenValue(children, snapshot)}
        </Tag>
      )}
    </>
  );
}

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

export interface MenuItemEventHandlers {
  onClick?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onMouseDown?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onMouseUp?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onPointerDown?: ((event: RebaseUIEvent<PointerEvent>) => void) | undefined;
  onPointerEnter?: ((event: RebaseUIEvent<PointerEvent>) => void) | undefined;
  onMouseEnter?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onMouseMove?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onMouseLeave?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onPointerLeave?: ((event: RebaseUIEvent<PointerEvent>) => void) | undefined;
  onFocus?: ((event: RebaseUIEvent<FocusEvent>) => void) | undefined;
  onBlur?: ((event: RebaseUIEvent<FocusEvent>) => void) | undefined;
  onKeyDown?: ((event: RebaseUIEvent<KeyboardEvent>) => void) | undefined;
  onKeyUp?: ((event: RebaseUIEvent<KeyboardEvent>) => void) | undefined;
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

export type MenuItemProps<T extends JSX.ElementType = "div"> = MenuItemOwnProps &
  MenuItemEventHandlers &
  RebaseUIComponentProps<T, MenuItemState>;

export namespace MenuItem {
  export type State = MenuItemState;
  export type Props<T extends JSX.ElementType = "div"> = MenuItemProps<T>;
  export type OwnProps = MenuItemOwnProps;
}
