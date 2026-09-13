import '@testing-library/jest-dom/vitest';
import { render, screen } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { describe, expect, it } from 'vitest';

import { SelectRoot } from '../root/SelectRoot';
import { SelectIcon } from './SelectIcon';

describe('<Select.Icon />', () => {
  it('renders a hidden fallback glyph without an open hook when closed', () => {
    render(() => (
      <SelectRoot>
        <SelectIcon />
      </SelectRoot>
    ));
    flush();

    const icon = screen.getByText('▼');
    expect(icon.tagName).toBe('SPAN');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).not.toHaveAttribute('data-popup-open');
  });

  it('marks the open hook while the select is open', () => {
    render(() => (
      <SelectRoot open>
        <SelectIcon />
      </SelectRoot>
    ));
    flush();

    expect(screen.getByText('▼')).toHaveAttribute('data-popup-open');
  });

  it('lets explicit children override the fallback glyph', () => {
    render(() => (
      <SelectRoot>
        <SelectIcon>▾</SelectIcon>
      </SelectRoot>
    ));
    flush();

    expect(screen.getByText('▾')).toBeInTheDocument();
    expect(screen.queryByText('▼')).not.toBeInTheDocument();
  });

  it('throws a descriptive error when rendered outside <Select.Root>', () => {
    expect(() => {
      render(() => <SelectIcon />);
      flush();
    }).toThrow(/SelectRootContext is missing/);
  });
});
