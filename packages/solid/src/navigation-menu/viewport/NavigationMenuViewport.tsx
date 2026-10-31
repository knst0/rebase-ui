import type { JSX, ValidComponent } from "@solidjs/web";
import { createUniqueId, Show, untrack } from "solid-js";

import { contains } from "../../internals/floating/utils/element";
import { getNextTabbable, getPreviousTabbable, isOutsideEvent } from "../../internals/floating/utils/tabbable";
import { FocusGuard } from "../../internals/focus-guard/FocusGuard";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuPositionerContext } from "../positioner/NavigationMenuPositionerContext";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";

function Guards(props: { hasPositioner: boolean; children?: JSX.Element }) {
  const root = useNavigationMenuRootContext();

  const reference = () => untrack(root.positionerElement) || untrack(root.viewportElement);

  return (
    <Show when={root.activeTrigger() != null || props.hasPositioner} fallback={props.children}>
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
      {props.children}
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
    </Show>
  );
}

/**
 * The clipping viewport of the navigation menu's current content.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuViewport<T extends ValidComponent = "div">(props: NavigationMenuViewport.Props<T>) {
  const [local, elementProps] = split(props as NavigationMenuViewport.Props, { default: defaultProps }, ["as", "children"]);

  const as = untrack(() => local.as);
  const generatedId = createUniqueId();

  const root = useNavigationMenuRootContext();
  const hasPositioner = useNavigationMenuPositionerContext(true) != null;

  const viewportProps = {
    id: generatedId,
    get inert() {
      return !hasPositioner && root.viewportInert() ? true : undefined;
    },
    children: hasPositioner ? (
      (untrack(() => local.children) as JSX.Element)
    ) : (
      <Guards hasPositioner={false}>
        <div ref={root.setViewportTargetElement}>{untrack(() => local.children) as JSX.Element}</div>
      </Guards>
    ),
  };

  const handlerProps = (externalProps: Record<string, any>) => ({
    // Focus events must bubble from the viewport's descendants.
    onFocusOut(event: FocusEvent) {
      externalProps.onFocusOut?.(event);
      const relatedTarget = event.relatedTarget as Element | null;
      const viewport = untrack(root.viewportElement);

      // If focus is leaving the viewport and not going to the trigger, make it inert
      // to prevent a focus loop.
      if (relatedTarget && !contains(viewport, relatedTarget) && relatedTarget !== untrack(root.activeTrigger)) {
        root.setViewportInert(true);
      }
    },
    ref: mergeRefs<HTMLElement>(externalProps.ref, root.setViewportElement),
  });

  const element = <RenderElement as={as} props={[viewportProps, elementProps, handlerProps]} untrackChildren />;

  return hasPositioner ? <Guards hasPositioner>{element}</Guards> : element;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<NavigationMenuViewport.Props>);

export interface NavigationMenuViewportState {}

export type NavigationMenuViewportProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, NavigationMenuViewportState>;

export namespace NavigationMenuViewport {
  export type State = NavigationMenuViewportState;
  export type Props<T extends ValidComponent = "div"> = NavigationMenuViewportProps<T>;
}
