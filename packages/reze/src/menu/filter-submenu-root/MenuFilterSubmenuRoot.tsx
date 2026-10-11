import { effect, untrack, type JSX } from "reze-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import {
  isCrossOrientationCloseKey,
  isCrossOrientationOpenKey,
  isMainOrientationKey,
} from "../../internals/floating/interactions/createListNavigation";
import { activeElement, contains } from "../../internals/floating/utils/element";
import { stopEvent } from "../../internals/floating/utils/event";
import { stableCallback } from "../../internals/stableCallback";
import { MenuFilterProviderContext } from "../filter-provider/MenuFilterProviderContext";
import type { MenuFilterProviderOptions } from "../filter-provider/MenuFilterProviderOptions";
import { MenuFilterDropdown } from "../filter-root/MenuFilterDropdown";
import { moveHighlightFrom } from "../filter-root/moveHighlightFrom";
import { useMenuFilterRoot } from "../filter-root/useMenuFilterRoot";
import type { MenuRoot } from "../root/MenuRoot";
import { MenuRoot as MenuRootComponent } from "../root/MenuRoot";
import { useMenuRootContext } from "../root/MenuRootContext";
import type { MenuStore } from "../store/MenuStore";
import type { MenuSubmenuRoot } from "../submenu-root/MenuSubmenuRoot";
import { MenuSubmenuRootContext, useMenuSubmenuRootContext } from "../submenu-root/MenuSubmenuRootContext";
import { isKeyboardOpen } from "../utils/isKeyboardOpen";

interface ParentReference {
  reference: HTMLElement;
  trigger: HTMLElement;
}

/**
 * The filterable implementation of `Menu.SubmenuRoot`, rendered in its place when the submenu
 * root sits inside `Menu.FilterProvider`.
 *
 * @internal
 */
export function MenuFilterSubmenuRoot(props: MenuFilterSubmenuRootProps): JSX.Element {
  const parent = useMenuRootContext();
  const parentStore = parent.store as MenuStore<unknown>;

  const parentDisabled = () => (parentStore.select("disabled") as boolean) ?? false;

  const { virtualFocusRef, rootProps, dropdownProps, allowEscape, resetOnPointerLeave } = useMenuFilterRoot(props);

  let parentReference: ParentReference | null = null;

  function handleSubmenuEnter(trigger: HTMLElement, event: KeyboardEvent | undefined) {
    const focusedElement = parent.virtualFocus ? parentStore.context.virtualFocusRef?.current : activeElement(trigger.ownerDocument);

    if (focusedElement instanceof HTMLElement) {
      parentReference = { reference: focusedElement, trigger };
      parentStore.setActiveIndex(null, event ? REASONS.keyboard : REASONS.none, event);
    }
  }

  function highlightTrigger(trigger: HTMLElement, event: KeyboardEvent) {
    parentStore.highlightItem(trigger, REASONS.keyboard, event);
  }

  function handleSubmenuExit(event: KeyboardEvent) {
    if (!parentReference) {
      return;
    }

    parentReference.reference.focus({ preventScroll: true });
    highlightTrigger(parentReference.trigger, event);
  }

  const onOpenChangeProp = stableCallback(() => (props as { onOpenChange?: MenuSubmenuRoot.Props["onOpenChange"] }).onOpenChange);

  function handleOpenChange(nextOpen: boolean, details: MenuSubmenuRoot.ChangeEventDetails) {
    untrack(() => onOpenChangeProp(nextOpen, details));
    if (details.isCanceled) {
      return;
    }

    if (!nextOpen) {
      if (details.reason === REASONS.escapeKey && details.trigger instanceof HTMLElement) {
        highlightTrigger(details.trigger, details.event);
        // `MenuPopup` returns focus through `getReturnElement`, so point it at the element that
        // can hold real focus: the parent's input, not its untabbable trigger.
        parentReference = {
          reference: parent.virtualFocus ? (parentStore.context.virtualFocusRef?.current ?? details.trigger) : details.trigger,
          trigger: details.trigger,
        };
      }
      return;
    }

    parentReference = null;
    if (details.trigger instanceof HTMLElement && isKeyboardOpen(details.reason, details.event)) {
      // A keyboard click reports its click, which isn't the key that opened the submenu.
      handleSubmenuEnter(details.trigger, details.reason === REASONS.listNavigation ? (details.event as KeyboardEvent) : undefined);
    }
  }

  // `props.children` passes through the JSX below without an eager body read, so the children
  // are created inside the providers and see the filter contexts.
  return (
    // The root that consumes the provider resets it, so the inner menu root doesn't
    // re-delegate and a plain nested submenu inside a filterable menu stays plain.
    <MenuFilterProviderContext value={null}>
      <MenuSubmenuRootContext value={{ parentMenu: parentStore }}>
        <MenuRootComponent
          {...rootProps}
          virtualFocus
          virtualFocusRef={virtualFocusRef}
          allowEscape={allowEscape}
          resetOnPointerLeave={resetOnPointerLeave}
          disabled={parentDisabled() || props.disabled}
          onOpenChange={handleOpenChange}
        >
          <MenuFilterSubmenuNavigation
            parentStore={parentStore}
            parentVirtualFocus={parent.virtualFocus}
            parentAllowEscape={parent.virtualFocus && parent.allowEscape}
            parentOrientation={parent.orientation}
            parentLoopFocus={parent.loopFocus}
            getReturnElement={() =>
              parentReference?.reference ?? (parent.virtualFocus ? (parentStore.context.virtualFocusRef?.current ?? null) : null)
            }
            onSubmenuEnter={handleSubmenuEnter}
            onSubmenuExit={handleSubmenuExit}
          >
            <MenuFilterDropdown {...dropdownProps}>{props.children}</MenuFilterDropdown>
          </MenuFilterSubmenuNavigation>
        </MenuRootComponent>
      </MenuSubmenuRootContext>
    </MenuFilterProviderContext>
  );
}

interface MenuFilterSubmenuNavigationProps {
  children: JSX.Element;
  parentStore: MenuStore<unknown>;
  parentVirtualFocus: boolean;
  parentAllowEscape: boolean;
  parentOrientation: MenuRoot.Orientation;
  parentLoopFocus: boolean;
  onSubmenuEnter: (trigger: HTMLElement, event: KeyboardEvent) => void;
  onSubmenuExit: (event: KeyboardEvent) => void;
  getReturnElement: () => HTMLElement | null;
}

function MenuFilterSubmenuNavigation(props: MenuFilterSubmenuNavigationProps) {
  const { store, orientation } = useMenuRootContext();
  const ownStore = store as MenuStore<unknown>;
  const submenuContext = useMenuSubmenuRootContext();

  const mounted = () => (ownStore.select("open") as boolean) && (ownStore.select("mounted") as boolean);

  let wasMounted = false;

  const handleReturnFocus = () => {
    // A plain parent has no input to return to. Focus the trigger this submenu opened from, as a
    // plain submenu does, so a hover close doesn't strand focus on the body.
    const ownTrigger = [...ownStore.context.triggerElements.elements()][0];
    return props.getReturnElement() ?? (ownTrigger instanceof HTMLElement ? ownTrigger : null);
  };

  // A hover close makes the focus manager skip its return focus, which would strand the
  // submenu input's focus on the body once the popup unmounts.
  effect(() => {
    const isMounted = mounted();
    // One-shot handoff: the value only steers this write.
    untrack(() => {
      const was = wasMounted;
      wasMounted = isMounted;
      if (isMounted || !was) {
        return;
      }

      const returnElement = handleReturnFocus();
      if (!returnElement || !props.parentStore.peek("open")) {
        return;
      }
      const doc = returnElement.ownerDocument;
      const activeEl = activeElement(doc);
      if (activeEl === doc.body || contains(ownStore.peek("popupElement") as Element | null, activeEl)) {
        returnElement.focus({ preventScroll: true });
      }
    });
  });

  function moveInParent(from: HTMLElement, event: KeyboardEvent) {
    const item = moveHighlightFrom(props.parentStore, from, event, {
      orientation: props.parentOrientation,
      rtl: document.dir === "rtl",
      loopFocus: props.parentLoopFocus,
      allowEscape: props.parentAllowEscape,
    });
    if (!props.parentVirtualFocus) {
      item?.focus({ preventScroll: true });
    }
  }

  function close(event: KeyboardEvent) {
    if (!untrack(() => ownStore.peek("open"))) {
      return;
    }

    // The key can reach this popup re-dispatched on its highlighted item, so it can't be left to
    // bubble to the parent. A close key that also navigates the parent moves it from here.
    stopEvent(event);
    const trigger = untrack(() => ownStore.peek("activeTriggerElement")) as Element | null;

    const eventDetails = createChangeEventDetails(REASONS.listNavigation, event);
    ownStore.setOpen(false, eventDetails);

    if (!eventDetails.isCanceled) {
      props.onSubmenuExit(event);
    }

    // `onSubmenuExit` bails when the submenu was opened by pointer, so return focus here.
    const returnElement = props.getReturnElement() ?? untrack(() => ownStore.peek("activeTriggerElement"));
    if (
      !untrack(() => ownStore.peek("open")) &&
      returnElement instanceof HTMLElement &&
      activeElement(returnElement.ownerDocument) !== returnElement
    ) {
      returnElement.focus();
    }

    if (
      !untrack(() => ownStore.peek("open")) &&
      trigger instanceof HTMLElement &&
      isMainOrientationKey(event.key, props.parentOrientation)
    ) {
      moveInParent(trigger, event);
    }
  }

  function handleTriggerKeyDown(event: KeyboardEvent & { currentTarget: HTMLElement }) {
    if (isMainOrientationKey(event.key, props.parentOrientation)) {
      moveInParent(event.currentTarget, event);
      stopEvent(event);
      return;
    }

    const open = untrack(() => ownStore.peek("open"));
    const isRtl = document.dir === "rtl";
    const isCloseKey = isCrossOrientationCloseKey(event.key, orientation, isRtl, false);

    if (open && isCloseKey) {
      close(event);
      return;
    }

    const isOpenKey = isCrossOrientationOpenKey(event.key, props.parentOrientation, isRtl);
    if (!isOpenKey) {
      return;
    }

    stopEvent(event);

    if (open) {
      // Re-entering an already-open submenu hands the cursor to its own focus owner. The submenu
      // is always virtually focused, so there is no roving-focus branch here. The highlight is
      // kept, so an automatic highlight or an earlier keyboard position survives re-entry.
      props.onSubmenuEnter(event.currentTarget, event);
      ownStore.context.virtualFocusRef?.current?.focus({ preventScroll: true });
      return;
    }

    ownStore.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event, event.currentTarget));
  }

  function handlePopupKeyDown(event: KeyboardEvent) {
    // A key that composes text in the input must not close the submenu.
    if ((event as KeyboardEvent & { which?: number }).which === 229) {
      return;
    }
    const isCloseKey = isCrossOrientationCloseKey(event.key, orientation, document.dir === "rtl", false);
    if (isCloseKey) {
      close(event);
    }
  }

  // `props.children` passes through the JSX below without an eager body read, so the children
  // are created inside the provider and see the submenu navigation context.
  return (
    <MenuSubmenuRootContext
      value={{
        parentMenu: submenuContext?.parentMenu ?? props.parentStore,
        getReturnElement: handleReturnFocus,
        onTriggerKeyDown: handleTriggerKeyDown,
        onPopupKeyDown: handlePopupKeyDown,
      }}
    >
      {props.children}
    </MenuSubmenuRootContext>
  );
}

export type MenuFilterSubmenuRootProps = MenuSubmenuRoot.Props & MenuFilterProviderOptions;

export namespace MenuFilterSubmenuRoot {
  export type Props = MenuFilterSubmenuRootProps;
}
