import { dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectRootContext } from "../root/SelectRootContext";

/**
 * An overlay displayed beneath the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Select](https://rebase-ui.knst.dev/components/select)
 */
export function SelectBackdrop<T extends JSX.ElementType = "div">(props: SelectBackdrop.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useSelectRootContext();

  function snapshot(): SelectBackdropState {
    return {
      open: store.select("open") as boolean,
      transitionStatus: store.select("transitionStatus") as TransitionStatus,
    };
  }

  function backdropStyle(): JSX.CSSProperties {
    return {
      "user-select": "none",
      "-webkit-user-select": "none",
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts. The default path renders a static `<div>`; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="presentation"
        hidden={!(store.select("mounted") as boolean) || undefined}
        data-open={(store.select("open") as boolean) ? "" : undefined}
        data-starting-style={(store.select("transitionStatus") as TransitionStatus) === "starting" ? "" : undefined}
        data-ending-style={(store.select("transitionStatus") as TransitionStatus) === "ending" ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={mergeStyleValue(backdropStyle() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="presentation"
      hidden={!(store.select("mounted") as boolean) || undefined}
      data-open={(store.select("open") as boolean) ? "" : undefined}
      data-starting-style={(store.select("transitionStatus") as TransitionStatus) === "starting" ? "" : undefined}
      data-ending-style={(store.select("transitionStatus") as TransitionStatus) === "ending" ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(backdropStyle() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface SelectBackdropState {
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export type SelectBackdropProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, SelectBackdropState>;

export namespace SelectBackdrop {
  export type State = SelectBackdropState;
  export type Props<T extends JSX.ElementType = "div"> = SelectBackdropProps<T>;
}
