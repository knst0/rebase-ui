import { createUniqueId, dynamicElement, omitProps, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuPositionerContext } from "../positioner/NavigationMenuPositionerContext";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";
import { inPlace } from "../utils/inPlace";

/**
 * A container for the navigation menu contents.
 * Renders a `<nav>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuPopup<T extends JSX.ElementType = "nav">(props: NavigationMenuPopup.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const generatedId = createUniqueId();
  const { open, transitionStatus, setPopupElement } = useNavigationMenuRootContext();
  const positioning = useNavigationMenuPositionerContext();

  function snapshot(): NavigationMenuPopupState {
    return {
      open: open(),
      transitionStatus: transitionStatus(),
      side: positioning.side(),
      align: positioning.align(),
      anchorHidden: positioning.anchorHidden(),
    };
  }

  // Ensure popup size transitions correctly when anchored to `bottom` (side=top) or `right` (side=left).
  function originStyle(): Record<string, string | undefined> {
    const physicalSide = positioning.physicalSide();
    const isPhysicalLeft = physicalSide === "left";
    return {
      ...(physicalSide === "top" || isPhysicalLeft
        ? {
            position: "absolute",
            [physicalSide === "top" ? "bottom" : "top"]: "0px",
            [isPhysicalLeft ? "right" : "left"]: "0px",
          }
        : null),
      ...(transitionStatus() === "starting" ? { transition: "none" } : null),
    };
  }

  const ref = mergeRefs<HTMLElement>(props.ref as ((element: HTMLElement | null) => void) | undefined, setPopupElement);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "nav");

  return inPlace(
    <Tag
      {...(rest as Record<string, unknown>)}
      id={generatedId}
      tabindex={-1}
      data-open={open() ? "" : undefined}
      data-closed={open() ? undefined : ""}
      data-starting-style={transitionStatus() === "starting" ? "" : undefined}
      data-ending-style={transitionStatus() === "ending" ? "" : undefined}
      data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
      data-side={positioning.side()}
      data-align={positioning.align()}
      class={resolveClassValue(props.class as never, snapshot())}
      style={mergeStyleValue(originStyle(), resolveStyleValue(props.style as never, snapshot()))}
      ref={(element: HTMLElement | null) => ref(element as HTMLElement)}
    >
      {resolveChildrenValue(children as never, snapshot)}
    </Tag>,
  );
}

export interface NavigationMenuPopupState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The transition status of the popup.
   */
  transitionStatus: TransitionStatus;
  /**
   * The side of the anchor the popup is positioned on.
   */
  side: Side;
  /**
   * The alignment of the popup relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export type NavigationMenuPopupProps<T extends JSX.ElementType = "nav"> = RebaseUIComponentProps<T, NavigationMenuPopupState>;

export namespace NavigationMenuPopup {
  export type State = NavigationMenuPopupState;
  export type Props<T extends JSX.ElementType = "nav"> = NavigationMenuPopupProps<T>;
}
