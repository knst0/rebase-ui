import { dynamicElement, omitProps, Portal, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuRootContext } from "../root/MenuRootContext";
import { MenuPortalContext } from "./MenuPortalContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuPortal<T extends JSX.ElementType = "div">(props: MenuPortal.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted", "container", "class", "style", "children", "ref");
  // Deliberately not hoisted: portal children must be created inside the portal
  // context provider (and the mounted branch) below, not in this body. The state
  // is static so resolving here cannot poison the branch with menu state reads.

  const keepMounted = props.keepMounted ?? false;
  const containerOption = props.container ?? (typeof document === "undefined" ? undefined : document.body);
  // One-shot read (matching the Solid layer, where it is untracked): the container never moves.
  const container =
    containerOption != null && "current" in (containerOption as Record<string, unknown>)
      ? ((containerOption as { current: HTMLElement | ShadowRoot | null }).current ?? undefined)
      : (containerOption as HTMLElement | ShadowRoot | undefined);

  const { store } = useMenuRootContext();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <>
      {(keepMounted || store.select("mounted")) && (
        <MenuPortalContext value={keepMounted}>
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
        </MenuPortalContext>
      )}
    </>
  );
}

export interface MenuPortalState {}

export interface MenuPortalOwnProps {
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

export type MenuPortalProps<T extends JSX.ElementType = "div"> = MenuPortalOwnProps & RebaseUIComponentProps<T, MenuPortalState>;

export namespace MenuPortal {
  export type State = MenuPortalState;
  export type Props<T extends JSX.ElementType = "div"> = MenuPortalProps<T>;
  export type OwnProps = MenuPortalOwnProps;
}
