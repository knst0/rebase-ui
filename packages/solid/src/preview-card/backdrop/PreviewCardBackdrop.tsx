import type { JSX, ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePreviewCardRootContext } from "../root/PreviewCardRootContext";
import { previewCardPopupStateMapping } from "../utils/stateAttributesMapping";

/**
 * A presentational overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardBackdrop<T extends ValidComponent = "div">(props: PreviewCardBackdrop.Props<T>) {
  const [local, elementProps] = split(props as PreviewCardBackdrop.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = usePreviewCardRootContext();

  const state: PreviewCardBackdropState = {
    get open() {
      return store.select("open");
    },
    get transitionStatus() {
      return store.select("transitionStatus");
    },
  };

  const backdropProps = {
    role: "presentation" as const,
    get hidden() {
      return !store.select("mounted") || undefined;
    },
    get style(): JSX.CSSProperties {
      return {
        "pointer-events": "none",
        "user-select": "none",
        "-webkit-user-select": "none",
      };
    },
  };

  return (
    <RenderElement as={as} state={state} props={[backdropProps, elementProps]} stateAttributesMapping={previewCardPopupStateMapping} />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<PreviewCardBackdrop.Props>);

export interface PreviewCardBackdropState {
  /**
   * Whether the preview card is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export type PreviewCardBackdropProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, PreviewCardBackdropState>;

export namespace PreviewCardBackdrop {
  export type State = PreviewCardBackdropState;
  export type Props<T extends ValidComponent = "div"> = PreviewCardBackdropProps<T>;
}
