import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, store as createStore, untrack, type JSX } from "reze-js";

import { createButton } from "../../internals/create-button";
import { REASONS } from "../../internals/event-details";
import { safePolygon } from "../../internals/floating";
import { createClick, type ClickReferenceProps } from "../../internals/floating/interactions/createClick";
import { createHoverReferenceInteraction, type HoverReferenceProps } from "../../internals/floating/interactions/createHoverReferenceInteraction";
import { FocusGuard } from "../../internals/focus-guard/FocusGuard";
import { getRootFloatingContext, setupTrigger } from "../../internals/popups/popupStoreUtils";
import { createTriggerFocusGuards, type TriggerFocusGuards } from "../../internals/popups/popupTriggerFocusGuards";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import { usePopoverRootContext } from "../root/PopoverRootContext";
import type { PopoverHandle } from "../store/PopoverHandle";
import type { PopoverInteractionType, PopoverStore } from "../store/PopoverStore";
import { OPEN_DELAY } from "../utils/constants";

/**
 * A button that opens the popover.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverTrigger<Payload = unknown, T extends JSX.ElementType = "button">(props: PopoverTrigger.Props<Payload, T>) {
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
    "onPointerDown",
    "onMouseEnter",
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

  const parentContext = usePopoverRootContext(true);
  const handle = props.handle as PopoverHandle<Payload> | undefined;

  if (!parentContext && !handle) {
    throw new Error("Rebase UI: <Popover.Trigger> must be either used within a <Popover.Root> component or provided with a handle.");
  }

  const thisTriggerId = props.id ?? createUniqueId();

  // The store that owns this trigger: the closest root, or the root attached to the handle
  // for detached triggers. Undefined while a detached trigger waits for its root.
  const store = (): PopoverStore<any> | undefined => parentContext ?? handle?.attached ?? undefined;

  const elements = createStore({ triggerElement: null as Element | null });
  const triggerElement = () => elements.triggerElement;
  // Plain (non-reactive) ref object for interaction creators, which read it in unowned
  // scopes where tracked reads are unsupported. Synced from the store via the element ref callback.
  const triggerElementRef: { current: Element | null } = { current: null };

  const disabled = () => props.disabled ?? false;
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
  // the popup is mounted, but `PopoverPopup` reads them once when it mounts on
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

  const interactionProps = createStore({
    click: undefined as ClickReferenceProps | undefined,
    hover: undefined as HoverReferenceProps | undefined,
  });

  function setClickProps(click: ClickReferenceProps | undefined) {
    interactionProps.click = click;
  }

  function setHoverProps(hover: HoverReferenceProps | undefined) {
    interactionProps.hover = hover;
  }

  const isOpenedByThisTrigger = () => {
    const liveStore = store();
    return liveStore ? ((liveStore.select("isOpenedByTrigger", thisTriggerId) as boolean) ?? false) : false;
  };

  const isPressOpened = () => {
    const liveStore = store();
    return isOpenedByThisTrigger() && liveStore !== undefined && liveStore.peek("openChangeReason") === REASONS.triggerPress;
  };

  function getRootTriggerProps(): Record<string, unknown> {
    const liveStore = store();
    if (!liveStore) {
      return {};
    }
    return (liveStore.select("triggerProps", isMountedByThisTrigger()) ?? {}) as Record<string, unknown>;
  }

  // Records the interaction type that opened the popover. Runs before the click
  // interaction so it still observes the closed state for keyboard presses.
  function handleOpenMethod(event: MouseEvent | PointerEvent) {
    const liveStore = store();
    if (liveStore && !liveStore.peek("open")) {
      liveStore.set("openMethod", resolveInteractionType(event));
    }
  }

  const openMethodHandlers: Record<string, (event: any) => void> = {
    onClick: handleOpenMethod,
    onPointerDown: handleOpenMethod,
  };

  function chainHandlers(key: string): ((event: any) => void) | undefined {
    const click = interactionProps.click?.[key as keyof ClickReferenceProps] as ((event: any) => void) | undefined;
    const hover = interactionProps.hover?.[key as keyof HoverReferenceProps] as ((event: any) => void) | undefined;
    const root = getRootTriggerProps()[key] as ((event: any) => void) | undefined;
    const openMethod = openMethodHandlers[key] as ((event: any) => void) | undefined;
    const user = (props as unknown as Record<string, unknown>)[key] as ((event: any) => void) | undefined;

    const handlers = [openMethod, click, hover, root, user].filter(Boolean) as Array<(event: any) => void>;
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
      return props.disabled;
    },
    get focusableWhenDisabled() {
      return undefined;
    },
    get nativeButton() {
      return props.nativeButton;
    },
    get ref() {
      return props.ref;
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
    get onKeyUp() {
      return props.onKeyUp;
    },
    get onPointerDown() {
      return chainHandlers("onPointerDown");
    },
  });

  // Focus guards are created per store (the store identity is stable) so the guard
  // ref objects stay stable across renders.
  let guardsCache: { store: PopoverStore<any>; guards: TriggerFocusGuards } | undefined;
  // Called from `FocusGuard`'s body and ref callbacks — imperative scopes where a read
  // cannot subscribe. `showFocusGuards()` tracks the store and re-creates the guards.
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
    return liveStore !== undefined && isOpenedByThisTrigger() && !(liveStore.peek("focusManagerModal") as boolean);
  };

  function snapshot(): PopoverTriggerState {
    return {
      disabled: disabled(),
      open: isOpenedByThisTrigger(),
      pressed: isPressOpened(),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  function ref(element: HTMLElement | null) {
    elements.triggerElement = element;
    triggerElementRef.current = element;
    button.buttonRef(element);
  }

  // Interaction creators access context and read options once, so they run in the body of a
  // child component that mounts once a store is available (immediately for triggers inside a
  // root; on handle attach for detached triggers) instead of in an effect.
  function setupInteractions(liveStore: PopoverStore<any>) {
    return (
      <PopoverTriggerInteractions
        store={liveStore}
        triggerId={thisTriggerId}
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
  }

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would drop the trigger's focus, listeners,
  // and element identity every time the focus guards appear or disappear. The
  // default path renders a static `<button>` so open/close transitions patch it in
  // place; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
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
          aria-haspopup="dialog"
          aria-expanded={isOpenedByThisTrigger() ? "true" : "false"}
          aria-controls={triggerPopupId(store(), thisTriggerId)}
          onClick={button.onClick}
          onMouseDown={button.onMouseDown}
          onKeyDown={button.onKeyDown}
          onKeyUp={button.onKeyUp}
          onPointerDown={button.onPointerDown}
          onMouseEnter={chainHandlers("onMouseEnter")}
          onMouseLeave={chainHandlers("onMouseLeave")}
          onFocus={chainHandlers("onFocus")}
          onBlur={chainHandlers("onBlur")}
          data-base-ui-click-trigger={disabled() ? undefined : ""}
          data-popup-open={isOpenedByThisTrigger() ? "" : undefined}
          data-pressed={isPressOpened() ? "" : undefined}
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

  return (
    <>
      {(() => {
        const liveStore = store();
        return liveStore ? setupInteractions(liveStore) : null;
      })()}
      {showFocusGuards() && (
        <FocusGuard guardRef={untrack(store)?.context.beforeTriggerFocusGuardRef} onFocus={getGuards()?.handlePreFocusGuardFocus} />
      )}
      <Tag
        {...(rest as Record<string, unknown>)}
        type={button.type}
        role={button.role}
        bool:disabled={button.disabled}
        tabindex={button.tabIndex}
        aria-disabled={button.ariaDisabled}
        id={thisTriggerId}
        aria-haspopup="dialog"
        aria-expanded={isOpenedByThisTrigger() ? "true" : "false"}
        aria-controls={triggerPopupId(store(), thisTriggerId)}
        onClick={button.onClick}
        onMouseDown={button.onMouseDown}
        onKeyDown={button.onKeyDown}
        onKeyUp={button.onKeyUp}
        onPointerDown={button.onPointerDown}
        onMouseEnter={chainHandlers("onMouseEnter")}
        onMouseLeave={chainHandlers("onMouseLeave")}
        onFocus={chainHandlers("onFocus")}
        onBlur={chainHandlers("onBlur")}
        data-base-ui-click-trigger={disabled() ? undefined : ""}
        data-popup-open={isOpenedByThisTrigger() ? "" : undefined}
        data-pressed={isPressOpened() ? "" : undefined}
        data-disabled={disabled() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={ref}
      >
        {resolveChildrenValue(children, snapshot)}
      </Tag>
      {showFocusGuards() && (
        <FocusGuard guardRef={untrack(store)?.context.triggerFocusTargetRef} onFocus={getGuards()?.handleFocusTargetFocus} />
      )}
    </>
  );
}

function triggerPopupId(liveStore: PopoverStore<any> | undefined, thisTriggerId: string): string | undefined {
  return liveStore ? ((liveStore.select("triggerPopupId", thisTriggerId) as string | undefined) ?? undefined) : undefined;
}

function resolveInteractionType(event: MouseEvent | PointerEvent): PopoverInteractionType {
  if ("pointerType" in event && typeof (event as PointerEvent).pointerType === "string") {
    const pointerType = (event as PointerEvent).pointerType;
    if (pointerType === "touch") {
      return "touch";
    }
    if (pointerType === "pen") {
      return "pen";
    }
    return "mouse";
  }

  return (event as MouseEvent).detail === 0 ? "keyboard" : "mouse";
}

/**
 * Creates the trigger's click/hover interactions against the resolved store and reports the
 * resulting props back to the trigger. Mounted once a store is available so detached triggers
 * set up their interactions when their handle attaches.
 */
function PopoverTriggerInteractions(props: {
  store: PopoverStore<any>;
  triggerId: string;
  triggerElementRef: { readonly current: Element | null };
  disabled: boolean;
  openOnHover: boolean;
  delay: number | undefined;
  closeDelay: number | undefined;
  onInteractions: (click: ClickReferenceProps | undefined, hover: HoverReferenceProps | undefined) => void;
}) {
  const floatingContext = getRootFloatingContext(untrack(() => props.store.select("floatingRootContext")));

  const click = createClick(floatingContext, {
    stickIfOpen: () => (props.store.peek("stickIfOpen") as boolean) ?? true,
  }).reference();

  const isActiveTrigger = untrack(() => props.store.select("isTriggerActive", props.triggerId)) as boolean;

  const hover = props.openOnHover
    ? createHoverReferenceInteraction(floatingContext, {
        enabled: !props.disabled,
        mouseOnly: true,
        move: false,
        handleClose: safePolygon(),
        // `delay` is an enter delay: hovering the trigger opens the popover
        // once it elapses, without requiring further mouse movement. It must
        // not be passed as `restMs`, which only starts its timer on mousemove
        // and leaves a plain hover (enter + wait) unable to ever open.
        delay: { open: props.delay ?? OPEN_DELAY, close: props.closeDelay ?? 0 },
        triggerElementRef: props.triggerElementRef,
        isActiveTrigger,
        isClosing: () => (props.store.select("transitionStatus") as string | undefined) === "ending",
        shouldOpen: () => {
          // A touch-opened popover stays owned by the touch interaction until it closes.
          const openMethod = props.store.peek("openMethod");
          const openReason = props.store.peek("openChangeReason");
          return openMethod !== "touch" || openReason !== REASONS.triggerPress;
        },
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

export interface PopoverTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the popover is currently open and was opened by this trigger.
   */
  open: boolean;
  /**
   * Whether the popover was opened by pressing this trigger.
   */
  pressed: boolean;
}

export interface PopoverTriggerEventHandlers {
  onMouseEnter?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onMouseLeave?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onFocus?: ((event: RebaseUIEvent<FocusEvent>) => void) | undefined;
  onBlur?: ((event: RebaseUIEvent<FocusEvent>) => void) | undefined;
}

export interface PopoverTriggerOwnProps<Payload = unknown> extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `as` prop.
   * Set to `false` if the rendered element is not a button (e.g. `<div>`).
   * @default true
   */
  nativeButton?: boolean | undefined;
  /**
   * A handle to associate the trigger with a popover.
   */
  handle?: PopoverHandle<Payload> | undefined;
  /**
   * A payload to pass to the popover when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for the popover in controlled mode (with the PopoverRoot `triggerId` prop).
   */
  id?: string | undefined;
  /**
   * Whether the popover should also open when the trigger is hovered.
   * @default false
   */
  openOnHover?: boolean | undefined;
  /**
   * How long to wait before the popover may be opened on hover. Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 300
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the popover that was opened on hover.
   * Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 0
   */
  closeDelay?: number | undefined;
}

export type PopoverTriggerProps<Payload = unknown, T extends JSX.ElementType = "button"> = PopoverTriggerOwnProps<Payload> &
  PopoverTriggerEventHandlers &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, PopoverTriggerState>;

export namespace PopoverTrigger {
  export type State = PopoverTriggerState;
  export type Props<Payload = unknown, T extends JSX.ElementType = "button"> = PopoverTriggerProps<Payload, T>;
  export type OwnProps<Payload = unknown> = PopoverTriggerOwnProps<Payload>;
}
