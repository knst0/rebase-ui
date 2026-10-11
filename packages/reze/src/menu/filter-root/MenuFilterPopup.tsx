import type { JSX } from "reze-js";

import { REASONS } from "../../internals/event-details";
import type { FloatingFocusManagerInteractionType } from "../../internals/floating/components/FloatingFocusManager";
import type { MenuPopup } from "../popup/MenuPopup";
import { MenuPopupPlain } from "../popup/MenuPopup";
import { useMenuRootContext } from "../root/MenuRootContext";
import { useMenuFilterPopup } from "./useMenuFilterPopup";

/**
 * A container for the filter input and item list.
 * Renders a `<div>` element with a `dialog` role.
 *
 * @internal
 */
export function MenuFilterPopup<T extends JSX.ElementType = "div">(props: MenuPopup.Props<T>) {
  const { store, parent, orientation } = useMenuRootContext();

  const interactionProps = useMenuFilterPopup(orientation);

  // The input holds real focus; the popup is never the focus target.
  // One-shot reads: the focus manager calls the resolver outside a tracking scope.
  function resolveInitialFocus(): boolean | HTMLElement {
    const isOpen = store.peek("open") as boolean;
    const method = store.peek("openMethod") as string | null;
    const reason = store.peek("lastOpenChangeReason") as string | null;
    const mayFocus =
      parent.type !== "menu" ||
      (isOpen &&
        (method === "keyboard" ||
          reason === REASONS.listNavigation ||
          reason === REASONS.triggerHover ||
          reason === REASONS.triggerPress));
    if (!mayFocus) {
      return false;
    }
    // A tap would raise the on-screen keyboard, but a screen reader press (such as an iOS
    // VoiceOver double-tap) still reports a touch and needs the input focused.
    const touchOpen = (method === "touch" || method === "pen") && !store.context.virtualPress;
    if ((isOpen && reason === REASONS.triggerHover) || touchOpen) {
      return false;
    }
    return store.context.virtualFocusRef?.current ?? false;
  }

  const initialFocus = (_openType: FloatingFocusManagerInteractionType) => resolveInitialFocus();

  // RenderElement layers are last-wins: spreading the filter interaction props would drop the
  // dismiss and list-navigation popup handlers from the store. Chain them explicitly, mirroring
  // upstream `mergeProps` (store first, then filter, then user).
  const { onKeyDown: filterOnKeyDown, onMouseDown: filterOnMouseDown } = interactionProps as {
    onKeyDown: ((event: KeyboardEvent) => void) | undefined;
    onMouseDown: ((event: MouseEvent) => void) | undefined;
  };
  const userProps = props as Record<string, unknown>;

  function getStoreHandler(key: "onKeyDown" | "onMouseDown") {
    return (store.peek("popupProps") as Record<string, (...args: never[]) => void> | undefined)?.[key];
  }

  function onKeyDown(event: KeyboardEvent) {
    (getStoreHandler("onKeyDown") as ((event: KeyboardEvent) => void) | undefined)?.(event);
    (filterOnKeyDown as ((event: KeyboardEvent) => void) | undefined)?.(event);
    (userProps.onKeyDown as ((event: KeyboardEvent) => void) | undefined)?.(event);
  }

  function onMouseDown(event: MouseEvent) {
    (getStoreHandler("onMouseDown") as ((event: MouseEvent) => void) | undefined)?.(event);
    (filterOnMouseDown as ((event: MouseEvent) => void) | undefined)?.(event);
    (userProps.onMouseDown as ((event: MouseEvent) => void) | undefined)?.(event);
  }

  // The remaining filter interaction props (pointer tracking, focus restoration) ride the
  // consumer layer, which `MenuPopupPlain` resolves last-wins below its internal handlers for
  // unchained keys and above the store for the rest.
  const { onKeyDown: _onKeyDown, onMouseDown: _onMouseDown, ...restInteractionProps } = interactionProps;

  return (
    <MenuPopupPlain
      {...(restInteractionProps as Record<string, unknown>)}
      {...(userProps as Record<string, unknown>)}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      role="dialog"
      initialFocus={(props.initialFocus ?? initialFocus) as MenuPopup.Props["initialFocus"]}
    />
  );
}
