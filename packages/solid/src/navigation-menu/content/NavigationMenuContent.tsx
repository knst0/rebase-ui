import { Portal, type ValidComponent } from "@solidjs/web";
import { createEffect, createMemo, createSignal, Show, untrack } from "solid-js";

import { CompositeRoot } from "../../internals/composite";
import { FloatingNode } from "../../internals/floating/tree/FloatingTree";
import { contains, getTarget } from "../../internals/floating/utils/element";
import { mergeRefs } from "../../internals/mergeRefs";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { createTransitionStatus, transitionStatusMapping, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuItemContext } from "../item/NavigationMenuItemContext";
import { useNavigationMenuRootContext, useNavigationMenuTreeContext } from "../root/NavigationMenuRootContext";
import { popupStateMapping } from "../utils/stateAttributesMapping";
import * as NavigationMenuContentDataAttributes from "./NavigationMenuContentDataAttributes";

const stateAttributesMapping = {
  open: popupStateMapping.open,
  ...transitionStatusMapping,
  activationDirection: {
    keys: [NavigationMenuContentDataAttributes.activationDirection],
    map: (value) => (value ? { [NavigationMenuContentDataAttributes.activationDirection]: value } : null),
  },
} satisfies StateAttributesMapping<NavigationMenuContentState>;

/**
 * A container for the content of the navigation menu item that is moved into the popup
 * when the item is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuContent<T extends ValidComponent = "div">(props: NavigationMenuContent.Props<T>) {
  const [local, elementProps] = split(props as NavigationMenuContent.Props, { default: defaultProps }, ["as", "keepMounted"]);

  const as = untrack(() => local.as);
  const keepMounted = untrack(() => local.keepMounted) as boolean;

  const root = useNavigationMenuRootContext();
  const item = useNavigationMenuItemContext();
  const nodeId = useNavigationMenuTreeContext();

  const open = createMemo(() => root.mounted() && root.value() === item.value());

  const [element, setElement] = createSignal<HTMLElement | null>(null, { ownedWrite: true });
  const [focusInside, setFocusInside] = createSignal(false, { ownedWrite: true });
  const [hasMountedInPortal, setHasMountedInPortal] = createSignal(false, { ownedWrite: true });

  const { mounted, setMounted, transitionStatus } = createTransitionStatus(open);

  // If the popup unmounts before the content's exit animation completes, reset the internal
  // mounted state so the next open can re-enter via `transitionStatus="starting"`.
  createEffect(
    () => mounted() && !root.mounted(),
    (stale) => {
      if (stale) {
        setMounted(false);
      }
    },
  );

  runOnOpenChangeComplete({
    ref: element,
    open,
    onComplete() {
      if (!untrack(open)) {
        setMounted(false);
      }
    },
  });

  // Only the active content can own the shared sizing observer target. Inactive `keepMounted`
  // content also mounts in the viewport, and re-entering content keeps its DOM element.
  createEffect(
    () => ({ isOpen: open(), node: element() }),
    ({ isOpen, node }) => {
      if (isOpen && node) {
        root.setCurrentContent(node);
      }
    },
  );

  const portalContainer = createMemo(() => root.viewportTargetElement() || root.viewportElement());

  createEffect(portalContainer, (container) => {
    if (keepMounted && container) {
      setHasMountedInPortal(true);
    }
  });

  const state: NavigationMenuContentState = {
    get open() {
      return open();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get activationDirection() {
      return root.activationDirection();
    },
  };

  const contentProps = {
    get style() {
      return !open() && mounted() ? { position: "absolute" as const, top: "0px", left: "0px" } : undefined;
    },
    get inert() {
      return !open() && mounted() && !focusInside() ? true : undefined;
    },
    get hidden() {
      return keepMounted && !mounted() ? true : undefined;
    },
  };

  const interactionProps = (externalProps: Record<string, any>) => ({
    // Focus events must bubble from the content's descendants.
    onFocusIn(event: FocusEvent) {
      externalProps.onFocusIn?.(event);
      const target = getTarget(event) as Element | null;
      if (!target?.hasAttribute("data-base-ui-focus-guard")) {
        setFocusInside(true);
      }
    },
    onFocusOut(event: FocusEvent) {
      externalProps.onFocusOut?.(event);
      if (!contains(untrack(element), event.relatedTarget as Element | null)) {
        setFocusInside(false);
      }
    },
    ref: mergeRefs<HTMLElement>(externalProps.ref, setElement),
  });

  const shouldRenderInline = () => keepMounted && !portalContainer() && !hasMountedInPortal();
  const portalTarget = () => (portalContainer() && (mounted() || keepMounted) ? portalContainer() : null);

  return (
    <Show
      when={!shouldRenderInline()}
      fallback={
        <CompositeRoot as={as} state={state} props={[{ hidden: true }, elementProps]} stateAttributesMapping={stateAttributesMapping} />
      }
    >
      <Show when={portalTarget()} keyed>
        {(target) => (
          <Portal mount={target as HTMLElement}>
            <FloatingNode id={nodeId}>
              <CompositeRoot
                as={as}
                state={state}
                props={[contentProps, elementProps, interactionProps]}
                stateAttributesMapping={stateAttributesMapping}
                untrackChildren
              />
            </FloatingNode>
          </Portal>
        )}
      </Show>
    </Show>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  keepMounted: false,
} satisfies Partial<NavigationMenuContent.Props>);

export interface NavigationMenuContentState {
  /**
   * If `true`, the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * The direction of the activation.
   */
  activationDirection: "left" | "right" | "up" | "down" | null;
}

export interface NavigationMenuContentOwnProps {
  /**
   * Whether to keep the content mounted in the DOM while the popup is closed.
   * Ensures the content is present during server-side rendering for web crawlers.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type NavigationMenuContentProps<T extends ValidComponent = "div"> = NavigationMenuContentOwnProps &
  RebaseUIComponentProps<T, NavigationMenuContentState>;

export namespace NavigationMenuContent {
  export type State = NavigationMenuContentState;
  export type Props<T extends ValidComponent = "div"> = NavigationMenuContentProps<T>;
}
