import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { createHoverFloatingInteraction } from "../../internals/floating/interactions/createHoverFloatingInteraction";
import { mergeRefs } from "../../internals/mergeRefs";
import { FOCUSABLE_POPUP_PROPS, getRootFloatingContext } from "../../internals/popups/popupStoreUtils";
import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePreviewCardPositionerContext } from "../positioner/PreviewCardPositionerContext";
import { usePreviewCardRootContext } from "../root/PreviewCardRootContext";
import { previewCardPopupStateMapping } from "../utils/stateAttributesMapping";

/**
 * A container for the preview card contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardPopup<T extends ValidComponent = "div">(props: PreviewCardPopup.Props<T>) {
  const [local, elementProps] = split(props as PreviewCardPopup.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = usePreviewCardRootContext();
  const positioner = usePreviewCardPositionerContext();

  const closeDelay = untrack(() => store.select("closeDelay"));

  createHoverFloatingInteraction(getRootFloatingContext(untrack(() => store.select("floatingRootContext"))), {
    closeDelay: closeDelay as number,
  });

  runOnOpenChangeComplete({
    open: () => store.select("open"),
    ref: () => store.context.popupRef.current,
    onComplete: () => {
      if (untrack(() => store.select("open"))) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const state: PreviewCardPopupState = {
    get open() {
      return store.select("open");
    },
    get side() {
      return positioner.side();
    },
    get align() {
      return positioner.align();
    },
    get instant() {
      return store.select("instantType");
    },
    get transitionStatus() {
      return store.select("transitionStatus");
    },
  };

  const popupProps = {
    get id() {
      return store.select("floatingId") as string | undefined;
    },
    ...FOCUSABLE_POPUP_PROPS,
    get style() {
      return store.select("transitionStatus") === "starting" ? { transition: "none" } : undefined;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, (element: HTMLElement | null) => {
      store.context.popupRef.current = element;
      store.set("popupElement", element);
    }),
  });

  const storePopupProps = () => store.select("popupProps") as Record<string, unknown>;

  return (
    <RenderElement
      as={as}
      state={state}
      props={[popupProps, storePopupProps, elementProps, refProps]}
      stateAttributesMapping={previewCardPopupStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<PreviewCardPopup.Props>);

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

export type PreviewCardPopupProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, PreviewCardPopupState>;

export namespace PreviewCardPopup {
  export type State = PreviewCardPopupState;
  export type Props<T extends ValidComponent = "div"> = PreviewCardPopupProps<T>;
}
