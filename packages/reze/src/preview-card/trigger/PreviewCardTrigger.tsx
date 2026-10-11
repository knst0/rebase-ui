import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, store as createStore, untrack, type JSX } from "reze-js";

import { safePolygon } from "../../internals/floating";
import { createFocus, type FocusReferenceProps } from "../../internals/floating/interactions/createFocus";
import {
  createHoverReferenceInteraction,
  type HoverReferenceProps,
} from "../../internals/floating/interactions/createHoverReferenceInteraction";
import { mergeRefs } from "../../internals/mergeRefs";
import { getRootFloatingContext, setupTrigger } from "../../internals/popups/popupStoreUtils";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { warnNestedInteractive } from "../../internals/utils/warnNestedInteractive";
import type { RebaseUIEvent } from "../../types";
import { usePreviewCardRootContext } from "../root/PreviewCardRootContext";
import type { PreviewCardHandle } from "../store/PreviewCardHandle";
import type { PreviewCardStore } from "../store/PreviewCardStore";
import { CLOSE_DELAY, OPEN_DELAY } from "../utils/constants";
import { getInlineRectTriggerProps } from "../utils/inlineRect";

type UserHandlerKey =
  | "onBlur"
  | "onClick"
  | "onFocus"
  | "onKeyDown"
  | "onMouseEnter"
  | "onMouseLeave"
  | "onMouseMove"
  | "onMouseOver"
  | "onPointerDown"
  | "onPointerEnter";

/**
 * A link that opens the preview card.
 * Renders an `<a>` element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardTrigger<Payload = unknown, T extends JSX.ElementType = "a">(props: PreviewCardTrigger.Props<Payload, T>) {
  const rest = omitProps(props, "as", "handle", "id", "payload", "delay", "closeDelay", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const parentContext = usePreviewCardRootContext(true);
  const handle = props.handle as PreviewCardHandle<Payload> | undefined;

  if (!parentContext && !handle) {
    throw new Error(
      "Rebase UI: <PreviewCard.Trigger> must be either used within a <PreviewCard.Root> component or provided with a handle.",
    );
  }

  const thisTriggerId = props.id ?? createUniqueId();
  const delay = props.delay ?? OPEN_DELAY;
  const closeDelay = props.closeDelay ?? CLOSE_DELAY;

  // The store that owns this trigger: the closest root, or the root attached to the handle
  // for detached triggers. Undefined while a detached trigger waits for its root.
  function store(): PreviewCardStore<any> | undefined {
    return (parentContext ?? handle?.attached ?? undefined) as PreviewCardStore<any> | undefined;
  }

  const triggerState = createStore({ element: null as Element | null });
  function triggerElement(): Element | null {
    return triggerState.element;
  }
  // Plain (non-reactive) ref object for interaction creators, which read it in unowned
  // scopes where signal reads warn. Synced from the element ref callback.
  const triggerElementRef: { current: Element | null } = { current: null };

  setupTrigger({
    triggerId: thisTriggerId,
    triggerElement,
    store: () => store(),
    stateUpdates: () => ({
      payload: props.payload as Payload | undefined,
      closeDelay: props.closeDelay ?? CLOSE_DELAY,
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

  // Latest interaction props, written by the setup child below. Read at event time so the
  // element's listeners stay stable while detached triggers attach late.
  let hoverProps: HoverReferenceProps | undefined;
  let focusProps: FocusReferenceProps | undefined;

  // Interaction creators access context and read options once, so they run in the body of a
  // child component that mounts once a store is available (immediately for triggers inside a
  // root; on handle attach for detached triggers) instead of in an effect.
  function setupInteractions(liveStore: PreviewCardStore<any>) {
    return (
      <PreviewCardTriggerInteractions
        store={liveStore}
        triggerId={thisTriggerId}
        triggerElementRef={triggerElementRef}
        delay={delay}
        closeDelay={closeDelay}
        onInteractions={(hover, focus) => {
          hoverProps = hover;
          focusProps = focus;
        }}
      />
    );
  }

  function isOpenedByThisTrigger(): boolean {
    const liveStore = store();
    return liveStore ? ((liveStore.select("isOpenedByTrigger", thisTriggerId) as boolean) ?? false) : false;
  }

  function snapshot(): PreviewCardTriggerState {
    return { open: isOpenedByThisTrigger() };
  }

  function runChainedHandlers(key: UserHandlerKey, event: Event): void {
    const hover = (hoverProps as Record<string, ((event: Event) => void) | undefined> | undefined)?.[key];
    const focus = (focusProps as Record<string, ((event: Event) => void) | undefined> | undefined)?.[key];
    // One-shot store reads: interaction props only steer this dispatch.
    const { root, inlineRect } = untrack(() => {
      const liveStore = store();
      if (!liveStore) {
        return { root: undefined, inlineRect: undefined };
      }
      const mountedByThisTrigger = liveStore.peek("isMountedByTrigger", thisTriggerId) as boolean;
      const rootProps = liveStore.peek("triggerProps", mountedByThisTrigger) as
        | Record<string, ((event: Event) => void) | undefined>
        | undefined;
      const openedByThisTrigger = liveStore.peek("isOpenedByTrigger", thisTriggerId) as boolean;
      const inlineRectProps = getInlineRectTriggerProps(liveStore.context.inlineRectCoordsRef, openedByThisTrigger) as Record<
        string,
        ((event: Event) => void) | undefined
      >;
      return { root: rootProps?.[key], inlineRect: inlineRectProps[key] };
    });
    const user = (props as unknown as Record<UserHandlerKey, ((event: Event) => void) | undefined>)[key];

    hover?.(event);
    focus?.(event);
    root?.(event);
    inlineRect?.(event);
    user?.(event);
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
  function handleMouseEnter(event: Event): void {
    runChainedHandlers("onMouseEnter", event);
  }
  function handleMouseLeave(event: Event): void {
    runChainedHandlers("onMouseLeave", event);
  }
  function handleMouseOver(event: Event): void {
    runChainedHandlers("onMouseOver", event);
  }
  function handleFocus(event: Event): void {
    runChainedHandlers("onFocus", event);
  }
  function handleBlur(event: Event): void {
    runChainedHandlers("onBlur", event);
  }
  function handleClick(event: Event): void {
    runChainedHandlers("onClick", event);
  }
  function handleKeyDown(event: Event): void {
    runChainedHandlers("onKeyDown", event);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "a");

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
  // trigger's listeners when the interactions below attach late to a detached trigger.
  // The default path renders a static `<a>`; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {(() => {
          const liveStore = store();
          return liveStore ? setupInteractions(liveStore) : null;
        })()}
        <a
          {...(rest as Record<string, unknown>)}
          id={thisTriggerId}
          data-popup-open={isOpenedByThisTrigger() ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          onPointerDown={handlePointerDown}
          onPointerEnter={handlePointerEnter}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseOver={handleMouseOver}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          ref={elementRef}
        >
          {resolveChildrenValue(children, snapshot)}
        </a>
      </>
    );
  }

  return (
    <>
      {(() => {
        const liveStore = store();
        return liveStore ? setupInteractions(liveStore) : null;
      })()}
      <Tag
        {...(rest as Record<string, unknown>)}
        id={thisTriggerId}
        data-popup-open={isOpenedByThisTrigger() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onPointerDown={handlePointerDown}
        onPointerEnter={handlePointerEnter}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseOver={handleMouseOver}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
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
function PreviewCardTriggerInteractions(props: {
  store: PreviewCardStore<any>;
  triggerId: string;
  triggerElementRef: { readonly current: Element | null };
  delay: number;
  closeDelay: number;
  onInteractions: (hover: HoverReferenceProps | undefined, focus: FocusReferenceProps | undefined) => void;
}) {
  const liveStore = props.store;
  const triggerId = props.triggerId;
  const floatingRootContext = untrack(() => liveStore.select("floatingRootContext"));
  const floatingContext = getRootFloatingContext(floatingRootContext);

  const isActiveTrigger = untrack(() => liveStore.select("isTriggerActive", triggerId)) as boolean;

  const hover = createHoverReferenceInteraction(floatingContext, {
    mouseOnly: true,
    move: false,
    handleClose: safePolygon(),
    restMs: props.delay,
    delay: () => ({ close: props.closeDelay }),
    triggerElementRef: props.triggerElementRef,
    isActiveTrigger,
    isClosing: () => (liveStore.select("transitionStatus") as string | undefined) === "ending",
  });

  const focus = createFocus(floatingContext, { delay: props.delay }).reference();

  props.onInteractions(hover ?? undefined, focus);
  onCleanup(() => {
    props.onInteractions(undefined, undefined);
  });

  return null;
}

export interface PreviewCardTriggerState {
  /**
   * Whether the preview card is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface PreviewCardTriggerEventHandlers {
  onClick?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onKeyDown?: ((event: RebaseUIEvent<KeyboardEvent>) => void) | undefined;
  onPointerDown?: ((event: RebaseUIEvent<PointerEvent>) => void) | undefined;
}

export interface PreviewCardTriggerOwnProps<Payload = unknown> {
  /**
   * A handle to associate the trigger with a preview card.
   */
  handle?: PreviewCardHandle<Payload> | undefined;
  /**
   * A payload to pass to the preview card when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for the preview card in controlled mode (with the PreviewCardRoot `triggerId` prop).
   */
  id?: string | undefined;
  /**
   * How long to wait before the preview card opens. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the preview card. Specified in milliseconds.
   * @default 300
   */
  closeDelay?: number | undefined;
}

export type PreviewCardTriggerProps<Payload = unknown, T extends JSX.ElementType = "a"> = PreviewCardTriggerOwnProps<Payload> &
  PreviewCardTriggerEventHandlers &
  RebaseUIComponentProps<T, PreviewCardTriggerState>;

export namespace PreviewCardTrigger {
  export type State = PreviewCardTriggerState;
  export type Props<Payload = unknown, T extends JSX.ElementType = "a"> = PreviewCardTriggerProps<Payload, T>;
  export type OwnProps<Payload = unknown> = PreviewCardTriggerOwnProps<Payload>;
}
