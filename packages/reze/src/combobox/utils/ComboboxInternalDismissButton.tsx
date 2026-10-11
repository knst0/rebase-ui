import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { mergeRefs } from "../../internals/mergeRefs";
import { visuallyHiddenInput } from "../../internals/utils/visuallyHidden";
import { useComboboxRootContext } from "../root/ComboboxRootContext";

/**
 * @internal
 */
export function ComboboxInternalDismissButton(props: { ref?: ((element: HTMLSpanElement | null) => void) | undefined }) {
  const store = useComboboxRootContext();

  function handleDismiss(event: MouseEvent) {
    store.context.setOpen(false, createChangeEventDetails(REASONS.closePress, event, event.currentTarget as Element));
  }

  const button = createButton({
    nativeButton: false,
    onClick: handleDismiss,
  });

  return (
    <span
      ref={mergeRefs(props.ref, button.buttonRef)}
      // Spread: the static checker does not list `role` for `span`, but the runtime renders it.
      {...{ role: "button" }}
      tabindex={undefined}
      aria-disabled={button.ariaDisabled}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      aria-label="Dismiss"
      style={visuallyHiddenInput}
    />
  );
}
