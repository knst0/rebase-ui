import { createButton } from '../../internals/create-button';
import { createChangeEventDetails, REASONS } from '../../internals/event-details';
import { mergeRefs } from '../../internals/mergeRefs';
import { visuallyHiddenInput } from '../../internals/utils/visuallyHidden';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

/**
 * @internal
 */
export function ComboboxInternalDismissButton(props: {
  ref?: ((element: HTMLSpanElement | null) => void) | undefined;
}) {
  const store = useComboboxRootContext();

  const { buttonRef, getButtonProps } = createButton({
    native: false,
  });

  function handleDismiss(event: MouseEvent) {
    store.context.setOpen(
      false,
      createChangeEventDetails(REASONS.closePress, event, event.currentTarget as Element),
    );
  }

  const dismissProps = getButtonProps({
    onClick: handleDismiss,
  });

  return (
    <span
      ref={mergeRefs(props.ref, buttonRef)}
      {...dismissProps}
      aria-label="Dismiss"
      tabindex={undefined}
      style={visuallyHiddenInput}
    />
  );
}
