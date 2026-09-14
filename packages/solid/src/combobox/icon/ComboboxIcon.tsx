import type { ValidComponent } from '@solidjs/web';
import { untrack } from 'solid-js';

import { RenderElement } from '../../internals/render-element';
import { split } from '../../internals/split';
import type { RebaseUIComponentProps } from '../../internals/types';

/**
 * An icon that indicates that the trigger button opens the popup.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxIcon<T extends ValidComponent = 'span'>(props: ComboboxIcon.Props<T>) {
  const [local, elementProps] = split(props as ComboboxIcon.Props, { default: defaultProps }, ['as']);

  const as = untrack(() => local.as);

  return (
    <RenderElement as={as} props={[{ 'aria-hidden': 'true', children: '▼' }, elementProps]} />
  );
}

const defaultProps = Object.freeze({
  as: 'span',
} satisfies Partial<ComboboxIcon.Props>);

export interface ComboboxIconState {}

export type ComboboxIconProps<T extends ValidComponent = 'span'> = RebaseUIComponentProps<
  T,
  ComboboxIconState
>;

export namespace ComboboxIcon {
  export type State = ComboboxIconState;
  export type Props<T extends ValidComponent = 'span'> = ComboboxIconProps<T>;
}
