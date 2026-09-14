import '@testing-library/jest-dom/vitest';
import { render, screen } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { describe, expect, it } from 'vitest';

import * as Combobox from '../index.parts';
import { ComboboxIcon } from './ComboboxIcon';

describe('<Combobox.Icon />', () => {
  it('renders a hidden fallback glyph', () => {
    render(() => (
      <Combobox.Root>
        <ComboboxIcon />
      </Combobox.Root>
    ));
    flush();

    const icon = screen.getByText('▼');
    expect(icon.tagName).toBe('SPAN');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('lets explicit children override the fallback glyph', () => {
    render(() => (
      <Combobox.Root>
        <ComboboxIcon>▾</ComboboxIcon>
      </Combobox.Root>
    ));
    flush();

    expect(screen.getByText('▾')).toBeInTheDocument();
    expect(screen.queryByText('▼')).not.toBeInTheDocument();
  });

  it('renders through a custom element via the `as` prop', () => {
    render(() => (
      <Combobox.Root>
        <ComboboxIcon as="div" data-testid="icon" />
      </Combobox.Root>
    ));
    flush();

    const icon = screen.getByTestId('icon');
    expect(icon.tagName).toBe('DIV');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
