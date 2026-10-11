import { dynamicElement, omitProps, Portal, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePopoverRootContext } from "../root/PopoverRootContext";
import { PopoverPortalContext } from "./PopoverPortalContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverPortal<T extends JSX.ElementType = "div">(props: PopoverPortal.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted", "container", "class", "style", "children", "ref");
  // Deliberately not hoisted: portal children must be created inside the portal
  // context provider (and the mounted branch) below, not in this body. The state
  // is static so resolving here cannot poison the branch with popover state reads.

  const keepMounted = props.keepMounted ?? false;
  const container = props.container ?? (typeof document === "undefined" ? undefined : document.body);

  const store = usePopoverRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <>
      {(keepMounted || store.select("mounted")) && (
        <PopoverPortalContext value={keepMounted}>
          <Portal mount={container}>
            <Tag
              {...(rest as Record<string, unknown>)}
              class={resolveClassValue(props.class, {})}
              style={resolveStyleValue(props.style, {})}
              ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
            >
              {resolveChildrenValue(props.children, () => ({}))}
            </Tag>
          </Portal>
        </PopoverPortalContext>
      )}
    </>
  );
}

export interface PopoverPortalOwnProps {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?: HTMLElement | ShadowRoot | undefined;
}

export type PopoverPortalProps<T extends JSX.ElementType = "div"> = PopoverPortalOwnProps & RebaseUIComponentProps<T, PopoverPortalState>;

export interface PopoverPortalState {}

export namespace PopoverPortal {
  export type State = PopoverPortalState;
  export type Props<T extends JSX.ElementType = "div"> = PopoverPortalProps<T>;
  export type OwnProps = PopoverPortalOwnProps;
}
