import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, untrack, type JSX } from "reze-js";

import { useCompositeItem, useCompositeRootContext } from "../../internals/composite";
import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import { useTabsListContext } from "../list/TabsListContext";
import type { TabsRoot } from "../root/TabsRoot";
import { useTabsRootContext } from "../root/TabsRootContext";

/**
 * An individual interactive tab button that toggles the corresponding panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/tabs)
 */
export function TabsTab<T extends JSX.ElementType = "button">(props: TabsTab.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "disabled",
    "id",
    "nativeButton",
    "value",
    "onClick",
    "onMouseDown",
    "onKeyDown",
    "onKeyUp",
    "onPointerDown",
    "onFocus",
    "onMouseMove",
    "tabindex",
    "tabIndex",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const rootContext = useTabsRootContext();
  const listContext = useTabsListContext();
  const compositeContext = useCompositeRootContext();

  const nativeButton = props.nativeButton ?? true;
  const fallbackId = createUniqueId();

  function id(): string {
    return props.id ?? fallbackId;
  }

  function disabled(): boolean {
    return props.disabled ?? false;
  }

  function active(): boolean {
    return props.value === rootContext.value();
  }

  const composite = useCompositeItem({
    metadata: () => ({
      get disabled() {
        return disabled();
      },
      get id() {
        return id();
      },
      get value() {
        return props.value;
      },
    }),
  });

  let isNavigating = false;

  effect(() => {
    const isActive = active();
    const index = composite?.index() ?? -1;
    const highlighted = compositeContext?.highlightedIndex() ?? -1;
    const isDisabled = disabled();
    const listElement = listContext.tabsListElement();

    // The apply half runs one-shot: the highlight sync never resubscribes this effect.
    untrack(() => {
      if (isNavigating) {
        isNavigating = false;
        return;
      }

      if (!(isActive && index > -1 && highlighted !== index)) {
        return;
      }

      if (listElement !== null) {
        const activeElement = listElement.ownerDocument.activeElement;
        if (activeElement !== null && listElement.contains(activeElement)) {
          return;
        }
      }

      if (!isDisabled) {
        compositeContext?.setHighlightedIndex(index);
      }
    });
  });

  function activate(event: Event) {
    rootContext.onValueChange(
      props.value,
      createChangeEventDetails(REASONS.none, event, undefined, {
        activationDirection: "none" as TabsTabActivationDirection,
      }),
    );
  }

  let isPressing = false;
  let isMainButton = false;

  function handleTabClick(event: MouseEvent): void {
    makeEventPreventable(event as RebaseUIEvent<MouseEvent>);
    (props.onClick as unknown as ((event: MouseEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<MouseEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    if (active() || disabled()) {
      return;
    }

    activate(event);
  }

  function handleTabFocus(event: FocusEvent): void {
    (props.onFocus as unknown as ((event: FocusEvent) => void) | undefined)?.(event);

    if (active() || disabled()) {
      return;
    }

    if (listContext.activateOnFocus() && (!isPressing || isMainButton)) {
      activate(event);
    }
  }

  function handleTabPointerDown(event: PointerEvent): void {
    (props.onPointerDown as unknown as ((event: PointerEvent) => void) | undefined)?.(event);

    if (active() || disabled()) {
      return;
    }

    isPressing = true;
    isMainButton = event.button === 0;

    const ownerDocument = (event.currentTarget as HTMLElement).ownerDocument;

    const handlePointerEnd = () => {
      isPressing = false;
      isMainButton = false;
      ownerDocument.removeEventListener("pointerup", handlePointerEnd);
      ownerDocument.removeEventListener("pointercancel", handlePointerEnd);
    };

    ownerDocument.addEventListener("pointerup", handlePointerEnd);
    ownerDocument.addEventListener("pointercancel", handlePointerEnd);
  }

  function handleTabKeyDown(event: KeyboardEvent): void {
    isNavigating = true;
    (props.onKeyDown as unknown as ((event: KeyboardEvent) => void) | undefined)?.(event);
  }

  function handleMouseMoveFallback(event: MouseEvent): void {
    (props.onMouseMove as unknown as ((event: MouseEvent) => void) | undefined)?.(event);
  }

  const button = createButton({
    get disabled() {
      return disabled();
    },
    focusableWhenDisabled: true,
    nativeButton,
    onClick: handleTabClick,
    get onMouseDown() {
      return props.onMouseDown;
    },
    onKeyDown: handleTabKeyDown,
    get onKeyUp() {
      return props.onKeyUp;
    },
    onPointerDown: handleTabPointerDown,
  });

  // Live external props: getters keep the merged handlers reactive to prop changes.
  const compositeExternalProps: Record<string, any> = {};
  Object.defineProperty(compositeExternalProps, "onFocus", {
    enumerable: true,
    configurable: true,
    get: () => handleTabFocus,
  });
  Object.defineProperty(compositeExternalProps, "onMouseMove", {
    enumerable: true,
    configurable: true,
    get: () => props.onMouseMove,
  });
  const compositeProps = composite?.getCompositeProps(compositeExternalProps);

  let unobserveTabElement: (() => void) | null = null;

  const observeTabElement = (element: HTMLElement | null) => {
    unobserveTabElement?.();
    unobserveTabElement = element === null ? null : listContext.registerTabResizeObserverElement(element);
  };

  onCleanup(() => {
    unobserveTabElement?.();
  });

  const ref = mergeRefs(
    button.buttonRef,
    composite?.compositeRef,
    observeTabElement,
    props.ref as ((element: HTMLElement | null) => void) | undefined,
  );

  function snapshot(): TabsTabState {
    return {
      active: active(),
      disabled: disabled(),
      orientation: rootContext.orientation(),
      tabActivationDirection: rootContext.tabActivationDirection(),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts, which would drop the tab's focus and unregister it from the composite.
  // The default path renders a static `<button>`; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <button
        {...(rest as Record<string, unknown>)}
        role="tab"
        id={id()}
        aria-controls={rootContext.getTabPanelIdByValue(props.value)}
        aria-selected={active() ? "true" : "false"}
        data-composite-item-active={active() ? "" : undefined}
        type={button.type}
        bool:disabled={button.disabled}
        tabindex={compositeProps?.tabIndex}
        aria-disabled={button.ariaDisabled}
        data-active={active() ? "" : undefined}
        data-disabled={disabled() ? "" : undefined}
        data-orientation={rootContext.orientation()}
        data-activation-direction={rootContext.tabActivationDirection()}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onClick={button.onClick}
        onMouseDown={button.onMouseDown}
        onKeyDown={button.onKeyDown}
        onKeyUp={button.onKeyUp}
        onPointerDown={button.onPointerDown}
        onFocus={compositeProps?.onFocus ?? handleTabFocus}
        onMouseMove={compositeProps?.onMouseMove ?? handleMouseMoveFallback}
        ref={ref}
      >
        {resolveChildrenValue(children, snapshot)}
      </button>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="tab"
      id={id()}
      aria-controls={rootContext.getTabPanelIdByValue(props.value)}
      aria-selected={active() ? "true" : "false"}
      data-composite-item-active={active() ? "" : undefined}
      type={button.type}
      bool:disabled={button.disabled}
      tabindex={compositeProps?.tabIndex}
      aria-disabled={button.ariaDisabled}
      data-active={active() ? "" : undefined}
      data-disabled={disabled() ? "" : undefined}
      data-orientation={rootContext.orientation()}
      data-activation-direction={rootContext.tabActivationDirection()}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      onFocus={compositeProps?.onFocus ?? handleTabFocus}
      onMouseMove={compositeProps?.onMouseMove ?? handleMouseMoveFallback}
      ref={ref}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export type TabsTabValue = any | null;

export type TabsTabActivationDirection = "left" | "right" | "up" | "down" | "none";

export interface TabsTabPosition {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TabsTabSize {
  width: number;
  height: number;
}

export interface TabsTabMetadata {
  disabled: boolean;
  id: string | undefined;
  value: TabsTab.Value | undefined;
}

export interface TabsTabState {
  /**
   * Whether the component is active.
   */
  active: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * The component orientation.
   */
  orientation: TabsRoot.Orientation;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: TabsTab.ActivationDirection;
}

export interface TabsTabOwnProps extends NativeButtonProps {
  /**
   * The value of the Tab.
   */
  value: TabsTabValue;
  /**
   * Whether the Tab is disabled.
   *
   * If the first Tab on a `<Tabs.List>` is disabled, it won't initially be selected.
   * Instead, the next enabled Tab will be selected.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type TabsTabProps<T extends JSX.ElementType = "button"> = TabsTabOwnProps &
  ButtonEventHandlers &
  Omit<RebaseUIComponentProps<T, TabsTabState>, "value">;

export namespace TabsTab {
  export type Props<T extends JSX.ElementType = "button"> = TabsTabProps<T>;
  export type OwnProps = TabsTabOwnProps;
  export type Value = TabsTabValue;
  export type ActivationDirection = TabsTabActivationDirection;
  export type Position = TabsTabPosition;
  export type Size = TabsTabSize;
  export type Metadata = TabsTabMetadata;
  export type State = TabsTabState;
}
