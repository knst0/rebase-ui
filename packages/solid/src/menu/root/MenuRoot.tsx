import type { JSX } from "@solidjs/web";
import { createMemo, onSettled, type Setter, untrack } from "solid-js";

import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { FloatingTree } from "../../internals/floating/tree/FloatingTree";
import { stableCallback } from "../../internals/stableCallback";
import type { MenuHandle } from "../store/MenuHandle";
import { createMenuRoot } from "./createMenuRoot";
import { MenuRootContext } from "./MenuRootContext";

/**
 * Groups all parts of the menu.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRoot<Payload = unknown>(props: MenuRoot.Props<Payload>) {
  const onOpenChange = stableCallback(() => props.onOpenChange);
  const onOpenChangeComplete = stableCallback(() => props.onOpenChangeComplete);

  const menu = createMenuRoot<Payload>({
    defaultOpen: () => props.defaultOpen ?? false,
    disabled: () => props.disabled ?? false,
    modal: () => props.modal,
    loopFocus: () => props.loopFocus ?? true,
    orientation: () => props.orientation ?? "vertical",
    highlightItemOnHover: () => props.highlightItemOnHover ?? true,
    closeParentOnEsc: () => props.closeParentOnEsc ?? false,
    onOpenChange,
    onOpenChangeComplete,
    open: () => props.open,
    triggerId: () => props.triggerId,
  });

  const handle = untrack(() => props.handle);
  if (handle) {
    // Attaching writes to state owned by the handle, so it must happen outside
    // the component's owned scope once rendering has settled.
    onSettled(() => {
      (handle as MenuHandle<Payload>).attach(menu.store);

      return () => {
        (handle as MenuHandle<Payload>).detach(menu.store);
      };
    });
  }

  const actionsRef = untrack(() => props.actionsRef);
  if (actionsRef) {
    // Delivering the actions is a signal write, so it happens outside the
    // component's owned scope once rendering has settled.
    onSettled(() => {
      actionsRef({
        unmount: menu.forceUnmount,
        close: () => {
          menu.store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
        },
      });

      return () => {
        actionsRef(null);
      };
    });
  }

  // Creates the children inside the provider (so parts resolve the context) without
  // subscribing to signals read while they are created. Only the payload of
  // render-prop children stays reactive.
  const content = (
    <MenuRootContext value={{ store: menu.store, parent: menu.parent }}>
      <MenuRootContent payload={menu.store.useState("payload") as () => Payload | undefined}>
        {untrack(() => props.children)}
      </MenuRootContent>
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
 */
function MenuRootContent<Payload>(props: {
  children: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  payload: () => Payload | undefined;
}) {
  const children = untrack(() => props.children);

  if (typeof children === "function") {
    const payloadChildren = children;
    const payload = props.payload;

    // The children function runs once: `payload` is exposed as a getter, so only the JSX
    // expressions that read it re-run. The memo is the lazy-creation wrapper the runtime
    // expects and it recomputes only if the children function reads the payload
    // synchronously (e.g. destructuring it), which restores the previous remount behaviour.
    const childrenMemo = createMemo(() =>
      payloadChildren({
        get payload() {
          return payload();
        },
      }),
    );
    return (() => childrenMemo()) as unknown as JSX.Element;
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
   * A signal setter that receives the imperative actions.
   * - `unmount`: Manually unmounts the menu.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: When specified, the menu can be closed imperatively.
   */
  actionsRef?: Setter<MenuRoot.Actions | null> | undefined;
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

export type MenuRootOrientation = "horizontal" | "vertical";

export namespace MenuRoot {
  export type State = MenuRootState;
  export type Props<Payload = unknown> = MenuRootProps<Payload>;
  export type Actions = MenuRootActions;
  export type ChangeEventReason = MenuRootChangeEventReason;
  export type ChangeEventDetails = MenuRootChangeEventDetails;
  export type Orientation = MenuRootOrientation;
}
