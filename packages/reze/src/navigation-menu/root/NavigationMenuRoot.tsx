import { isHTMLElement } from "@floating-ui/utils/dom";
import { dynamicElement, omitProps, onCleanup, store as createStore, untrack, type JSX } from "reze-js";

import { createControllableSignal } from "../../internals/createControllableSignal";
import { createUnmountAfterClose } from "../../internals/createUnmountAfterClose";
import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { FloatingNode, FloatingTree, useFloatingNodeId, useFloatingParentNodeId } from "../../internals/floating/tree/FloatingTree";
import { activeElement, contains } from "../../internals/floating/utils/element";
import { mergeRefs } from "../../internals/mergeRefs";
import { attachPreventUnmountOnClose } from "../../internals/popups/popupStoreUtils";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import type { RebaseUIComponentProps } from "../../internals/types";
import * as NavigationMenuPositionerCssVars from "../positioner/NavigationMenuPositionerCssVars";
import { inPlace } from "../utils/inPlace";
import { ResolvedChildren } from "../utils/ResolvedChildren";
import { setSharedFixedSize } from "../utils/setSharedFixedSize";
import { watch } from "../utils/watch";
import {
  NavigationMenuRootContext,
  NavigationMenuTreeContext,
  useNavigationMenuRootContext,
  type NavigationMenuPopupAutoSizeResetState,
} from "./NavigationMenuRootContext";

const blockedReturnFocusReasons = new Set<string>([REASONS.triggerHover, REASONS.outsidePress, REASONS.focusOut]);

function getPositionerFixedSize(positionerElement: HTMLElement) {
  // Read the last fixed positioner size rather than measuring the popup now:
  // during a controlled close, the popup can already be in its exit render and
  // report 0 before the closing transition gets a stable size to animate from.
  const width = parseFloat(positionerElement.style.getPropertyValue(NavigationMenuPositionerCssVars.positionerWidth)) || 0;
  const height = parseFloat(positionerElement.style.getPropertyValue(NavigationMenuPositionerCssVars.positionerHeight)) || 0;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

/**
 * Groups all parts of the navigation menu.
 * Renders a `<nav>` element at the root, or `<div>` element when nested.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuRoot<Value = any, T extends JSX.ElementType = "nav">(props: NavigationMenuRoot.Props<Value, T>) {
  const rest = omitProps(
    props,
    "as",
    "defaultValue",
    "value",
    "onValueChange",
    "actionsRef",
    "delay",
    "closeDelay",
    "orientation",
    "onOpenChangeComplete",
    "class",
    "style",
    "children",
    "ref",
  );

  const nested = useFloatingParentNodeId() != null;
  const parentRootContext = useNavigationMenuRootContext(true);

  const [value, setValueUnwrapped] = createControllableSignal<Value | null>({
    value: () => props.value as Value | null | undefined,
    defaultValue: () => (props.defaultValue ?? null) as Value | null,
  });

  const open = () => value() != null;

  const local = createStore({
    rootElement: null as HTMLElement | null,
    positionerElement: null as HTMLElement | null,
    popupElement: null as HTMLElement | null,
    viewportElement: null as HTMLElement | null,
    viewportTargetElement: null as HTMLElement | null,
    currentContent: null as HTMLElement | null,
    activeTrigger: null as HTMLElement | null,
    activationDirection: null as "left" | "right" | "up" | "down" | null,
    viewportInert: false,
    preventUnmountOnClose: false,
  });
  const rootElement = () => local.rootElement;
  const setRootElement = (element: HTMLElement | null) => {
    local.rootElement = element;
  };
  const positionerElement = () => local.positionerElement;
  const setPositionerElement = (element: HTMLElement | null) => {
    local.positionerElement = element;
  };
  const popupElement = () => local.popupElement;
  const setPopupElement = (element: HTMLElement | null) => {
    local.popupElement = element;
  };
  const viewportElement = () => local.viewportElement;
  const setViewportElement = (element: HTMLElement | null) => {
    local.viewportElement = element;
  };
  const viewportTargetElement = () => local.viewportTargetElement;
  const setViewportTargetElement = (element: HTMLElement | null) => {
    local.viewportTargetElement = element;
  };
  const currentContent = () => local.currentContent;
  const setCurrentContent = (element: HTMLElement | null) => {
    local.currentContent = element;
  };
  const activeTrigger = () => local.activeTrigger;
  const setActiveTrigger = (element: HTMLElement | null) => {
    local.activeTrigger = element;
  };
  const activationDirection = () => local.activationDirection;
  const setActivationDirection = (direction: "left" | "right" | "up" | "down" | null) => {
    local.activationDirection = direction;
  };
  const viewportInert = () => local.viewportInert;
  const setViewportInert = (inert: boolean) => {
    local.viewportInert = inert;
  };
  const preventUnmountOnClose = () => local.preventUnmountOnClose;
  const setPreventUnmountOnClose = (prevent: boolean) => {
    local.preventUnmountOnClose = prevent;
  };

  let closeReason: string | undefined;

  const prevTriggerElementRef: { current: Element | null | undefined } = { current: null };
  const popupAutoSizeResetRef: { current: NavigationMenuPopupAutoSizeResetState } = { current: { abortController: null, owner: null } };

  const { mounted, transitionStatus, forceUnmount } = createUnmountAfterClose({
    open,
    ref: popupElement,
    preventUnmountOnClose,
    setPreventUnmountOnClose,
    onUnmount() {
      const popup = popupElement();
      const doc = (rootElement() ?? popup)?.ownerDocument ?? document;
      const activeEl = activeElement(doc);
      const isReturnFocusBlocked = closeReason ? blockedReturnFocusReasons.has(closeReason) : false;

      if (
        !isReturnFocusBlocked &&
        isHTMLElement(prevTriggerElementRef.current) &&
        popup &&
        (activeEl === doc.body || contains(popup, activeEl))
      ) {
        prevTriggerElementRef.current.focus({ preventScroll: true });
        prevTriggerElementRef.current = undefined;
      }

      props.onOpenChangeComplete?.(false);
      setActivationDirection(null);
      setActiveTrigger(null);
      setCurrentContent(null);
      closeReason = undefined;
    },
  });

  // The viewport target may be the animated element instead of the popup.
  runOnOpenChangeComplete({
    enabled: () => mounted() && !open() && !preventUnmountOnClose(),
    open,
    ref: viewportTargetElement,
    onComplete() {
      if (!untrack(open)) {
        forceUnmount();
      }
    },
  });

  watch(
    () => ({ isOpen: open(), popup: popupElement(), positioner: positionerElement() }),
    ({ isOpen, popup, positioner }) => {
      if (isOpen || !popup || !positioner) {
        return;
      }

      const closeTransitionSize = getPositionerFixedSize(positioner);

      if (closeTransitionSize) {
        // No cleanup is needed for this fixed size: if the popup unmounts, the inline
        // styles are removed with it. If it stays mounted, reopening runs the trigger's
        // sizing logic which clears these vars.
        setSharedFixedSize(popup, positioner, closeTransitionSize.width, closeTransitionSize.height);
      }
    },
  );

  watch(value, () => {
    setViewportInert(false);
  });

  function setValue(nextValue: Value | null, eventDetails: RebaseUIChangeEventDetails<NavigationMenuRoot.ChangeEventReason>) {
    const current = untrack(value);

    if (nextValue == null) {
      closeReason = eventDetails.reason;
    }

    const changeEventDetails = eventDetails as NavigationMenuRoot.ChangeEventDetails;
    const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(changeEventDetails);

    if (nextValue !== current) {
      untrack(() => props.onValueChange)?.(nextValue, changeEventDetails);
    }

    if (eventDetails.isCanceled) {
      return;
    }

    if (nextValue == null) {
      // A redundant close (for example the trigger's blur after an imperative close) skips
      // `onValueChange`, so it can't opt out again and must not discard the recorded opt-out.
      if (current != null) {
        setPreventUnmountOnClose(shouldPreventUnmountOnClose());
      }
      setActivationDirection(null);
    }

    setValueUnwrapped(nextValue);

    if (nested && nextValue == null && eventDetails.reason === REASONS.linkPress && parentRootContext) {
      parentRootContext.setValue(null, eventDetails);
    }
  }

  const actionsRef = props.actionsRef;
  if (actionsRef) {
    actionsRef({
      unmount: forceUnmount,
      close: () => setValue(null, createChangeEventDetails(REASONS.imperativeAction)),
    });
    onCleanup(() => actionsRef(null));
  }

  function snapshot(): NavigationMenuRootState {
    return { open: open(), nested };
  }

  const contextValue: NavigationMenuRootContext = {
    open,
    value,
    setValue: setValue as NavigationMenuRootContext["setValue"],
    mounted,
    transitionStatus,
    positionerElement,
    setPositionerElement,
    popupElement,
    setPopupElement,
    viewportElement,
    setViewportElement,
    viewportTargetElement,
    setViewportTargetElement,
    activationDirection: () => (open() ? activationDirection() : null),
    setActivationDirection,
    activeTrigger,
    setActiveTrigger,
    currentContent,
    setCurrentContent,
    nested,
    rootElement,
    beforeInsideRef: { current: null },
    afterInsideRef: { current: null },
    beforeOutsideRef: { current: null },
    afterOutsideRef: { current: null },
    prevTriggerElementRef,
    popupAutoSizeResetRef,
    delay: () => props.delay ?? 50,
    closeDelay: () => props.closeDelay ?? 50,
    orientation: () => props.orientation ?? "horizontal",
    viewportInert,
    setViewportInert,
  };

  const attrs = {
    get class() {
      return resolveClassValue(props.class as never, snapshot());
    },
    get style() {
      return resolveStyleValue(props.style as never, snapshot());
    },
  };

  const ref = mergeRefs<HTMLElement>(props.ref as ((element: HTMLElement | null) => void) | undefined, setRootElement);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as as JSX.ElementType);

  // `as` is resolved once: a dynamic element re-creates its DOM node when a sibling mounts.
  // The providers live inside the tag: context does not flow through dynamicElement. Keep the branches in sync.
  if (props.as == null) {
    return nested ? (
      <div {...(rest as Record<string, unknown>)} {...attrs} ref={ref}>
        <NavigationMenuRootContext value={contextValue}>
          <NavigationMenuTreeNode snapshot={snapshot}>{props.children}</NavigationMenuTreeNode>
        </NavigationMenuRootContext>
      </div>
    ) : (
      <nav {...(rest as Record<string, unknown>)} {...attrs} ref={ref}>
        <NavigationMenuRootContext value={contextValue}>
          <FloatingTree>
            <NavigationMenuTreeNode snapshot={snapshot}>{props.children}</NavigationMenuTreeNode>
          </FloatingTree>
        </NavigationMenuRootContext>
      </nav>
    );
  }

  return inPlace(
    <Tag {...(rest as Record<string, unknown>)} {...attrs} ref={ref}>
      <NavigationMenuRootContext value={contextValue}>
        {nested ? (
          <NavigationMenuTreeNode snapshot={snapshot}>{props.children}</NavigationMenuTreeNode>
        ) : (
          <FloatingTree>
            <NavigationMenuTreeNode snapshot={snapshot}>{props.children}</NavigationMenuTreeNode>
          </FloatingTree>
        )}
      </NavigationMenuRootContext>
    </Tag>,
  );
}

function NavigationMenuTreeNode(props: { snapshot: () => NavigationMenuRootState; children?: unknown }) {
  // Must run inside `FloatingTree` so the node registers with it.
  const nodeId = useFloatingNodeId();

  return (
    <NavigationMenuTreeContext value={nodeId}>
      <FloatingNode id={nodeId}>
        <ResolvedChildren snapshot={props.snapshot}>{props.children}</ResolvedChildren>
      </FloatingNode>
    </NavigationMenuTreeContext>
  );
}

export interface NavigationMenuRootState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * Whether the navigation menu is nested.
   */
  nested: boolean;
}

export interface NavigationMenuRootActions {
  unmount: () => void;
  close: () => void;
}

export interface NavigationMenuRootOwnProps<Value = any> {
  /**
   * A setter receiving the imperative actions of the navigation menu.
   */
  actionsRef?: ((actions: NavigationMenuRootActions | null) => void) | undefined;
  /**
   * Event handler called after any animations complete when the navigation menu is closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * The controlled value of the navigation menu item that should be currently open.
   * When non-nullish, the menu will be open. When nullish, the menu will be closed.
   *
   * To render an uncontrolled navigation menu, use the `defaultValue` prop instead.
   * @default null
   */
  value?: Value | null | undefined;
  /**
   * The uncontrolled value of the item that should be initially selected.
   *
   * To render a controlled navigation menu, use the `value` prop instead.
   * @default null
   */
  defaultValue?: Value | null | undefined;
  /**
   * Callback fired when the value changes.
   */
  onValueChange?: ((value: Value | null, eventDetails: NavigationMenuRootChangeEventDetails) => void) | undefined;
  /**
   * How long to wait before opening the navigation popup. Specified in milliseconds.
   * @default 50
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the navigation popup. Specified in milliseconds.
   * @default 50
   */
  closeDelay?: number | undefined;
  /**
   * The orientation of the navigation menu.
   * @default 'horizontal'
   */
  orientation?: "horizontal" | "vertical" | undefined;
}

export type NavigationMenuRootProps<Value = any, T extends JSX.ElementType = "nav"> = NavigationMenuRootOwnProps<Value> &
  Omit<RebaseUIComponentProps<T, NavigationMenuRootState>, "value" | "defaultValue">;

export type NavigationMenuRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.triggerHover
  | typeof REASONS.outsidePress
  | typeof REASONS.listNavigation
  | typeof REASONS.focusOut
  | typeof REASONS.escapeKey
  | typeof REASONS.linkPress
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type NavigationMenuRootChangeEventDetails = RebaseUIChangeEventDetails<NavigationMenuRootChangeEventReason> & {
  /** Prevents the popup from unmounting until the `unmount` action is called. */
  preventUnmountOnClose: () => void;
};

export namespace NavigationMenuRoot {
  export type State = NavigationMenuRootState;
  export type Props<Value = any, T extends JSX.ElementType = "nav"> = NavigationMenuRootProps<Value, T>;
  export type Value<TValue = any> = TValue | null;
  export type Actions = NavigationMenuRootActions;
  export type ChangeEventReason = NavigationMenuRootChangeEventReason;
  export type ChangeEventDetails = NavigationMenuRootChangeEventDetails;
}
