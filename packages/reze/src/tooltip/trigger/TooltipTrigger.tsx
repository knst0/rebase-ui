import { isElement } from "@floating-ui/utils/dom";
import {
  createUniqueId,
  dynamicElement,
  effect,
  getOwner,
  omitProps,
  onCleanup,
  runWithOwner,
  store as createStore,
  untrack,
  type JSX,
} from "reze-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { safePolygon, useDelayGroup } from "../../internals/floating";
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
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import { warnNestedInteractive } from "../../internals/utils/warnNestedInteractive";
import { useTooltipProviderContext } from "../provider/TooltipProviderContext";
import { useTooltipRootContext } from "../root/TooltipRootContext";
import type { TooltipHandle } from "../store/TooltipHandle";
import type { TooltipStore } from "../store/TooltipStore";
import { OPEN_DELAY } from "../utils/constants";

const TOOLTIP_TRIGGER_IDENTIFIER = "data-base-ui-tooltip-trigger";

type TooltipTriggerHandlerKey =
  | "onPointerDown"
  | "onPointerEnter"
  | "onMouseMove"
  | "onMouseOver"
  | "onFocus"
  | "onBlur"
  | "onMouseLeave"
  | "onClick"
  | "onKeyDown"
  | "onMouseEnter";

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
export function TooltipTrigger<Payload = unknown, T extends JSX.ElementType = "button">(props: TooltipTrigger.Props<Payload, T>) {
  const rest = omitProps(
    props,
    "as",
    "disabled",
    "closeOnClick",
    "closeDelay",
    "delay",
    "handle",
    "id",
    "payload",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const parentContext = useTooltipRootContext(true);
  const handle = props.handle as TooltipHandle<Payload> | undefined;

  if (!parentContext && !handle) {
    throw new Error("Rebase UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle.");
  }

  const thisTriggerId = props.id ?? createUniqueId();

  // The store that owns this trigger: the closest root, or the root attached to the handle
  // for detached triggers. Undefined while a detached trigger waits for its root.
  function store(): TooltipStore<any> | undefined {
    return (parentContext ?? handle?.attached ?? undefined) as TooltipStore<any> | undefined;
  }

  const triggerState = createStore({ element: null as Element | null });
  function triggerElement(): Element | null {
    return triggerState.element;
  }
  // Plain (non-reactive) ref object for interaction creators, which read it in unowned
  // scopes where signal reads warn. Synced from the element ref callback.
  const triggerElementRef: { current: Element | null } = { current: null };

  function closeOnClick(): boolean {
    return props.closeOnClick ?? true;
  }
  function closeDelayWithDefault(): number {
    return props.closeDelay ?? 0;
  }

  const { isMountedByTrigger: isMountedByThisTrigger } = setupTrigger({
    triggerId: thisTriggerId,
    triggerElement,
    store: () => store(),
    stateUpdates: () => ({
      payload: props.payload as Payload | undefined,
      closeOnClick: closeOnClick(),
      closeDelay: closeDelayWithDefault(),
    }),
  });

  // Registers into the handle's pending map while no root is attached so imperative
  // `handle.open(id)` resolves the trigger. Migrates to the live store once it attaches.
  effect(() => {
    const element = triggerElement();
    const liveStore = store();
    let cleanup: (() => void) | undefined;
    // One-shot registration: the values only steer this write.
    untrack(() => {
      if (element === null || liveStore !== undefined || !handle) {
        return;
      }
      cleanup = handle.registerPendingTrigger(thisTriggerId, element);
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  const providerDelay = useTooltipProviderContext();

  // Latest interaction props, written by the setup child below. Read at event time so the
  // element's listeners stay stable while detached triggers attach late.
  let hoverProps: HoverReferenceProps | undefined;
  let focusProps: FocusReferenceProps | undefined;

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
    return createHoverInteractionSharedState(liveStore.peek("floatingRootContext"));
  }

  function disabled(): boolean {
    return props.disabled ?? store()?.select("disabled") ?? false;
  }

  function isOpenedByThisTrigger(): boolean {
    const liveStore = store();
    return liveStore ? ((liveStore.select("isOpenedByTrigger", thisTriggerId) as boolean) ?? false) : false;
  }

  function snapshot(): TooltipTriggerState {
    return { open: isOpenedByThisTrigger() };
  }

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
    if (nestedTriggerHovered && liveStore.peek("open") && liveStore.peek("lastOpenChangeReason") === REASONS.triggerHover) {
      liveStore.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
      return;
    }

    if (
      wasNestedTriggerHovered &&
      !nestedTriggerHovered &&
      targetInsideTrigger &&
      !untrack(disabled) &&
      !liveStore.peek("open") &&
      triggerEl &&
      // Match the hover interaction's non-strict mouse fallback for mouse-only event sequences.
      isMouseLikePointerType(pointerTypeRef.current)
    ) {
      const open = () => {
        if (!isNestedTriggerHoveredRef.current && !untrack(disabled) && !liveStore.peek("open")) {
          liveStore.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, triggerEl));
        }
      };

      const openDelay = props.delay ?? providerDelay ?? OPEN_DELAY;

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
    const trackCursorAxis = liveStore.peek("trackCursorAxis");
    if (!mountedByThis && trackCursorAxis === "none") {
      return {};
    }
    return (liveStore.peek("triggerProps", mountedByThis) ?? {}) as Record<string, unknown>;
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
      if (closeOnClick() && !liveStore.peek("open")) {
        liveStore.cancelPendingOpen(event);
      }
    },
    onClick(event: MouseEvent) {
      const liveStore = store();
      if (liveStore && closeOnClick() && !liveStore.peek("open")) {
        liveStore.cancelPendingOpen(event);
      }
    },
  };

  function runChainedHandlers(key: TooltipTriggerHandlerKey, event: Event, focusVeto = false): void {
    const hover = (hoverProps as Record<string, ((event: Event) => void) | undefined> | undefined)?.[key];
    const focus = (focusProps as Record<string, ((event: Event) => void) | undefined> | undefined)?.[key];
    const root = getRootTriggerProps()[key] as ((event: Event) => void) | undefined;
    const localHandler = localHandlers[key] as ((event: Event) => void) | undefined;
    const user = (props as unknown as Record<TooltipTriggerHandlerKey, ((event: Event) => void) | undefined>)[key];

    // Focusing into a nested trigger must not open the parent tooltip, and a disabled
    // trigger must not open it at all: skip the focus interaction (which has no per-event
    // veto point of its own) while still running the remaining handlers. Hover opens are
    // vetoed via `shouldOpen` in the interaction itself.
    const vetoed = focusVeto && isEnabledNestedTriggerTarget(getTargetElement(event));
    const skipFocus = focus !== undefined && (vetoed || untrack(disabled));

    for (const handler of [hover, focus, root, localHandler, user]) {
      if (handler === undefined) {
        continue;
      }
      if (handler === focus && skipFocus) {
        continue;
      }
      handler(event);
    }
  }

  function handlePointerDown(event: Event): void {
    runChainedHandlers("onPointerDown", event);
  }
  function handlePointerEnter(event: Event): void {
    runChainedHandlers("onPointerEnter", event);
  }
  function handleMouseMove(event: Event): void {
    runChainedHandlers("onMouseMove", event);
  }
  function handleMouseOver(event: Event): void {
    runChainedHandlers("onMouseOver", event);
  }
  function handleFocus(event: Event): void {
    runChainedHandlers("onFocus", event, true);
  }
  function handleBlur(event: Event): void {
    runChainedHandlers("onBlur", event);
  }
  function handleMouseLeave(event: Event): void {
    runChainedHandlers("onMouseLeave", event);
  }
  function handleClick(event: Event): void {
    runChainedHandlers("onClick", event);
  }
  function handleKeyDown(event: Event): void {
    runChainedHandlers("onKeyDown", event);
  }
  function handleMouseEnter(event: Event): void {
    runChainedHandlers("onMouseEnter", event);
  }

  // Interaction creators access context and read options once, so they run in the body
  // of a child component that mounts once a store is available (immediately for
  // triggers inside a root; on handle attach for detached triggers) instead of in an
  // effect. `disabled` stays a live accessor: hover opens are vetoed per event via
  // `shouldOpen`, and focus handlers are skipped per event in `runChainedHandlers`.
  function setupInteractions(liveStore: TooltipStore<any>) {
    return (
      <TooltipTriggerInteractions
        store={liveStore}
        triggerId={thisTriggerId}
        triggerElementRef={triggerElementRef}
        disabled={disabled}
        disableHoverablePopup={liveStore.peek("disableHoverablePopup")}
        trackCursorAxis={liveStore.peek("trackCursorAxis")}
        delay={props.delay}
        closeDelay={props.closeDelay}
        closeDelayWithDefault={closeDelayWithDefault()}
        providerDelay={providerDelay}
        isNestedTriggerHoveredRef={isNestedTriggerHoveredRef}
        onInteractions={(hover, focus) => {
          hoverProps = hover;
          focusProps = focus;
        }}
      />
    );
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  // The interactions binding below runs later under the renderer's owner, so the setup
  // child is created with this owner re-entered to keep ancestor context (in particular
  // the floating delay group) visible to the interaction creators.
  const interactionsOwner = getOwner();

  function setTriggerElement(element: Element | null): void {
    triggerState.element = element;
    triggerElementRef.current = element;
    if (element !== null && process.env.NODE_ENV !== "production") {
      // Deferred past mount so nested children are attached before the nesting
      // check runs (mirrors Solid's `onSettled` timing).
      queueMicrotask(() => warnNestedInteractive(element));
    }
  }

  const elementRef = mergeRefs(setTriggerElement, props.ref as ((element: Element | null) => void) | undefined);

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would drop the
  // trigger's listeners and focus when the tooltip opens or closes. The default path renders
  // a static `<button>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {(() => {
          const liveStore = store();
          if (!liveStore) {
            return null;
          }
          return runWithOwner(interactionsOwner, () => setupInteractions(liveStore));
        })()}
        <button
          {...(rest as Record<string, unknown>)}
          id={thisTriggerId}
          data-popup-open={isOpenedByThisTrigger() ? "" : undefined}
          data-trigger-disabled={disabled() ? "" : undefined}
          data-base-ui-tooltip-trigger={disabled() ? undefined : ""}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          onPointerDown={handlePointerDown}
          onPointerEnter={handlePointerEnter}
          onMouseMove={handleMouseMove}
          onMouseOver={handleMouseOver}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onMouseEnter={handleMouseEnter}
          ref={elementRef}
        >
          {resolveChildrenValue(children, snapshot)}
        </button>
      </>
    );
  }

  return (
    <>
      {(() => {
        const liveStore = store();
        if (!liveStore) {
          return null;
        }
        return runWithOwner(interactionsOwner, () => setupInteractions(liveStore));
      })()}
      <Tag
        {...(rest as Record<string, unknown>)}
        id={thisTriggerId}
        data-popup-open={isOpenedByThisTrigger() ? "" : undefined}
        data-trigger-disabled={disabled() ? "" : undefined}
        data-base-ui-tooltip-trigger={disabled() ? undefined : ""}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onPointerDown={handlePointerDown}
        onPointerEnter={handlePointerEnter}
        onMouseMove={handleMouseMove}
        onMouseOver={handleMouseOver}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        ref={elementRef}
      >
        {resolveChildrenValue(children, snapshot)}
      </Tag>
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
  const liveStore = props.store;
  const triggerId = props.triggerId;
  const floatingRootContext = liveStore.peek("floatingRootContext");
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

  const isActiveTrigger = liveStore.peek("isTriggerActive", triggerId) as boolean;

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
    isClosing: () => liveStore.peek("transitionStatus") === "ending",
    shouldOpen() {
      return !untrack(() => props.disabled()) && !props.isNestedTriggerHoveredRef.current;
    },
  });

  const focus = createFocus(floatingContext, { enabled: untrack(() => !props.disabled()) }).reference();

  props.onInteractions(hover ?? undefined, focus);
  onCleanup(() => {
    props.onInteractions(undefined, undefined);
  });

  return null;
}

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

export type TooltipTriggerProps<Payload = unknown, T extends JSX.ElementType = "button"> = TooltipTriggerOwnProps<Payload> &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, TooltipTriggerState>;

export namespace TooltipTrigger {
  export type State = TooltipTriggerState;
  export type Props<Payload = unknown, T extends JSX.ElementType = "button"> = TooltipTriggerProps<Payload, T>;
  export type OwnProps<Payload = unknown> = TooltipTriggerOwnProps<Payload>;
}
