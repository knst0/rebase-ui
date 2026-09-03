import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createUniqueId, onCleanup, untrack } from "solid-js";

import { ACTIVE_COMPOSITE_ITEM, useCompositeItem, useCompositeRootContext } from "../../internals/composite";
import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { mergeRefs } from "../../internals/mergeRefs";
import { overrideProps } from "../../internals/overrideProps";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useTabsListContext } from "../list/TabsListContext";
import { tabsStateAttributesMapping } from "../root/stateAttributesMapping";
import type { TabsRoot } from "../root/TabsRoot";
import { useTabsRootContext } from "../root/TabsRootContext";

export function TabsTab<T extends ValidComponent = "button">(props: TabsTab.Props<T>) {
  const [local, elementProps] = split(props as TabsTab.Props, { default: defaultProps }, ["as", "disabled", "id", "nativeButton", "value"]);

  const as = untrack(() => local.as);

  const rootContext = useTabsRootContext();
  const listContext = useTabsListContext();
  const compositeContext = useCompositeRootContext();

  const fallbackId = createUniqueId();
  const id = () => local.id ?? fallbackId;

  const disabled = createMemo(() => local.disabled);
  const active = createMemo(() => local.value === rootContext.value());

  const composite = useCompositeItem({
    metadata: () => ({
      get disabled() {
        return disabled();
      },
      get id() {
        return id();
      },
      get value() {
        return local.value;
      },
    }),
  });

  let isNavigating = false;

  createEffect(
    () => ({
      isActive: active(),
      index: composite?.index() ?? -1,
      highlighted: compositeContext?.highlightedIndex() ?? -1,
      isDisabled: disabled(),
      listElement: listContext.tabsListElement(),
    }),
    ({ isActive, index, highlighted, isDisabled, listElement }) => {
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
    },
  );

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => local.nativeButton,
    focusableWhenDisabled: () => true,
  });

  let unobserveTabElement: (() => void) | null = null;

  const observeTabElement = (element: HTMLElement | null) => {
    unobserveTabElement?.();
    unobserveTabElement = element === null ? null : listContext.registerTabResizeObserverElement(element);
  };

  onCleanup(() => {
    unobserveTabElement?.();
  });

  const ref = mergeRefs<HTMLElement | null>(buttonRef, composite?.compositeRef, observeTabElement);

  let isPressing = false;
  let isMainButton = false;

  const activate = (event: Event) => {
    rootContext.onValueChange(
      local.value,
      createChangeEventDetails(REASONS.none, event, undefined, {
        activationDirection: "none" as TabsTabActivationDirection,
      }),
    );
  };

  const tabProps = (externalProps: Record<string, any>) =>
    overrideProps(externalProps, {
      onClick(event: MouseEvent) {
        makeEventPreventable(event as any);
        externalProps.onClick?.(event);
        if ((event as any).rebaseUIHandlerPrevented) {
          return;
        }

        if (active() || disabled()) {
          return;
        }

        activate(event);
      },

      onFocus(event: FocusEvent) {
        externalProps.onFocus?.(event);

        if (active() || disabled()) {
          return;
        }

        if (listContext.activateOnFocus() && (!isPressing || isMainButton)) {
          activate(event);
        }
      },

      onPointerDown(event: PointerEvent) {
        externalProps.onPointerDown?.(event);

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
      },

      onKeyDown(event: KeyboardEvent) {
        isNavigating = true;
        externalProps.onKeyDown?.(event);
      },
    });

  const tabAriaProps = {
    role: "tab" as const,
    get id() {
      return id();
    },
    get "aria-controls"() {
      return rootContext.getTabPanelIdByValue(local.value);
    },
    get "aria-selected"() {
      return active() ? "true" : "false";
    },
    get [ACTIVE_COMPOSITE_ITEM]() {
      return active() ? "" : undefined;
    },
  };

  const state: TabsTabState = {
    active,
    disabled,
    orientation: rootContext.orientation,
    tabActivationDirection: rootContext.tabActivationDirection,
  };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[tabAriaProps, tabProps, elementProps, getButtonProps, composite?.getCompositeProps, { ref }]}
      stateAttributesMapping={tabsStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "button",
  disabled: false,
  nativeButton: true,
} satisfies Partial<TabsTab.Props>);

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
  active: Accessor<boolean>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  /**
   * The component orientation.
   */
  orientation: Accessor<TabsRoot.Orientation>;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: Accessor<TabsTab.ActivationDirection>;
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

export type TabsTabProps<T extends ValidComponent = "button"> = TabsTabOwnProps & Omit<RebaseUIComponentProps<T, TabsTabState>, "value">;

export namespace TabsTab {
  export type Props<T extends ValidComponent = "button"> = TabsTabProps<T>;
  export type OwnProps = TabsTabOwnProps;
  export type Value = TabsTabValue;
  export type ActivationDirection = TabsTabActivationDirection;
  export type Position = TabsTabPosition;
  export type Size = TabsTabSize;
  export type Metadata = TabsTabMetadata;
  export type State = TabsTabState;
}
