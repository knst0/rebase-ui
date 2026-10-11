import { dynamicElement, omitProps, untrack, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { createHoverFloatingInteraction } from "../../internals/floating/interactions/createHoverFloatingInteraction";
import { mergeRefs } from "../../internals/mergeRefs";
import { getRootFloatingContext } from "../../internals/popups/popupStoreUtils";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import type { TransitionStatus } from "../../internals/transition-status";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import { useTooltipPositionerContext } from "../positioner/TooltipPositionerContext";
import { useTooltipRootContext } from "../root/TooltipRootContext";

/**
 * A container for the tooltip contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Tooltip](https://rebase-ui.knst.dev/components/tooltip)
 */
export function TooltipPopup<T extends JSX.ElementType = "div">(props: TooltipPopup.Props<T>) {
  const rest = omitProps(props, "as", "tabindex", "tabIndex", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useTooltipRootContext();
  const positioner = useTooltipPositionerContext();

  const disabled = untrack(() => store.select("disabled"));
  const closeDelay = untrack(() => store.select("closeDelay"));

  createHoverFloatingInteraction(getRootFloatingContext(untrack(() => store.select("floatingRootContext"))), {
    enabled: !disabled,
    closeDelay: closeDelay as number,
  });

  runOnOpenChangeComplete({
    // The popup mounts fresh on every open, so the completion effect below can run before
    // the element ref callback; gating on the reactive element key re-runs it once the
    // element arrives instead of dropping the completion check for this open epoch.
    enabled: () => (store.select("popupElement") as HTMLElement | null) != null,
    open: () => store.select("open") as boolean,
    ref: () => store.context.popupRef.current,
    onComplete: () => {
      if (untrack(() => store.select("open"))) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  function snapshot(): TooltipPopupState {
    return {
      open: store.select("open") as boolean,
      side: positioner.side(),
      align: positioner.align(),
      instant: store.select("instantType"),
      transitionStatus: store.select("transitionStatus"),
    };
  }

  function storePopupProps(): Record<string, ((event: Event) => void) | undefined> {
    return store.select("popupProps") as Record<string, ((event: Event) => void) | undefined>;
  }

  function open(): boolean {
    return store.select("open") as boolean;
  }

  function transitionStatus(): TransitionStatus {
    return store.select("transitionStatus") as TransitionStatus;
  }

  function userTabIndex(): number | undefined {
    const tabs = props as unknown as { tabindex?: number | undefined; tabIndex?: number | undefined };
    return tabs.tabindex ?? tabs.tabIndex;
  }

  // User handlers win over the interaction handlers, matching the Solid layer where the
  // element props layer is applied last.
  function handleKeyDown(event: KeyboardEvent): void {
    const handler =
      (props.onKeyDown as unknown as ((event: KeyboardEvent) => void) | undefined) ??
      (storePopupProps().onKeyDown as ((event: KeyboardEvent) => void) | undefined);
    handler?.(event);
  }

  function handlePointerDown(event: PointerEvent): void {
    const handler =
      (props.onPointerDown as unknown as ((event: PointerEvent) => void) | undefined) ??
      (storePopupProps().onPointerDown as ((event: PointerEvent) => void) | undefined);
    handler?.(event);
  }

  function handleMouseDown(event: MouseEvent): void {
    const handler =
      (props.onMouseDown as unknown as ((event: MouseEvent) => void) | undefined) ??
      (storePopupProps().onMouseDown as ((event: MouseEvent) => void) | undefined);
    handler?.(event);
  }

  function popupRef(element: HTMLElement | null): void {
    store.context.popupRef.current = element;
    store.set("popupElement", element);
  }

  const elementRef = mergeRefs(popupRef, props.ref as ((element: HTMLElement | null) => void) | undefined);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would restart the
  // enter transition. The default path renders a static `<div>`; only a customized `as`
  // keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        tabindex={userTabIndex() ?? -1}
        data-base-ui-focusable=""
        data-open={open() ? "" : undefined}
        data-closed={open() ? undefined : ""}
        data-side={positioner.side()}
        data-align={positioner.align()}
        data-instant={(store.select("instantType") as string | undefined) ?? undefined}
        data-starting-style={transitionStatus() === "starting" ? "" : undefined}
        data-ending-style={transitionStatus() === "ending" ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={mergeStyleValue(transitionStatus() === "starting" ? { transition: "none" } : {}, resolveStyleValue(props.style, snapshot()))}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onMouseDown={handleMouseDown}
        ref={elementRef}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      tabindex={userTabIndex() ?? -1}
      data-base-ui-focusable=""
      data-open={open() ? "" : undefined}
      data-closed={open() ? undefined : ""}
      data-side={positioner.side()}
      data-align={positioner.align()}
      data-instant={(store.select("instantType") as string | undefined) ?? undefined}
      data-starting-style={transitionStatus() === "starting" ? "" : undefined}
      data-ending-style={transitionStatus() === "ending" ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(transitionStatus() === "starting" ? { transition: "none" } : {}, resolveStyleValue(props.style, snapshot()))}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onMouseDown={handleMouseDown}
      ref={elementRef}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

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

export type TooltipPopupProps<T extends JSX.ElementType = "div"> = ButtonEventHandlers & RebaseUIComponentProps<T, TooltipPopupState>;

export namespace TooltipPopup {
  export type State = TooltipPopupState;
  export type Props<T extends JSX.ElementType = "div"> = TooltipPopupProps<T>;
}
