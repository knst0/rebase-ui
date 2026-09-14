import type { ValidComponent } from '@solidjs/web';
import { untrack } from 'solid-js';

import type { Align, Side } from '../../internals/anchor-positioning/createAnchorPositioning';
import { mergeRefs } from '../../internals/mergeRefs';
import { RenderElement } from '../../internals/render-element';
import { split } from '../../internals/split';
import type { StateAttributesMapping } from '../../internals/stateToAttributes';
import type { RebaseUIComponentProps } from '../../internals/types';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import * as ComboboxArrowDataAttributes from './ComboboxArrowDataAttributes';

const ARROW_OPEN_HOOK = { [ComboboxArrowDataAttributes.open]: '' };
const ARROW_CLOSED_HOOK = { [ComboboxArrowDataAttributes.closed]: '' };
const ARROW_UNCENTERED_HOOK = { [ComboboxArrowDataAttributes.uncentered]: '' };

const comboboxArrowStateMapping: StateAttributesMapping<ComboboxArrowState> = {
  open: {
    keys: [ComboboxArrowDataAttributes.open, ComboboxArrowDataAttributes.closed],
    map: (value) => (value ? ARROW_OPEN_HOOK : ARROW_CLOSED_HOOK),
  },
  side: {
    keys: [ComboboxArrowDataAttributes.side],
    map: (value) => ({ [ComboboxArrowDataAttributes.side]: value }),
  },
  align: {
    keys: [ComboboxArrowDataAttributes.align],
    map: (value) => ({ [ComboboxArrowDataAttributes.align]: value }),
  },
  uncentered: {
    keys: [ComboboxArrowDataAttributes.uncentered],
    map: (value) => (value ? ARROW_UNCENTERED_HOOK : null),
  },
};

/**
 * Displays an element positioned against the anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxArrow<T extends ValidComponent = 'div'>(props: ComboboxArrow.Props<T>) {
  const [local, elementProps] = split(props as ComboboxArrow.Props, { default: defaultProps }, ['as']);

  const as = untrack(() => local.as);

  const store = useComboboxRootContext();
  const positioner = useComboboxPositionerContext();

  const state: ComboboxArrowState = {
    get open() {
      return store.select('open') as boolean;
    },
    get side() {
      return positioner.side();
    },
    get align() {
      return positioner.align();
    },
    get uncentered() {
      return positioner.arrowUncentered();
    },
  };

  const arrowProps = {
    get style() {
      return positioner.arrowStyles();
    },
    'aria-hidden': 'true' as const,
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<Element>(externalProps.ref, (element: Element | null) => {
      positioner.arrowRef.current = element;
    }),
  });

  return (
    <RenderElement
      as={as}
      state={state}
      props={[arrowProps, elementProps, refProps]}
      stateAttributesMapping={comboboxArrowStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: 'div',
} satisfies Partial<ComboboxArrow.Props>);

export interface ComboboxArrowState {
  /**
   * Whether the popup is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
}

export type ComboboxArrowProps<T extends ValidComponent = 'div'> = RebaseUIComponentProps<
  T,
  ComboboxArrowState
>;

export namespace ComboboxArrow {
  export type State = ComboboxArrowState;
  export type Props<T extends ValidComponent = 'div'> = ComboboxArrowProps<T>;
}
