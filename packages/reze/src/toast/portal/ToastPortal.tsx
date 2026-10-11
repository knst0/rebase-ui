import { dynamicElement, omitProps, Portal, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";

/**
 * A portal element that moves the viewport to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastPortal<T extends JSX.ElementType = "div">(props: ToastPortal.Props<T>) {
  const rest = omitProps(props, "as", "container", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const container = props.container ?? (typeof document !== "undefined" ? document.body : undefined);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  function snapshot(): ToastPortalState {
    return {};
  }

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts. The default path renders a static `<div>` so toast
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <Portal mount={container}>
        <div
          {...(rest as Record<string, unknown>)}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
        >
          {resolveChildrenValue(children, snapshot)}
        </div>
      </Portal>
    );
  }

  return (
    <Portal mount={container}>
      <Tag
        {...(rest as Record<string, unknown>)}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {resolveChildrenValue(children, snapshot)}
      </Tag>
    </Portal>
  );
}

export interface ToastPortalState {}

export interface ToastPortalOwnProps {
  /**
   * A parent element to render the portal element into.
   */
  container?: HTMLElement | ShadowRoot | undefined;
}

export type ToastPortalProps<T extends JSX.ElementType = "div"> = ToastPortalOwnProps & RebaseUIComponentProps<T, ToastPortalState>;

export namespace ToastPortal {
  export type State = ToastPortalState;
  export type Props<T extends JSX.ElementType = "div"> = ToastPortalProps<T>;
  export type OwnProps = ToastPortalOwnProps;
}
