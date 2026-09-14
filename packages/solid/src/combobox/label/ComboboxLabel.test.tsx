import '@testing-library/jest-dom/vitest';
import { render, screen } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { describe, expect, it } from 'vitest';

import { renderWithCombobox } from '../test-utils';
import { ComboboxLabel } from './ComboboxLabel';

describe('<Combobox.Label />', () => {
  it('renders with an id derived from the root id', () => {
    renderWithCombobox(() => <ComboboxLabel>Font</ComboboxLabel>);
    flush();

    const label = screen.getByText('Font');
    expect(label.tagName).toBe('DIV');
    expect(label).toHaveAttribute('id', 'test-combobox-label');
  });

  it('throws a descriptive error when rendered outside <Combobox.Root>', () => {
    expect(() => {
      render(() => <ComboboxLabel>Font</ComboboxLabel>);
      flush();
    }).toThrow(/ComboboxRootContext is missing/);
  });
});
