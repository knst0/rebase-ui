import { dynamicElement, omitProps, untrack, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { createHoverFloatingInteraction } from "../../internals/floating/interactions/createHoverFloatingInteraction";
import { mergeRefs } from "../../internals/mergeRefs";
import { getRootFloatingContext } from "../../internals/popups/popupStoreUtils";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePreviewCardPositionerContext } from "../positioner/PreviewCardPositionerContext";
import { usePreviewCardRootContext } from "../root/PreviewCardRootContext";

/**
 * A container for the preview card contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardPopup<T extends JSX.ElementType = "div">(props: PreviewCardPopup.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = usePreviewCardRootContext();
  const positioner = usePreviewCardPositionerContext();

  const closeDelay = untrack(() => store.select("closeDelay"));

  createHoverFloatingInteraction(getRootFloatingContext(untrack(() => store.select("floatingRootContext"))), {
    closeDelay: closeDelay as number,
  });

  runOnOpenChangeComplete({
    open: () => store.select("open") as boolean,
    ref: () => store.context.popupRef.current,
    onComplete: () => {
      if (untrack(() => store.select("open"))) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  function snapshot(): PreviewCardPopupState {
    return {
      open: store.select("open") as boolean,
      side: positioner.side(),
      align: positioner.align(),
      instant: store.select("instantType"),
      transitionStatus: store.select("transitionStatus"),
    };
  }

  function popupProps(): Record<string, ((event: Event) => void) | undefined> {
    return store.select("popupProps") as Record<string, ((event: Event) => void) | undefined>;
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={store.select("floatingId") as string | undefined}
      tabindex={-1}
      data-base-ui-focusable=""
      data-open={(store.select("open") as boolean) ? "" : undefined}
      data-closed={(store.select("open") as boolean) ? undefined : ""}
      data-side={positioner.side()}
      data-align={positioner.align()}
      data-instant={(store.select("instantType") as string | undefined) ?? undefined}
      data-starting-style={(store.select("transitionStatus") as string | undefined) === "starting" ? "" : undefined}
      data-ending-style={(store.select("transitionStatus") as string | undefined) === "ending" ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(
        (store.select("transitionStatus") as string | undefined) === "starting" ? { transition: "none" } : {},
        resolveStyleValue(props.style, snapshot()),
      )}
      onKeyDown={((rest as Record<string, unknown>).onKeyDown as ((event: KeyboardEvent) => void) | undefined) ?? popupProps().onKeyDown}
      onPointerDown={
        ((rest as Record<string, unknown>).onPointerDown as ((event: PointerEvent) => void) | undefined) ?? popupProps().onPointerDown
      }
      onMouseDown={((rest as Record<string, unknown>).onMouseDown as ((event: MouseEvent) => void) | undefined) ?? popupProps().onMouseDown}
      ref={mergeRefs(
        (element: HTMLElement | null) => {
          store.context.popupRef.current = element;
          store.set("popupElement", element);
        },
        props.ref as ((element: HTMLElement | null) => void) | undefined,
      )}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface PreviewCardPopupState {
  /**
   * Whether the preview card is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether transitions should be skipped.
   */
  instant: "dismiss" | "focus" | undefined;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export type PreviewCardPopupProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, PreviewCardPopupState>;

export namespace PreviewCardPopup {
  export type State = PreviewCardPopupState;
  export type Props<T extends JSX.ElementType = "div"> = PreviewCardPopupProps<T>;
}
