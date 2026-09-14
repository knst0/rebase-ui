import type { ValidComponent } from '@solidjs/web';
import { untrack } from 'solid-js';

import { createButton } from '../../internals/create-button';
import { createChangeEventDetails, REASONS } from '../../internals/event-details';
import { stopEvent } from '../../internals/floating/utils/event';
import { RenderElement } from '../../internals/render-element';
import { split } from '../../internals/split';
import type { NativeButtonProps, RebaseUIComponentProps } from '../../internals/types';
import { findItemIndex } from '../../select/utils/itemEquality';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { useComboboxChipContext } from '../chip/ComboboxChipContext';

/**
 * A button to remove a chip.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxChipRemove<T extends ValidComponent = 'button'>(
  props: ComboboxChipRemove.Props<T>,
) {
  const [local, userHandlers, elementProps] = split(
    props as ComboboxChipRemove.Props,
    { default: defaultProps },
    ['as', 'disabled', 'nativeButton'],
    ['onClick', 'onKeyDown'],
  );

  const as = untrack(() => local.as);

  const store = useComboboxRootContext();
  const { index } = useComboboxChipContext();

  const disabled = () =>
    (store.select('disabled') as boolean) || local.disabled === true;

  const { buttonRef, getButtonProps } = createButton({
    native: () => local.nativeButton ?? true,
    disabled: () => disabled() || (store.select('readOnly') as boolean),
    focusableWhenDisabled: true,
    tabIndex: () => -1,
  });

  const state: ComboboxChipRemoveState = {
    get disabled() {
      return disabled();
    },
  };

  function clearActiveIndexForRemovedItem(removedItem: unknown) {
    const activeIndex = store.peek('activeIndex') as number | null;

    if (activeIndex == null) {
      return;
    }

    // Try current visible list first; if not found, it's filtered out.
    // No need to clear highlight in that case since it can't equal activeIndex.
    const removedIndex = findItemIndex(
      store.context.valuesRef.current,
      removedItem,
      store.peek('isItemEqualToValue'),
    );
    if (removedIndex !== -1 && activeIndex === removedIndex) {
      store.context.setIndices({
        activeIndex: null,
        type: store.context.keyboardActiveRef.current ? REASONS.keyboard : REASONS.pointer,
      });
    }
  }

  function removeChip(event: MouseEvent | KeyboardEvent) {
    const eventDetails = createChangeEventDetails(REASONS.chipRemovePress, event);
    const selectedValue = store.peek('selectedValue') as Array<unknown>;
    const currentIndex = index();
    const removedItem = selectedValue[currentIndex];

    clearActiveIndexForRemovedItem(removedItem);

    store.context.setSelectedValue(
      selectedValue.filter((_: unknown, i: number) => i !== currentIndex),
      eventDetails,
    );

    store.context.inputRef.current?.focus();
    return eventDetails;
  }

  const ownProps = () => ({
    onMouseDown: (event: MouseEvent) => {
      event.preventDefault();
    },
    onClick: (event: MouseEvent) => {
      const eventDetails = removeChip(event);
      if (!eventDetails.isPropagationAllowed) {
        event.stopPropagation();
      }
      (userHandlers.onClick as ((event: MouseEvent) => void) | undefined)?.(event);
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        const eventDetails = removeChip(event);
        if (!eventDetails.isPropagationAllowed) {
          stopEvent(event);
        }
      }
      (userHandlers.onKeyDown as ((event: KeyboardEvent) => void) | undefined)?.(event);
    },
  });

  return (
    <RenderElement
      as={as}
      state={state}
      props={[ownProps, elementProps, getButtonProps, { ref: buttonRef }]}
    />
  );
}

const defaultProps = Object.freeze({
  as: 'button',
  disabled: false,
  nativeButton: true,
} satisfies Partial<ComboboxChipRemove.Props>);

export interface ComboboxChipRemoveState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface ComboboxChipRemoveOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
}

export type ComboboxChipRemoveProps<T extends ValidComponent = 'button'> =
  ComboboxChipRemoveOwnProps & RebaseUIComponentProps<T, ComboboxChipRemoveState>;

export namespace ComboboxChipRemove {
  export type State = ComboboxChipRemoveState;
  export type Props<T extends ValidComponent = 'button'> = ComboboxChipRemoveProps<T>;
  export type OwnProps = ComboboxChipRemoveOwnProps;
}
