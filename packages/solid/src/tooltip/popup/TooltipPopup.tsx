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
import { useTooltipPositionerContext } from "../positioner/TooltipPositionerContext";
import { useTooltipRootContext } from "../root/TooltipRootContext";
import { tooltipPopupStateMapping } from "../utils/stateAttributesMapping";

/**
 * A container for the tooltip contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Tooltip](https://rebase-ui.knst.dev/components/tooltip)
 */
export function TooltipPopup<T extends ValidComponent = "div">(props: TooltipPopup.Props<T>) {
  const [local, elementProps] = split(props as TooltipPopup.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = useTooltipRootContext();
  const positioner = useTooltipPositionerContext();

  const disabled = untrack(() => store.select("disabled"));
  const closeDelay = untrack(() => store.select("closeDelay"));

  createHoverFloatingInteraction(getRootFloatingContext(untrack(() => store.select("floatingRootContext"))), {
    enabled: !disabled,
    closeDelay,
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

  const state: TooltipPopupState = {
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
      stateAttributesMapping={tooltipPopupStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<TooltipPopup.Props>);

export interface TooltipPopupState {
  /**
   * Whether the tooltip is currently open.
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
  instant: "delay" | "focus" | "dismiss" | undefined;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export type TooltipPopupProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, TooltipPopupState>;

export namespace TooltipPopup {
  export type State = TooltipPopupState;
  export type Props<T extends ValidComponent = "div"> = TooltipPopupProps<T>;
}
