import { isHTMLElement } from "@floating-ui/utils/dom";
import type { JSX, ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, onSettled, type Setter, untrack } from "solid-js";

import { createControllableSignal } from "../../internals/createControllableSignal";
import { createUnmountAfterClose } from "../../internals/createUnmountAfterClose";
import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { FloatingNode, FloatingTree, useFloatingNodeId, useFloatingParentNodeId } from "../../internals/floating/tree/FloatingTree";
import { activeElement, contains } from "../../internals/floating/utils/element";
import { mergeRefs } from "../../internals/mergeRefs";
import { attachPreventUnmountOnClose } from "../../internals/popups/popupStoreUtils";
import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import * as NavigationMenuPositionerCssVars from "../positioner/NavigationMenuPositionerCssVars";
import { setSharedFixedSize } from "../utils/setSharedFixedSize";
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
export function NavigationMenuRoot<Value = any, T extends ValidComponent = "nav">(props: NavigationMenuRoot.Props<Value, T>) {
  const nested = useFloatingParentNodeId() != null;
  const parentRootContext = useNavigationMenuRootContext(true);

  const [local, elementProps] = split(props as NavigationMenuRoot.Props<Value>, { default: defaultProps }, [
    "as",
    "defaultValue",
    "value",
    "onValueChange",
    "actionsRef",
    "delay",
    "closeDelay",
    "orientation",
    "onOpenChangeComplete",
  ]);

  const as = untrack(() => local.as) ?? (nested ? "div" : "nav");

  const [value, setValueUnwrapped] = createControllableSignal<Value | null>({
    value: () => local.value,
    defaultValue: () => local.defaultValue ?? null,
  });

  const open = () => value() != null;

  let closeReason: string | undefined;

  const [rootElement, setRootElement] = createSignal<HTMLElement | null>(null, { ownedWrite: true });
  const [positionerElement, setPositionerElement] = createSignal<HTMLElement | null>(null, { ownedWrite: true });
  const [popupElement, setPopupElement] = createSignal<HTMLElement | null>(null, { ownedWrite: true });
  const [viewportElement, setViewportElement] = createSignal<HTMLElement | null>(null, { ownedWrite: true });
  const [viewportTargetElement, setViewportTargetElement] = createSignal<HTMLElement | null>(null, { ownedWrite: true });
  const [currentContent, setCurrentContent] = createSignal<HTMLElement | null>(null, { ownedWrite: true });
  const [activeTrigger, setActiveTrigger] = createSignal<HTMLElement | null>(null, { ownedWrite: true });
  const [activationDirection, setActivationDirection] = createSignal<"left" | "right" | "up" | "down" | null>(null, { ownedWrite: true });
  const [viewportInert, setViewportInert] = createSignal(false, { ownedWrite: true });
  const [preventUnmountOnClose, setPreventUnmountOnClose] = createSignal(false, { ownedWrite: true });

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

      local.onOpenChangeComplete?.(false);
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

  createEffect(
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

  createEffect(value, () => {
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
      untrack(() => local.onValueChange)?.(nextValue, changeEventDetails);
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

  const actionsRef = untrack(() => local.actionsRef);
  if (actionsRef) {
    onSettled(() => {
      actionsRef({
        unmount: forceUnmount,
        close: () => setValue(null, createChangeEventDetails(REASONS.imperativeAction)),
      });

      return () => {
        actionsRef(null);
      };
    });
  }

  const state: NavigationMenuRootState = {
    get open() {
      return open();
    },
    nested,
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, setRootElement),
  });

  const content = () => (
    <NavigationMenuRootContext
      value={{
        open,
        value,
        setValue,
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
        delay: () => local.delay as number,
        closeDelay: () => local.closeDelay as number,
        orientation: () => local.orientation as "horizontal" | "vertical",
        viewportInert,
        setViewportInert,
      }}
    >
      <NavigationMenuTreeNode>
        <RenderElement as={as} state={state} props={[elementProps, refProps]} untrackChildren />
      </NavigationMenuTreeNode>
    </NavigationMenuRootContext>
  );

  return nested ? content() : <FloatingTree>{content()}</FloatingTree>;
}

function NavigationMenuTreeNode(props: { children: JSX.Element }) {
  // Must run inside `FloatingTree` so the node registers with it.
  const nodeId = useFloatingNodeId();

  return (
    <NavigationMenuTreeContext value={nodeId}>
      <FloatingNode id={nodeId}>{props.children}</FloatingNode>
    </NavigationMenuTreeContext>
  );
}

const defaultProps = Object.freeze({
  delay: 50,
  closeDelay: 50,
  orientation: "horizontal",
} satisfies Partial<NavigationMenuRoot.Props>);

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
  actionsRef?: Setter<NavigationMenuRootActions | null> | ((actions: NavigationMenuRootActions | null) => void) | undefined;
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

export type NavigationMenuRootProps<Value = any, T extends ValidComponent = "nav"> = NavigationMenuRootOwnProps<Value> &
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
  export type Props<Value = any, T extends ValidComponent = "nav"> = NavigationMenuRootProps<Value, T>;
  export type Value<TValue = any> = TValue | null;
  export type Actions = NavigationMenuRootActions;
  export type ChangeEventReason = NavigationMenuRootChangeEventReason;
  export type ChangeEventDetails = NavigationMenuRootChangeEventDetails;
}
