import { effect, onCleanup, untrack, useContext } from "reze-js";

import { useContextMenuRootContext } from "../../context-menu/root/ContextMenuRootContext";
import { CompositeListContext } from "../../internals/composite/list/CompositeListContext";
import { createButton, type CreateButtonReturnValue } from "../../internals/create-button";
import { dispatchClickWithModifiers } from "../../internals/dispatchClickWithModifiers";
import { REASONS } from "../../internals/event-details";
import type { FloatingTreeStore } from "../../internals/floating/tree/FloatingTreeStore";
import { platform } from "../../internals/utils/platform";
import type { RebaseUIEvent } from "../../types";
import { useMenuRootContext } from "../root/MenuRootContext";
import type { MenuStore } from "../store/MenuStore";
import { useMenuItemCommonProps } from "./useMenuItemCommonProps";

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

  const rootContext = useMenuRootContext(true);
  const contextMenuContext = useContextMenuRootContext(true);
  const commonItemProps = rootContext === undefined ? undefined : useMenuItemCommonProps({ highlighted, store, itemMetadata });

  const tabIndex = () => {
    if (commonItemProps) {
      return commonItemProps.tabIndex();
    }
    return (store.select("open") as boolean) && highlighted() ? 0 : -1;
  };

  const ariaSelected = () => commonItemProps?.ariaSelected() === true;

  /**
   * Last-wins read across the handler layers below the item, mirroring how `RenderElement`
   * resolves the accumulated external props for its function layers: a user handler wins over
   * the filter's, which wins over the store's.
   */
  function externalHandler(key: string): ((event: any) => void) | undefined {
    const layers = params.layers;
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const handler = layers[index]()?.[key] as ((event: any) => void) | undefined;
      if (handler !== undefined) {
        return handler;
      }
    }
    return undefined;
  }

  function onCommonKeyDown(event: KeyboardEvent) {
    if (event.key === " " && typingRef.current) {
      event.preventDefault();
    }
  }

  // Real focus stays on the input or list that owns virtual navigation.
  const onCommonMouseDown =
    commonItemProps?.virtualFocus === true
      ? (event: MouseEvent) => {
          event.preventDefault();
        }
      : undefined;

  function onCommonMouseMove(event: MouseEvent) {
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
  }

  function onCommonClick(event: MouseEvent) {
    if (closeOnClick()) {
      (store.peek("floatingTreeRoot") as FloatingTreeStore).events.emit("close", {
        domEvent: event,
        reason: REASONS.itemPress,
      });
    }
  }

  function onCommonMouseUp(event: MouseEvent) {
    if (contextMenuContext) {
      const initialCursorPoint = contextMenuContext.initialCursorPoint;
      contextMenuContext.initialCursorPoint = null;
      if (
        initialCursorPoint &&
        Math.abs(event.clientX - initialCursorPoint.x) <= 1 &&
        Math.abs(event.clientY - initialCursorPoint.y) <= 1
      ) {
        return;
      }

      // On non-macOS platforms, this mouseup belongs to the right-click gesture
      // that opened the context menu, so it must not activate an item.
      if (!platform.os.mac && event.button === 2) {
        return;
      }
    }

    if (
      itemElement &&
      store.context.allowMouseUpTriggerRef.current &&
      (!contextMenuContext || event.button === 2) &&
      itemMetadata.type === "regular-item"
    ) {
      // This fires whenever the user clicks on the trigger, moves the cursor, and releases it over the item.
      // We trigger the click and override the `closeOnClick` preference to always close the menu.
      // `detail: 1` and `pointerType: 'mouse'` mark this as a mouse-gesture click so
      // MenuRoot and FloatingFocusManager don't treat it as a keyboard activation.
      dispatchMouseGestureClick(itemElement, event);
    }
  }

  const onSubmenuTriggerMouseEnter =
    itemMetadata.type === "submenu-trigger"
      ? (event: MouseEvent) => {
          itemMetadata.setActive(event);
        }
      : undefined;

  // One-shot read: the interaction prop bags are created once by the root, so chaining them
  // here keeps hover-highlight and focus sync working even when a later layer shadows them.
  const floatProps = (params.chainFloatItemProps ?? true) ? ((store.peek("itemProps") as MenuHTMLProps | undefined) ?? {}) : {};

  // Runs after the winning onClick and before the close-on-click handler (checkbox toggle,
  // radio select), mirroring the upstream layer order.
  const onClickExtra = params.onClickExtra;
  function onExternalClick(event: MouseEvent) {
    externalHandler("onClick")?.(event);
    onClickExtra?.(event);
  }

  function handleKeyDown(event: KeyboardEvent) {
    chainHandlers(externalHandler("onKeyDown"), onCommonKeyDown)?.(event);
    // Composite Space activation, mirroring the Solid button's composite branch: menu items
    // activate on Space keydown (not keyup). A Space already claimed for text navigation
    // (default-prevented while typeahead is active) stays with the input.
    const currentTarget = event.currentTarget as Element | null;
    if (event.target === event.currentTarget && event.key === " ") {
      const role = currentTarget?.getAttribute("role");
      const isTextNavigationRole = role?.startsWith("menuitem") === true || role === "option" || role === "gridcell";
      if (event.defaultPrevented && isTextNavigationRole) {
        return;
      }
      event.preventDefault();
      if (currentTarget !== null && (!untrack(nativeButton) || currentTarget.tagName === "BUTTON")) {
        (event as RebaseUIEvent<KeyboardEvent>).preventRebaseUIHandler?.();
        dispatchClickWithModifiers(currentTarget, event);
      }
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    externalHandler("onKeyUp")?.(event);
    // Suppress the keyup Space activation: composite items already activated on keydown, and a
    // native button item must not fire its native click either.
    if (event.target === event.currentTarget && event.key === " ") {
      event.preventDefault();
    }
  }

  const button = createButton({
    get disabled() {
      return disabled();
    },
    get focusableWhenDisabled() {
      return true;
    },
    get nativeButton() {
      return nativeButton();
    },
    get onClick() {
      return onChainedClick;
    },
    get onMouseDown() {
      return chainHandlers(externalHandler("onMouseDown"), onCommonMouseDown);
    },
    get onKeyDown() {
      return handleKeyDown;
    },
    get onKeyUp() {
      return handleKeyUp;
    },
    get onPointerDown() {
      return externalHandler("onPointerDown");
    },
  });

  function onChainedClick(event: MouseEvent) {
    onExternalClick(event);
    (floatProps.onClick as ((event: MouseEvent) => void) | undefined)?.(event);
    onCommonClick(event);
  }

  function onMouseMove(event: MouseEvent) {
    chainHandlers(externalHandler("onMouseMove"), floatProps.onMouseMove, onCommonMouseMove)?.(event);
  }

  function onMouseUp(event: MouseEvent) {
    chainHandlers(externalHandler("onMouseUp"), onCommonMouseUp)?.(event);
  }

  function onMouseEnter(event: MouseEvent) {
    chainHandlers(externalHandler("onMouseEnter"), onSubmenuTriggerMouseEnter)?.(event);
  }

  function onFocus(event: FocusEvent) {
    chainHandlers(externalHandler("onFocus"), floatProps.onFocus)?.(event);
  }

  function onPointerLeave(event: PointerEvent) {
    chainHandlers(externalHandler("onPointerLeave"), floatProps.onPointerLeave)?.(event);
  }

  return {
    tabIndex,
    ariaSelected,
    virtualFocus: commonItemProps?.virtualFocus ?? false,
    button,
    itemRef,
    id,
    onMouseMove,
    onMouseUp,
    onMouseEnter,
    onFocus,
    onPointerLeave,
  };
}

/**
 * Dispatches a synthetic click for a press-drag-release gesture, copying the source event's
 * modifier state. Reports `detail: 1` and `pointerType: 'mouse'`, which the focus manager
 * reads to classify the close as a mouse gesture rather than a keyboard activation.
 */
function dispatchMouseGestureClick(target: Element, sourceEvent: MouseEvent) {
  dispatchClickWithModifiers(target, sourceEvent, { detail: 1, pointerType: "mouse" });
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
  /**
   * Handler layers below the item, lowest precedence first (the store's item props, the
   * filter's item props, then the consumer's). Each key resolves last-wins, mirroring how
   * `RenderElement` accumulates the external props for its function layers.
   */
  layers: Array<() => MenuHTMLProps | undefined>;
  /**
   * Runs after the winning onClick and before the close-on-click handler: the checkbox
   * toggle or the radio selection. Mirrors the upstream layer order.
   */
  onClickExtra?: ((event: MouseEvent) => void) | undefined;
}

export type UseMenuItemMetadata =
  | typeof REGULAR_ITEM
  | {
      type: "submenu-trigger";
      setActive: (event: MouseEvent) => void;
    };

export interface UseMenuItemReturnValue {
  /**
   * The roving focus model (`tabIndex`) shared by all menu item types.
   */
  tabIndex: () => number;
  /**
   * Whether the WebKit selection state applies.
   */
  ariaSelected: () => boolean;
  /**
   * Whether the item follows the virtual focus model.
   */
  virtualFocus: boolean;
  /**
   * Button behavior wrapping the chained handlers; suppresses them while disabled and
   * handles keyboard activation.
   */
  button: CreateButtonReturnValue;
  /**
   * Ref callback for the component's root DOM element.
   */
  itemRef: (element: HTMLElement | null) => void;
  /**
   * The id of the menu item.
   */
  id: string | undefined;
  onMouseMove: (event: MouseEvent) => void;
  onMouseUp: (event: MouseEvent) => void;
  onMouseEnter: (event: MouseEvent) => void;
  onFocus: (event: FocusEvent) => void;
  onPointerLeave: (event: PointerEvent) => void;
}

/**
 * Registers the item with the composite list provided by `Menu.Positioner` (or the nearest
 * composite list ancestor) and returns its document-order index. Outside a composite list the
 * index stays `-1` and the item is never highlighted, mirroring upstream's optional
 * positioner context.
 */
export function useMenuListItem(
  label: () => string | undefined,
  options?: { enabled?: () => boolean },
): { ref: (element: HTMLElement | null) => void; index: () => number } {
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

  // A filtered-out item renders nothing while its component stays mounted, so its cleanup never
  // runs. Unregister it explicitly; the ref re-registers it when it renders again.
  if (options?.enabled) {
    const enabled = options.enabled;
    effect(() => {
      const isEnabled = enabled();
      // One-shot registry write: the value only steers this write.
      untrack(() => {
        if (!isEnabled && itemElement !== null) {
          context?.unregister(itemElement);
          itemElement = null;
        }
      });
    });
  }

  // `indexOf` subscribes to registry changes even for a `null` element, so the first `-1`
  // doesn't stick forever when the ref runs later.
  const index = () => context?.indexOf(itemElement) ?? -1;

  return { ref, index };
}
