import { isElement } from "@floating-ui/utils/dom";
import { isServer, type ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, createUniqueId, onCleanup, onSettled, untrack } from "solid-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { safePolygon } from "../../internals/floating";
import { useDelayGroup } from "../../internals/floating/components/FloatingDelayGroup";
import { createFocus, type FocusReferenceProps } from "../../internals/floating/interactions/createFocus";
import {
  createHoverInteractionSharedState,
  Timeout,
  type HoverInteraction,
} from "../../internals/floating/interactions/createHoverInteractionSharedState";
import {
  createHoverReferenceInteraction,
  type HoverReferenceProps,
} from "../../internals/floating/interactions/createHoverReferenceInteraction";
import { getDelay } from "../../internals/floating/interactions/createHoverShared";
import { contains } from "../../internals/floating/utils/element";
import { isMouseLikePointerType } from "../../internals/floating/utils/event";
import { mergeRefs } from "../../internals/mergeRefs";
import { getRootFloatingContext, setupTrigger } from "../../internals/popups/popupStoreUtils";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { warnNestedInteractive } from "../../internals/utils/warnNestedInteractive";
import { useTooltipProviderContext } from "../provider/TooltipProviderContext";
import { useTooltipRootContext } from "../root/TooltipRootContext";
import type { TooltipHandle } from "../store/TooltipHandle";
import type { TooltipStore } from "../store/TooltipStore";
import { OPEN_DELAY } from "../utils/constants";
import { tooltipTriggerStateMapping } from "../utils/stateAttributesMapping";
import * as TooltipTriggerDataAttributes from "./TooltipTriggerDataAttributes";

const TOOLTIP_TRIGGER_IDENTIFIER = "data-base-ui-tooltip-trigger";

function getTargetElement(event: Event): Element | null {
  if ("composedPath" in event) {
    const path = event.composedPath();
    for (let i = 0; i < path.length; i += 1) {
      const element = path[i];
      if (isElement(element)) {
        return element;
      }
    }
  }

  const target = event.target;
  if (isElement(target)) {
    return target;
  }

  return null;
}

/**
 * An element to attach the tooltip to.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Tooltip](https://rebase-ui.knst.dev/components/tooltip)
 */
export function TooltipTrigger<Payload = unknown, T extends ValidComponent = "button">(props: TooltipTrigger.Props<Payload, T>) {
  const [local, userHandlers, elementProps] = split(
    props as TooltipTrigger.Props<Payload>,
    { default: defaultProps },
    ["as", "disabled", "closeOnClick", "closeDelay", "delay", "handle", "id", "payload"],
    [
      "onBlur",
      "onClick",
      "onFocus",
      "onKeyDown",
      "onMouseEnter",
      "onMouseLeave",
      "onMouseMove",
      "onMouseOver",
      "onPointerDown",
      "onPointerEnter",
    ],
  );

  const as = untrack(() => local.as);
  const parentContext = useTooltipRootContext(true);
  const handle = untrack(() => local.handle) as TooltipHandle<Payload> | undefined;

  if (!parentContext && !handle) {
    throw new Error("Rebase UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle.");
  }

  const thisTriggerId = untrack(() => local.id) ?? createUniqueId();

  // The store that owns this trigger: the closest root, or the root attached to the handle
  // for detached triggers. Undefined while a detached trigger waits for its root.
  const store = () => parentContext ?? handle?.attached ?? undefined;

  const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);
  // Plain (non-reactive) ref object for interaction creators, which read it in unowned
  // scopes where signal reads warn. Synced from the signal via the element ref callback.
  const triggerElementRef: { current: Element | null } = { current: null };

  if (process.env.NODE_ENV !== "production") {
    onSettled(() => {
      warnNestedInteractive(triggerElement());
    });
  }

  const closeOnClick = () => local.closeOnClick;
  const closeDelayWithDefault = () => local.closeDelay ?? 0;

  const { isMountedByTrigger: isMountedByThisTrigger } = setupTrigger({
    triggerId: thisTriggerId,
    triggerElement,
    store,
    stateUpdates: () => ({
      payload: local.payload as Payload | undefined,
      closeOnClick: closeOnClick(),
      closeDelay: closeDelayWithDefault(),
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

  const providerDelay = useTooltipProviderContext();

  // Written from the setup child's body, so owned writes are intentional.
  const [hoverProps, setHoverProps] = createSignal<HoverReferenceProps | undefined>(undefined, { ownedWrite: true });
  const [focusProps, setFocusProps] = createSignal<FocusReferenceProps | undefined>(undefined, { ownedWrite: true });

  const isNestedTriggerHoveredRef: { current: boolean } = { current: false };
  const nestedTriggerOpenTimeout = new Timeout();
  onCleanup(() => nestedTriggerOpenTimeout.clear());
  // Local copy so it can be cleared on mouseLeave without resetting the hover interaction's own pointerType.
  const pointerTypeRef: { current: string | undefined } = { current: undefined };

  function getHoverSharedState(): HoverInteraction | undefined {
    const liveStore = store();
    if (!liveStore) {
      return undefined;
    }
    return createHoverInteractionSharedState(untrack(() => liveStore.select("floatingRootContext")));
  }

  const disabled = () => local.disabled ?? store()?.select("disabled") ?? false;

  const isOpenedByThisTrigger = () => {
    const liveStore = store();
    return liveStore ? ((liveStore.select("isOpenedByTrigger", thisTriggerId) as boolean) ?? false) : false;
  };

  function isEnabledNestedTriggerTarget(target: Element | null) {
    const triggerEl = triggerElement();
    if (!triggerEl || !target) {
      return false;
    }

    const nearestTrigger = typeof target.closest === "function" ? target.closest(`[${TOOLTIP_TRIGGER_IDENTIFIER}]`) : null;
    return nearestTrigger !== null && nearestTrigger !== triggerEl && contains(triggerEl, nearestTrigger);
  }

  function detectNestedTriggerHover(target: Element | null) {
    const nestedTriggerHovered = isEnabledNestedTriggerTarget(target);

    isNestedTriggerHoveredRef.current = nestedTriggerHovered;
    if (nestedTriggerHovered) {
      const hoverShared = getHoverSharedState();
      hoverShared?.openChangeTimeout.clear();
      hoverShared?.restTimeout.clear();
      if (hoverShared) {
        hoverShared.restTimeoutPending = false;
      }
      nestedTriggerOpenTimeout.clear();
    }
    return nestedTriggerHovered;
  }

  function handleNestedTriggerHover(event: MouseEvent) {
    const liveStore = store();
    if (!liveStore) {
      return;
    }
    const wasNestedTriggerHovered = isNestedTriggerHoveredRef.current;
    const target = getTargetElement(event);
    const nestedTriggerHovered = detectNestedTriggerHover(target);
    const triggerEl = triggerElement() as HTMLElement | null;
    const targetInsideTrigger = triggerEl && target && contains(triggerEl, target);

    // Only close hover-opened parents. Focus/click-like opens remain owned by
    // their original interaction and should not be clobbered by nested hover.
    if (nestedTriggerHovered && liveStore.select("open") && liveStore.select("lastOpenChangeReason") === REASONS.triggerHover) {
      liveStore.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
      return;
    }

    if (
      wasNestedTriggerHovered &&
      !nestedTriggerHovered &&
      targetInsideTrigger &&
      !untrack(disabled) &&
      !liveStore.select("open") &&
      triggerEl &&
      // Match the hover interaction's non-strict mouse fallback for mouse-only event sequences.
      isMouseLikePointerType(pointerTypeRef.current)
    ) {
      const open = () => {
        if (!isNestedTriggerHoveredRef.current && !untrack(disabled) && !untrack(() => liveStore.select("open"))) {
          liveStore.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, triggerEl));
        }
      };

      const openDelay = local.delay ?? providerDelay ?? OPEN_DELAY;

      // With `move: false`, the hover interaction only listens to mouseenter/mouseleave
      // on the parent trigger. Leaving a nested child for the parent area fires
      // no event the interaction can react to, so reopen locally.
      if (openDelay === 0) {
        nestedTriggerOpenTimeout.clear();
        open();
      } else {
        nestedTriggerOpenTimeout.start(openDelay, open);
      }
    }
  }

  function getRootTriggerProps(): Record<string, unknown> {
    const liveStore = store();
    if (!liveStore) {
      return {};
    }
    const mountedByThis = isMountedByThisTrigger();
    const trackCursorAxis = untrack(() => liveStore.select("trackCursorAxis"));
    if (!mountedByThis && trackCursorAxis === "none") {
      return {};
    }
    return (liveStore.select("triggerProps", mountedByThis) ?? {}) as Record<string, unknown>;
  }

  function chainHandlers(key: string, focusVeto = false): ((event: any) => void) | undefined {
    const hover = hoverProps()?.[key as keyof HoverReferenceProps] as ((event: any) => void) | undefined;
    const focus = focusProps()?.[key as keyof FocusReferenceProps] as ((event: any) => void) | undefined;
    const root = getRootTriggerProps()[key] as ((event: any) => void) | undefined;
    const user = (userHandlers as Record<string, unknown>)[key] as ((event: any) => void) | undefined;
    const localHandler = localHandlers[key] as ((event: any) => void) | undefined;

    const handlers = [hover, focus, root, localHandler, user].filter(Boolean) as Array<(event: any) => void>;
    if (handlers.length === 0) {
      return undefined;
    }
    // Focusing into a nested trigger must not open the parent tooltip, and a disabled
    // trigger must not open it at all: skip the focus interaction (which has no per-event
    // veto point of its own) while still running the remaining handlers. Hover opens are
    // vetoed via `shouldOpen` in the interaction itself.
    return (event: any) => {
      const vetoed = focusVeto && isEnabledNestedTriggerTarget(getTargetElement(event));
      const skipFocus = focus !== undefined && (vetoed || untrack(disabled));
      for (const handler of handlers) {
        if (handler === focus && skipFocus) {
          continue;
        }
        handler(event);
      }
    };
  }

  const localHandlers: Record<string, (event: any) => void> = {
    onMouseOver(event: MouseEvent) {
      handleNestedTriggerHover(event);
    },
    onMouseLeave() {
      isNestedTriggerHoveredRef.current = false;
      nestedTriggerOpenTimeout.clear();
      pointerTypeRef.current = undefined;
    },
    onPointerEnter(event: PointerEvent) {
      pointerTypeRef.current = event.pointerType;
    },
    onPointerDown(event: PointerEvent) {
      pointerTypeRef.current = event.pointerType;
      const liveStore = store();
      if (!liveStore) {
        return;
      }
      liveStore.set("closeOnClick", closeOnClick());
      if (closeOnClick() && !liveStore.select("open")) {
        liveStore.cancelPendingOpen(event);
      }
    },
    onClick(event: MouseEvent) {
      const liveStore = store();
      if (liveStore && closeOnClick() && !liveStore.select("open")) {
        liveStore.cancelPendingOpen(event);
      }
    },
  };

  const state: TooltipTriggerState = {
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  const triggerProps = {
    get id() {
      return thisTriggerId;
    },
    get onPointerDown() {
      return chainHandlers("onPointerDown");
    },
    get onPointerEnter() {
      return chainHandlers("onPointerEnter");
    },
    get onMouseMove() {
      return chainHandlers("onMouseMove");
    },
    get onMouseOver() {
      return chainHandlers("onMouseOver");
    },
    get onFocus() {
      return chainHandlers("onFocus", true);
    },
    get onBlur() {
      return chainHandlers("onBlur");
    },
    get onMouseLeave() {
      return chainHandlers("onMouseLeave");
    },
    get onClick() {
      return chainHandlers("onClick");
    },
    get onKeyDown() {
      return chainHandlers("onKeyDown");
    },
    get onMouseEnter() {
      return chainHandlers("onMouseEnter");
    },
    get [TooltipTriggerDataAttributes.triggerDisabled]() {
      return disabled() ? "" : undefined;
    },
    get [TOOLTIP_TRIGGER_IDENTIFIER]() {
      return disabled() ? undefined : "";
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<Element>(externalProps.ref, setTriggerElement, (element: Element | null) => {
      triggerElementRef.current = element;
    }),
  });

  return (
    <>
      {(() => {
        const liveStore = store();
        if (!liveStore) {
          return null;
        }
        // Interaction creators access context and read options once, so they run in the body
        // of a child component that mounts once a store is available (immediately for
        // triggers inside a root; on handle attach for detached triggers) instead of in an
        // effect. `disabled` stays a live accessor: hover opens are vetoed per event via
        // `shouldOpen`, and focus handlers are skipped per event in `chainHandlers`.
        return (
          <TooltipTriggerInteractions
            store={liveStore}
            triggerId={thisTriggerId}
            triggerElementRef={triggerElementRef}
            disabled={disabled}
            disableHoverablePopup={untrack(() => liveStore.select("disableHoverablePopup"))}
            trackCursorAxis={untrack(() => liveStore.select("trackCursorAxis"))}
            delay={local.delay}
            closeDelay={local.closeDelay}
            closeDelayWithDefault={closeDelayWithDefault()}
            providerDelay={providerDelay}
            isNestedTriggerHoveredRef={isNestedTriggerHoveredRef}
            onInteractions={(hover, focus) => {
              setHoverProps(hover);
              setFocusProps(focus);
            }}
          />
        );
      })()}
      <RenderElement
        as={as}
        state={state}
        props={[triggerProps, elementProps, refProps]}
        stateAttributesMapping={tooltipTriggerStateMapping}
      />
    </>
  );
}

/**
 * Creates the trigger's hover/focus interactions against the resolved store and reports the
 * resulting props back to the trigger. Mounted once a store is available so detached triggers
 * set up their interactions when their handle attaches.
 */
function TooltipTriggerInteractions(props: {
  store: TooltipStore<any>;
  triggerId: string;
  triggerElementRef: { readonly current: Element | null };
  disabled: () => boolean;
  disableHoverablePopup: boolean;
  trackCursorAxis: "none" | "x" | "y" | "both";
  delay: number | undefined;
  closeDelay: number | undefined;
  closeDelayWithDefault: number;
  providerDelay: number | undefined;
  isNestedTriggerHoveredRef: { current: boolean };
  onInteractions: (hover: HoverReferenceProps | undefined, focus: FocusReferenceProps | undefined) => void;
}) {
  const { store: liveStore, triggerId } = props;
  const floatingRootContext = untrack(() => liveStore.select("floatingRootContext"));
  const floatingContext = getRootFloatingContext(floatingRootContext);

  const isOpenedByThisTrigger = () => (liveStore.select("isOpenedByTrigger", triggerId) as boolean) ?? false;

  const { activeIdRef, delayRef, isInstantPhase, hasProvider } = useDelayGroup(floatingContext, {
    open: isOpenedByThisTrigger,
  });
  createHoverInteractionSharedState(floatingRootContext);

  liveStore.useSyncedValue("isInstantPhase", isInstantPhase);

  function getOpenDelay() {
    // Adjacent tooltips open instantly while the group is active.
    if (hasProvider && activeIdRef.current != null) {
      return 0;
    }
    return props.delay ?? props.providerDelay ?? OPEN_DELAY;
  }

  const isActiveTrigger = untrack(() => liveStore.select("isTriggerActive", triggerId)) as boolean;

  const hover = createHoverReferenceInteraction(floatingContext, {
    enabled: untrack(() => !props.disabled()),
    mouseOnly: true,
    move: false,
    handleClose: !props.disableHoverablePopup && props.trackCursorAxis !== "both" ? safePolygon() : null,
    restMs: getOpenDelay,
    delay() {
      if (props.closeDelay == null && hasProvider) {
        return { close: getDelay(delayRef.current, "close") };
      }
      return { close: props.closeDelayWithDefault };
    },
    triggerElementRef: props.triggerElementRef,
    isActiveTrigger,
    isClosing: () => (liveStore.peek("transitionStatus") as string | undefined) === "ending",
    shouldOpen() {
      return !untrack(props.disabled) && !props.isNestedTriggerHoveredRef.current;
    },
  });

  const focus = createFocus(floatingContext, { enabled: untrack(() => !props.disabled()) }).reference();

  if (!isServer) {
    props.onInteractions(hover ?? undefined, focus);
    onCleanup(() => {
      props.onInteractions(undefined, undefined);
    });
  }

  return null;
}

const defaultProps = Object.freeze({
  as: "button",
  closeOnClick: true,
} satisfies Partial<TooltipTrigger.Props>);

export interface TooltipTriggerState {
  /**
   * Whether the tooltip is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface TooltipTriggerOwnProps<Payload = unknown> {
  /**
   * A handle to associate the trigger with a tooltip.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * A payload to pass to the tooltip when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * How long to wait before opening the tooltip on hover. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * Whether the tooltip should close when this trigger is clicked.
   * @default true
   */
  closeOnClick?: boolean | undefined;
  /**
   * How long to wait before closing the tooltip. Specified in milliseconds.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * If `true`, the tooltip will not open when interacting with this trigger.
   * Note that this doesn't apply the `disabled` attribute to the trigger element.
   * If you need a natively disabled trigger element, compose it via the `as` prop.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for the tooltip in controlled mode (with the TooltipRoot `triggerId` prop).
   */
  id?: string | undefined;
}

export type TooltipTriggerProps<Payload = unknown, T extends ValidComponent = "button"> = TooltipTriggerOwnProps<Payload> &
  RebaseUIComponentProps<T, TooltipTriggerState>;

export namespace TooltipTrigger {
  export type State = TooltipTriggerState;
  export type Props<Payload = unknown, T extends ValidComponent = "button"> = TooltipTriggerProps<Payload, T>;
  export type OwnProps<Payload = unknown> = TooltipTriggerOwnProps<Payload>;
}
