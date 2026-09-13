import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { nextFrames } from '#test-utils';
import { SelectLabel } from '../label/SelectLabel';
import { SelectRoot } from '../root/SelectRoot';
import { SelectTrigger } from './SelectTrigger';

function renderTrigger(triggerProps: Record<string, unknown> = {}, rootProps: Record<string, unknown> = {}) {
  return render(() => (
    <SelectRoot {...rootProps}>
      <SelectTrigger {...triggerProps}>Choose</SelectTrigger>
    </SelectRoot>
  ));
}

describe('<Select.Trigger />', () => {
  it('renders closed combobox semantics with a placeholder hook', () => {
    renderTrigger();
    flush();

    const trigger = screen.getByRole('combobox');
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('tabindex', '0');
    expect(trigger).toHaveAttribute('data-placeholder');
    expect(trigger).not.toHaveAttribute('data-popup-open');
    expect(trigger).not.toHaveAttribute('aria-controls');
  });

  it('opens and closes the popup on click', async () => {
    renderTrigger();
    flush();

    const trigger = screen.getByRole('combobox');

    fireEvent.click(trigger);
    flush();
    await nextFrames();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('data-popup-open');

    fireEvent.click(trigger);
    flush();
    await nextFrames();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('data-popup-open');
  });

  it('reflects a controlled open value', () => {
    renderTrigger({}, { open: true });
    flush();

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('data-popup-open');
  });

  it('marks the pressed hook while the pointer is held down', () => {
    renderTrigger();
    flush();

    const trigger = screen.getByRole('combobox');
    fireEvent.pointerDown(trigger);
    flush();
    expect(trigger).toHaveAttribute('data-pressed');

    fireEvent.pointerUp(trigger);
    flush();
    expect(trigger).not.toHaveAttribute('data-pressed');
  });

  it('does not open while disabled and exposes disabled semantics', async () => {
    renderTrigger({ disabled: true });
    flush();

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('data-disabled');
    expect(trigger).toHaveAttribute('tabindex', '-1');

    fireEvent.click(trigger);
    flush();
    await nextFrames();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('data-popup-open');
  });

  it('forwards readonly and required hooks to aria attributes', () => {
    renderTrigger({}, { readOnly: true, required: true });
    flush();

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-readonly', 'true');
    expect(trigger).toHaveAttribute('aria-required', 'true');
    expect(trigger).toHaveAttribute('data-required');
  });

  it('associates the label through aria-labelledby', () => {
    render(() => (
      <SelectRoot id="country">
        <SelectLabel>Country</SelectLabel>
        <SelectTrigger>Choose</SelectTrigger>
      </SelectRoot>
    ));
    flush();

    const trigger = screen.getByRole('combobox');
    const labelledBy = trigger.getAttribute('aria-labelledby') ?? '';
    expect(labelledBy).toContain('country-label');
    expect(screen.getByText('Country').getAttribute('id')).toBe('country-label');
  });

  it('throws a descriptive error when rendered outside <Select.Root>', () => {
    expect(() => {
      render(() => <SelectTrigger>Choose</SelectTrigger>);
      flush();
    }).toThrow(/SelectRootContext is missing/);
  });
});
