import type { JSX, ValidComponent } from '@solidjs/web';
import { untrack } from 'solid-js';

import { RenderElement } from '../../internals/render-element';
import { split } from '../../internals/split';
import type { StateAttributesMapping } from '../../internals/stateToAttributes';
import { transitionStatusMapping } from '../../internals/transition-status';
import type { TransitionStatus } from '../../internals/transition-status';
import type { RebaseUIComponentProps } from '../../internals/types';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import * as ComboboxBackdropDataAttributes from './ComboboxBackdropDataAttributes';

const BACKDROP_OPEN_HOOK = { [ComboboxBackdropDataAttributes.open]: '' };

const comboboxBackdropStateMapping: StateAttributesMapping<ComboboxBackdropState> = {
  open: {
    keys: [ComboboxBackdropDataAttributes.open, ComboboxBackdropDataAttributes.closed],
    map: (value) => (value ? BACKDROP_OPEN_HOOK : null),
  },
  ...transitionStatusMapping,
};

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxBackdrop<T extends ValidComponent = 'div'>(props: ComboboxBackdrop.Props<T>) {
  const [local, elementProps] = split(props as ComboboxBackdrop.Props, { default: defaultProps }, ['as']);

  const as = untrack(() => local.as);

  const store = useComboboxRootContext();

  const state: ComboboxBackdropState = {
    get open() {
      return store.select('open') as boolean;
    },
    get transitionStatus() {
      return store.select('transitionStatus') as TransitionStatus;
    },
  };

  const backdropProps = {
    role: 'presentation' as const,
    get hidden() {
      return !store.select('mounted') || undefined;
    },
    get style(): JSX.CSSProperties {
      return {
        'user-select': 'none',
        '-webkit-user-select': 'none',
      };
    },
  };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[backdropProps, elementProps]}
      stateAttributesMapping={comboboxBackdropStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: 'div',
} satisfies Partial<ComboboxBackdrop.Props>);

export interface ComboboxBackdropState {
  /**
   * Whether the popup is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export type ComboboxBackdropProps<T extends ValidComponent = 'div'> = RebaseUIComponentProps<
  T,
  ComboboxBackdropState
>;

export namespace ComboboxBackdrop {
  export type State = ComboboxBackdropState;
  export type Props<T extends ValidComponent = 'div'> = ComboboxBackdropProps<T>;
}
