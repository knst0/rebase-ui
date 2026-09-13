import { Portal, type ValidComponent } from "@solidjs/web";
import { Show, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
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
export function PreviewCardPortal<T extends ValidComponent = "div">(props: PreviewCardPortal.Props<T>) {
  const [local, elementProps] = split(props as PreviewCardPortal.Props, { default: defaultProps }, ["as", "keepMounted", "container"]);

  const as = untrack(() => local.as);
  const keepMounted = untrack(() => local.keepMounted);
  const container = untrack(() => local.container) ?? (typeof document !== "undefined" ? document.body : undefined);

  const store = usePreviewCardRootContext();

  const shouldRender = () => keepMounted || store.select("mounted");

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref),
  });

  return (
    <Show when={shouldRender()}>
      <PreviewCardPortalContext value={keepMounted}>
        <Portal mount={container as Element | undefined}>
          <RenderElement as={as} props={[elementProps, refProps]} />
        </Portal>
      </PreviewCardPortalContext>
    </Show>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  keepMounted: false,
} satisfies Partial<PreviewCardPortal.Props>);

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

export type PreviewCardPortalProps<T extends ValidComponent = "div"> = PreviewCardPortalOwnProps &
  RebaseUIComponentProps<T, PreviewCardPortalState>;

export namespace PreviewCardPortal {
  export type State = PreviewCardPortalState;
  export type Props<T extends ValidComponent = "div"> = PreviewCardPortalProps<T>;
  export type OwnProps = PreviewCardPortalOwnProps;
}
