import { onCleanup } from "solid-js";

import { dispatchClickWithModifiers } from "#utils/dispatchClickWithModifiers";

import { CompositeListContext } from "../../internals/composite/list/CompositeListContext";
import { useContext } from "../../internals/context";
import { createButton } from "../../internals/create-button";
import { REASONS } from "../../internals/event-details";
import type { FloatingTreeStore } from "../../internals/floating/tree/FloatingTreeStore";
import type { MenuStore } from "../store/MenuStore";

export type MenuHTMLProps = Record<string, any>;

export const REGULAR_ITEM = {
  type: "regular-item" as const,
};

export function useMenuItem(params: UseMenuItemParameters): UseMenuItemReturnValue {
  const { disabled, highlighted, id, store, itemMetadata } = params;

  const typingRef = params.typingRef ?? store.context.typingRef;
  const closeOnClick = params.closeOnClick;
  const nativeButton = params.nativeButton;

  let itemElement: HTMLElement | null = null;
  const itemRef = (element: HTMLElement | null) => {
    itemElement = element;
  };

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: () => true,
    native: () => nativeButton(),
    composite: () => true,
  });

  const commonProps: MenuHTMLProps = {
    id,
    role: "menuitem",
    get tabIndex() {
      return (store.select("open") as boolean) && highlighted() ? 0 : -1;
    },
    onKeyDown(event: KeyboardEvent) {
      if (event.key === " " && typingRef.current) {
        event.preventDefault();
      }
    },
    onMouseMove(event: MouseEvent) {
      // One-shot store reads: event handlers don't track.
      const nodeId = store.peek("floatingNodeId") as string | undefined;
      if (!nodeId) {
        return;
      }

      // Inform the floating tree that a menu item within this menu was hovered/moved over
      // so unrelated descendant submenus can be closed.
      (store.peek("floatingTreeRoot") as FloatingTreeStore).events.emit("itemhover", {
        nodeId,
        target: event.currentTarget,
      });
    },
    onClick(event: MouseEvent) {
      if (closeOnClick()) {
        (store.peek("floatingTreeRoot") as FloatingTreeStore).events.emit("close", {
          domEvent: event,
          reason: REASONS.itemPress,
        });
      }
    },
    onMouseUp(event: MouseEvent) {
      if (itemElement && store.context.allowMouseUpTriggerRef.current && itemMetadata.type === "regular-item") {
        // This fires whenever the user clicks on the trigger, moves the cursor, and releases it over the item.
        // We trigger the click and override the `closeOnClick` preference to always close the menu.
        // `detail: 1` marks this as a mouse-gesture click so MenuRoot doesn't
        // treat it as a keyboard activation (`detail === 0` → `data-instant`).
        dispatchClickWithModifiers(itemElement, event, { detail: 1 });
      }
    },
  };

  const submenuTriggerProps: MenuHTMLProps =
    itemMetadata.type === "submenu-trigger"
      ? {
          onMouseEnter() {
            itemMetadata.setActive();
          },
        }
      : {};

  /**
   * Resolver for the root slot's props. Pass as a function layer to `RenderElement` (before
   * `getButtonProps`) so it receives the accumulated external props. External values win over
   * the internal ones (rightmost-wins, mirroring upstream `mergeProps`) while event handlers
   * are chained with the external handler first (mirroring upstream right-to-left execution).
   * `getButtonProps` wraps the chained handlers and suppresses them while the item is disabled.
   */
  function getItemProps(externalProps?: MenuHTMLProps): MenuHTMLProps {
    // One-shot read: the interaction prop bags are created once by the root, so chaining them
    // here keeps hover-highlight and focus sync working even when a later layer shadows them.
    const floatProps = (params.chainFloatItemProps ?? true) ? ((store.peek("itemProps") as MenuHTMLProps | undefined) ?? {}) : {};
    return {
      ...commonProps,
      ...submenuTriggerProps,
      ...externalProps,
      onKeyDown: chainHandlers(externalProps?.onKeyDown, commonProps.onKeyDown),
      onMouseMove: chainHandlers(externalProps?.onMouseMove, floatProps.onMouseMove, commonProps.onMouseMove),
      onClick: chainHandlers(externalProps?.onClick, floatProps.onClick, commonProps.onClick),
      onMouseUp: chainHandlers(externalProps?.onMouseUp, commonProps.onMouseUp),
      onMouseEnter: chainHandlers(
        externalProps?.onMouseEnter,
        (submenuTriggerProps as { onMouseEnter?: (event: MouseEvent) => void }).onMouseEnter,
      ),
      onFocus: chainHandlers(externalProps?.onFocus, floatProps.onFocus),
      onPointerLeave: chainHandlers(externalProps?.onPointerLeave, floatProps.onPointerLeave),
    };
  }

  return {
    getItemProps,
    getButtonProps,
    itemRef,
    buttonRef,
  };
}

function chainHandlers(...handlers: Array<((event: any) => void) | undefined>): ((event: any) => void) | undefined {
  const active = handlers.filter(Boolean) as Array<(event: any) => void>;
  if (active.length === 0) {
    return undefined;
  }
  return (event: any) => {
    for (const handler of active) {
      handler(event);
    }
  };
}

export interface UseMenuItemParameters {
  /**
   * Whether to chain the floating list-navigation item props (hover-highlight and focus sync)
   * into the resolved handlers. Submenu triggers opt out: upstream wires them to the parent
   * menu's item props instead.
   * @default true
   */
  chainFloatItemProps?: boolean | undefined;
  /**
   * Whether to close the menu when the item is clicked.
   */
  closeOnClick: () => boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: () => boolean;
  /**
   * Determines if the menu item is highlighted.
   */
  highlighted: () => boolean;
  /**
   * The id of the menu item.
   */
  id: string | undefined;
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `render` prop.
   * Set to `false` if the rendered element is not a button (for example, `<div>`).
   * @default false
   */
  nativeButton: () => boolean;
  /**
   * Additional data specific to the item type.
   */
  itemMetadata: UseMenuItemMetadata;
  /**
   * The menu store.
   */
  store: MenuStore<any>;
  /**
   * Whether a typeahead session is in progress.
   * @default store.context.typingRef
   */
  typingRef?: { current: boolean } | undefined;
}

export type UseMenuItemMetadata =
  | typeof REGULAR_ITEM
  | {
      type: "submenu-trigger";
      setActive: () => void;
    };

export interface UseMenuItemReturnValue {
  /**
   * Resolver for the root slot's props. Pass as a function layer to `RenderElement`
   * so it receives the accumulated external props and chains their handlers.
   * @param externalProps event handlers for the root slot
   * @returns props that should be spread on the root slot
   */
  getItemProps: (externalProps?: MenuHTMLProps) => MenuHTMLProps;
  /**
   * Button prop resolver. Pass as a function layer after `getItemProps` so the button
   * behavior wraps the chained handlers and suppresses them while disabled.
   */
  getButtonProps: (externalProps?: MenuHTMLProps) => MenuHTMLProps;
  /**
   * Ref callback for the component's root DOM element.
   */
  itemRef: (element: HTMLElement | null) => void;
  /**
   * Ref callback from the button behavior.
   */
  buttonRef: (element: HTMLElement | null) => void;
}

/**
 * Registers the item with the composite list provided by `Menu.Positioner` (or the nearest
 * composite list ancestor) and returns its document-order index. Outside a composite list the
 * index stays `-1` and the item is never highlighted, mirroring upstream's optional
 * positioner context.
 */
export function useMenuListItem(label: () => string | undefined): { ref: (element: HTMLElement | null) => void; index: () => number } {
  const context = useContext(CompositeListContext);

  let itemElement: HTMLElement | null = null;

  const ref = (element: HTMLElement | null) => {
    if (itemElement !== null) {
      context?.unregister(itemElement);
    }

    itemElement = element;

    if (element !== null) {
      context?.register(element, () => ({ label: label() }));
    }
  };

  onCleanup(() => {
    if (itemElement !== null) {
      context?.unregister(itemElement);
    }
  });

  // `indexOf` subscribes to registry changes even for a `null` element, so the first `-1`
  // doesn't stick forever when the ref runs later.
  const index = () => context?.indexOf(itemElement) ?? -1;

  return { ref, index };
}
