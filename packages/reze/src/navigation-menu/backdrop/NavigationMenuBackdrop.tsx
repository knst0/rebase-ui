import { dynamicElement, omitProps, type JSX } from "reze-js";

import { inPlace } from "../../internals/inPlace";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";

/**
 * A backdrop for the navigation menu popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuBackdrop<T extends JSX.ElementType = "div">(props: NavigationMenuBackdrop.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { open, mounted, transitionStatus } = useNavigationMenuRootContext();

  function snapshot(): NavigationMenuBackdropState {
    return { open: open(), transitionStatus: transitionStatus() };
  }

  const ref = mergeRefs<HTMLElement>(props.ref as ((element: HTMLElement | null) => void) | undefined);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return inPlace(
    <Tag
      {...(rest as Record<string, unknown>)}
      role="presentation"
      hidden={!mounted() || undefined}
      data-open={open() ? "" : undefined}
      data-closed={open() ? undefined : ""}
      data-starting-style={transitionStatus() === "starting" ? "" : undefined}
      data-ending-style={transitionStatus() === "ending" ? "" : undefined}
      class={resolveClassValue(props.class as never, snapshot())}
      style={mergeStyleValue({ "user-select": "none", "-webkit-user-select": "none" }, resolveStyleValue(props.style as never, snapshot()))}
      ref={(element: HTMLElement | null) => ref(element as HTMLElement)}
    >
      {resolveChildrenValue(children as never, snapshot)}
    </Tag>,
  );
}

export interface NavigationMenuBackdropState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The transition status of the popup.
   */
  transitionStatus: TransitionStatus;
}

export type NavigationMenuBackdropProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, NavigationMenuBackdropState>;

export namespace NavigationMenuBackdrop {
  export type State = NavigationMenuBackdropState;
  export type Props<T extends JSX.ElementType = "div"> = NavigationMenuBackdropProps<T>;
}
