import { isServer, type ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, createUniqueId, onCleanup, onSettled, untrack } from "solid-js";

import { safePolygon } from "../../internals/floating";
import { createFocus, type FocusReferenceProps } from "../../internals/floating/interactions/createFocus";
import {
  createHoverReferenceInteraction,
  type HoverReferenceProps,
} from "../../internals/floating/interactions/createHoverReferenceInteraction";
import { mergeRefs } from "../../internals/mergeRefs";
import { getRootFloatingContext, setupTrigger } from "../../internals/popups/popupStoreUtils";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { warnNestedInteractive } from "../../internals/utils/warnNestedInteractive";
import { usePreviewCardRootContext } from "../root/PreviewCardRootContext";
import type { PreviewCardHandle } from "../store/PreviewCardHandle";
import type { PreviewCardStore } from "../store/PreviewCardStore";
import { CLOSE_DELAY, OPEN_DELAY } from "../utils/constants";
import { getInlineRectTriggerProps } from "../utils/inlineRect";
import { previewCardTriggerStateMapping } from "../utils/stateAttributesMapping";

/**
 * A link that opens the preview card.
 * Renders an `<a>` element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardTrigger<Payload = unknown, T extends ValidComponent = "a">(props: PreviewCardTrigger.Props<Payload, T>) {
  const [local, userHandlers, elementProps] = split(
    props as PreviewCardTrigger.Props<Payload>,
    { default: defaultProps },
    ["as", "handle", "id", "payload", "delay", "closeDelay"],
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
  const parentContext = usePreviewCardRootContext(true);
  const handle = untrack(() => local.handle) as PreviewCardHandle<Payload> | undefined;

  if (!parentContext && !handle) {
    throw new Error(
      "Rebase UI: <PreviewCard.Trigger> must be either used within a <PreviewCard.Root> component or provided with a handle.",
    );
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

  const { isMountedByTrigger: isMountedByThisTrigger } = setupTrigger({
    triggerId: thisTriggerId,
    triggerElement,
    store,
    stateUpdates: () => ({
      payload: local.payload as Payload | undefined,
      closeDelay: local.closeDelay ?? CLOSE_DELAY,
    }),
  });

  // Registers into the handle's pending map while no root is attached so imperative
  // `handle.open(id)` resolves the trigger. Migrates to the live store once it attaches.
  createEffect(
    () => ({ element: triggerElement(), liveStore: store() }),
    ({ element, liveStore }) => {
      if (element === null || liveStore !== undefined || !handle) {
        return undefined;
      }
      return handle.registerPendingTrigger(thisTriggerId, element);
    },
  );

  // Written from the setup child's body, so owned writes are intentional.
  const [hoverProps, setHoverProps] = createSignal<HoverReferenceProps | undefined>(undefined, { ownedWrite: true });
  const [focusProps, setFocusProps] = createSignal<FocusReferenceProps | undefined>(undefined, { ownedWrite: true });

  // Interaction creators access context and read options once, so they run in the body of a
  // child component that mounts once a store is available (immediately for triggers inside a
  // root; on handle attach for detached triggers) instead of in an effect.
  const setupInteractions = (liveStore: PreviewCardStore<any>) => (
    <PreviewCardTriggerInteractions
      store={liveStore}
      triggerId={thisTriggerId}
      triggerElementRef={triggerElementRef}
      delay={local.delay ?? OPEN_DELAY}
      closeDelay={local.closeDelay ?? CLOSE_DELAY}
      onInteractions={(hover, focus) => {
        setHoverProps(hover);
        setFocusProps(focus);
      }}
    />
  );

  const isOpenedByThisTrigger = () => {
    const liveStore = store();
    return liveStore ? ((liveStore.select("isOpenedByTrigger", thisTriggerId) as boolean) ?? false) : false;
  };

  function getRootTriggerProps(): Record<string, unknown> {
    const liveStore = store();
    if (!liveStore) {
      return {};
    }
    return (liveStore.select("triggerProps", isMountedByThisTrigger()) ?? {}) as Record<string, unknown>;
  }

  function getInlineRectProps(): Record<string, ((event: any) => void) | undefined> {
    const liveStore = store();
    if (!liveStore) {
      return {};
    }
    return getInlineRectTriggerProps(liveStore.context.inlineRectCoordsRef, isOpenedByThisTrigger()) as Record<
      string,
      ((event: any) => void) | undefined
    >;
  }

  function chainHandlers(key: string): ((event: any) => void) | undefined {
    const hover = hoverProps()?.[key as keyof HoverReferenceProps] as ((event: any) => void) | undefined;
    const focus = focusProps()?.[key as keyof FocusReferenceProps] as ((event: any) => void) | undefined;
    const root = getRootTriggerProps()[key] as ((event: any) => void) | undefined;
    const inlineRect = getInlineRectProps()[key] as ((event: any) => void) | undefined;
    const user = (userHandlers as Record<string, unknown>)[key] as ((event: any) => void) | undefined;

    const handlers = [hover, focus, root, inlineRect, user].filter(Boolean) as Array<(event: any) => void>;
    if (handlers.length === 0) {
      return undefined;
    }
    return (event: any) => {
      for (const handler of handlers) {
        handler(event);
      }
    };
  }

  const state: PreviewCardTriggerState = {
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
    get onMouseEnter() {
      return chainHandlers("onMouseEnter");
    },
    get onMouseLeave() {
      return chainHandlers("onMouseLeave");
    },
    get onMouseOver() {
      return chainHandlers("onMouseOver");
    },
    get onFocus() {
      return chainHandlers("onFocus");
    },
    get onBlur() {
      return chainHandlers("onBlur");
    },
    get onClick() {
      return chainHandlers("onClick");
    },
    get onKeyDown() {
      return chainHandlers("onKeyDown");
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
        return liveStore ? setupInteractions(liveStore) : null;
      })()}
      <RenderElement
        as={as}
        state={state}
        props={[triggerProps, elementProps, refProps]}
        stateAttributesMapping={previewCardTriggerStateMapping}
      />
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
  const { store: liveStore, triggerId } = props;
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

  if (!isServer) {
    props.onInteractions(hover ?? undefined, focus);
    onCleanup(() => {
      props.onInteractions(undefined, undefined);
    });
  }

  return null;
}

const defaultProps = Object.freeze({
  as: "a",
} satisfies Partial<PreviewCardTrigger.Props>);

export interface PreviewCardTriggerState {
  /**
   * Whether the preview card is currently open and was opened by this trigger.
   */
  open: boolean;
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

export type PreviewCardTriggerProps<Payload = unknown, T extends ValidComponent = "a"> = PreviewCardTriggerOwnProps<Payload> &
  RebaseUIComponentProps<T, PreviewCardTriggerState>;

export namespace PreviewCardTrigger {
  export type State = PreviewCardTriggerState;
  export type Props<Payload = unknown, T extends ValidComponent = "a"> = PreviewCardTriggerProps<Payload, T>;
  export type OwnProps<Payload = unknown> = PreviewCardTriggerOwnProps<Payload>;
}
