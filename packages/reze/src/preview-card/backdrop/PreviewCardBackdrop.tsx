import { dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePreviewCardRootContext } from "../root/PreviewCardRootContext";

/**
 * A presentational overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardBackdrop<T extends JSX.ElementType = "div">(props: PreviewCardBackdrop.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = usePreviewCardRootContext();

  function snapshot(): PreviewCardBackdropState {
    return {
      open: store.select("open") as boolean,
      transitionStatus: store.select("transitionStatus"),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="presentation"
      hidden={!(store.select("mounted") as boolean) || undefined}
      data-open={(store.select("open") as boolean) ? "" : undefined}
      data-closed={(store.select("open") as boolean) ? undefined : ""}
      data-starting-style={(store.select("transitionStatus") as string | undefined) === "starting" ? "" : undefined}
      data-ending-style={(store.select("transitionStatus") as string | undefined) === "ending" ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(
        { "pointer-events": "none", "user-select": "none", "-webkit-user-select": "none" },
        resolveStyleValue(props.style, snapshot()),
      )}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

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

export type PreviewCardBackdropProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, PreviewCardBackdropState>;

export namespace PreviewCardBackdrop {
  export type State = PreviewCardBackdropState;
  export type Props<T extends JSX.ElementType = "div"> = PreviewCardBackdropProps<T>;
}
