import { dynamicElement, omitProps, Portal, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import { useTooltipRootContext } from "../root/TooltipRootContext";
import { TooltipPortalContext } from "./TooltipPortalContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Tooltip](https://rebase-ui.knst.dev/components/tooltip)
 */
export function TooltipPortal<T extends JSX.ElementType = "div">(props: TooltipPortal.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted", "container", "class", "style", "children", "ref");
  // Deliberately not hoisted: portal children must be created inside the portal
  // context provider (and the mounted branch) below, not in this body. The state
  // is static so resolving here cannot poison the branch with tooltip state reads.

  const keepMounted = props.keepMounted ?? false;
  const container = resolveContainer(props.container);

  const store = useTooltipRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts. The default path renders
  // a static `<div>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {(keepMounted || (store.select("mounted") as boolean)) && (
          <TooltipPortalContext value={keepMounted}>
            <Portal mount={container}>
              <div
                {...(rest as Record<string, unknown>)}
                class={resolveClassValue(props.class, {})}
                style={resolveStyleValue(props.style, {})}
                ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
              >
                {resolveChildrenValue(props.children, () => ({}))}
              </div>
            </Portal>
          </TooltipPortalContext>
        )}
      </>
    );
  }

  return (
    <>
      {(keepMounted || (store.select("mounted") as boolean)) && (
        <TooltipPortalContext value={keepMounted}>
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
        </TooltipPortalContext>
      )}
    </>
  );
}

function resolveContainer(container: TooltipPortalOwnProps["container"]): HTMLElement | ShadowRoot | undefined {
  const fallback = typeof document === "undefined" ? undefined : document.body;
  if (container == null) {
    return fallback;
  }
  if ("current" in (container as object)) {
    return (container as { current: HTMLElement | ShadowRoot | null }).current ?? fallback;
  }
  return container as HTMLElement | ShadowRoot;
}

export interface TooltipPortalState {}

export interface TooltipPortalOwnProps {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?: HTMLElement | ShadowRoot | { current: HTMLElement | ShadowRoot | null } | null | undefined;
}

export type TooltipPortalProps<T extends JSX.ElementType = "div"> = TooltipPortalOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, TooltipPortalState>;

export namespace TooltipPortal {
  export type State = TooltipPortalState;
  export type Props<T extends JSX.ElementType = "div"> = TooltipPortalProps<T>;
  export type OwnProps = TooltipPortalOwnProps;
}
