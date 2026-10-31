import { createUniqueId, dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { inPlace } from "../utils/inPlace";
import { ResolvedChildren } from "../utils/ResolvedChildren";
import { NavigationMenuItemContext } from "./NavigationMenuItemContext";

/**
 * An individual navigation menu item.
 * Renders a `<li>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuItem<T extends JSX.ElementType = "li">(props: NavigationMenuItem.Props<T>) {
  const rest = omitProps(props, "as", "value", "class", "style", "children", "ref");

  const id = createUniqueId();
  const contextValue = { value: () => props.value ?? id };
  const snapshot = () => ({});

  const attrs = {
    get class() {
      return resolveClassValue(props.class as never, {});
    },
    get style() {
      return resolveStyleValue(props.style as never, {});
    },
  };
  const ref = (element: HTMLElement | null) => (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as as JSX.ElementType);

  // See `NavigationMenuRoot`: `as` is resolved once. Keep both branches in sync.
  if (props.as == null) {
    return (
      <li {...(rest as Record<string, unknown>)} {...attrs} ref={(element) => ref(element as HTMLElement)}>
        <NavigationMenuItemContext value={contextValue}>
          <ResolvedChildren snapshot={snapshot}>{props.children}</ResolvedChildren>
        </NavigationMenuItemContext>
      </li>
    );
  }

  return inPlace(
    <Tag {...(rest as Record<string, unknown>)} {...attrs} ref={(element: HTMLElement | null) => ref(element as HTMLElement)}>
      <NavigationMenuItemContext value={contextValue}>
        <ResolvedChildren snapshot={snapshot}>{props.children}</ResolvedChildren>
      </NavigationMenuItemContext>
    </Tag>,
  );
}

export interface NavigationMenuItemState {}

export interface NavigationMenuItemOwnProps {
  /**
   * A unique value that identifies this navigation menu item.
   * If no value is provided, a unique ID will be generated automatically.
   * Use when controlling the navigation menu programmatically.
   */
  value?: any;
}

export type NavigationMenuItemProps<T extends JSX.ElementType = "li"> = NavigationMenuItemOwnProps &
  Omit<RebaseUIComponentProps<T, NavigationMenuItemState>, "value">;

export namespace NavigationMenuItem {
  export type State = NavigationMenuItemState;
  export type Props<T extends JSX.ElementType = "li"> = NavigationMenuItemProps<T>;
}
