import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createPopupViewport } from "../../internals/popups/popupViewport";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuPositionerContext } from "../positioner/MenuPositionerContext";
import { useMenuRootContext } from "../root/MenuRootContext";

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuViewport<T extends JSX.ElementType = "div">(props: MenuViewport.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Deliberately not hoisted: the viewport re-reads its children on every render
  // pass so a payload change updates the content in place instead of freezing
  // the value read while closed.

  const { store } = useMenuRootContext();
  const positioner = useMenuPositionerContext();

  function snapshot(): MenuViewportState {
    return {
      activationDirection: viewport.state.activationDirection,
      transitioning: viewport.state.transitioning,
      instant: store.select("instantType"),
    };
  }

  const viewport = createPopupViewport({
    store,
    side: positioner.side,
    // Read on every render pass so a payload change updates the content in place.
    children: () => resolveChildrenValue(props.children, snapshot),
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-activation-direction={viewport.state.activationDirection ?? undefined}
      data-transitioning={viewport.state.transitioning ? "" : undefined}
      data-instant={store.select("instantType") ?? undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {() => viewport.children()}
    </Tag>
  );
}

export interface MenuViewportState {
  /**
   * The activation direction of the transitioned content.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
  /**
   * Present if animations should be instant.
   */
  instant: "dismiss" | "click" | "group" | "trigger-change" | undefined;
}

export interface MenuViewportOwnProps {
  /**
   * The content to render inside the transition container.
   */
  children?: JSX.Element | undefined;
}

export type MenuViewportProps<T extends JSX.ElementType = "div"> = MenuViewportOwnProps & RebaseUIComponentProps<T, MenuViewportState>;

export namespace MenuViewport {
  export type State = MenuViewportState;
  export type Props<T extends JSX.ElementType = "div"> = MenuViewportProps<T>;
  export type OwnProps = MenuViewportOwnProps;
}
