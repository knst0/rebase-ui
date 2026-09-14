import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { describe, expect, it } from 'vitest';

import { renderWithCombobox } from '../test-utils';
import { ComboboxClear } from './ComboboxClear';

describe('<Combobox.Clear />', () => {
  it('is not rendered without a selection', () => {
    renderWithCombobox(() => <ComboboxClear />);
    flush();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders when a single value is selected', () => {
    renderWithCombobox(() => <ComboboxClear />, {
      storeState: { selectedValue: 'sans' },
    });
    flush();

    const clear = screen.getByRole('button');
    expect(clear).toHaveTextContent('x');
    expect(clear).toHaveAttribute('tabindex', '-1');
    expect(clear).toHaveAttribute('data-visible');
  });

  it('renders when the input has a value in none mode', () => {
    const { harness } = renderWithCombobox(() => <ComboboxClear />, {
      storeState: { selectionMode: 'none' },
    });
    harness.store.context.setInputValue('a', { reason: 'input-change' } as never);
    flush();

    expect(screen.getByRole('button')).toHaveAttribute('data-visible');
  });

  it('clears the input and selection on click', () => {
    const { harness } = renderWithCombobox(
      () => (
        <>
          <input data-testid="field" />
          <ComboboxClear />
        </>
      ),
      { storeState: { selectedValue: 'sans' } },
    );
    flush();
    harness.store.context.inputRef.current = screen.getByTestId('field') as HTMLInputElement;

    fireEvent.click(screen.getByRole('button'));
    flush();

    expect(harness.inputValueCalls.at(-1)).toEqual({ value: '', reason: 'clear-press' });
    expect(harness.selectedValueCalls.at(-1)).toEqual({ value: null, reason: 'clear-press' });
    expect(harness.indicesCalls.at(-1)).toMatchObject({ activeIndex: null, selectedIndex: null });
  });

  it('clears to an empty array in multiple mode', () => {
    const { harness } = renderWithCombobox(() => <ComboboxClear />, {
      storeState: { selectionMode: 'multiple', selectedValue: ['a', 'b'] },
    });
    flush();

    fireEvent.click(screen.getByRole('button'));
    flush();

    expect(harness.selectedValueCalls.at(-1)).toEqual({ value: [], reason: 'clear-press' });
  });

  it('does nothing while disabled or readonly', () => {
    const { harness } = renderWithCombobox(() => <ComboboxClear />, {
      storeState: { selectedValue: 'sans', readOnly: true },
    });
    flush();

    fireEvent.click(screen.getByRole('button'));
    flush();

    expect(harness.inputValueCalls.length).toBe(0);
    expect(harness.selectedValueCalls.length).toBe(0);
  });

  it('stays mounted with keepMounted even when not visible', () => {
    renderWithCombobox(() => <ComboboxClear keepMounted />);
    flush();

    const clear = screen.getByRole('button');
    expect(clear).toBeInTheDocument();
    expect(clear).not.toHaveAttribute('data-visible');
  });

  it('throws a descriptive error when rendered outside <Combobox.Root>', () => {
    expect(() => {
      render(() => <ComboboxClear />);
      flush();
    }).toThrow(/ComboboxRootContext is missing/);
  });
});
