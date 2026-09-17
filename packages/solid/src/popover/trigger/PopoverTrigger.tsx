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
import { FocusGuard } from "../../internals/focus-guard/FocusGuard";
import { mergeRefs } from "../../internals/mergeRefs";
import { getRootFloatingContext, setupTrigger } from "../../internals/popups/popupStoreUtils";
import { createTriggerFocusGuards, type TriggerFocusGuards } from "../../internals/popups/popupTriggerFocusGuards";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { usePopoverRootContext } from "../root/PopoverRootContext";
import type { PopoverHandle } from "../store/PopoverHandle";
import type { PopoverInteractionType, PopoverStore } from "../store/PopoverStore";
import { OPEN_DELAY } from "../utils/constants";
import { popoverTriggerStateMapping } from "../utils/stateAttributesMapping";

const POPOVER_TRIGGER_IDENTIFIER = "data-base-ui-click-trigger";

/**
 * A button that opens the popover.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverTrigger<Payload = unknown, T extends ValidComponent = "button">(props: PopoverTrigger.Props<Payload, T>) {
  const [local, userHandlers, elementProps] = split(
    props as PopoverTrigger.Props<Payload>,
    { default: defaultProps },
    ["as", "disabled", "nativeButton", "handle", "payload", "id", "openOnHover", "delay", "closeDelay"],
    ["onClick", "onMouseDown", "onPointerDown", "onMouseEnter", "onMouseLeave", "onFocus", "onBlur", "onKeyDown"],
  );

  const as = untrack(() => local.as);
  const parentContext = usePopoverRootContext(true);
  const handle = untrack(() => local.handle) as PopoverHandle<Payload> | undefined;

  if (!parentContext && !handle) {
    throw new Error("Rebase UI: <Popover.Trigger> must be either used within a <Popover.Root> component or provided with a handle.");
  }

  const thisTriggerId = untrack(() => local.id) ?? createUniqueId();

  // The store that owns this trigger: the closest root, or the root attached to the handle
  // for detached triggers. Undefined while a detached trigger waits for its root.
  const store = () => parentContext ?? handle?.attached ?? undefined;

  const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);
  // Plain (non-reactive) ref object for interaction creators, which read it in unowned
  // scopes where signal reads warn. Synced from the signal via the element ref callback.
  const triggerElementRef: { current: Element | null } = { current: null };

  const disabled = () => local.disabled ?? false;
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
  // the popup is mounted, but `PopoverPopup` reads them once when it mounts on
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
      return { liveStore, openOnHover: openOnHover(), closeDelay: local.closeDelay ?? 0 };
    },
    (data) => {
      if (!data) {
        return undefined;
      }
      data.liveStore.set("openOnHover", data.openOnHover);
      data.liveStore.set("closeDelay", data.closeDelay);
      return undefined;
    },
  );

  // Written from the setup child's body, so owned writes are intentional.
  const [clickProps, setClickProps] = createSignal<ClickReferenceProps | undefined>(undefined, { ownedWrite: true });
  const [hoverProps, setHoverProps] = createSignal<HoverReferenceProps | undefined>(undefined, { ownedWrite: true });

  const nestedTriggerOpenTimeout = new Timeout();
  onCleanup(() => nestedTriggerOpenTimeout.clear());

  // Interaction creators access context and read options once, so they run in the body of a
  // child component that mounts once a store is available (immediately for triggers inside a
  // root; on handle attach for detached triggers) instead of in an effect.
  const setupInteractions = (liveStore: PopoverStore<any>) => (
    <PopoverTriggerInteractions
      store={liveStore}
      triggerId={thisTriggerId}
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

  const isOpenedByThisTrigger = () => {
    const liveStore = store();
    return liveStore ? ((liveStore.select("isOpenedByTrigger", thisTriggerId) as boolean) ?? false) : false;
  };

  const isPressOpened = () => {
    const liveStore = store();
    return (
      isOpenedByThisTrigger() && liveStore !== undefined && untrack(() => liveStore.select("openChangeReason")) === REASONS.triggerPress
    );
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
    const click = clickProps()?.[key as keyof ClickReferenceProps] as ((event: any) => void) | undefined;
    const hover = hoverProps()?.[key as keyof HoverReferenceProps] as ((event: any) => void) | undefined;
    const root = getRootTriggerProps()[key] as ((event: any) => void) | undefined;
    const openMethod = openMethodHandlers[key] as ((event: any) => void) | undefined;
    const user = (userHandlers as Record<string, unknown>)[key] as ((event: any) => void) | undefined;

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

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => local.nativeButton ?? true,
  });

  // Focus guards are created per store (the store identity is stable) so the guard
  // ref objects stay stable across renders.
  let guardsCache: { store: PopoverStore<any>; guards: TriggerFocusGuards } | undefined;
  function getGuards(): TriggerFocusGuards | undefined {
    const liveStore = store();
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
    return liveStore !== undefined && isMountedByThisTrigger() && !(untrack(() => liveStore.select("focusManagerModal")) as boolean);
  };

  const state: PopoverTriggerState = {
    get disabled() {
      return disabled();
    },
    get open() {
      return isOpenedByThisTrigger();
    },
    get pressed() {
      return isPressOpened();
    },
  };

  const triggerProps = {
    get id() {
      return thisTriggerId;
    },
    "aria-haspopup": "dialog" as const,
    get "aria-expanded"() {
      return isOpenedByThisTrigger() ? "true" : "false";
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
    get onPointerDown() {
      return chainHandlers("onPointerDown");
    },
    get onMouseEnter() {
      return chainHandlers("onMouseEnter");
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
    get [POPOVER_TRIGGER_IDENTIFIER]() {
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
        return liveStore ? setupInteractions(liveStore) : null;
      })()}
      <Show when={showFocusGuards()}>
        <FocusGuard
          guardRef={getGuards()?.preFocusGuardRef as { current: HTMLSpanElement | null }}
          onFocus={getGuards()?.handlePreFocusGuardFocus}
        />
      </Show>
      <RenderElement
        as={as}
        state={state}
        props={[triggerProps, elementProps, refProps, getButtonProps]}
        stateAttributesMapping={popoverTriggerStateMapping}
      />
      <Show when={showFocusGuards()}>
        <FocusGuard
          guardRef={
            {
              get current() {
                return store()?.context.triggerFocusTargetRef.current ?? null;
              },
              set current(element: HTMLSpanElement | null) {
                const liveStore = store();
                if (liveStore) {
                  liveStore.context.triggerFocusTargetRef.current = element;
                }
              },
            } as { current: HTMLSpanElement | null }
          }
          onFocus={getGuards()?.handleFocusTargetFocus}
        />
      </Show>
    </>
  );
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
  const { store: liveStore, triggerId } = props;
  const floatingRootContext = untrack(() => liveStore.select("floatingRootContext"));
  const floatingContext = getRootFloatingContext(floatingRootContext);

  const click = createClick(floatingContext, {
    stickIfOpen: () => (liveStore.peek("stickIfOpen") as boolean) ?? true,
  }).reference();

  const isActiveTrigger = untrack(() => liveStore.select("isTriggerActive", triggerId)) as boolean;

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
        isClosing: () => (liveStore.select("transitionStatus") as string | undefined) === "ending",
        shouldOpen: () => {
          // A touch-opened popover stays owned by the touch interaction until it closes.
          const openMethod = liveStore.peek("openMethod");
          const openReason = liveStore.peek("openChangeReason");
          return openMethod !== "touch" || openReason !== REASONS.triggerPress;
        },
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
} satisfies Partial<PopoverTrigger.Props>);

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

export interface PopoverTriggerOwnProps<Payload = unknown> extends NativeButtonProps {
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

export type PopoverTriggerProps<Payload = unknown, T extends ValidComponent = "button"> = PopoverTriggerOwnProps<Payload> &
  RebaseUIComponentProps<T, PopoverTriggerState>;

export namespace PopoverTrigger {
  export type State = PopoverTriggerState;
  export type Props<Payload = unknown, T extends ValidComponent = "button"> = PopoverTriggerProps<Payload, T>;
  export type OwnProps<Payload = unknown> = PopoverTriggerOwnProps<Payload>;
}
