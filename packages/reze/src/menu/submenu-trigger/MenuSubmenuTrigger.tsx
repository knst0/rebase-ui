import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, store as createStore, untrack, type JSX } from "reze-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { safePolygon } from "../../internals/floating";
import { createClick, type ClickReferenceProps } from "../../internals/floating/interactions/createClick";
import {
  createHoverReferenceInteraction,
  type HoverReferenceProps,
} from "../../internals/floating/interactions/createHoverReferenceInteraction";
import { getTarget } from "../../internals/floating/utils/element";
import { getRootFloatingContext, setupTrigger } from "../../internals/popups/popupStoreUtils";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import { useMenuFilterItem } from "../filter-root/MenuFilterContext";
import { useMenuItem, useMenuListItem, type MenuHTMLProps } from "../item/useMenuItem";
import { useMenuRootContext } from "../root/MenuRootContext";
import type { MenuStore } from "../store/MenuStore";
import { useMenuSubmenuRootContext } from "../submenu-root/MenuSubmenuRootContext";

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
export function MenuSubmenuTrigger<T extends JSX.ElementType = "div">(props: MenuSubmenuTrigger.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "label",
    "id",
    "nativeButton",
    "openOnHover",
    "delay",
    "closeDelay",
    "disabled",
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
    "onKeyUp",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const submenuRootContext = useMenuSubmenuRootContext();
  if (!submenuRootContext?.parentMenu) {
    throw new Error("Rebase UI: <Menu.SubmenuTrigger> must be placed in <Menu.SubmenuRoot>.");
  }
  const parentMenuStore = submenuRootContext.parentMenu as MenuStore<unknown>;

  const filterItem = useMenuFilterItem({ label: props.label }, "submenu-trigger");
  const listItem = useMenuListItem(() => props.label, { enabled: filterItem.visible });

  const { store } = useMenuRootContext();

  const thisTriggerId = props.id ?? createUniqueId();

  const elements = createStore({ triggerElement: null as Element | null });
  const triggerElement = () => elements.triggerElement;
  const triggerElementRef: { current: Element | null } = { current: null };

  setupTrigger({
    triggerId: thisTriggerId,
    triggerElement,
    store: () => store as MenuStore<unknown>,
    stateUpdates: () => ({
      closeDelay: props.closeDelay ?? 0,
    }),
  });

  store.useSyncedValue("closeDelay", () => props.closeDelay ?? 0);

  const rootDisabled = () => (store.select("disabled") as boolean) ?? false;
  const parentDisabled = () => (parentMenuStore.select("disabled") as boolean) ?? false;
  const disabled = () => props.disabled === true || rootDisabled() || parentDisabled();

  const open = () => (store.select("open") as boolean) ?? false;
  const openOnHover = () => props.openOnHover ?? true;

  const parentItemProps = () => parentMenuStore.select("itemProps") as Record<string, unknown>;
  const highlighted = () => (parentMenuStore.select("isActive", listItem.index()) as boolean) ?? false;

  // Live view of the consumer handlers omitted from the spread above.
  const userHandlers = props as unknown as MenuHTMLProps;

  const interactionState = createStore({
    click: undefined as ClickReferenceProps | undefined,
    hover: undefined as HoverReferenceProps | undefined,
  });

  function setClickProps(click: ClickReferenceProps | undefined) {
    interactionState.click = click;
  }

  function setHoverProps(hover: HoverReferenceProps | undefined) {
    interactionState.hover = hover;
  }

  let focusReturnedThroughGuard = false;

  effect(() => {
    const isOpen = open();
    const positioner = store.select("positionerElement") as HTMLElement | null;
    if (!isOpen || !positioner) {
      return undefined;
    }

    function handleGuardFocusOut(event: FocusEvent) {
      if (getTarget(event) === store.context.beforeContentFocusGuardRef.current) {
        focusReturnedThroughGuard = event.relatedTarget === triggerElementRef.current;
      }
    }

    // Observe focus leaving the guard inside its positioner. When the portal is in a shadow root,
    // the trigger's focus event can report the shadow host as `relatedTarget`, not the guard.
    positioner.addEventListener("focusout", handleGuardFocusOut, true);
    return () => {
      focusReturnedThroughGuard = false;
      positioner.removeEventListener("focusout", handleGuardFocusOut, true);
    };
  });

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
    const click = interactionState.click?.[key as keyof ClickReferenceProps] as ((event: any) => void) | undefined;
    const hover = interactionState.hover?.[key as keyof HoverReferenceProps] as ((event: any) => void) | undefined;
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

  // The chained layer below the item, mirroring the `submenuTriggerProps` static layer: the
  // consumer handlers already run first inside it, so only `onKeyUp` (which the chain does
  // not cover) reads the consumer layer directly.
  function chainedLayer(): MenuHTMLProps {
    return {
      onClick: chainHandlers("onClick"),
      onMouseDown: chainHandlers("onMouseDown"),
      onMouseUp: chainHandlers("onMouseUp"),
      onPointerDown: chainHandlers("onPointerDown"),
      onPointerEnter: chainHandlers("onPointerEnter"),
      onMouseEnter: chainHandlers("onMouseEnter"),
      onMouseMove: chainHandlers("onMouseMove"),
      onMouseLeave: chainHandlers("onMouseLeave"),
      onFocus: chainHandlers("onFocus"),
      onBlur: chainHandlers("onBlur"),
      onKeyDown: chainHandlers("onKeyDown"),
      onKeyUp: userHandlers.onKeyUp,
    };
  }

  const item = useMenuItem({
    chainFloatItemProps: false,
    closeOnClick: () => false,
    disabled,
    highlighted,
    id: thisTriggerId,
    store: store as MenuStore<any>,
    nativeButton: () => props.nativeButton ?? false,
    itemMetadata: {
      type: "submenu-trigger",
      setActive(event: MouseEvent) {
        if (parentMenuStore.peek("highlightItemOnHover")) {
          parentMenuStore.setActiveIndex(listItem.index(), REASONS.pointer, event);
        }
      },
    },
    layers: [parentItemProps, chainedLayer, () => filterItem.props],
  });

  const popupId = () => store.select("triggerPopupId", thisTriggerId) as string | undefined;

  const openMethod = () => store.select("openMethod") as string | null;
  const lastOpenChangeReason = () => store.select("lastOpenChangeReason") as string | null;
  // Arrow keys open the submenu through list navigation without dispatching a click, so
  // `openMethod` stays null there; Enter and Space do dispatch one and report `keyboard`.
  const openedByKeyboard = () => lastOpenChangeReason() === REASONS.listNavigation || openMethod() === "keyboard";
  const shouldOmitExpanded = () => open() && openedByKeyboard() && isVoiceOver();

  function snapshot(): MenuSubmenuTriggerState {
    return {
      disabled: disabled(),
      highlighted: highlighted(),
      open: open(),
    };
  }

  function ariaExpanded(): "true" | "false" | undefined {
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
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // Native Escape containment: reze delegates `keydown` to the document, so the
  // delegated dismiss handler runs too late to stop the parent menu's native
  // document listener (same node — `stopPropagation` cannot block it). A native
  // listener restores Solid's per-element ordering: Escape closes only this
  // submenu and never reaches the parent, unless `closeParentOnEsc` allows it
  // to bubble. Non-Escape keys and the closed state fall through untouched so
  // the delegated chain (list navigation, parent dismissal) behaves as usual.
  function handleNativeKeyDown(event: Event) {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== "Escape") {
      return;
    }
    if (!store.peek("open")) {
      return;
    }
    const triggerProps = store.peek("triggerProps", true) as Record<string, unknown> | undefined;
    (triggerProps?.["onKeyDown"] as ((event: KeyboardEvent) => void) | undefined)?.(keyEvent);
  }

  function buttonRef(element: HTMLElement | null) {
    const previous = triggerElementRef.current;
    if (previous !== null && previous !== element) {
      previous.removeEventListener("keydown", handleNativeKeyDown);
    }
    item.button.buttonRef(element);
    item.itemRef(element);
    listItem.ref(element);
    filterItem.ref?.(element);
    elements.triggerElement = element;
    triggerElementRef.current = element;
    if (element !== null) {
      element.addEventListener("keydown", handleNativeKeyDown);
      store.set("activeTriggerElement", element);
    }
    (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);
  }

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would drop the trigger's registry entry,
  // highlight, and element identity. The default path renders a static `<div>` so
  // filter updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  // The interactions setup renders only once the trigger element exists: reze
  // flushes a component's setup effects before conditionally-rendered siblings
  // materialize (unlike Solid's whole-tree batch), and the hover setup attaches
  // its native listeners to `triggerElementRef.current`, which the trigger's ref
  // populates. Mounting the setup first would read a null ref and never attach
  // (the setup only re-runs when `open`/`domReference` change, and the trigger
  // selector stays masked while unmounted), leaving hover permanently broken.
  // Gating on the reactive element also re-runs the setup when filtering swaps
  // the trigger in or out.
  const interactions = () =>
    elements.triggerElement !== null && (
      <MenuSubmenuTriggerInteractions
        store={store as MenuStore<any>}
        parentMenuStore={parentMenuStore}
        triggerElementRef={triggerElementRef}
        disabled={disabled()}
        openOnHover={openOnHover()}
        delay={props.delay}
        closeDelay={props.closeDelay}
        onInteractions={(click, hover) => {
          setClickProps(click);
          setHoverProps(hover);
        }}
      />
    );
  if (props.as == null) {
    return (
      <>
        {filterItem.visible() && (
          <div
            {...(rest as Record<string, unknown>)}
            id={thisTriggerId}
            role="menuitem"
            {...(item.button.type ? { type: item.button.type } : {})}
            bool:disabled={item.button.disabled}
            tabindex={open() || highlighted() ? 0 : -1}
            aria-disabled={item.button.ariaDisabled}
            aria-haspopup={(filterItem.props?.["aria-haspopup"] as "menu" | "dialog" | undefined) ?? "menu"}
            aria-controls={popupId()}
            aria-expanded={ariaExpanded()}
            aria-selected={item.ariaSelected() ? "true" : undefined}
            onClick={item.button.onClick}
            onMouseDown={item.button.onMouseDown}
            onKeyDown={item.button.onKeyDown}
            onKeyUp={item.button.onKeyUp}
            onPointerDown={item.button.onPointerDown}
            onMouseMove={item.onMouseMove}
            onMouseUp={item.onMouseUp}
            onMouseEnter={item.onMouseEnter}
            onMouseLeave={chainHandlers("onMouseLeave")}
            onPointerEnter={chainHandlers("onPointerEnter")}
            onPointerLeave={item.onPointerLeave}
            onFocus={item.onFocus}
            onBlur={chainHandlers("onBlur")}
            data-disabled={disabled() ? "" : undefined}
            data-highlighted={highlighted() ? "" : undefined}
            data-popup-open={open() ? "" : undefined}
            class={resolveClassValue(props.class, snapshot())}
            style={resolveStyleValue(props.style, snapshot())}
            ref={buttonRef}
          >
            {resolveChildrenValue(children, snapshot)}
          </div>
        )}
        {interactions()}
      </>
    );
  }

  return (
    <>
      {filterItem.visible() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          id={thisTriggerId}
          role="menuitem"
          type={item.button.type}
          bool:disabled={item.button.disabled}
          tabindex={open() || highlighted() ? 0 : -1}
          aria-disabled={item.button.ariaDisabled}
          aria-haspopup={(filterItem.props?.["aria-haspopup"] as "menu" | "dialog" | undefined) ?? "menu"}
          aria-controls={popupId()}
          aria-expanded={ariaExpanded()}
          aria-selected={item.ariaSelected() ? "true" : undefined}
          onClick={item.button.onClick}
          onMouseDown={item.button.onMouseDown}
          onKeyDown={item.button.onKeyDown}
          onKeyUp={item.button.onKeyUp}
          onPointerDown={item.button.onPointerDown}
          onMouseMove={item.onMouseMove}
          onMouseUp={item.onMouseUp}
          onMouseEnter={item.onMouseEnter}
          onMouseLeave={chainHandlers("onMouseLeave")}
          onPointerEnter={chainHandlers("onPointerEnter")}
          onPointerLeave={item.onPointerLeave}
          onFocus={item.onFocus}
          onBlur={chainHandlers("onBlur")}
          data-disabled={disabled() ? "" : undefined}
          data-highlighted={highlighted() ? "" : undefined}
          data-popup-open={open() ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={buttonRef}
        >
          {resolveChildrenValue(children, snapshot)}
        </Tag>
      )}
      {interactions()}
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
  const floatingContext = getRootFloatingContext(untrack(() => props.store.select("floatingRootContext")));

  const hoverEnabled = untrack(() => props.store.select("hoverEnabled")) as boolean;

  const hover = createHoverReferenceInteraction(floatingContext, {
    enabled: hoverEnabled && props.openOnHover && !props.disabled,
    handleClose: safePolygon({ blockPointerEvents: true }),
    mouseOnly: true,
    move: true,
    restMs: props.delay ?? 100,
    delay: { open: props.delay ?? 100, close: props.closeDelay ?? 0 },
    shouldOpen: (props.delay ?? 100) > 0 ? () => props.parentMenuStore.peek("allowMouseEnter") as boolean : undefined,
    triggerElementRef: props.triggerElementRef,
    isClosing: () => (props.store.select("transitionStatus") as string | undefined) === "ending",
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

  effect(() => {
    const onInteractions = props.onInteractions;
    // One-shot report: the interaction props only steer this write.
    untrack(() => {
      onInteractions(click, hover ?? undefined);
    });
    onCleanup(() => {
      untrack(() => {
        onInteractions(undefined, undefined);
      });
    });
  });

  return null;
}

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

export interface MenuSubmenuTriggerEventHandlers {
  onClick?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onMouseDown?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onMouseUp?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onPointerDown?: ((event: RebaseUIEvent<PointerEvent>) => void) | undefined;
  onPointerEnter?: ((event: RebaseUIEvent<PointerEvent>) => void) | undefined;
  onMouseEnter?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onMouseMove?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onMouseLeave?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onFocus?: ((event: RebaseUIEvent<FocusEvent>) => void) | undefined;
  onBlur?: ((event: RebaseUIEvent<FocusEvent>) => void) | undefined;
  onKeyDown?: ((event: RebaseUIEvent<KeyboardEvent>) => void) | undefined;
  onKeyUp?: ((event: RebaseUIEvent<KeyboardEvent>) => void) | undefined;
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

export type MenuSubmenuTriggerProps<T extends JSX.ElementType = "div"> = MenuSubmenuTriggerOwnProps &
  MenuSubmenuTriggerEventHandlers &
  RebaseUIComponentProps<T, MenuSubmenuTriggerState>;

export namespace MenuSubmenuTrigger {
  export type State = MenuSubmenuTriggerState;
  export type Props<T extends JSX.ElementType = "div"> = MenuSubmenuTriggerProps<T>;
  export type OwnProps = MenuSubmenuTriggerOwnProps;
}
