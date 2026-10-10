import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

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
export function MenuFilterPopup<T extends ValidComponent = "div">(props: MenuPopup.Props<T>) {
  const { store, parent, orientation } = useMenuRootContext();

  const open = () => store.select("open") as boolean;
  const openMethod = () => store.select("openMethod") as string | null;
  const lastOpenChangeReason = () => store.select("lastOpenChangeReason") as string | null;

  const interactionProps = useMenuFilterPopup(orientation);

  const openedByHover = () => open() && lastOpenChangeReason() === REASONS.triggerHover;
  const mayFocusInput = () =>
    parent.type !== "menu" ||
    (open() &&
      (openMethod() === "keyboard" ||
        lastOpenChangeReason() === REASONS.listNavigation ||
        lastOpenChangeReason() === REASONS.triggerHover ||
        lastOpenChangeReason() === REASONS.triggerPress));

  // The input holds real focus; the popup is never the focus target.
  function resolveInitialFocus(): boolean | HTMLElement {
    if (!untrack(mayFocusInput)) {
      return false;
    }
    // A tap would raise the on-screen keyboard, but a screen reader press (such as an iOS
    // VoiceOver double-tap) still reports a touch and needs the input focused.
    const method = untrack(openMethod);
    const touchOpen = (method === "touch" || method === "pen") && !store.context.virtualPress;
    if (untrack(openedByHover) || touchOpen) {
      return false;
    }
    return store.context.virtualFocusRef?.current ?? false;
  }

  const initialFocus = (_openType: FloatingFocusManagerInteractionType) => resolveInitialFocus();

  return (
    <MenuPopupPlain
      {...(interactionProps as Record<string, unknown>)}
      {...(props as Record<string, unknown>)}
      role="dialog"
      initialFocus={props.initialFocus ?? initialFocus}
    />
  );
}
