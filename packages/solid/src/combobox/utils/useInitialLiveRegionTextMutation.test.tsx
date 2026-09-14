import { render, screen } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';

import {
  INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY,
  useInitialLiveRegionTextMutation,
} from './useInitialLiveRegionTextMutation';

describe('useInitialLiveRegionTextMutation', () => {
  it('does nothing when its ref is not attached', () => {
    function Unattached() {
      useInitialLiveRegionTextMutation<HTMLDivElement>();
      return <div data-testid="status">Status</div>;
    }

    render(() => <Unattached />);

    expect(screen.getByTestId('status')).toHaveTextContent('Status');
  });

  it('marks the last non-empty text node so the announcement is picked up', () => {
    function Status() {
      const ref = useInitialLiveRegionTextMutation<HTMLDivElement>();
      return (
        <div ref={ref} data-testid="status">
          Status
        </div>
      );
    }

    render(() => <Status />);
    flush();

    expect(screen.getByTestId('status').firstChild!.nodeValue).toBe('Status⁠');
  });

  it('restores the original text after the reset delay', () => {
    vi.useFakeTimers();
    try {
      function Status() {
        const ref = useInitialLiveRegionTextMutation<HTMLDivElement>();
        return (
          <div ref={ref} data-testid="status">
            Status
          </div>
        );
      }

      render(() => <Status />);
      flush();
      const status = screen.getByTestId('status');
      expect(status.firstChild!.nodeValue).toBe('Status⁠');

      vi.advanceTimersByTime(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

      expect(status.firstChild!.nodeValue).toBe('Status');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not overwrite text that changes before the reset', () => {
    vi.useFakeTimers();
    try {
      function Status() {
        const ref = useInitialLiveRegionTextMutation<HTMLDivElement>();
        return (
          <div ref={ref} data-testid="status">
            Status
          </div>
        );
      }

      render(() => <Status />);
      flush();
      const status = screen.getByTestId('status');
      status.firstChild!.nodeValue = 'Updated';

      vi.advanceTimersByTime(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

      expect(status).toHaveTextContent('Updated');
    } finally {
      vi.useRealTimers();
    }
  });
});
