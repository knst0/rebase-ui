import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { CompositeItem } from "../../internals/composite";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { useFloatingTree } from "../../internals/floating/tree/FloatingTree";
import { mergeRefs } from "../../internals/mergeRefs";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuRootContext, useNavigationMenuTreeContext } from "../root/NavigationMenuRootContext";
import { isOutsideMenuEvent } from "../utils/isOutsideMenuEvent";

/**
 * A link in the navigation menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuLink<T extends ValidComponent = "a">(props: NavigationMenuLink.Props<T>) {
  const [local, elementProps] = split(props as NavigationMenuLink.Props, { default: defaultProps }, ["as", "active", "closeOnClick"]);

  const as = untrack(() => local.as);

  const root = useNavigationMenuRootContext();
  const nodeId = useNavigationMenuTreeContext();
  const tree = useFloatingTree();

  let linkElement: HTMLElement | null = null;

  const state: NavigationMenuLinkState = {
    get active() {
      return local.active as boolean;
    },
  };

  const linkProps = {
    get "aria-current"() {
      return local.active ? ("page" as const) : undefined;
    },
  };

  const handlerProps = (externalProps: Record<string, any>) => ({
    onClick(event: MouseEvent) {
      externalProps.onClick?.(event);
      if (untrack(() => local.closeOnClick)) {
        root.setValue(null, createChangeEventDetails(REASONS.linkPress, event));
      }
    },
    onBlur(event: FocusEvent) {
      externalProps.onBlur?.(event);
      const popup = untrack(root.popupElement);
      if (
        untrack(root.positionerElement) &&
        popup &&
        isOutsideMenuEvent(
          { currentTarget: linkElement, relatedTarget: event.relatedTarget as Element | null },
          { popupElement: popup, rootElement: untrack(root.rootElement), tree, nodeId },
        )
      ) {
        root.setValue(null, createChangeEventDetails(REASONS.focusOut, event));
      }
    },
    ref: mergeRefs<HTMLElement>(externalProps.ref, (element: HTMLElement | null) => {
      linkElement = element;
    }),
  });

  return <CompositeItem as={as} state={state} props={[linkProps, elementProps, handlerProps]} />;
}

const defaultProps = Object.freeze({
  as: "a",
  active: false,
  closeOnClick: false,
} satisfies Partial<NavigationMenuLink.Props>);

export interface NavigationMenuLinkState {
  /**
   * Whether the link is the currently active page.
   */
  active: boolean;
}

export interface NavigationMenuLinkOwnProps {
  /**
   * Whether the link is the currently active page.
   * @default false
   */
  active?: boolean | undefined;
  /**
   * Whether to close the navigation menu when the link is clicked.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export type NavigationMenuLinkProps<T extends ValidComponent = "a"> = NavigationMenuLinkOwnProps &
  RebaseUIComponentProps<T, NavigationMenuLinkState>;

export namespace NavigationMenuLink {
  export type State = NavigationMenuLinkState;
  export type Props<T extends ValidComponent = "a"> = NavigationMenuLinkProps<T>;
}
