import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { CompositeRoot } from "../../internals/composite";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";

/**
 * Contains a list of navigation menu items.
 * Renders a `<ul>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuList<T extends ValidComponent = "ul">(props: NavigationMenuList.Props<T>) {
  const [local, elementProps] = split(props as NavigationMenuList.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { orientation, open, nested } = useNavigationMenuRootContext();

  const state: NavigationMenuListState = {
    get open() {
      return open();
    },
  };

  // When nested, skip the CompositeRoot wrapper so that triggers can participate
  // in the parent Content's composite navigation context.
  if (nested) {
    return <RenderElement as={as} state={state} props={[elementProps]} untrackChildren />;
  }

  // `stopEventPropagation` won't stop the propagation if the end of the list is reached,
  // but we want to block it in this case.
  const keyProps = (externalProps: Record<string, any>) => ({
    onKeyDown(event: KeyboardEvent) {
      externalProps.onKeyDown?.(event);
      const shouldStop =
        (untrack(orientation) === "horizontal" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) ||
        (untrack(orientation) === "vertical" && (event.key === "ArrowUp" || event.key === "ArrowDown"));

      if (shouldStop) {
        event.stopPropagation();
      }
    },
  });

  return (
    <CompositeRoot as={as} state={state} props={[elementProps, keyProps]} loopFocus={false} orientation={orientation()} untrackChildren />
  );
}

const defaultProps = Object.freeze({
  as: "ul",
} satisfies Partial<NavigationMenuList.Props>);

export interface NavigationMenuListState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
}

export type NavigationMenuListProps<T extends ValidComponent = "ul"> = RebaseUIComponentProps<T, NavigationMenuListState>;

export namespace NavigationMenuList {
  export type State = NavigationMenuListState;
  export type Props<T extends ValidComponent = "ul"> = NavigationMenuListProps<T>;
}
