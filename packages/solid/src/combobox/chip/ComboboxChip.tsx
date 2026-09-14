import type { ValidComponent } from '@solidjs/web';
import { untrack } from 'solid-js';

import { useCompositeListItem } from '../../internals/composite';
import { createChangeEventDetails, REASONS } from '../../internals/event-details';
import { stopEvent } from '../../internals/floating/utils/event';
import { RenderElement } from '../../internals/render-element';
import { split } from '../../internals/split';
import type { RebaseUIComponentProps } from '../../internals/types';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { getChipNavigationKeys, getIndexAfterChipRemoval } from '../utils/parts';
import { useComboboxChipsContext } from '../chips/ComboboxChipsContext';
import { ComboboxChipContext } from './ComboboxChipContext';

/**
 * An individual chip that represents a value in a multiselectable input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxChip<T extends ValidComponent = 'div'>(props: ComboboxChip.Props<T>) {
  const [local, userHandlers, elementProps] = split(
    props as ComboboxChip.Props,
    { default: defaultProps },
    ['as'],
    ['onKeyDown'],
  );

  const as = untrack(() => local.as);

  const store = useComboboxRootContext();
  const chipsContext = useComboboxChipsContext();
  if (!chipsContext) {
    throw new Error(
      'Rebase UI: ComboboxChipsContext is missing. ComboboxChip parts must be placed within <Combobox.Chips>.',
    );
  }
  const { setHighlightedChipIndex, chipsRef } = chipsContext;

  const { ref: listItemRef, index } = useCompositeListItem();

  function handleKeyDown(event: KeyboardEvent): number | undefined {
    const currentIndex = index();
    let nextIndex: number | undefined = currentIndex;
    const owner = event.currentTarget instanceof Element ? event.currentTarget.ownerDocument : document;
    const direction = owner.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
    const [previousChipKey, nextChipKey] = getChipNavigationKeys(direction);
    const selectedValue = store.peek('selectedValue') as Array<unknown>;

    if (event.key === previousChipKey) {
      event.preventDefault();
      if (currentIndex > 0) {
        nextIndex = currentIndex - 1;
      } else {
        nextIndex = undefined;
      }
    } else if (event.key === nextChipKey) {
      event.preventDefault();
      if (currentIndex < chipsRef.current.length - 1) {
        nextIndex = currentIndex + 1;
      } else {
        nextIndex = undefined;
      }
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      nextIndex = getIndexAfterChipRemoval(currentIndex, selectedValue.length);

      stopEvent(event);

      store.context.setIndices({
        activeIndex: null,
        selectedIndex: null,
        type: REASONS.keyboard,
      });
      store.context.setSelectedValue(
        selectedValue.filter((_: unknown, i: number) => i !== currentIndex),
        createChangeEventDetails(REASONS.none, event),
      );
    } else if (event.key === 'Enter' || event.key === ' ') {
      stopEvent(event);
      nextIndex = undefined;
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      stopEvent(event);
      store.context.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event));
      nextIndex = undefined;
    } else if (
      // Check for printable characters (letters, numbers, symbols)
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      nextIndex = undefined;
    }

    return nextIndex;
  }

  const state: ComboboxChipState = {
    get disabled() {
      return store.select('disabled') as boolean;
    },
  };

  const ownProps = () => ({
    tabIndex: -1,
    get 'aria-disabled'() {
      return (store.select('disabled') as boolean) ? ('true' as const) : undefined;
    },
    get 'aria-readonly'() {
      return (store.select('readOnly') as boolean) ? ('true' as const) : undefined;
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (!store.peek('disabled') && !store.peek('readOnly')) {
        const nextIndex = handleKeyDown(event);
        setHighlightedChipIndex(nextIndex);

        if (nextIndex === undefined) {
          store.context.inputRef.current?.focus();
        } else {
          chipsRef.current[nextIndex]?.focus();
        }
      }
      (userHandlers.onKeyDown as ((event: KeyboardEvent) => void) | undefined)?.(event);
    },
  });

  const contextValue: ComboboxChipContext = {
    index,
  };

  return (
    <ComboboxChipContext value={contextValue}>
      <RenderElement
        as={as}
        state={state}
        props={[ownProps, elementProps, { ref: listItemRef }]}
      />
    </ComboboxChipContext>
  );
}

const defaultProps = Object.freeze({
  as: 'div',
} satisfies Partial<ComboboxChip.Props>);

export interface ComboboxChipState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface ComboboxChipOwnProps {}

export type ComboboxChipProps<T extends ValidComponent = 'div'> = ComboboxChipOwnProps &
  RebaseUIComponentProps<T, ComboboxChipState>;

export namespace ComboboxChip {
  export type State = ComboboxChipState;
  export type Props<T extends ValidComponent = 'div'> = ComboboxChipProps<T>;
  export type OwnProps = ComboboxChipOwnProps;
}
