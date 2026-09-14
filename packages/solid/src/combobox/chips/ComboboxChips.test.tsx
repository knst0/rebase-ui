import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { describe, expect, it } from 'vitest';

import { ComboboxChip } from '../chip/ComboboxChip';
import { ComboboxInput } from '../input/ComboboxInput';
import { ComboboxRoot } from '../root/ComboboxRoot';
import { ComboboxChips } from './ComboboxChips';

function renderChips(chipsProps: Record<string, unknown> = {}, rootProps: Record<string, unknown> = {}) {
  return render(() => (
    <ComboboxRoot multiple {...rootProps}>
      <ComboboxChips {...chipsProps} />
    </ComboboxRoot>
  ));
}

describe('<Combobox.Chips />', () => {
  it('renders a div element', () => {
    renderChips({ 'data-testid': 'chips' });
    flush();

    expect(screen.getByTestId('chips').tagName).toBe('DIV');
  });

  it('does not set role="toolbar" when there are no chips', () => {
    renderChips({ 'data-testid': 'chips' });
    flush();

    expect(screen.getByTestId('chips')).not.toHaveAttribute('role');
  });

  it('sets role="toolbar" when there is at least one chip', () => {
    render(() => (
      <ComboboxRoot multiple defaultValue={['apple']}>
        <ComboboxChips data-testid="chips">
          <ComboboxChip>apple</ComboboxChip>
        </ComboboxChips>
      </ComboboxRoot>
    ));
    flush();

    expect(screen.getByTestId('chips')).toHaveAttribute('role', 'toolbar');
  });

  it('focuses the input when pressing anywhere in the chips area', () => {
    render(() => (
      <ComboboxRoot multiple defaultValue={['apple']}>
        <ComboboxChips data-testid="chips">
          <ComboboxChip data-testid="chip">apple</ComboboxChip>
          <ComboboxInput data-testid="input" />
        </ComboboxChips>
      </ComboboxRoot>
    ));
    flush();

    const chips = screen.getByTestId('chips');
    const input = screen.getByTestId('input');

    expect(input).not.toHaveFocus();

    fireEvent.mouseDown(chips);
    flush();
    expect(input).toHaveFocus();

    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.mouseDown(screen.getByTestId('chip'));
    flush();
    expect(input).toHaveFocus();
  });

  it('throws a descriptive error when rendered outside <Combobox.Root>', () => {
    expect(() => {
      render(() => <ComboboxChips />);
      flush();
    }).toThrow(/ComboboxRootContext is missing/);
  });
});
