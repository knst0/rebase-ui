import type { ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, createUniqueId, onCleanup, Show, untrack } from "solid-js";

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
import { mergeRefs } from "../../internals/mergeRefs";
import { getRootFloatingContext, setupTrigger } from "../../internals/popups/popupStoreUtils";
import { createTriggerFocusGuards, type TriggerFocusGuards } from "../../internals/popups/popupTriggerFocusGuards";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useMenuRootContext } from "../root/MenuRootContext";
import type { MenuHandle } from "../store/MenuHandle";
import type { MenuStore } from "../store/MenuStore";
import { findRootOwnerId } from "../utils/findRootOwnerId";
import { menuPressableTriggerStateMapping } from "../utils/stateAttributesMapping";

const MENU_TRIGGER_IDENTIFIER = "data-base-ui-click-trigger";
const PATIENT_CLICK_THRESHOLD = 500;

/**
 * A button that opens the menu.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuTrigger<Payload = unknown, T extends ValidComponent = "button">(props: MenuTrigger.Props<Payload, T>) {
  const [local, userHandlers, elementProps] = split(
    props as MenuTrigger.Props<Payload>,
    { default: defaultProps },
    ["as", "disabled", "nativeButton", "handle", "payload", "id", "openOnHover", "delay", "closeDelay"],
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
  const rootContext = useMenuRootContext(true);
  const handle = untrack(() => local.handle) as MenuHandle<Payload> | undefined;

  if (!rootContext && !handle) {
    throw new Error("Rebase UI: <Menu.Trigger> must be either used within a <Menu.Root> component or provided with a handle.");
  }

  const thisTriggerId = untrack(() => local.id) ?? createUniqueId();

  // The store that owns this trigger: the closest root, or the root attached to the handle
  // for detached triggers. Undefined while a detached trigger waits for its root.
  const store = () => (rootContext?.store ?? handle?.attached ?? undefined) as MenuStore<Payload> | undefined;

  const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);
  // Plain (non-reactive) ref object for interaction creators, which read it in unowned
  // scopes where signal reads warn. Synced from the signal via the element ref callback.
  const triggerElementRef: { current: Element | null } = { current: null };

  const rootDisabled = () => (store()?.select("disabled") as boolean | undefined) ?? false;
  const disabled = () => local.disabled || rootDisabled();
  const openOnHover = () => local.openOnHover ?? false;

  const { isMountedByTrigger: isMountedByThisTrigger } = setupTrigger({
    triggerId: thisTriggerId,
    triggerElement,
    store,
    stateUpdates: () => ({
      payload: local.payload as Payload | undefined,
      disabled: disabled(),
      openOnHover: openOnHover(),
      closeDelay: local.closeDelay ?? 0,
    }),
  });

  // Registers into the handle's pending map while no root is attached so imperative
  // `handle.open(id)` resolves the trigger. Migrates to the live store once it attaches.
  // Created only for detached triggers with a handle: without one the body would bail
  // out unconditionally, so mounting skips the effect and its subscriptions entirely.
  if (handle) {
    createEffect(
      () => ({ element: triggerElement(), liveStore: store() }),
      ({ element, liveStore }) => {
        if (element === null || liveStore !== undefined) {
          return undefined;
        }
        return handle.registerPendingTrigger(thisTriggerId, element);
      },
    );
  }

  // Syncs the hover config to the store eagerly (while closed), not only once
  // the popup is mounted. `setupTrigger` above applies these fields only while
  // the popup is mounted, but `MenuPopup` reads them once when it mounts on
  // open — without this, the popup's hover interaction would observe the
  // initial `false`/`0` on first open and mis-handle trigger-to-popup hover.
  // The hover config is subscribed only once the write path is reachable (a store
  // is present, the element mounted, and no other trigger owns the popup), so a
  // closed or shadowed trigger mounts without tracking prop changes it would discard.
  createEffect(
    () => {
      const liveStore = store();
      const element = triggerElement();
      if (!liveStore || element === null) {
        return undefined;
      }
      const activeTriggerId = liveStore.peek("activeTriggerId") as string | null;
      if (activeTriggerId !== null && activeTriggerId !== thisTriggerId) {
        return undefined;
      }
      return { liveStore, hover: openOnHover(), closeDelay: local.closeDelay ?? 0 };
    },
    (data) => {
      if (!data) {
        return undefined;
      }
      data.liveStore.set("openOnHover", data.hover);
      data.liveStore.set("closeDelay", data.closeDelay);
      return undefined;
    },
  );

  // Written from the setup child's body, so owned writes are intentional.
  const [clickProps, setClickProps] = createSignal<ClickReferenceProps | undefined>(undefined, { ownedWrite: true });
  const [hoverProps, setHoverProps] = createSignal<HoverReferenceProps | undefined>(undefined, { ownedWrite: true });
  // Whether to ignore clicks to open the menu after a hover-open ("patient" clicks only).
  const [stickIfOpen, setStickIfOpen] = createSignal(false, { ownedWrite: true });

  const stickIfOpenTimeout = new Timeout();
  const allowMouseUpTriggerTimeout = new Timeout();
  onCleanup(() => {
    stickIfOpenTimeout.clear();
    allowMouseUpTriggerTimeout.clear();
  });

  // Interaction creators access context and read options once, so they run in the body of a
  // child component that mounts once a store is available (immediately for triggers inside a
  // root; on handle attach for detached triggers) instead of in an effect.
  const setupInteractions = (liveStore: MenuStore<any>) => (
    <MenuTriggerInteractions
      store={liveStore}
      triggerId={thisTriggerId}
      triggerElementRef={triggerElementRef}
      disabled={untrack(disabled)}
      openOnHover={untrack(openOnHover)}
      delay={untrack(() => local.delay)}
      closeDelay={untrack(() => local.closeDelay)}
      stickIfOpen={stickIfOpen}
      onInteractions={(click, hover) => {
        setClickProps(click);
        setHoverProps(hover);
      }}
    />
  );

  const isOpenedByThisTrigger = () => {
    const liveStore = store();
    return liveStore ? ((liveStore.select("isOpenedByTrigger", thisTriggerId) as boolean) ?? false) : false;
  };

  // Only allow "patient" clicks to close the menu if it was opened on hover.
  // If clicked within 500ms of the menu opening, keep it open.
  createEffect(
    () => ({
      opened: isOpenedByThisTrigger(),
      reason: store()?.select("lastOpenChangeReason") as string | null,
    }),
    ({ opened, reason }) => {
      if (opened && reason === REASONS.triggerHover) {
        setStickIfOpen(true);
        stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
          setStickIfOpen(false);
        });
      } else if (!opened) {
        stickIfOpenTimeout.clear();
        setStickIfOpen(false);
      }
      return undefined;
    },
  );

  createEffect(
    () => ({ opened: isOpenedByThisTrigger(), liveStore: store() }),
    ({ opened, liveStore }) => {
      if (!opened && liveStore) {
        liveStore.context.allowMouseUpTriggerRef.current = false;
      }
      return undefined;
    },
  );

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

  createEffect(
    () => ({
      opened: isOpenedByThisTrigger(),
      reason: store()?.select("lastOpenChangeReason") as string | null,
    }),
    ({ opened, reason }) => {
      if (opened && reason === REASONS.triggerHover) {
        const doc = triggerElementRef.current?.ownerDocument ?? document;
        doc.addEventListener("mouseup", handleDocumentMouseUp, { once: true });
        return () => {
          doc.removeEventListener("mouseup", handleDocumentMouseUp);
        };
      }
      return undefined;
    },
  );

  function getRootTriggerProps(): Record<string, unknown> {
    const liveStore = store();
    if (!liveStore) {
      return {};
    }
    return (liveStore.select("triggerProps", isMountedByThisTrigger()) ?? {}) as Record<string, unknown>;
  }

  const localHandlers: Record<string, (event: any) => void> = {
    onMouseDown: handleMouseDown,
  };

  function chainHandlers(key: string): ((event: any) => void) | undefined {
    const click = clickProps()?.[key as keyof ClickReferenceProps] as ((event: any) => void) | undefined;
    const hover = hoverProps()?.[key as keyof HoverReferenceProps] as ((event: any) => void) | undefined;
    const root = getRootTriggerProps()[key] as ((event: any) => void) | undefined;
    const localHandler = localHandlers[key] as ((event: any) => void) | undefined;
    const user = (userHandlers as Record<string, unknown>)[key] as ((event: any) => void) | undefined;

    // Execution order mirrors upstream `mergeProps` (right-to-left): the user handler runs
    // first and the click interaction last, so the open-method recording in the root props
    // still observes the closed state and the press-drag-release arming observes it too.
    const handlers = [user, localHandler, root, hover, click].filter(Boolean) as Array<(event: any) => void>;
    if (handlers.length === 0) {
      return undefined;
    }
    return (event: any) => {
      for (const handler of handlers) {
        handler(event);
      }
    };
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

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => local.nativeButton ?? true,
  });

  // Focus guards are created per store (the store identity is stable) so the guard
  // ref objects stay stable across renders. Resolved in the tracked setup expression below
  // and read as a plain variable by the guard props: plain-component prop expressions
  // evaluate outside a tracking scope, so they must not read signals (such as the handle's
  // attach state behind `store()`).
  let guardsCache: { store: MenuStore<any>; guards: TriggerFocusGuards } | undefined;
  let currentGuards: TriggerFocusGuards | undefined;
  function getGuardsFor(liveStore: MenuStore<any>): TriggerFocusGuards {
    if (guardsCache?.store !== liveStore) {
      guardsCache = { store: liveStore, guards: createTriggerFocusGuards(liveStore, triggerElementRef) };
    }
    return guardsCache.guards;
  }

  const showFocusGuards = () => {
    const liveStore = store();
    return liveStore !== undefined && isMountedByThisTrigger();
  };

  const state: MenuTriggerState = {
    get disabled() {
      return disabled();
    },
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  const triggerProps = {
    get id() {
      return thisTriggerId;
    },
    "aria-haspopup": "menu" as const,
    get "aria-expanded"() {
      // The root publishes the expanded state on its trigger prop bag; detached triggers
      // without a root report the collapsed state.
      const expanded = getRootTriggerProps()["aria-expanded"] as boolean | undefined;
      return expanded ? "true" : "false";
    },
    get "aria-controls"() {
      const liveStore = store();
      return liveStore ? ((liveStore.select("triggerPopupId", thisTriggerId) as string | undefined) ?? undefined) : undefined;
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
    get [MENU_TRIGGER_IDENTIFIER]() {
      return disabled() ? undefined : "";
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, buttonRef, setTriggerElement, (element: HTMLElement | null) => {
      triggerElementRef.current = element;
    }),
  });

  return (
    <>
      {(() => {
        const liveStore = store();
        currentGuards = liveStore ? getGuardsFor(liveStore) : undefined;
        return liveStore ? setupInteractions(liveStore) : null;
      })()}
      <Show when={showFocusGuards()}>
        <FocusGuard
          guardRef={currentGuards?.preFocusGuardRef as { current: HTMLSpanElement | null }}
          onFocus={currentGuards?.handlePreFocusGuardFocus}
        />
      </Show>
      <RenderElement
        as={as}
        state={state}
        props={[triggerProps, elementProps, refProps, getButtonProps]}
        stateAttributesMapping={menuPressableTriggerStateMapping}
      />
    </>
  );
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
  const { store: liveStore, triggerId } = props;
  const floatingRootContext = untrack(() => liveStore.select("floatingRootContext"));
  const floatingContext = getRootFloatingContext(floatingRootContext);

  const click = createClick(floatingContext, {
    enabled: !props.disabled,
    event: "mousedown",
    toggle: true,
    ignoreMouse: false,
    stickIfOpen: () => props.stickIfOpen(),
  }).reference();

  const isActiveTrigger = untrack(() => liveStore.select("isTriggerActive", triggerId)) as boolean;

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
        isClosing: () => (liveStore.select("transitionStatus") as string | undefined) === "ending",
      })
    : undefined;

  props.onInteractions(click, hover ?? undefined);
  onCleanup(() => {
    props.onInteractions(undefined, undefined);
  });

  return null;
}

const defaultProps = Object.freeze({
  as: "button",
  nativeButton: true,
  openOnHover: false,
  delay: 100,
  closeDelay: 0,
} satisfies Partial<MenuTrigger.Props>);

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

export type MenuTriggerProps<Payload = unknown, T extends ValidComponent = "button"> = MenuTriggerOwnProps<Payload> &
  RebaseUIComponentProps<T, MenuTriggerState>;

export namespace MenuTrigger {
  export type State = MenuTriggerState;
  export type Props<Payload = unknown, T extends ValidComponent = "button"> = MenuTriggerProps<Payload, T>;
  export type OwnProps<Payload = unknown> = MenuTriggerOwnProps<Payload>;
}
