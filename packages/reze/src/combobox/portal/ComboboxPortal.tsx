import { dynamicElement, omitProps, Portal, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { useComboboxRootContext } from "../root/ComboboxRootContext";
import { ComboboxPortalContext } from "./ComboboxPortalContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxPortal<T extends JSX.ElementType = "div">(props: ComboboxPortal.Props<T>) {
  const rest = omitProps(props, "as", "container", "keepMounted", "class", "style", "children", "ref");
  // Deliberately not hoisted: portal children must be created inside the portal
  // context provider (and the mounted branch) below, not in this body. The state
  // is static so resolving here cannot poison the branch with combobox state reads.

  const keepMounted = props.keepMounted ?? false;
  const containerProp = props.container ?? (typeof document === "undefined" ? undefined : document.body);
  // A ref object resolves to its current element; anything else passes through.
  const container =
    containerProp != null && typeof containerProp === "object" && "current" in (containerProp as Record<string, unknown>)
      ? ((containerProp as { current: HTMLElement | ShadowRoot | null }).current ?? undefined)
      : (containerProp as HTMLElement | ShadowRoot | undefined);

  const store = useComboboxRootContext();

  function shouldRender() {
    return (store.select("mounted") as boolean) || keepMounted || (store.select("forceMounted") as boolean);
  }

  function snapshot(): ComboboxPortalState {
    return {};
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {shouldRender() && (
          <ComboboxPortalContext value={keepMounted}>
            <Portal mount={container as Element | undefined}>
              <div
                {...(rest as Record<string, unknown>)}
                class={resolveClassValue(props.class, snapshot())}
                style={resolveStyleValue(props.style, snapshot())}
                ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
              >
                <ComboboxPortalContent>{props.children}</ComboboxPortalContent>
              </div>
            </Portal>
          </ComboboxPortalContext>
        )}
      </>
    );
  }

  return (
    <>
      {shouldRender() && (
        <ComboboxPortalContext value={keepMounted}>
          <Portal mount={container as Element | undefined}>
            <Tag
              {...(rest as Record<string, unknown>)}
              class={resolveClassValue(props.class, snapshot())}
              style={resolveStyleValue(props.style, snapshot())}
              ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
            >
              <ComboboxPortalContent>{props.children}</ComboboxPortalContent>
            </Tag>
          </Portal>
        </ComboboxPortalContext>
      )}
    </>
  );
}

/**
 * Resolves the portal children inside the portal context. Reading the children
 * getter here (once per instance) instead of in the `shouldRender` interpolation
 * keeps a re-run that stays mounted (e.g. `keepMounted` + a `mounted` flip) from
 * recreating the whole subtree while it is live.
 */
function ComboboxPortalContent(props: { children: unknown }) {
  const children = props.children;
  return resolveChildrenValue(children as ChildrenValue<ComboboxPortalState>, () => ({})) as JSX.Element;
}

export interface ComboboxPortalState {}

export interface ComboboxPortalOwnProps {
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

export type ComboboxPortalProps<T extends JSX.ElementType = "div"> = ComboboxPortalOwnProps &
  RebaseUIComponentProps<T, ComboboxPortalState>;

export namespace ComboboxPortal {
  export type State = ComboboxPortalState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxPortalProps<T>;
  export type OwnProps = ComboboxPortalOwnProps;
}
