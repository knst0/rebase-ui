import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, store as createStore, untrack, type JSX } from "reze-js";

import { createButton } from "../../internals/create-button";
import { REASONS } from "../../internals/event-details";
import { safePolygon } from "../../internals/floating";
import { createClick, type ClickReferenceProps } from "../../internals/floating/interactions/createClick";
import { Timeout } from "../../internals/floating/interactions/createHoverInteractionSharedState";
import {
  createHoverReferenceInteraction,
  type HoverReferenceProps,
} from "../../internals/floating/interactions/createHoverReferenceInteraction";
import type { FloatingTreeStore } from "../../internals/floating/tree/FloatingTreeStore";
import { contains } from "../../internals/floating/utils/element";
import { FocusGuard } from "../../internals/focus-guard/FocusGuard";
import { getRootFloatingContext, setupTrigger } from "../../internals/popups/popupStoreUtils";
import { createTriggerFocusGuards, type TriggerFocusGuards } from "../../internals/popups/popupTriggerFocusGuards";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import { useMenuRootContext } from "../root/MenuRootContext";
import type { MenuHandle } from "../store/MenuHandle";
import type { MenuStore } from "../store/MenuStore";
import { findRootOwnerId } from "../utils/findRootOwnerId";

const MENU_TRIGGER_IDENTIFIER = "data-base-ui-click-trigger";
const PATIENT_CLICK_THRESHOLD = 500;

/**
 * A button that opens the menu.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuTrigger<Payload = unknown, T extends JSX.ElementType = "button">(props: MenuTrigger.Props<Payload, T>) {
  const rest = omitProps(
    props,
    "as",
    "disabled",
    "nativeButton",
    "handle",
    "payload",
    "id",
    "openOnHover",
    "delay",
    "closeDelay",
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

  const rootContext = useMenuRootContext(true);
  const handle = props.handle as MenuHandle<Payload> | undefined;

  if (!rootContext && !handle) {
    throw new Error("Rebase UI: <Menu.Trigger> must be either used within a <Menu.Root> component or provided with a handle.");
  }

  const thisTriggerId = props.id ?? createUniqueId();

  // The store that owns this trigger: the closest root, or the root attached to the handle
  // for detached triggers. Undefined while a detached trigger waits for its root.
  const store = (): MenuStore<Payload> | undefined =>
    (rootContext?.store ?? handle?.attached ?? undefined) as MenuStore<Payload> | undefined;

  const elements = createStore({ triggerElement: null as Element | null });
  const triggerElement = () => elements.triggerElement;
  // Plain (non-reactive) ref object for interaction creators, which read it in unowned
  // scopes where tracked reads are unsupported. Synced from the store via the element ref callback.
  const triggerElementRef: { current: Element | null } = { current: null };

  const rootDisabled = () => (store()?.select("disabled") as boolean | undefined) ?? false;
  const disabled = () => props.disabled === true || rootDisabled();
  const openOnHover = () => props.openOnHover ?? false;

  const { isMountedByTrigger: isMountedByThisTrigger } = setupTrigger({
    triggerId: thisTriggerId,
    triggerElement,
    store,
    stateUpdates: () => ({
      payload: props.payload as Payload | undefined,
      disabled: disabled(),
      openOnHover: openOnHover(),
      closeDelay: props.closeDelay ?? 0,
    }),
  });

  // Registers into the handle's pending map while no root is attached so imperative
  // `handle.open(id)` resolves the trigger. Migrates to the live store once it attaches.
  // Created only for detached triggers with a handle: without one the body would bail
  // out unconditionally, so mounting skips the effect and its subscriptions entirely.
  if (handle) {
    effect(() => {
      const element = triggerElement();
      const liveStore = store();
      let cleanup: (() => void) | undefined;
      // One-shot registration: the values only steer this write.
      untrack(() => {
        if (element === null || liveStore !== undefined) {
          return;
        }
        cleanup = handle.registerPendingTrigger(thisTriggerId, element);
      });
      if (cleanup) {
        onCleanup(cleanup);
      }
    });
  }

  // Syncs the hover config to the store eagerly (while closed), not only once
  // the popup is mounted. `setupTrigger` above applies these fields only while
  // the popup is mounted, but `MenuPopup` reads them once when it mounts on
  // open — without this, the popup's hover interaction would observe the
  // initial `false`/`0` on first open and mis-handle trigger-to-popup hover.
  // The hover config is subscribed only once the write path is reachable (a store
  // is present, the element mounted, and no other trigger owns the popup), so a
  // closed or shadowed trigger mounts without tracking prop changes it would discard.
  effect(() => {
    const liveStore = store();
    const element = triggerElement();
    if (!liveStore || element === null) {
      return;
    }
    const activeTriggerId = liveStore.peek("activeTriggerId") as string | null;
    if (activeTriggerId !== null && activeTriggerId !== thisTriggerId) {
      return;
    }
    const nextOpenOnHover = openOnHover();
    const nextCloseDelay = props.closeDelay ?? 0;
    // One-shot sync write: the values only steer this write.
    untrack(() => {
      liveStore.set("openOnHover", nextOpenOnHover);
      liveStore.set("closeDelay", nextCloseDelay);
    });
  });

  const interactionState = createStore({
    click: undefined as ClickReferenceProps | undefined,
    hover: undefined as HoverReferenceProps | undefined,
    // Whether to ignore clicks to open the menu after a hover-open ("patient" clicks only).
    stickIfOpen: false,
  });

  function setClickProps(click: ClickReferenceProps | undefined) {
    interactionState.click = click;
  }

  function setHoverProps(hover: HoverReferenceProps | undefined) {
    interactionState.hover = hover;
  }

  function setStickIfOpen(next: boolean) {
    if (interactionState.stickIfOpen !== next) {
      interactionState.stickIfOpen = next;
    }
  }

  const stickIfOpenTimeout = new Timeout();
  const allowMouseUpTriggerTimeout = new Timeout();
  onCleanup(() => {
    stickIfOpenTimeout.clear();
    allowMouseUpTriggerTimeout.clear();
  });

  // Interaction creators access context and read options once, so they run in the body of a
  // child component that mounts once a store is available (immediately for triggers inside a
  // root; on handle attach for detached triggers) instead of in an effect.
  function setupInteractions(liveStore: MenuStore<any>) {
    return (
      <MenuTriggerInteractions
        store={liveStore}
        triggerId={thisTriggerId}
        triggerElementRef={triggerElementRef}
        disabled={disabled()}
        openOnHover={openOnHover()}
        delay={props.delay}
        closeDelay={props.closeDelay}
        stickIfOpen={() => interactionState.stickIfOpen}
        onInteractions={(click, hover) => {
          setClickProps(click);
          setHoverProps(hover);
        }}
      />
    );
  }

  const isOpenedByThisTrigger = () => {
    const liveStore = store();
    return liveStore ? ((liveStore.select("isOpenedByTrigger", thisTriggerId) as boolean) ?? false) : false;
  };

  // Only allow "patient" clicks to close the menu if it was opened on hover.
  // If clicked within 500ms of the menu opening, keep it open.
  effect(() => {
    const opened = isOpenedByThisTrigger();
    const reason = store()?.select("lastOpenChangeReason") as string | null;
    // One-shot write: the values only steer this write.
    untrack(() => {
      if (opened && reason === REASONS.triggerHover) {
        setStickIfOpen(true);
        stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
          setStickIfOpen(false);
        });
      } else if (!opened) {
        stickIfOpenTimeout.clear();
        setStickIfOpen(false);
      }
    });
  });

  effect(() => {
    const opened = isOpenedByThisTrigger();
    const liveStore = store();
    // One-shot write: the values only steer this write.
    untrack(() => {
      if (!opened && liveStore) {
        liveStore.context.allowMouseUpTriggerRef.current = false;
      }
    });
  });

  function handleDocumentMouseUp(mouseEvent: MouseEvent) {
    const element = triggerElementRef.current;
    const liveStore = store();
    if (!element || !liveStore) {
      return;
    }

    allowMouseUpTriggerTimeout.clear();
    liveStore.context.allowMouseUpTriggerRef.current = false;

    const mouseUpTarget = mouseEvent.target as Element | null;

    if (contains(element, mouseUpTarget) || mouseUpTarget === element) {
      return;
    }

    if (contains(untrack(() => liveStore.peek("positionerElement")) as Element | null, mouseUpTarget)) {
      return;
    }

    if (mouseUpTarget != null && findRootOwnerId(mouseUpTarget) === untrack(() => liveStore.peek("rootId") as string | undefined)) {
      return;
    }

    if (isWithinBounds(mouseEvent, element)) {
      return;
    }

    (untrack(() => liveStore.peek("floatingTreeRoot")) as FloatingTreeStore).events.emit("close", {
      domEvent: mouseEvent,
      reason: REASONS.cancelOpen,
    });
  }

  effect(() => {
    const opened = isOpenedByThisTrigger();
    const reason = store()?.select("lastOpenChangeReason") as string | null;
    if (opened && reason === REASONS.triggerHover) {
      const doc = triggerElementRef.current?.ownerDocument ?? document;
      doc.addEventListener("mouseup", handleDocumentMouseUp, { once: true });
      return () => {
        doc.removeEventListener("mouseup", handleDocumentMouseUp);
      };
    }
    return undefined;
  });

  function getRootTriggerProps(): Record<string, unknown> {
    const liveStore = store();
    if (!liveStore) {
      return {};
    }
    return (liveStore.select("triggerProps", isMountedByThisTrigger()) ?? {}) as Record<string, unknown>;
  }

  function handleMouseDown(event: MouseEvent) {
    const liveStore = store();
    if (!liveStore || liveStore.peek("open")) {
      return;
    }

    // mousedown -> mouseup on menu item should not trigger it within 200ms.
    allowMouseUpTriggerTimeout.start(200, () => {
      liveStore.context.allowMouseUpTriggerRef.current = true;
    });

    const doc = (event.currentTarget as Element | null)?.ownerDocument ?? document;
    doc.addEventListener("mouseup", handleDocumentMouseUp, { once: true });
  }

  const localHandlers: Record<string, (event: any) => void> = {
    onMouseDown: handleMouseDown,
  };

  function chainHandlers(key: string): ((event: any) => void) | undefined {
    const click = interactionState.click?.[key as keyof ClickReferenceProps] as ((event: any) => void) | undefined;
    const hover = interactionState.hover?.[key as keyof HoverReferenceProps] as ((event: any) => void) | undefined;
    const root = getRootTriggerProps()[key] as ((event: any) => void) | undefined;
    const localHandler = localHandlers[key] as ((event: any) => void) | undefined;
    const user = (props as unknown as Record<string, unknown>)[key] as ((event: any) => void) | undefined;
    // Published by a filter root: dialog semantics, screen reader press tracking, and the relay
    // of list navigation typed on the trigger to the input.
    const filter = (store()?.select("filterTriggerProps") as Record<string, unknown> | undefined)?.[key] as
      | ((event: any) => void)
      | undefined;

    // Execution order mirrors upstream `mergeProps` (right-to-left): the user handler runs
    // first and the click interaction last, so the open-method recording in the root props
    // still observes the closed state and the press-drag-release arming observes it too.
    const handlers = [user, filter, localHandler, root, hover, click].filter(Boolean) as Array<(event: any) => void>;
    if (handlers.length === 0) {
      return undefined;
    }
    return (event: any) => {
      for (const handler of handlers) {
        handler(event);
      }
    };
  }

  const button = createButton({
    get disabled() {
      return disabled();
    },
    get nativeButton() {
      return props.nativeButton ?? true;
    },
    get onClick() {
      return chainHandlers("onClick");
    },
    get onMouseDown() {
      return chainHandlers("onMouseDown");
    },
    get onKeyDown() {
      return chainHandlers("onKeyDown");
    },
    get onPointerDown() {
      return chainHandlers("onPointerDown");
    },
    get onKeyUp() {
      return (props as unknown as Record<string, unknown>).onKeyUp as ((event: KeyboardEvent) => void) | undefined;
    },
    get ref() {
      return props.ref;
    },
  });

  // Focus guards are created per store (the store identity is stable) so the guard
  // ref objects stay stable across renders.
  let guardsCache: { store: MenuStore<any>; guards: TriggerFocusGuards } | undefined;
  // Called from `FocusGuard`'s body — an imperative scope where a read cannot
  // subscribe. `showFocusGuards()` tracks the store and re-creates the guards.
  function getGuards(): TriggerFocusGuards | undefined {
    const liveStore = untrack(store);
    if (!liveStore) {
      return undefined;
    }
    if (guardsCache?.store !== liveStore) {
      guardsCache = { store: liveStore, guards: createTriggerFocusGuards(liveStore, triggerElementRef) };
    }
    return guardsCache.guards;
  }

  const showFocusGuards = () => {
    const liveStore = store();
    return liveStore !== undefined && isOpenedByThisTrigger();
  };

  function snapshot(): MenuTriggerState {
    return {
      disabled: disabled(),
      open: isOpenedByThisTrigger(),
    };
  }

  function ref(element: HTMLElement | null) {
    elements.triggerElement = element;
    triggerElementRef.current = element;
    button.buttonRef(element);
  }

  function ariaHasPopup(): "menu" | "dialog" {
    return ((store()?.select("filterTriggerProps") as Record<string, unknown> | undefined)?.["aria-haspopup"] ?? "menu") as
      | "menu"
      | "dialog";
  }

  function ariaExpanded(): "true" | "false" {
    // The root publishes the expanded state on its trigger prop bag; detached triggers
    // without a root report the collapsed state.
    const expanded = getRootTriggerProps()["aria-expanded"] as boolean | undefined;
    return expanded ? "true" : "false";
  }

  function ariaControls(): string | undefined {
    const liveStore = store();
    // The list when one holds the `menu` role, else the popup.
    return liveStore ? ((liveStore.select("triggerControlsId", thisTriggerId) as string | undefined) ?? undefined) : undefined;
  }

  // The default path renders a static `<button>` so open/close transitions patch it in place;
  // only a customized `as` keeps the dynamic tag (shielded below). Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {(() => {
          const liveStore = store();
          return liveStore ? setupInteractions(liveStore) : null;
        })()}
        {showFocusGuards() && (
          <FocusGuard guardRef={untrack(store)?.context.beforeTriggerFocusGuardRef} onFocus={getGuards()?.handlePreFocusGuardFocus} />
        )}
        <button
          {...(rest as Record<string, unknown>)}
          type={button.type}
          role={button.role}
          bool:disabled={button.disabled}
          tabindex={button.tabIndex}
          aria-disabled={button.ariaDisabled}
          id={thisTriggerId}
          aria-haspopup={ariaHasPopup()}
          aria-expanded={ariaExpanded()}
          aria-controls={ariaControls()}
          onClick={button.onClick}
          onMouseDown={button.onMouseDown}
          onKeyDown={button.onKeyDown}
          onPointerDown={button.onPointerDown}
          onKeyUp={button.onKeyUp}
          onMouseUp={chainHandlers("onMouseUp")}
          onPointerEnter={chainHandlers("onPointerEnter")}
          onMouseEnter={chainHandlers("onMouseEnter")}
          onMouseMove={chainHandlers("onMouseMove")}
          onMouseLeave={chainHandlers("onMouseLeave")}
          onFocus={chainHandlers("onFocus")}
          onBlur={chainHandlers("onBlur")}
          data-base-ui-click-trigger={disabled() ? undefined : ""}
          data-popup-open={isOpenedByThisTrigger() ? "" : undefined}
          data-pressed={isOpenedByThisTrigger() ? "" : undefined}
          data-disabled={disabled() ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={ref}
        >
          {resolveChildrenValue(children, snapshot)}
        </button>
        {showFocusGuards() && (
          <FocusGuard guardRef={untrack(store)?.context.triggerFocusTargetRef} onFocus={getGuards()?.handleFocusTargetFocus} />
        )}
      </>
    );
  }

  // A customized `as` renders inside `MenuTriggerCustomTag`: a dynamic element re-creates its
  // DOM node whenever a sibling mounts or unmounts, which would drop the trigger's focus,
  // listeners, and element identity every time the focus guards appear or disappear. The
  // shield keeps the tag as the sole child of a stable component so guard toggles patch
  // around it instead of re-creating it. Keep the shield's props in sync with the static
  // branch above.
  return (
    <>
      {(() => {
        const liveStore = store();
        return liveStore ? setupInteractions(liveStore) : null;
      })()}
      <span style={{ display: "contents" }}>
        {showFocusGuards() && (
          <FocusGuard guardRef={untrack(store)?.context.beforeTriggerFocusGuardRef} onFocus={getGuards()?.handlePreFocusGuardFocus} />
        )}
      </span>
      <MenuTriggerCustomTag
        as={props.as}
        element={(Tag) => (
          <Tag
            {...(rest as Record<string, unknown>)}
            type={button.type}
            role={button.role}
            bool:disabled={button.disabled}
            tabindex={button.tabIndex}
            aria-disabled={button.ariaDisabled}
            id={thisTriggerId}
            aria-haspopup={ariaHasPopup()}
            aria-expanded={ariaExpanded()}
            aria-controls={ariaControls()}
            onClick={button.onClick}
            onMouseDown={button.onMouseDown}
            onKeyDown={button.onKeyDown}
            onPointerDown={button.onPointerDown}
            onKeyUp={button.onKeyUp}
            onMouseUp={chainHandlers("onMouseUp")}
            onPointerEnter={chainHandlers("onPointerEnter")}
            onMouseEnter={chainHandlers("onMouseEnter")}
            onMouseMove={chainHandlers("onMouseMove")}
            onMouseLeave={chainHandlers("onMouseLeave")}
            onFocus={chainHandlers("onFocus")}
            onBlur={chainHandlers("onBlur")}
            data-base-ui-click-trigger={disabled() ? undefined : ""}
            data-popup-open={isOpenedByThisTrigger() ? "" : undefined}
            data-pressed={isOpenedByThisTrigger() ? "" : undefined}
            data-disabled={disabled() ? "" : undefined}
            class={resolveClassValue(props.class, snapshot())}
            style={resolveStyleValue(props.style, snapshot())}
            ref={ref}
          >
            {resolveChildrenValue(children, snapshot)}
          </Tag>
        )}
      />
      <span style={{ display: "contents" }}>
        {showFocusGuards() && (
          <FocusGuard guardRef={untrack(store)?.context.triggerFocusTargetRef} onFocus={getGuards()?.handleFocusTargetFocus} />
        )}
      </span>
    </>
  );
}

/**
 * Renders a customized trigger tag as the sole child of a stable component. A dynamic
 * element re-creates its DOM node whenever a sibling mounts or unmounts; rendering it
 * directly in the trigger's fragment would drop the trigger's focus, listeners, and
 * element identity every time the focus guards appear or disappear.
 */
function MenuTriggerCustomTag(props: { as: JSX.ElementType; element: (Tag: (props: Record<string, any>) => JSX.Element) => JSX.Element }) {
  const Tag = dynamicElement<JSX.ElementType>(() => props.as);
  return props.element(Tag);
}

function isWithinBounds(event: MouseEvent, element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

/**
 * Creates the trigger's click/hover interactions against the resolved store and reports the
 * resulting props back to the trigger. Mounted once a store is available so detached triggers
 * set up their interactions when their handle attaches.
 */
function MenuTriggerInteractions(props: {
  store: MenuStore<any>;
  triggerId: string;
  triggerElementRef: { readonly current: Element | null };
  disabled: boolean;
  openOnHover: boolean;
  delay: number | undefined;
  closeDelay: number | undefined;
  stickIfOpen: () => boolean;
  onInteractions: (click: ClickReferenceProps | undefined, hover: HoverReferenceProps | undefined) => void;
}) {
  const floatingContext = getRootFloatingContext(untrack(() => props.store.select("floatingRootContext")));

  const click = createClick(floatingContext, {
    enabled: !props.disabled,
    event: "mousedown",
    toggle: true,
    ignoreMouse: false,
    stickIfOpen: () => props.stickIfOpen(),
  }).reference();

  const isActiveTrigger = untrack(() => props.store.select("isTriggerActive", props.triggerId)) as boolean;

  const hover = props.openOnHover
    ? createHoverReferenceInteraction(floatingContext, {
        enabled: !props.disabled,
        handleClose: safePolygon({ blockPointerEvents: true }),
        mouseOnly: true,
        move: false,
        restMs: props.delay ?? 100,
        delay: { close: props.closeDelay ?? 0 },
        triggerElementRef: props.triggerElementRef,
        isActiveTrigger,
        isClosing: () => (props.store.select("transitionStatus") as string | undefined) === "ending",
      })
    : undefined;

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

export interface MenuTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the menu is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface MenuTriggerEventHandlers {
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

export interface MenuTriggerOwnProps<Payload = unknown> extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `render` prop.
   * Set to `false` if the rendered element is not a button (e.g. `<div>`).
   * @default true
   */
  nativeButton?: boolean | undefined;
  /**
   * A handle to associate the trigger with a menu.
   */
  handle?: MenuHandle<Payload> | undefined;
  /**
   * A payload to pass to the menu when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for the menu in controlled mode (with the MenuRoot `triggerId` prop).
   */
  id?: string | undefined;
  /**
   * Whether the menu should also open when the trigger is hovered.
   * @default false
   */
  openOnHover?: boolean | undefined;
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
}

export type MenuTriggerProps<Payload = unknown, T extends JSX.ElementType = "button"> = MenuTriggerOwnProps<Payload> &
  MenuTriggerEventHandlers &
  RebaseUIComponentProps<T, MenuTriggerState>;

export namespace MenuTrigger {
  export type State = MenuTriggerState;
  export type Props<Payload = unknown, T extends JSX.ElementType = "button"> = MenuTriggerProps<Payload, T>;
  export type OwnProps<Payload = unknown> = MenuTriggerOwnProps<Payload>;
}
