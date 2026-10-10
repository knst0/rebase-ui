import { isServer, type ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, createUniqueId, onCleanup, untrack } from "solid-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { safePolygon } from "../../internals/floating";
import { createClick, type ClickReferenceProps } from "../../internals/floating/interactions/createClick";
import {
  createHoverReferenceInteraction,
  type HoverReferenceProps,
} from "../../internals/floating/interactions/createHoverReferenceInteraction";
import { getTarget } from "../../internals/floating/utils/element";
import { mergeRefs } from "../../internals/mergeRefs";
import { getRootFloatingContext, setupTrigger } from "../../internals/popups/popupStoreUtils";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useMenuFilterItem } from "../filter-root/MenuFilterContext";
import { useMenuItem, useMenuListItem } from "../item/useMenuItem";
import { useMenuRootContext } from "../root/MenuRootContext";
import type { MenuStore } from "../store/MenuStore";
import { useMenuSubmenuRootContext } from "../submenu-root/MenuSubmenuRootContext";
import { menuItemStateMapping, menuSubmenuTriggerStateMapping } from "../utils/stateAttributesMapping";

// Local equivalent of upstream `platform.screenReader.voiceOver`: VoiceOver is the system screen
// reader on Apple platforms, so the flag is purely an OS check.
function isVoiceOver(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform ?? "") || (navigator as any).standalone === true;
}

/**
 * A menu item that opens a submenu.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuSubmenuTrigger<T extends ValidComponent = "div">(props: MenuSubmenuTrigger.Props<T>) {
  const [local, userHandlers, elementProps] = split(
    props as MenuSubmenuTrigger.Props,
    { default: defaultProps },
    ["as", "label", "id", "nativeButton", "openOnHover", "delay", "closeDelay", "disabled"],
    [
      "onClick",
      "onMouseDown",
      "onMouseUp",
      "onPointerDown",
      "onPointerEnter",
      "onMouseEnter",
      "onMouseMove",
      "onMouseLeave",
      "onFocus",
      "onBlur",
      "onKeyDown",
    ],
  );

  const as = untrack(() => local.as);

  const submenuRootContext = useMenuSubmenuRootContext();
  if (!submenuRootContext?.parentMenu) {
    throw new Error("Rebase UI: <Menu.SubmenuTrigger> must be placed in <Menu.SubmenuRoot>.");
  }
  const parentMenuStore = submenuRootContext.parentMenu as MenuStore<unknown>;

  const filterItem = useMenuFilterItem({ label: local.label }, "submenu-trigger");
  const listItem = useMenuListItem(() => local.label, { enabled: filterItem.visible });

  const { store } = useMenuRootContext();

  const thisTriggerId = untrack(() => local.id) ?? createUniqueId();

  const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);
  const triggerElementRef: { current: Element | null } = { current: null };

  setupTrigger({
    triggerId: thisTriggerId,
    triggerElement,
    store: () => store as MenuStore<unknown>,
    stateUpdates: () => ({
      closeDelay: local.closeDelay ?? 0,
    }),
  });

  store.useSyncedValue("closeDelay", () => local.closeDelay ?? 0);

  const rootDisabled = () => (store.select("disabled") as boolean) ?? false;
  const parentDisabled = () => (parentMenuStore.select("disabled") as boolean) ?? false;
  const disabled = () => local.disabled || rootDisabled() || parentDisabled();

  const open = () => (store.select("open") as boolean) ?? false;
  const openOnHover = () => local.openOnHover ?? true;

  const parentItemProps = () => parentMenuStore.select("itemProps") as Record<string, unknown>;
  const highlighted = () => (parentMenuStore.select("isActive", listItem.index()) as boolean) ?? false;

  const { getItemProps, getButtonProps, itemRef, buttonRef } = useMenuItem({
    chainFloatItemProps: false,
    closeOnClick: () => false,
    disabled,
    highlighted,
    id: thisTriggerId,
    store: store as MenuStore<any>,
    nativeButton: () => local.nativeButton,
    itemMetadata: {
      type: "submenu-trigger",
      setActive(event: MouseEvent) {
        if (parentMenuStore.peek("highlightItemOnHover")) {
          parentMenuStore.setActiveIndex(listItem.index(), REASONS.pointer, event);
        }
      },
    },
  });

  // Written from the setup child's body, so owned writes are intentional.
  const [clickProps, setClickProps] = createSignal<ClickReferenceProps | undefined>(undefined, { ownedWrite: true });
  const [hoverProps, setHoverProps] = createSignal<HoverReferenceProps | undefined>(undefined, { ownedWrite: true });

  const setupInteractions = (liveStore: MenuStore<any>) => (
    <MenuSubmenuTriggerInteractions
      store={liveStore}
      parentMenuStore={parentMenuStore}
      triggerElementRef={triggerElementRef}
      disabled={untrack(disabled)}
      openOnHover={untrack(openOnHover)}
      delay={untrack(() => local.delay)}
      closeDelay={untrack(() => local.closeDelay)}
      onInteractions={(click, hover) => {
        setClickProps(click);
        setHoverProps(hover);
      }}
    />
  );

  const popupId = () => store.select("triggerPopupId", thisTriggerId) as string | undefined;

  const openMethod = () => store.select("openMethod") as string | null;
  const lastOpenChangeReason = () => store.select("lastOpenChangeReason") as string | null;
  // Arrow keys open the submenu through list navigation without dispatching a click, so
  // `openMethod` stays null there; Enter and Space do dispatch one and report `keyboard`.
  const openedByKeyboard = () => lastOpenChangeReason() === REASONS.listNavigation || openMethod() === "keyboard";
  const shouldOmitExpanded = () => open() && openedByKeyboard() && isVoiceOver();

  let focusReturnedThroughGuard = false;

  createEffect(
    () => ({ isOpen: open(), positioner: store.select("positionerElement") as HTMLElement | null }),
    ({ isOpen, positioner }) => {
      if (!isOpen || !positioner) {
        return undefined;
      }

      const handleGuardFocusOut = (event: FocusEvent) => {
        if (getTarget(event) === store.context.beforeContentFocusGuardRef.current) {
          focusReturnedThroughGuard = event.relatedTarget === triggerElementRef.current;
        }
      };

      // Observe focus leaving the guard inside its positioner. When the portal is in a shadow root,
      // the trigger's focus event can report the shadow host as `relatedTarget`, not the guard.
      positioner.addEventListener("focusout", handleGuardFocusOut, true);
      return () => {
        focusReturnedThroughGuard = false;
        positioner.removeEventListener("focusout", handleGuardFocusOut, true);
      };
    },
  );

  const state: MenuSubmenuTriggerState = {
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
    get open() {
      return open();
    },
  };

  function handleFocus(event: FocusEvent) {
    // Close when focus returns through the submenu's guard to its trigger. This also lets
    // screen reader users move past the trigger in the parent menu. Direct focus from a
    // submenu item, such as on hover, leaves the submenu open.
    if (store.peek("open") && focusReturnedThroughGuard) {
      focusReturnedThroughGuard = false;
      store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event));
    }
  }

  function handleBlur() {
    if (untrack(highlighted)) {
      parentMenuStore.setActiveIndex(null, REASONS.none);
    }
  }

  const localHandlers: Record<string, (event: any) => void> = {
    onFocus: handleFocus,
    onBlur: handleBlur,
  };

  function chainHandlers(key: string): ((event: any) => void) | undefined {
    const click = clickProps()?.[key as keyof ClickReferenceProps] as ((event: any) => void) | undefined;
    const hover = hoverProps()?.[key as keyof HoverReferenceProps] as ((event: any) => void) | undefined;
    const root = (store.select("triggerProps", true) ?? {}) as Record<string, unknown>;
    const rootHandler = root[key] as ((event: any) => void) | undefined;
    // One-shot read: the parent's item prop bag is created once by the parent root.
    const parentFloat = (parentMenuStore.peek("itemProps") as Record<string, unknown> | undefined) ?? {};
    const parentHandler = parentFloat[key] as ((event: any) => void) | undefined;
    const localHandler = localHandlers[key] as ((event: any) => void) | undefined;
    const user = (userHandlers as Record<string, unknown>)[key] as ((event: any) => void) | undefined;
    // Present when the submenu this trigger opens is filterable: routes cross-axis keys between
    // the parent list and the submenu.
    const submenuNavigationHandler = key === "onKeyDown" ? submenuRootContext?.onTriggerKeyDown : undefined;

    // Execution order mirrors upstream `mergeProps` (right-to-left).
    const handlers = [user, submenuNavigationHandler, localHandler, parentHandler, rootHandler, hover, click].filter(Boolean) as Array<
      (event: any) => void
    >;
    if (handlers.length === 0) {
      return undefined;
    }
    return (event: any) => {
      for (const handler of handlers) {
        handler(event);
      }
    };
  }

  const submenuTriggerProps = {
    "aria-haspopup": "menu" as const,
    get "aria-controls"() {
      return popupId();
    },
    get tabIndex() {
      return open() || highlighted() ? 0 : -1;
    },
    get onClick() {
      return chainHandlers("onClick");
    },
    get onMouseDown() {
      return chainHandlers("onMouseDown");
    },
    get onMouseUp() {
      return chainHandlers("onMouseUp");
    },
    get onPointerDown() {
      return chainHandlers("onPointerDown");
    },
    get onPointerEnter() {
      return chainHandlers("onPointerEnter");
    },
    get onMouseEnter() {
      return chainHandlers("onMouseEnter");
    },
    get onMouseMove() {
      return chainHandlers("onMouseMove");
    },
    get onMouseLeave() {
      return chainHandlers("onMouseLeave");
    },
    get onFocus() {
      return chainHandlers("onFocus");
    },
    get onBlur() {
      return chainHandlers("onBlur");
    },
    get onKeyDown() {
      return chainHandlers("onKeyDown");
    },
    get "aria-expanded"() {
      // Opening a submenu changes the trigger's expanded state while the trigger still holds
      // focus, and VoiceOver announces that state change instead of the submenu item that focus
      // moves to a moment later, so the first item is never announced. Dropping the state while
      // the submenu is open avoids the announcement without claiming the submenu is collapsed;
      // `aria-haspopup` still conveys that the item opens a submenu.
      if (shouldOmitExpanded()) {
        return undefined;
      }
      const expanded = (store.select("triggerProps", true) as Record<string, unknown>)?.["aria-expanded"] as boolean | undefined;
      return expanded ? "true" : "false";
    },
  };

  const ref = mergeRefs<HTMLElement | null>(
    buttonRef,
    itemRef,
    listItem.ref,
    filterItem.ref,
    setTriggerElement,
    (element: HTMLElement | null) => {
      triggerElementRef.current = element;
      if (element !== null) {
        store.set("activeTriggerElement", element);
      }
    },
  );

  return (
    <>
      {setupInteractions(store as MenuStore<any>)}
      <RenderElement
        as={as}
        state={state}
        enabled={filterItem.visible}
        props={[parentItemProps, submenuTriggerProps, filterItem.props ?? {}, elementProps, getItemProps, getButtonProps, { ref }]}
        stateAttributesMapping={{ ...menuItemStateMapping, ...menuSubmenuTriggerStateMapping }}
      />
    </>
  );
}

/**
 * Creates the submenu trigger's click/hover interactions against the submenu store.
 */
function MenuSubmenuTriggerInteractions(props: {
  store: MenuStore<any>;
  parentMenuStore: MenuStore<unknown>;
  triggerElementRef: { readonly current: Element | null };
  disabled: boolean;
  openOnHover: boolean;
  delay: number | undefined;
  closeDelay: number | undefined;
  onInteractions: (click: ClickReferenceProps | undefined, hover: HoverReferenceProps | undefined) => void;
}) {
  const { store: liveStore, parentMenuStore } = props;
  const floatingRootContext = untrack(() => liveStore.select("floatingRootContext"));
  const floatingContext = getRootFloatingContext(floatingRootContext);

  const hoverEnabled = untrack(() => liveStore.select("hoverEnabled")) as boolean;

  const hover = createHoverReferenceInteraction(floatingContext, {
    enabled: hoverEnabled && props.openOnHover && !props.disabled,
    handleClose: safePolygon({ blockPointerEvents: true }),
    mouseOnly: true,
    move: true,
    restMs: props.delay ?? 100,
    delay: { open: props.delay ?? 100, close: props.closeDelay ?? 0 },
    shouldOpen: (props.delay ?? 100) > 0 ? () => parentMenuStore.peek("allowMouseEnter") as boolean : undefined,
    triggerElementRef: props.triggerElementRef,
    isClosing: () => (liveStore.select("transitionStatus") as string | undefined) === "ending",
    // Chrome can drop the trigger's `mouseleave` during a fast pointer sweep,
    // leaving a stale submenu open — cancel from `mouseout` too.
    guardStaleOpen: true,
  });

  const click = createClick(floatingContext, {
    enabled: !props.disabled,
    event: "mousedown",
    // Without toggling, TalkBack users cannot close the submenu to reach the next parent menu
    // item: moving the virtual cursor outside does not close it, and moving forward again
    // re-enters the still-open submenu. Keep toggling enabled so activating its trigger closes it.
    // Toggling applies to touch and keyboard activation. In hover mode, mouse presses are
    // ignored and the first activation after hover-opening keeps the submenu open.
    toggle: true,
    ignoreMouse: props.openOnHover,
    stickIfOpen: props.openOnHover,
  }).reference();

  if (!isServer) {
    props.onInteractions(click, hover ?? undefined);
    onCleanup(() => {
      props.onInteractions(undefined, undefined);
    });
  }

  return null;
}

const defaultProps = Object.freeze({
  as: "div",
  nativeButton: false,
  openOnHover: true,
  delay: 100,
  closeDelay: 0,
  disabled: false,
} satisfies Partial<MenuSubmenuTrigger.Props>);

export interface MenuSubmenuTriggerState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
}

export interface MenuSubmenuTriggerOwnProps extends NonNativeButtonProps {
  /**
   * Overrides the text label to use when the item is matched during keyboard text navigation.
   */
  label?: string | undefined;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * How long to wait before the menu may be opened on hover. Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 100
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the menu that was opened on hover.
   * Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * Whether the menu should also open when the trigger is hovered.
   * @default true
   */
  openOnHover?: boolean | undefined;
}

export type MenuSubmenuTriggerProps<T extends ValidComponent = "div"> = MenuSubmenuTriggerOwnProps &
  RebaseUIComponentProps<T, MenuSubmenuTriggerState>;

export namespace MenuSubmenuTrigger {
  export type State = MenuSubmenuTriggerState;
  export type Props<T extends ValidComponent = "div"> = MenuSubmenuTriggerProps<T>;
  export type OwnProps = MenuSubmenuTriggerOwnProps;
}
