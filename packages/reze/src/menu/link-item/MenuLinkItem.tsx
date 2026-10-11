import { createUniqueId, dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuFilterItem } from "../filter-root/MenuFilterContext";
import type { MenuItemEventHandlers } from "../item/MenuItem";
import { REGULAR_ITEM, useMenuItem, useMenuListItem, type MenuHTMLProps } from "../item/useMenuItem";
import { useMenuRootContext } from "../root/MenuRootContext";

/**
 * A link in the menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuLinkItem<T extends JSX.ElementType = "a">(props: MenuLinkItem.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "id",
    "label",
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
  const highlighted = () => (store.select("isActive", listItem.index()) as boolean) ?? false;

  // Live view of the consumer handlers omitted from the spread above.
  const userHandlers = props as unknown as MenuHTMLProps;

  const item = useMenuItem({
    closeOnClick: () => props.closeOnClick ?? false,
    disabled: () => false,
    highlighted,
    id,
    store,
    nativeButton: () => false,
    itemMetadata: REGULAR_ITEM,
    layers: [() => store.select("itemProps") as MenuHTMLProps | undefined, () => filterItem.props, () => userHandlers],
  });

  function snapshot(): MenuLinkItemState {
    return {
      highlighted: highlighted(),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "a");

  function buttonRef(element: HTMLElement | null) {
    item.itemRef(element);
    item.button.buttonRef(element);
    listItem.ref(element);
    filterItem.ref?.(element);
    (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);
  }

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would drop the item's registry entry and
  // highlight every time an item appears or disappears. The default path renders
  // a static `<a>` so filter updates patch it in place; only a customized `as`
  // keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {filterItem.visible() && (
          <a
            {...(rest as Record<string, unknown>)}
            id={id}
            role="menuitem"
            tabindex={item.tabIndex()}
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
            data-highlighted={highlighted() ? "" : undefined}
            class={resolveClassValue(props.class, snapshot())}
            style={resolveStyleValue(props.style, snapshot())}
            ref={buttonRef}
          >
            {resolveChildrenValue(children, snapshot)}
          </a>
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
          tabindex={item.tabIndex()}
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

export type MenuLinkItemProps<T extends JSX.ElementType = "a"> = MenuLinkItemOwnProps &
  MenuItemEventHandlers &
  RebaseUIComponentProps<T, MenuLinkItemState>;

export namespace MenuLinkItem {
  export type State = MenuLinkItemState;
  export type Props<T extends JSX.ElementType = "a"> = MenuLinkItemProps<T>;
  export type OwnProps = MenuLinkItemOwnProps;
}
