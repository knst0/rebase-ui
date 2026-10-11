import { dynamicElement, omitProps, Portal, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectRootContext } from "../root/SelectRootContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Select](https://rebase-ui.knst.dev/components/select)
 */
export function SelectPortal<T extends JSX.ElementType = "div">(props: SelectPortal.Props<T>) {
  const rest = omitProps(props, "as", "container", "class", "style", "children", "ref");
  // Deliberately not hoisted: portal children must be created inside the mounted
  // branch below, not in this body. The state is static so resolving here cannot
  // poison the branch with select state reads.

  const container = props.container ?? (typeof document !== "undefined" ? document.body : undefined);

  const store = useSelectRootContext();

  function shouldRender(): boolean {
    return (store.select("mounted") as boolean) || (store.select("forceMount") as boolean);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts. The default path renders a static `<div>`; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {shouldRender() && (
          <Portal mount={container as Element | undefined}>
            <div
              {...(rest as Record<string, unknown>)}
              class={resolveClassValue(props.class, {})}
              style={resolveStyleValue(props.style, {})}
              ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
            >
              {resolveChildrenValue(props.children, () => ({}))}
            </div>
          </Portal>
        )}
      </>
    );
  }

  return (
    <>
      {shouldRender() && (
        <Portal mount={container as Element | undefined}>
          <Tag
            {...(rest as Record<string, unknown>)}
            class={resolveClassValue(props.class, {})}
            style={resolveStyleValue(props.style, {})}
            ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
          >
            {resolveChildrenValue(props.children, () => ({}))}
          </Tag>
        </Portal>
      )}
    </>
  );
}

export interface SelectPortalState {}

export interface SelectPortalOwnProps {
  /**
   * A parent element to render the portal element into.
   */
  container?: HTMLElement | ShadowRoot | { current: HTMLElement | ShadowRoot | null } | null | undefined;
}

export type SelectPortalProps<T extends JSX.ElementType = "div"> = SelectPortalOwnProps & RebaseUIComponentProps<T, SelectPortalState>;

export namespace SelectPortal {
  export type State = SelectPortalState;
  export type Props<T extends JSX.ElementType = "div"> = SelectPortalProps<T>;
  export type OwnProps = SelectPortalOwnProps;
}
