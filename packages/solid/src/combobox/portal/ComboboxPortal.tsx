import { Portal, type ValidComponent } from "@solidjs/web";
import { Show, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxRootContext } from "../root/ComboboxRootContext";
import { ComboboxPortalContext } from "./ComboboxPortalContext";

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxPortal<T extends ValidComponent = "div">(props: ComboboxPortal.Props<T>) {
  const [local, elementProps] = split(props as ComboboxPortal.Props, { default: defaultProps }, ["as", "container", "keepMounted"]);

  const as = untrack(() => local.as);
  const container = untrack(() => local.container) ?? (typeof document !== "undefined" ? document.body : undefined);
  const keepMounted = untrack(() => local.keepMounted) ?? false;

  const store = useComboboxRootContext();

  const shouldRender = () => (store.select("mounted") as boolean) || keepMounted || (store.select("forceMounted") as boolean);

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref),
  });

  return (
    <ComboboxPortalContext value={keepMounted}>
      <Show when={shouldRender()}>
        <Portal mount={container as Element | undefined}>
          <RenderElement as={as} props={[elementProps, refProps]} />
        </Portal>
      </Show>
    </ComboboxPortalContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ComboboxPortal.Props>);

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

export type ComboboxPortalProps<T extends ValidComponent = "div"> = ComboboxPortalOwnProps & RebaseUIComponentProps<T, ComboboxPortalState>;

export namespace ComboboxPortal {
  export type State = ComboboxPortalState;
  export type Props<T extends ValidComponent = "div"> = ComboboxPortalProps<T>;
  export type OwnProps = ComboboxPortalOwnProps;
}
