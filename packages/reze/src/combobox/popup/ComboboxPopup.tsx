import { dynamicElement, effect, omitProps, untrack, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { FloatingFocusManager } from "../../internals/floating";
import type { FloatingFocusManagerInteractionType } from "../../internals/floating/components/FloatingFocusManager";
import { contains, getTarget } from "../../internals/floating/utils/element";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxPositionerContext } from "../positioner/ComboboxPositionerContext";
import { useComboboxDerivedItemsContext, useComboboxFloatingContext, useComboboxRootContext } from "../root/ComboboxRootContext";

function getComboboxPopupId(rootId: string | null | undefined) {
  return rootId == null ? undefined : `${rootId}-popup`;
}

/**
 * A container for the list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxPopup<T extends JSX.ElementType = "div">(props: ComboboxPopup.Props<T>) {
  const rest = omitProps(
    props as Record<string, unknown>,
    "as",
    "initialFocus",
    "finalFocus",
    "onFocus",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useComboboxRootContext();
  const positioning = useComboboxPositionerContext();
  const floatingRootContext = useComboboxFloatingContext();
  const derivedItems = useComboboxDerivedItemsContext() as unknown as {
    filteredItems: unknown[] | (() => unknown[]);
  };

  function empty() {
    const filteredItems = derivedItems.filteredItems;
    const items = typeof filteredItems === "function" ? filteredItems() : filteredItems;
    return items.length === 0;
  }
  function mounted() {
    return store.select("mounted") as boolean;
  }
  function inputInsidePopup() {
    return store.select("inputInsidePopup") as boolean;
  }
  function modal() {
    return store.select("modal") as boolean;
  }

  // Prefer the rendered DOM id, which a `render` prop element or function may override.
  effect(() => {
    const rootId = store.select("id") as string | undefined;
    const explicitId = (props as Record<string, unknown>).id as string | undefined;
    const popupId = explicitId ?? (inputInsidePopup() ? getComboboxPopupId(rootId) : undefined);
    // One-shot sync: the id only steers this write.
    untrack(() => {
      store.set("popupId", store.context.popupRef.current?.id || popupId);
    });
  });

  runOnOpenChangeComplete({
    open: () => store.select("open") as boolean,
    ref: () => store.context.popupRef.current,
    onComplete() {
      if (store.peek("open")) {
        store.context.onOpenChangeComplete(true);
      }
    },
  });

  function snapshot(): ComboboxPopupState {
    return {
      open: store.select("open") as boolean,
      side: mounted() ? (store.select("popupSide") as Side | null) : null,
      align: positioning.align(),
      anchorHidden: positioning.anchorHidden(),
      transitionStatus: store.select("transitionStatus") as TransitionStatus,
      empty: empty(),
    };
  }

  function storePopupProps(): Record<string, unknown> {
    return store.select("popupProps") as Record<string, unknown>;
  }

  function popupId(): string | undefined {
    const explicitId = (props as Record<string, unknown>).id as string | undefined;
    const rootId = store.select("id") as string | undefined;
    return explicitId ?? (inputInsidePopup() ? getComboboxPopupId(rootId) : undefined);
  }

  // User handlers replace the internal ones (matching the Solid layer, where `elementProps`
  // override the store and default props layers).
  function handleFocus(event: FocusEvent) {
    const user = props.onFocus as ((event: FocusEvent) => void) | undefined;
    if (user) {
      user(event);
      return;
    }
    const target = getTarget(event) as Element | null;
    if (
      (store.peek("openMethod") as string | null) !== "touch" &&
      (contains(store.peek("listElement") as Element | null, target) || target === event.currentTarget)
    ) {
      store.context.inputRef.current?.focus();
    }
  }

  function resolveKeyDown(): ((event: KeyboardEvent) => void) | undefined {
    return (
      ((props as Record<string, unknown>).onKeyDown as ((event: KeyboardEvent) => void) | undefined) ??
      (storePopupProps().onKeyDown as ((event: KeyboardEvent) => void) | undefined)
    );
  }

  function resolvePointerDown(): ((event: PointerEvent) => void) | undefined {
    return (
      ((props as Record<string, unknown>).onPointerDown as ((event: PointerEvent) => void) | undefined) ??
      (storePopupProps().onPointerDown as ((event: PointerEvent) => void) | undefined)
    );
  }

  function resolveMouseDown(): ((event: MouseEvent) => void) | undefined {
    return (
      ((props as Record<string, unknown>).onMouseDown as ((event: MouseEvent) => void) | undefined) ??
      (storePopupProps().onMouseDown as ((event: MouseEvent) => void) | undefined)
    );
  }

  function style(): string | JSX.CSSProperties | undefined {
    return mergeStyleValue(
      (store.select("transitionStatus") === "starting" ? { transition: "none" } : {}) as Record<string, string | undefined>,
      resolveStyleValue(props.style, snapshot()),
    );
  }

  // Default initial focus logic:
  // If opened by touch, focus the popup element to prevent the virtual keyboard from opening
  // (this is required for Android specifically as iOS handles this automatically).
  function resolveInitialFocus() {
    if (props.initialFocus !== undefined) {
      return props.initialFocus;
    }
    if (!inputInsidePopup()) {
      return false;
    }
    return (interactionType: FloatingFocusManagerInteractionType) =>
      interactionType === "touch" ? store.context.popupRef.current : store.peek("inputElement");
  }

  // `FloatingFocusManager` reads `returnFocus` imperatively when focus goes back to the
  // trigger, so the flag is snapshotted instead of subscribed to.
  function resolveFinalFocus() {
    if (props.finalFocus != null) {
      return props.finalFocus;
    }
    return (store.peek("inputInsidePopup") as boolean) ? undefined : false;
  }

  function focusManagerModal() {
    return !inputInsidePopup() || modal();
  }

  function getInsideElements() {
    return [store.context.startDismissRef.current, store.context.endDismissRef.current];
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <FloatingFocusManager
        context={floatingRootContext}
        disabled={!mounted()}
        modal={focusManagerModal()}
        openInteractionType={store.peek("openMethod") as FloatingFocusManagerInteractionType | null}
        initialFocus={resolveInitialFocus() as never}
        returnFocus={resolveFinalFocus() as never}
        getInsideElements={getInsideElements}
      >
        <div
          {...(rest as Record<string, unknown>)}
          id={popupId()}
          role={inputInsidePopup() ? "dialog" : "presentation"}
          tabindex={(storePopupProps().tabindex as number | undefined) ?? undefined}
          data-base-ui-focusable={(storePopupProps()["data-base-ui-focusable"] as string | undefined) ?? undefined}
          onFocus={handleFocus}
          onKeyDown={resolveKeyDown()}
          onPointerDown={resolvePointerDown()}
          onMouseDown={resolveMouseDown()}
          data-open={(store.select("open") as boolean) ? "" : undefined}
          data-closed={(store.select("open") as boolean) ? undefined : ""}
          data-side={mounted() ? ((store.select("popupSide") as Side | null) ?? undefined) : undefined}
          data-align={positioning.align()}
          data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
          data-empty={empty() ? "" : undefined}
          data-starting-style={(store.select("transitionStatus") as string) === "starting" ? "" : undefined}
          data-ending-style={(store.select("transitionStatus") as string) === "ending" ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={style()}
          ref={mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, (element: HTMLDivElement | null) => {
            store.context.popupRef.current = element;
          })}
        >
          {resolveChildrenValue(children, snapshot)}
        </div>
        {focusManagerModal() && (
          <span
            ref={(element: HTMLSpanElement | null) => {
              store.context.endDismissRef.current = element;
            }}
            tabindex={0}
            aria-hidden="true"
            style={{ position: "fixed", top: "0", left: "0", width: "1px", height: "0", opacity: "0" }}
            onFocus={(event: FocusEvent) => {
              store.context.inputRef.current?.focus();
              (event.currentTarget as HTMLElement).blur();
            }}
          />
        )}
      </FloatingFocusManager>
    );
  }

  return (
    <FloatingFocusManager
      context={floatingRootContext}
      disabled={!mounted()}
      modal={focusManagerModal()}
      openInteractionType={store.peek("openMethod") as FloatingFocusManagerInteractionType | null}
      initialFocus={resolveInitialFocus() as never}
      returnFocus={resolveFinalFocus() as never}
      getInsideElements={getInsideElements}
    >
      <Tag
        {...(rest as Record<string, unknown>)}
        id={popupId()}
        role={inputInsidePopup() ? "dialog" : "presentation"}
        tabindex={(storePopupProps().tabindex as number | undefined) ?? undefined}
        data-base-ui-focusable={(storePopupProps()["data-base-ui-focusable"] as string | undefined) ?? undefined}
        onFocus={handleFocus}
        onKeyDown={resolveKeyDown()}
        onPointerDown={resolvePointerDown()}
        onMouseDown={resolveMouseDown()}
        data-open={(store.select("open") as boolean) ? "" : undefined}
        data-closed={(store.select("open") as boolean) ? undefined : ""}
        data-side={mounted() ? ((store.select("popupSide") as Side | null) ?? undefined) : undefined}
        data-align={positioning.align()}
        data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
        data-empty={empty() ? "" : undefined}
        data-starting-style={(store.select("transitionStatus") as string) === "starting" ? "" : undefined}
        data-ending-style={(store.select("transitionStatus") as string) === "ending" ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={style()}
        ref={mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, (element: HTMLDivElement | null) => {
          store.context.popupRef.current = element;
        })}
      >
        {resolveChildrenValue(children, snapshot)}
      </Tag>
      {focusManagerModal() && (
        <span
          ref={(element: HTMLSpanElement | null) => {
            store.context.endDismissRef.current = element;
          }}
          tabindex={0}
          aria-hidden="true"
          style={{ position: "fixed", top: "0", left: "0", width: "1px", height: "0", opacity: "0" }}
          onFocus={(event: FocusEvent) => {
            store.context.inputRef.current?.focus();
            (event.currentTarget as HTMLElement).blur();
          }}
        />
      )}
    </FloatingFocusManager>
  );
}

export interface ComboboxPopupState {
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | null;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether there are no items to display.
   */
  empty: boolean;
}

export interface ComboboxPopupProps extends RebaseUIComponentProps<"div", ComboboxPopupState> {
  /**
   * Determines the element to focus when the popup is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `{ current }`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?:
    | boolean
    | { current: HTMLElement | null }
    | ((openType: FloatingFocusManagerInteractionType) => void | boolean | HTMLElement | null)
    | undefined;
  /**
   * Determines the element to focus when the popup is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `{ current }`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | boolean
    | { current: HTMLElement | null }
    | ((closeType: FloatingFocusManagerInteractionType) => void | boolean | HTMLElement | null)
    | undefined;
}

export type ComboboxPopupPropsWithGenerics<T extends JSX.ElementType = "div"> = Omit<ComboboxPopupProps, "as"> &
  RebaseUIComponentProps<T, ComboboxPopupState> & {
    initialFocus?: ComboboxPopupProps["initialFocus"];
    finalFocus?: ComboboxPopupProps["finalFocus"];
  };

export namespace ComboboxPopup {
  export type State = ComboboxPopupState;
  export type Props<T extends JSX.ElementType = "div"> = T extends "div" ? ComboboxPopupProps : ComboboxPopupPropsWithGenerics<T>;
}
