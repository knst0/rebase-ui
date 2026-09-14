import type { ValidComponent } from '@solidjs/web';
import { createEffect, createSignal, untrack } from 'solid-js';

import { CompositeListContext, createCompositeList } from '../../internals/composite';
import { mergeRefs } from '../../internals/mergeRefs';
import { RenderElement } from '../../internals/render-element';
import { split } from '../../internals/split';
import type { RebaseUIComponentProps } from '../../internals/types';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { handleInputPress } from '../utils/handleInputPress';
import { ComboboxChipsContext } from './ComboboxChipsContext';

/**
 * A container for the chips in a multiselectable input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxChips<T extends ValidComponent = 'div'>(props: ComboboxChips.Props<T>) {
  const [local, userHandlers, elementProps] = split(
    props as ComboboxChips.Props,
    { default: defaultProps },
    ['as'],
    ['onMouseDown'],
  );

  const as = untrack(() => local.as);

  const store = useComboboxRootContext();

  const [highlightedChipIndex, setHighlightedChipIndex] = createSignal<number | undefined>(
    undefined,
  );

  const chipsRef: { current: Array<HTMLElement | null> } = { current: [] };

  const compositeList = createCompositeList();

  createEffect(
    () => store.select('open'),
    (open) => {
      if (open && highlightedChipIndex() !== undefined) {
        setHighlightedChipIndex(undefined);
      }
      return undefined;
    },
  );

  // Keep the imperative chips array in registration order so chips can move
  // focus between each other without reading reactive state in handlers.
  createEffect(
    () => compositeList.elements(),
    (elements) => {
      chipsRef.current = elements.slice();
      return undefined;
    },
  );

  const state: ComboboxChipsState = {};

  const ownProps = () => ({
    // NVDA enters browse mode instead of staying in focus mode when navigating with
    // arrow keys inside a container unless it has a toolbar role.
    ...(store.select('hasSelectionChips') ? { role: 'toolbar' as const } : null),
    onMouseDown: (event: MouseEvent) => {
      handleInputPress(event, store, store.peek('disabled'));
      (userHandlers.onMouseDown as ((event: MouseEvent) => void) | undefined)?.(event);
    },
  });

  const refProps = (externalProps: Record<string, unknown>) => ({
    ref: mergeRefs<HTMLDivElement>(
      externalProps.ref as ((element: HTMLDivElement) => void) | undefined,
      (element) => {
        store.context.chipsContainerRef.current = element;
      },
    ),
  });

  const contextValue: ComboboxChipsContext = {
    highlightedChipIndex,
    setHighlightedChipIndex,
    chipsRef,
  };

  return (
    <CompositeListContext value={compositeList.contextValue}>
      <ComboboxChipsContext value={contextValue}>
        <RenderElement as={as} state={state} props={[ownProps, elementProps, refProps]} />
      </ComboboxChipsContext>
    </CompositeListContext>
  );
}

const defaultProps = Object.freeze({
  as: 'div',
} satisfies Partial<ComboboxChips.Props>);

export interface ComboboxChipsState {}

export interface ComboboxChipsOwnProps {}

export type ComboboxChipsProps<T extends ValidComponent = 'div'> = ComboboxChipsOwnProps &
  RebaseUIComponentProps<T, ComboboxChipsState>;

export namespace ComboboxChips {
  export type State = ComboboxChipsState;
  export type Props<T extends ValidComponent = 'div'> = ComboboxChipsProps<T>;
  export type OwnProps = ComboboxChipsOwnProps;
}
