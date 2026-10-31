import { dynamicElement, omitProps, Portal, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";
import { inPlace } from "../utils/inPlace";
import { NavigationMenuPortalContext } from "./NavigationMenuPortalContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuPortal<T extends JSX.ElementType = "div">(props: NavigationMenuPortal.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted", "container", "class", "style", "children", "ref");
  // Deliberately not hoisted: portal children must be created inside the provider below.

  const keepMounted = props.keepMounted ?? false;
  const container = props.container ?? (typeof document === "undefined" ? undefined : document.body);

  const { mounted } = useNavigationMenuRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <>
      {(keepMounted || mounted()) && (
        <NavigationMenuPortalContext value={keepMounted}>
          <Portal mount={container as HTMLElement}>
            {inPlace(
              <Tag
                {...(rest as Record<string, unknown>)}
                class={resolveClassValue(props.class as never, {})}
                style={resolveStyleValue(props.style as never, {})}
                ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
              >
                {resolveChildrenValue(props.children as never, () => ({}))}
              </Tag>,
            )}
          </Portal>
        </NavigationMenuPortalContext>
      )}
    </>
  );
}

export interface NavigationMenuPortalState {}

export interface NavigationMenuPortalOwnProps {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?: HTMLElement | ShadowRoot | null | undefined;
}

export type NavigationMenuPortalProps<T extends JSX.ElementType = "div"> = NavigationMenuPortalOwnProps &
  RebaseUIComponentProps<T, NavigationMenuPortalState>;

export namespace NavigationMenuPortal {
  export type State = NavigationMenuPortalState;
  export type Props<T extends JSX.ElementType = "div"> = NavigationMenuPortalProps<T>;
}
