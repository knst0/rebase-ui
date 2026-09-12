import { Portal, type JSX, type ValidComponent } from "@solidjs/web";
import { type Accessor, createContext, createEffect, createMemo, createSignal, createUniqueId, untrack, useContext } from "solid-js";

import { createChangeEventDetails } from "../../event-details/createEventDetails";
import { REASONS } from "../../event-details/reasons";
import { mergeRefs } from "../../mergeRefs";
import { RenderElement } from "../../render-element";
import { split } from "../../split";
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
  portalNode: Accessor<HTMLElement | null>;
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
  node: Accessor<HTMLElement | null>;
  /**
   * The `id` attribute of the portal node, reflecting an overriding `id`
   * prop when one is provided so `aria-owns` never points at an ID absent
   * from the DOM.
   */
  nodeId: Accessor<string | undefined>;
  containerElement: Accessor<HTMLElement | ShadowRoot | null>;
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
  const uniqueId = createUniqueId();
  const portalContext = usePortalContext();

  const [containerElement, setContainerElement] = createSignal<HTMLElement | ShadowRoot | null>(null);
  const [portalNode, setPortalNode] = createSignal<HTMLElement | null>(null);

  let containerRef: HTMLElement | ShadowRoot | null = null;

  createEffect(
    () => ({
      container: props.container,
      parentPortalNode: portalContext?.portalNode() ?? null,
    }),
    ({ container, parentPortalNode }) => {
      // Wait for the container to be resolved if explicitly `null`.
      const resolved = resolveContainer(container, parentPortalNode);

      if (resolved == null) {
        if (containerRef) {
          containerRef = null;
          setPortalNode(null);
          setContainerElement(null);
        }
        return;
      }

      if (containerRef !== resolved) {
        containerRef = resolved;
        setPortalNode(null);
        setContainerElement(resolved);
      }
    },
  );

  return {
    node: portalNode,
    // An `id` prop can override or remove the generated ID. Use the exact
    // rendered value so `aria-owns` never points at an ID absent from the DOM.
    nodeId: () => props.id ?? uniqueId,
    containerElement,
    setPortalNode,
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
 * while retaining its location in the Solid tree.
 * @see https://floating-ui.com/docs/FloatingPortal
 * @internal
 */
export function FloatingPortal<T extends ValidComponent = "div">(props: FloatingPortal.Props<T>) {
  const [local, elementProps] = split(props as FloatingPortal.Props<"div">, { default: defaultProps }, [
    "as",
    "container",
    "portalOwnerRole",
  ]);

  const as = untrack(() => local.as);
  const container = untrack(() => local.container);
  const portalOwnerRole = untrack(() => local.portalOwnerRole);
  const portalElementId = untrack(() => (elementProps as { id?: string | undefined }).id);

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

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLDivElement>(externalProps.ref, setPortalNodeRef),
  });

  const beforeOutsideRef: { current: HTMLSpanElement | null } = { current: null };
  const afterOutsideRef: { current: HTMLSpanElement | null } = { current: null };
  const beforeInsideRef: { current: HTMLSpanElement | null } = { current: null };
  const afterInsideRef: { current: HTMLSpanElement | null } = { current: null };

  const [focusManagerState, setFocusManagerState] = createSignal<FocusManagerState>(null);
  let focusInsideDisabled = false;

  const modal = () => focusManagerState()?.modal;
  const open = () => focusManagerState()?.open;

  const shouldRenderGuards = createMemo(
    () => !!focusManagerState() && !focusManagerState()!.modal && focusManagerState()!.open && !!portalNode(),
  );

  // https://codesandbox.io/s/tabbable-portal-f4tng?file=/src/TabbablePortal.tsx
  createEffect(
    () => ({ node: portalNode(), modal: modal() }),
    ({ node, modal: isModal }) => {
      if (!node || isModal) {
        return undefined;
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
      return () => {
        node.removeEventListener("focusin", onFocus, true);
        node.removeEventListener("focusout", onFocus, true);
      };
    },
  );

  createEffect(
    () => ({ node: portalNode(), open: open() }),
    ({ node, open: isOpen }) => {
      if (!node || isOpen !== true || !focusInsideDisabled) {
        return;
      }

      // Restore tabbability before the focus manager's queued focus-on-open step runs.
      enableFocusInside(node);
      focusInsideDisabled = false;
    },
  );

  const portalContextValue: FloatingPortalContextValue = {
    beforeOutsideRef,
    afterOutsideRef,
    beforeInsideRef,
    afterInsideRef,
    portalNode,
    setFocusManagerState,
  };

  const portalId = createMemo(() => portalNodeId());

  return (
    <>
      {containerElement() && (
        <Portal mount={containerElement() as unknown as Element | undefined}>
          <RenderElement
            as={as}
            props={[
              {
                id: portalId(),
                [attr]: "",
              },
              elementProps,
              refProps,
            ]}
          />
        </Portal>
      )}
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
        {shouldRenderGuards() && portalNode() && <span role={portalOwnerRole} aria-owns={portalNodeId()} style={visuallyHidden} />}
        {portalNode() && <Portal mount={portalNode() as unknown as Element | undefined}>{props.children}</Portal>}
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

export type FloatingPortalProps<T extends ValidComponent = "div"> = FloatingPortalOwnProps & RebaseUIComponentProps<T, FloatingPortalState>;

export namespace FloatingPortal {
  export type State = FloatingPortalState;
  export type Props<T extends ValidComponent = "div"> = FloatingPortalProps<T>;
  export type OwnProps = FloatingPortalOwnProps;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<FloatingPortal.Props>);
