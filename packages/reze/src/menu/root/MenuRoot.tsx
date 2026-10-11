import { effect, omitProps, onCleanup, untrack, type JSX } from "reze-js";

import {
  createChangeEventDetails,
  REASONS,
  type RebaseUIChangeEventDetails,
  type RebaseUIGenericEventDetails,
} from "../../internals/event-details";
import { FloatingTree } from "../../internals/floating/tree/FloatingTree";
import { stableCallback } from "../../internals/stableCallback";
import { useMenuFilterProviderContext } from "../filter-provider/MenuFilterProviderContext";
import type { MenuHandle } from "../store/MenuHandle";
import { createMenuRoot } from "./createMenuRoot";
import { MenuRootContext, useMenuRootContext } from "./MenuRootContext";

/**
 * Groups all parts of the menu.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRoot<Payload = unknown>(props: MenuRoot.Props<Payload>) {
  const filterProvider = useMenuFilterProviderContext();
  if (filterProvider) {
    const FilterRoot = filterProvider.Root;
    // The provider's own `children` is this root's element: omitting (not reading) it keeps the
    // element from setting up a second time and lets this root's children through.
    const filterOptions = omitProps(filterProvider.options as Record<string, unknown>, "children");
    return <FilterRoot {...(props as Record<string, unknown>)} {...(filterOptions as Record<string, unknown>)} />;
  }

  const parentRootContext = useMenuRootContext(true);

  const onOpenChange = stableCallback(() => props.onOpenChange);
  const onOpenChangeComplete = stableCallback(() => props.onOpenChangeComplete);
  const onItemHighlighted = stableCallback(() => props.onItemHighlighted);

  const menu = createMenuRoot<Payload>({
    defaultOpen: () => props.defaultOpen ?? false,
    disabled: () => props.disabled ?? false,
    modal: () => props.modal,
    loopFocus: () => props.loopFocus ?? true,
    orientation: () => props.orientation ?? "vertical",
    highlightItemOnHover: () => props.highlightItemOnHover ?? true,
    closeParentOnEsc: () => props.closeParentOnEsc ?? false,
    virtualFocus: () => props.virtualFocus ?? false,
    allowEscape: () => props.allowEscape ?? true,
    resetOnPointerLeave: () => props.resetOnPointerLeave ?? true,
    onOpenChange,
    onOpenChangeComplete,
    onItemHighlighted,
    open: () => props.open,
    triggerId: () => props.triggerId,
  });

  const handle = props.handle;
  if (handle) {
    effect(() => {
      (handle as MenuHandle<Payload>).attach(menu.store);

      onCleanup(() => {
        (handle as MenuHandle<Payload>).detach(menu.store);
      });
    });
  }

  const actionsRef = props.actionsRef;
  if (actionsRef) {
    effect(() => {
      (actionsRef as (actions: MenuRoot.Actions | null) => void)({
        unmount: menu.forceUnmount,
        close: () => {
          menu.store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
        },
      });

      onCleanup(() => {
        (actionsRef as (actions: MenuRoot.Actions | null) => void)(null);
      });
    });
  }

  const virtualFocusRef = props.virtualFocusRef;
  if (virtualFocusRef) {
    menu.store.context.virtualFocusRef = virtualFocusRef;
  }

  const orientation = props.orientation ?? "vertical";
  const loopFocus = props.loopFocus ?? true;

  // Creates the children inside the provider (so parts resolve the context) without
  // subscribing to signals read while they are created. Only the payload of
  // render-prop children stays reactive.
  const content = (
    <MenuRootContext
      value={{
        store: menu.store,
        parent: menu.parent,
        orientation,
        loopFocus,
        allowEscape: props.allowEscape ?? true,
        virtualFocus: props.virtualFocus ?? false,
        parentVirtualFocus: parentRootContext?.virtualFocus ?? false,
      }}
    >
      <MenuRootContent payload={menu.store.useState("payload") as () => Payload | undefined}>{props.children}</MenuRootContent>
    </MenuRootContext>
  );

  if (menu.parent.type === undefined) {
    // Set up a FloatingTree to provide the context to nested menus.
    return <FloatingTree externalTree={menu.floatingTreeRoot}>{content}</FloatingTree>;
  }

  return content;
}

/**
 * Renders the root children inside the menu context. Render-prop children are invoked
 * once and receive `payload` as a getter, so reading it inside JSX updates the content in
 * place instead of recreating the popup subtree (which would restart the open, position
 * and content transitions).
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
function MenuRootContent<Payload>(props: {
  children: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  payload: () => Payload | undefined;
}) {
  const children = props.children;

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (args: { payload: Payload | undefined }) => JSX.Element;
    const payload = props.payload;

    // Invoked once, returned directly: `payload` is exposed as a getter, so only
    // the JSX expressions that read it update. Never return a thunk here — a
    // returned thunk re-runs on every update, which would recreate the whole
    // popup subtree (positioner, popup, viewport) and restart the open, position
    // and content transitions.
    return untrack(() =>
      render({
        get payload() {
          return payload();
        },
      }),
    );
  }

  return children as JSX.Element;
}

export interface MenuRootState {}

export interface MenuRootProps<Payload = unknown> {
  /**
   * Whether the menu is initially open.
   *
   * To render a controlled menu, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Determines if the menu enters a modal state when open.
   * - `true`: user interaction is limited to the menu: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   *
   * Nested menus ignore this prop, and menus opened by hover are never modal.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Event handler called when the menu is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: MenuRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the menu is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Callback fired when an item is highlighted or unhighlighted.
   * Receives the highlighted item element (or `undefined` if no item is highlighted) and details
   * containing the reason for the change, the event, and the item's text label.
   * The `reason` can be:
   * - `'keyboard'`: the highlight changed due to keyboard navigation.
   * - `'pointer'`: the highlight changed due to pointer hovering. The event may be a `MouseEvent`
   *   rather than a `PointerEvent`.
   * - `'none'`: the highlight changed for another reason, such as automatic highlighting while
   *   filtering, the item list changing, or the popup opening or closing.
   */
  onItemHighlighted?: ((highlightedItem: HTMLElement | undefined, eventDetails: MenuRoot.HighlightEventDetails) => void) | undefined;
  /**
   * Whether the menu is currently open.
   */
  open?: boolean | undefined;
  /**
   * The visual orientation of the menu.
   * Controls whether roving focus uses up/down or left/right arrow keys.
   * @default 'vertical'
   */
  orientation?: MenuRoot.Orientation | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * When in a submenu, determines whether pressing the Escape key
   * closes the entire menu, or only the current child menu.
   * @default false
   */
  closeParentOnEsc?: boolean | undefined;
  /**
   * A callback that receives the imperative actions.
   * - `unmount`: Manually unmounts the menu.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: When specified, the menu can be closed imperatively.
   */
  actionsRef?: ((actions: MenuRoot.Actions | null) => void) | undefined;
  /**
   * ID of the trigger that the menu is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled menu.
   * There's no need to specify this prop when the menu is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * A handle to associate the menu with a trigger.
   * If specified, allows external triggers to control the menu's open state.
   */
  handle?: MenuHandle<Payload> | undefined;
  /**
   * The content of the menu.
   * This can be a regular node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  /**
   * Whether the menu uses virtual focus: real focus stays on the filter input while the highlight
   * is exposed through `aria-activedescendant`.
   * @internal
   */
  virtualFocus?: boolean | undefined;
  /**
   * The element that holds real focus while virtual list navigation is active.
   * @internal
   */
  virtualFocusRef?: { current: HTMLElement | null } | undefined;
  /**
   * Whether arrow keys can step from either end of the list back to a virtual focus owner.
   * @internal
   * @default true
   */
  allowEscape?: boolean | undefined;
  /**
   * Whether pointer leave should clear the active item.
   * @internal
   * @default true
   */
  resetOnPointerLeave?: boolean | undefined;
}

export interface MenuRootActions {
  unmount: () => void;
  close: () => void;
}

export type MenuRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.focusOut
  | typeof REASONS.listNavigation
  | typeof REASONS.escapeKey
  | typeof REASONS.itemPress
  | typeof REASONS.closePress
  | typeof REASONS.siblingOpen
  | typeof REASONS.cancelOpen
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type MenuRootChangeEventDetails = RebaseUIChangeEventDetails<
  MenuRootChangeEventReason,
  {
    preventUnmountOnClose(): void;
  }
>;

export type MenuRootHighlightEventReason = typeof REASONS.keyboard | typeof REASONS.pointer | typeof REASONS.none;

export type MenuRootHighlightEventDetails = RebaseUIGenericEventDetails<
  MenuRootHighlightEventReason,
  {
    /**
     * The highlighted item's `label` prop, or its text content when the prop is not set.
     */
    label: string | undefined;
  }
>;

export type MenuRootOrientation = "horizontal" | "vertical";

export namespace MenuRoot {
  export type State = MenuRootState;
  export type Props<Payload = unknown> = MenuRootProps<Payload>;
  export type Actions = MenuRootActions;
  export type ChangeEventReason = MenuRootChangeEventReason;
  export type ChangeEventDetails = MenuRootChangeEventDetails;
  export type HighlightEventReason = MenuRootHighlightEventReason;
  export type HighlightEventDetails = MenuRootHighlightEventDetails;
  export type Orientation = MenuRootOrientation;
}
