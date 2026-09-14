import type {
  Align,
  CreateAnchorPositioningReturnValue,
  Side,
} from '../../internals/anchor-positioning/createAnchorPositioning';
import { createContext, useContext } from '../../internals/context';

export interface ComboboxPositionerContext
  extends Pick<
    CreateAnchorPositioningReturnValue,
    'side' | 'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles' | 'anchorHidden' | 'isPositioned'
  > {
  side: () => Side;
  align: () => Align;
}

export const ComboboxPositionerContext = createContext<ComboboxPositionerContext>();

export function useComboboxPositionerContext(optional?: false): ComboboxPositionerContext;
export function useComboboxPositionerContext(optional: true): ComboboxPositionerContext | undefined;
export function useComboboxPositionerContext(optional?: boolean): ComboboxPositionerContext | undefined {
  const context = useContext(ComboboxPositionerContext);
  if (context === undefined && !optional) {
    throw new Error(
      'Rebase UI: ComboboxPositionerContext is missing. Combobox popup and arrow parts must be placed within <Combobox.Positioner>.',
    );
  }
  return context;
}
