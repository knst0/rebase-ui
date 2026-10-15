import {
  createContext,
  createUniqueId,
  dynamicElement,
  effect,
  omitProps,
  onCleanup,
  Portal,
  store as createStore,
  untrack,
  useContext,
  type JSX,
} from "reze-js";

import { createChangeEventDetails } from "../../event-details/createEventDetails";
import { REASONS } from "../../event-details/reasons";
import { mergeRefs } from "../../mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../renderProps";
import type { RebaseUIComponentProps } from "../../types";
import { visuallyHidden } from "../../utils/visuallyHidden";
import { createAttribute } from "../utils/createAttribute";
import { disableFocusInside, enableFocusInside, getNextTabbable, getPreviousTabbable, isOutsideEvent } from "../utils/tabbable";

type FocusManagerState = null | {
  modal: boolean;
  open: boolean;
  onOpenChange(open: boolean, data?: { reason?: string | undefined; event?: Event | undefined }): void;
  domReference: Element | null;
  closeOnFocusOut: boolean;
};

interface FloatingPortalContextValue {
  portalNode: () => HTMLElement | null;
  setFocusManagerState: (state: FocusManagerState) => void;
  beforeInsideRef: { current: HTMLSpanElement | null };
  afterInsideRef: { current: HTMLSpanElement | null };
  beforeOutsideRef: { current: HTMLSpanElement | null };
  afterOutsideRef: { current: HTMLSpanElement | null };
}

const PortalContext = createContext<FloatingPortalContextValue | null>(null);

export function usePortalContext(): FloatingPortalContextValue | null {
  return useContext(PortalContext);
}

const attr = createAttribute("portal");

export interface FloatingPortalContainerRef {
  current: HTMLElement | ShadowRoot | null;
}

export type FloatingPortalContainer = HTMLElement | ShadowRoot | null | FloatingPortalContainerRef | undefined;

export interface UseFloatingPortalNodeProps {
  ref?: ((element: HTMLDivElement) => void) | undefined;
  container?: FloatingPortalContainer | undefined;
  /**
   * An overriding `id` for the portal node. Used so `aria-owns` points at
   * the exact rendered value instead of the generated one.
   */
  id?: string | undefined;
}

export interface UseFloatingPortalNodeResult {
  node: () => HTMLElement | null;
  /**
   * The `id` attribute of the portal node, reflecting an overriding `id`
   * prop when one is provided so `aria-owns` never points at an ID absent
   * from the DOM.
   */
  nodeId: () => string | undefined;
  containerElement: () => HTMLElement | ShadowRoot | null;
  setPortalNode: (node: HTMLElement | null) => void;
}

function isNodeContainer(value: Element | ShadowRoot | FloatingPortalContainerRef): value is Element | ShadowRoot {
  if (value instanceof Element) {
    return true;
  }

  return typeof ShadowRoot !== "undefined" && value instanceof ShadowRoot;
}

function resolveContainer(container: FloatingPortalContainer, parentPortalNode: HTMLElement | null): HTMLElement | ShadowRoot | null {
  if (container === null) {
    return null;
  }

  if (container !== undefined) {
    if (isNodeContainer(container)) {
      return container;
    }

    const resolved = container.current;
    return resolved ?? parentPortalNode ?? (typeof document !== "undefined" ? document.body : null);
  }

  return parentPortalNode ?? (typeof document !== "undefined" ? document.body : null);
}

export function useFloatingPortalNode(props: UseFloatingPortalNodeProps = {}): UseFloatingPortalNodeResult {
  const uniqueId = untrack(() => props.id) ?? createUniqueId();
  const portalContext = usePortalContext();

  const state = createStore({
    containerElement: null as HTMLElement | ShadowRoot | null,
    portalNode: null as HTMLElement | null,
  });

  let containerRef: HTMLElement | ShadowRoot | null = null;

  effect(() => {
    const container = props.container;
    const parentPortalNode = portalContext?.portalNode() ?? null;
    // One-shot container resolution: the values only steer the resolution.
    untrack(() => {
      // Wait for the container to be resolved if explicitly `null`.
      const resolved = resolveContainer(container, parentPortalNode);

      if (resolved == null) {
        if (containerRef) {
          containerRef = null;
          state.portalNode = null;
          state.containerElement = null;
        }
        return;
      }

      if (containerRef !== resolved) {
        containerRef = resolved;
        state.portalNode = null;
        state.containerElement = resolved;
      }
    });
  });

  return {
    node: () => state.portalNode,
    // An `id` prop can override or remove the generated ID. Use the exact
    // rendered value so `aria-owns` never points at an ID absent from the DOM.
    nodeId: () => uniqueId,
    containerElement: () => state.containerElement,
    setPortalNode: (node) => {
      untrack(() => {
        if (state.portalNode !== node) {
          state.portalNode = node;
        }
      });
    },
  };
}

function PortalFocusGuard(props: {
  ref?: ((element: HTMLSpanElement) => void) | undefined;
  onFocus: (event: FocusEvent) => void;
}): JSX.Element {
  return (
    <span
      data-type="outside"
      ref={props.ref}
      tabindex={0}
      aria-hidden="true"
      style={visuallyHidden}
      onFocus={(event) => props.onFocus(event)}
    />
  );
}

/**
 * Portals the floating element into a given container element — by default,
 * outside of the app root and into the body.
 * This is necessary to ensure the floating element can appear outside any
 * potential parent containers that cause clipping (such as `overflow: hidden`),
 * while retaining its location in the Reze tree.
 * @see https://floating-ui.com/docs/FloatingPortal
 * @internal
 */
export function FloatingPortal<T extends JSX.ElementType = "div">(props: FloatingPortal.Props<T>) {
  const rest = omitProps(props, "as", "container", "portalOwnerRole", "class", "style", "children", "ref", "id");

  const as = untrack(() => props.as);
  const container = untrack(() => props.container);
  const portalOwnerRole = untrack(() => props.portalOwnerRole);
  const portalElementId = untrack(() => (props as { id?: string | undefined }).id);
  const externalRef = untrack(() => (props as { ref?: unknown }).ref);

  const {
    node: portalNode,
    nodeId: portalNodeId,
    containerElement,
    setPortalNode,
  } = useFloatingPortalNode({ container, id: portalElementId });

  const setPortalNodeRef = (node: HTMLDivElement) => {
    if (node !== null) {
      // The container-resolution effect above clears the portal node when the
      // container becomes null or changes, so ignoring null here is safe.
      setPortalNode(node);
    }
  };

  const refProp =
    typeof externalRef === "function"
      ? mergeRefs<HTMLDivElement>(externalRef as (element: HTMLDivElement) => void, setPortalNodeRef)
      : setPortalNodeRef;

  const beforeOutsideRef: { current: HTMLSpanElement | null } = { current: null };
  const afterOutsideRef: { current: HTMLSpanElement | null } = { current: null };
  const beforeInsideRef: { current: HTMLSpanElement | null } = { current: null };
  const afterInsideRef: { current: HTMLSpanElement | null } = { current: null };

  const state = createStore({ focusManagerState: null as FocusManagerState });
  let focusInsideDisabled = false;

  function setFocusManagerState(next: FocusManagerState) {
    untrack(() => {
      state.focusManagerState = next;
    });
  }

  function focusManagerState(): FocusManagerState {
    return state.focusManagerState;
  }

  function modal(): boolean | undefined {
    return focusManagerState()?.modal;
  }

  function open(): boolean | undefined {
    return focusManagerState()?.open;
  }

  function shouldRenderGuards(): boolean {
    return !!focusManagerState() && !focusManagerState()!.modal && focusManagerState()!.open && !!portalNode();
  }

  // https://codesandbox.io/s/tabbable-portal-f4tng?file=/src/TabbablePortal.tsx
  effect(() => {
    const node = portalNode();
    const isModal = modal();
    let cleanup: (() => void) | undefined;
    // One-shot listener wiring: the values only steer the subscriptions.
    untrack(() => {
      if (!node || isModal) {
        return;
      }

      // Make sure elements inside the portal element are tabbable only when the
      // portal has already been focused, either by tabbing into a focus trap
      // element outside or using the mouse.
      function onFocus(event: FocusEvent) {
        if (node && event.relatedTarget && isOutsideEvent(event)) {
          if (event.type === "focusin") {
            if (focusInsideDisabled) {
              enableFocusInside(node);
              focusInsideDisabled = false;
            }
          } else {
            disableFocusInside(node);
            focusInsideDisabled = true;
          }
        }
      }

      // Listen to the event on the capture phase so they run before the focus
      // trap elements onFocus prop is called.
      node.addEventListener("focusin", onFocus, true);
      node.addEventListener("focusout", onFocus, true);
      cleanup = () => {
        node.removeEventListener("focusin", onFocus, true);
        node.removeEventListener("focusout", onFocus, true);
      };
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  effect(() => {
    const node = portalNode();
    const isOpen = open();
    // One-shot tabbability restore: the values only steer the restore.
    untrack(() => {
      if (!node || isOpen !== true || !focusInsideDisabled) {
        return;
      }

      // Restore tabbability before the focus manager's queued focus-on-open step runs.
      enableFocusInside(node);
      focusInsideDisabled = false;
    });
  });

  const portalContextValue: FloatingPortalContextValue = {
    beforeOutsideRef,
    afterOutsideRef,
    beforeInsideRef,
    afterInsideRef,
    portalNode,
    setFocusManagerState,
  };

  // Spread so the attribute stays on the element: `role` on a lowercase intrinsic
  // trips the reze-lsp UNKNOWN_ATTRIBUTE false positive (see MeterRootElement).
  const ownerRoleProps = portalOwnerRole === undefined ? ({} as const) : ({ role: portalOwnerRole } as const);

  const Tag = dynamicElement<JSX.ElementType>(() => as ?? "div");

  // `as` is resolved once: the default path renders a static `<div>` so the
  // portal node is never recreated; only a customized `as` keeps the dynamic
  // tag. Keep both branches in sync.
  function portalNodeElement(): JSX.Element {
    if (props.as == null) {
      return (
        <div
          {...(rest as Record<string, unknown>)}
          id={portalNodeId()}
          {...{ [attr]: "" }}
          class={resolveClassValue(props.class, {})}
          style={resolveStyleValue(props.style, {})}
          ref={refProp}
        />
      );
    }

    return (
      <Tag
        {...(rest as Record<string, unknown>)}
        id={portalNodeId()}
        {...{ [attr]: "" }}
        class={resolveClassValue(props.class, {})}
        style={resolveStyleValue(props.style, {})}
        ref={refProp}
      />
    );
  }

  return (
    <>
      {containerElement() && <Portal mount={containerElement() as unknown as Element | undefined}>{portalNodeElement()}</Portal>}
      <PortalContext value={portalContextValue}>
        {shouldRenderGuards() && portalNode() && (
          <PortalFocusGuard
            ref={(element) => {
              beforeOutsideRef.current = element;
            }}
            onFocus={(event) => {
              const node = portalNode();
              if (node && isOutsideEvent(event, node)) {
                beforeInsideRef.current?.focus();
              } else {
                const domReference = focusManagerState() ? focusManagerState()!.domReference : null;
                const prevTabbable = getPreviousTabbable(domReference);
                prevTabbable?.focus();
              }
            }}
          />
        )}
        {shouldRenderGuards() && portalNode() && <span {...ownerRoleProps} aria-owns={portalNodeId()} style={visuallyHidden} />}
        {portalNode() && (
          <Portal mount={portalNode() as unknown as Element | undefined}>{resolveChildrenValue(props.children, () => ({}))}</Portal>
        )}
        {shouldRenderGuards() && portalNode() && (
          <PortalFocusGuard
            ref={(element) => {
              afterOutsideRef.current = element;
            }}
            onFocus={(event) => {
              const node = portalNode();
              if (node && isOutsideEvent(event, node)) {
                afterInsideRef.current?.focus();
              } else {
                const domReference = focusManagerState() ? focusManagerState()!.domReference : null;
                const nextTabbable = getNextTabbable(domReference);
                nextTabbable?.focus();

                if (focusManagerState()?.closeOnFocusOut) {
                  focusManagerState()?.onOpenChange(false, createChangeEventDetails(REASONS.focusOut, event as FocusEvent));
                }
              }
            }}
          />
        )}
      </PortalContext>
    </>
  );
}

export interface FloatingPortalState {}

export interface FloatingPortalOwnProps {
  /**
   * A parent element to render the portal element into.
   */
  container?: FloatingPortalContainer | undefined;
  /**
   * @ignore
   * The role for the hidden `aria-owns` owner element.
   */
  portalOwnerRole?: JSX.IntrinsicElements["span"]["role"] | undefined;
  children?: JSX.Element | undefined;
}

export type FloatingPortalProps<T extends JSX.ElementType = "div"> = FloatingPortalOwnProps &
  RebaseUIComponentProps<T, FloatingPortalState>;

export namespace FloatingPortal {
  export type State = FloatingPortalState;
  export type Props<T extends JSX.ElementType = "div"> = FloatingPortalProps<T>;
  export type OwnProps = FloatingPortalOwnProps;
}
