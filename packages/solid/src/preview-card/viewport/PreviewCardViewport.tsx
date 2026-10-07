import type { JSX, ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { createPopupViewport } from "../../internals/popups/popupViewport";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePreviewCardPositionerContext } from "../positioner/PreviewCardPositionerContext";
import { usePreviewCardRootContext } from "../root/PreviewCardRootContext";
import { previewCardViewportStateMapping } from "../utils/stateAttributesMapping";

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardViewport<T extends ValidComponent = "div">(props: PreviewCardViewport.Props<T>) {
  const [local, elementProps] = split(props as PreviewCardViewport.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = usePreviewCardRootContext();
  const positioner = usePreviewCardPositionerContext();

  const state: PreviewCardViewportState = {
    get activationDirection() {
      return viewport.state.activationDirection;
    },
    get transitioning() {
      return viewport.state.transitioning;
    },
    get instant() {
      return store.select("instantType");
    },
  };

  const viewport = createPopupViewport({
    store,
    side: positioner.side,
    // Read on every render pass so a payload change updates the content in place.
    children: () => {
      const value = elementProps.children as JSX.Element | ((state: PreviewCardViewportState) => JSX.Element);
      return typeof value === "function" ? value(state) : value;
    },
  });

  const childrenProps = {
    get children() {
      return viewport.children();
    },
  };

  return (
    <RenderElement as={as} state={state} props={[elementProps, childrenProps]} stateAttributesMapping={previewCardViewportStateMapping} />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<PreviewCardViewport.Props>);

export interface PreviewCardViewportState {
  /**
   * The activation direction of the transitioned content.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
  /**
   * Present if animations should be instant.
   */
  instant: "dismiss" | "focus" | undefined;
}

export type PreviewCardViewportProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, PreviewCardViewportState>;

export namespace PreviewCardViewport {
  export type State = PreviewCardViewportState;
  export type Props<T extends ValidComponent = "div"> = PreviewCardViewportProps<T>;
}
