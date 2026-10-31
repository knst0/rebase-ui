import { createUniqueId, dynamicElement, omitProps, untrack, type JSX } from "reze-js";

import { contains } from "../../internals/floating/utils/element";
import { getNextTabbable, getPreviousTabbable, isOutsideEvent } from "../../internals/floating/utils/tabbable";
import { FocusGuard } from "../../internals/focus-guard/FocusGuard";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuPositionerContext } from "../positioner/NavigationMenuPositionerContext";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";
import { inPlace } from "../utils/inPlace";

function Guards(props: { hasPositioner: boolean; children?: JSX.Element }) {
  const root = useNavigationMenuRootContext();

  const reference = () => untrack(root.positionerElement) || untrack(root.viewportElement);

  return (
    <>
      {(root.activeTrigger() != null || props.hasPositioner) && (
        <FocusGuard
          guardRef={root.beforeInsideRef}
          onFocus={(event) => {
            const element = reference();
            if (element && isOutsideEvent(event, element)) {
              (getNextTabbable(element) as HTMLElement | null)?.focus();
            } else {
              root.beforeOutsideRef.current?.focus();
            }
          }}
        />
      )}
      {props.children}
      {(root.activeTrigger() != null || props.hasPositioner) && (
        <FocusGuard
          guardRef={root.afterInsideRef}
          onFocus={(event) => {
            const element = reference();
            if (element && isOutsideEvent(event, element)) {
              (getPreviousTabbable(element) as HTMLElement | null)?.focus();
            } else {
              root.afterOutsideRef.current?.focus();
            }
          }}
        />
      )}
    </>
  );
}

/**
 * The clipping viewport of the navigation menu's current content.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuViewport<T extends JSX.ElementType = "div">(props: NavigationMenuViewport.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref", "onFocusOut");
  const generatedId = createUniqueId();

  const root = useNavigationMenuRootContext();
  const hasPositioner = useNavigationMenuPositionerContext(true) != null;

  // Focus events must bubble from the viewport's descendants.
  function handleFocusOut(event: FocusEvent) {
    (props.onFocusOut as ((event: FocusEvent) => void) | undefined)?.(event);
    const relatedTarget = event.relatedTarget as Element | null;

    // If focus is leaving the viewport and not going to the trigger, make it inert
    // to prevent a focus loop.
    if (relatedTarget && !contains(root.viewportElement(), relatedTarget) && relatedTarget !== root.activeTrigger()) {
      root.setViewportInert(true);
    }
  }

  const ref = mergeRefs<HTMLElement>(props.ref as ((element: HTMLElement | null) => void) | undefined, root.setViewportElement);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  const element = inPlace(
    <Tag
      {...(rest as Record<string, unknown>)}
      id={generatedId}
      inert={!hasPositioner && root.viewportInert() ? true : undefined}
      class={resolveClassValue(props.class as never, {})}
      style={resolveStyleValue(props.style as never, {})}
      onFocusOut={handleFocusOut}
      ref={(node: HTMLElement | null) => ref(node as HTMLElement)}
    >
      {hasPositioner ? (
        resolveChildrenValue(props.children as never, () => ({}))
      ) : (
        <Guards hasPositioner={false}>
          <div ref={(node) => root.setViewportTargetElement(node)}>{resolveChildrenValue(props.children as never, () => ({}))}</div>
        </Guards>
      )}
    </Tag>,
  );

  return hasPositioner ? <Guards hasPositioner>{element}</Guards> : element;
}

export interface NavigationMenuViewportState {}

export type NavigationMenuViewportProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, NavigationMenuViewportState>;

export namespace NavigationMenuViewport {
  export type State = NavigationMenuViewportState;
  export type Props<T extends JSX.ElementType = "div"> = NavigationMenuViewportProps<T>;
}
