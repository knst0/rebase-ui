import { omitProps, Portal, store as createStore, type JSX } from "reze-js";

import { CompositeRoot } from "../../internals/composite";
import { FloatingNode } from "../../internals/floating/tree/FloatingTree";
import { contains, getTarget } from "../../internals/floating/utils/element";
import { inPlace } from "../../internals/inPlace";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuItemContext } from "../item/NavigationMenuItemContext";
import { useNavigationMenuRootContext, useNavigationMenuTreeContext } from "../root/NavigationMenuRootContext";
import { watch } from "../utils/watch";

/**
 * A container for the content of the navigation menu item that is moved into the popup
 * when the item is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuContent<T extends JSX.ElementType = "div">(props: NavigationMenuContent.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted", "class", "style", "children", "ref", "onFocusIn", "onFocusOut");

  const keepMounted = props.keepMounted ?? false;

  const root = useNavigationMenuRootContext();
  const item = useNavigationMenuItemContext();
  const nodeId = useNavigationMenuTreeContext();

  const open = () => root.mounted() && root.value() === item.value();

  const local = createStore({
    element: null as HTMLElement | null,
    focusInside: false,
    hasMountedInPortal: false,
    mounted: false,
    transitionStatus: undefined as TransitionStatus,
  });
  const mounted = () => local.mounted;
  const transitionStatus = () => local.transitionStatus;
  const setMounted = (value: boolean) => {
    local.mounted = value;
  };

  createTransitionStatus({
    open,
    mounted,
    transitionStatus,
    setMounted,
    setTransitionStatus: (status) => {
      local.transitionStatus = status;
    },
  });

  // If the popup unmounts before the content's exit animation completes, reset the internal
  // mounted state so the next open can re-enter via `transitionStatus="starting"`.
  watch(
    () => mounted() && !root.mounted(),
    (stale) => {
      if (stale) {
        setMounted(false);
      }
    },
  );

  runOnOpenChangeComplete({
    ref: () => local.element,
    open,
    onComplete() {
      if (!open()) {
        setMounted(false);
      }
    },
  });

  // Only the active content can own the shared sizing observer target. Inactive `keepMounted`
  // content also mounts in the viewport, and re-entering content keeps its DOM element.
  watch(
    () => ({ isOpen: open(), node: local.element }),
    ({ isOpen, node }) => {
      if (isOpen && node) {
        root.setCurrentContent(node);
      }
    },
  );

  const portalContainer = () => root.viewportTargetElement() || root.viewportElement();

  watch(portalContainer, (container) => {
    if (keepMounted && container) {
      local.hasMountedInPortal = true;
    }
  });

  function snapshot(): NavigationMenuContentState {
    return { open: open(), transitionStatus: transitionStatus(), activationDirection: root.activationDirection() };
  }

  const attrs = {
    get "data-open"() {
      return open() ? "" : undefined;
    },
    get "data-closed"() {
      return open() ? undefined : "";
    },
    get "data-starting-style"() {
      return transitionStatus() === "starting" ? "" : undefined;
    },
    get "data-ending-style"() {
      return transitionStatus() === "ending" ? "" : undefined;
    },
    get "data-activation-direction"() {
      return root.activationDirection() ?? undefined;
    },
    get class() {
      return resolveClassValue(props.class as never, snapshot()) as string | undefined;
    },
  };

  function handleFocusIn(event: FocusEvent) {
    (props.onFocusIn as ((event: FocusEvent) => void) | undefined)?.(event);
    const target = getTarget(event) as Element | null;
    if (!target?.hasAttribute("data-base-ui-focus-guard")) {
      local.focusInside = true;
    }
  }

  function handleFocusOut(event: FocusEvent) {
    (props.onFocusOut as ((event: FocusEvent) => void) | undefined)?.(event);
    if (!contains(local.element, event.relatedTarget as Element | null)) {
      local.focusInside = false;
    }
  }

  const ref = mergeRefs<HTMLElement>(props.ref as ((element: HTMLElement | null) => void) | undefined, (element) => {
    local.element = element;
  });

  const shouldRenderInline = () => keepMounted && !portalContainer() && !local.hasMountedInPortal;
  const portalTarget = () => (!shouldRenderInline() && portalContainer() && (mounted() || keepMounted) ? portalContainer() : null);

  return (
    <>
      {shouldRenderInline() &&
        inPlace(
          <CompositeRoot
            as={(props.as ?? "div") as "div"}
            {...(rest as Record<string, unknown>)}
            {...attrs}
            hidden
            style={resolveStyleValue(props.style as never, snapshot())}
          >
            {resolveChildrenValue(props.children as never, snapshot)}
          </CompositeRoot>,
        )}
      {portalTarget() && (
        <Portal mount={portalTarget() as HTMLElement}>
          <FloatingNode id={nodeId as string}>
            {inPlace(
              <CompositeRoot
                as={(props.as ?? "div") as "div"}
                {...(rest as Record<string, unknown>)}
                {...attrs}
                hidden={keepMounted && !mounted() ? true : undefined}
                inert={!open() && mounted() && !local.focusInside ? true : undefined}
                style={mergeStyleValue(
                  !open() && mounted() ? { position: "absolute", top: "0px", left: "0px" } : {},
                  resolveStyleValue(props.style as never, snapshot()),
                )}
                onFocusIn={handleFocusIn}
                onFocusOut={handleFocusOut}
                ref={(element: HTMLElement | null) => ref(element as HTMLElement)}
              >
                {resolveChildrenValue(props.children as never, snapshot)}
              </CompositeRoot>,
            )}
          </FloatingNode>
        </Portal>
      )}
    </>
  );
}

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

export type NavigationMenuContentProps<T extends JSX.ElementType = "div"> = NavigationMenuContentOwnProps &
  RebaseUIComponentProps<T, NavigationMenuContentState>;

export namespace NavigationMenuContent {
  export type State = NavigationMenuContentState;
  export type Props<T extends JSX.ElementType = "div"> = NavigationMenuContentProps<T>;
}
