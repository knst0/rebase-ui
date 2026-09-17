import { isElement } from "@floating-ui/utils/dom";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { getTarget, isInteractiveElement } from "../../internals/floating/utils/element";
import type { ComboboxStore } from "../store/ComboboxStore";

export function handleInputPress(
  event: MouseEvent & { rebaseUIHandlerPrevented?: boolean | undefined },
  store: ComboboxStore,
  disabled: boolean,
  shouldIgnoreTarget?: ((target: Element | null) => boolean) | undefined,
) {
  if (event.rebaseUIHandlerPrevented) {
    return;
  }

  const target = getTarget(event);
  const targetElement = isElement(target) ? (target as Element) : null;
  if (targetElement !== event.currentTarget && (shouldIgnoreTarget?.(targetElement) || isInteractiveElement(targetElement))) {
    return;
  }

  event.preventDefault();

  if (disabled) {
    return;
  }

  store.context.inputRef.current?.focus();

  if (store.peekState().openOnInputClick) {
    store.context.setOpen(true, createChangeEventDetails(REASONS.inputPress, event));
  }
}
