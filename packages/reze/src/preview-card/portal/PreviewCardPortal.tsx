import { dynamicElement, omitProps, Portal, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePreviewCardRootContext } from "../root/PreviewCardRootContext";
import { PreviewCardPortalContext } from "./PreviewCardPortalContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardPortal<T extends JSX.ElementType = "div">(props: PreviewCardPortal.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted", "container", "class", "style", "children", "ref");
  // Deliberately not hoisted: portal children must be created inside the portal
  // context provider (and the mounted branch) below, not in this body. The state
  // is static so resolving here cannot poison the branch with preview card state reads.

  const keepMounted = props.keepMounted ?? false;
  const container = resolveContainer(props.container);

  const store = usePreviewCardRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <>
      {(keepMounted || (store.select("mounted") as boolean)) && (
        <PreviewCardPortalContext value={keepMounted}>
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
        </PreviewCardPortalContext>
      )}
    </>
  );
}

function resolveContainer(container: PreviewCardPortalOwnProps["container"]): HTMLElement | ShadowRoot | undefined {
  const fallback = typeof document === "undefined" ? undefined : document.body;
  if (container == null) {
    return fallback;
  }
  if ("current" in (container as object)) {
    return (container as { current: HTMLElement | ShadowRoot | null }).current ?? fallback;
  }
  return container as HTMLElement | ShadowRoot;
}

export interface PreviewCardPortalState {}

export interface PreviewCardPortalOwnProps {
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

export type PreviewCardPortalProps<T extends JSX.ElementType = "div"> = PreviewCardPortalOwnProps &
  RebaseUIComponentProps<T, PreviewCardPortalState>;

export namespace PreviewCardPortal {
  export type State = PreviewCardPortalState;
  export type Props<T extends JSX.ElementType = "div"> = PreviewCardPortalProps<T>;
  export type OwnProps = PreviewCardPortalOwnProps;
}
