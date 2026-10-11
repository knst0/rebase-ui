import { dynamicElement, omitProps, type JSX } from "reze-js";

import { REASONS } from "../../internals/event-details";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuRootContext } from "../root/MenuRootContext";

/**
 * An overlay displayed beneath the menu popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuBackdrop<T extends JSX.ElementType = "div">(props: MenuBackdrop.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { store } = useMenuRootContext();

  function snapshot(): MenuBackdropState {
    return {
      open: store.select("open"),
      transitionStatus: store.select("transitionStatus"),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="presentation"
      hidden={!store.select("mounted") || undefined}
      data-open={store.select("open") ? "" : undefined}
      data-closed={store.select("open") ? undefined : ""}
      data-starting-style={store.select("transitionStatus") === "starting" ? "" : undefined}
      data-ending-style={store.select("transitionStatus") === "ending" ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(
        {
          "pointer-events": (store.select("lastOpenChangeReason") as string | null) === REASONS.triggerHover ? "none" : undefined,
          "user-select": "none",
          "-webkit-user-select": "none",
        },
        resolveStyleValue(props.style, snapshot()),
      )}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface MenuBackdropState {
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export type MenuBackdropProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, MenuBackdropState>;

export namespace MenuBackdrop {
  export type State = MenuBackdropState;
  export type Props<T extends JSX.ElementType = "div"> = MenuBackdropProps<T>;
}
