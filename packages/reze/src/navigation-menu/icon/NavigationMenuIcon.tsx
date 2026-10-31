import { dynamicElement, omitProps, type JSX } from "reze-js";

import { inPlace } from "../../internals/inPlace";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuItemContext } from "../item/NavigationMenuItemContext";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";

/**
 * An icon that indicates that the trigger button opens a menu.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuIcon<T extends JSX.ElementType = "span">(props: NavigationMenuIcon.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children ?? "▼";

  const item = useNavigationMenuItemContext();
  const { open, value } = useNavigationMenuRootContext();
  const isOpen = () => open() && value() === item.value();

  function snapshot(): NavigationMenuIconState {
    return { open: isOpen() };
  }

  const ref = mergeRefs<HTMLElement>(props.ref as ((element: HTMLElement | null) => void) | undefined);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  return inPlace(
    <Tag
      {...(rest as Record<string, unknown>)}
      aria-hidden="true"
      data-popup-open={isOpen() ? "" : undefined}
      class={resolveClassValue(props.class as never, snapshot())}
      style={resolveStyleValue(props.style as never, snapshot())}
      ref={(element: HTMLElement | null) => ref(element as HTMLElement)}
    >
      {resolveChildrenValue(children as never, snapshot)}
    </Tag>,
  );
}

export interface NavigationMenuIconState {
  /**
   * Whether the navigation menu is open and the item is active.
   */
  open: boolean;
}

export type NavigationMenuIconProps<T extends JSX.ElementType = "span"> = RebaseUIComponentProps<T, NavigationMenuIconState>;

export namespace NavigationMenuIcon {
  export type State = NavigationMenuIconState;
  export type Props<T extends JSX.ElementType = "span"> = NavigationMenuIconProps<T>;
}
