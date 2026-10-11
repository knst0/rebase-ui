import { cleanup, mount, tick } from "@rezejs/testing-library";
import { store, untrack } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { createTypeahead } from "./createTypeahead";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setupStub() {
  const stubState = store({ open: true });
  return {
    stubState,
    stubStore: {
      select: (key: string) => (key === "open" ? stubState.open : null),
      peek: (key: string) => (key === "open" ? untrack(() => stubState.open) : null),
    },
  };
}

describe("createTypeahead", () => {
  it("calls onTyping(false) when the popup closes with a pending buffer", () => {
    const onTyping = vi.fn();
    const onMatch = vi.fn();

    const { stubState, stubStore } = setupStub();

    let keyDown!: (event: KeyboardEvent) => void;
    function Test(): null {
      const { reference } = createTypeahead({ rootStore: stubStore } as any, {
        listRef: { current: ["tomato", "apple"] },
        onMatch,
        onTyping,
      });
      keyDown = reference().onKeyDown;
      return null;
    }
    const { dispose } = mount(Test);

    try {
      tick();
      expect(onTyping).not.toHaveBeenCalled();

      keyDown(new KeyboardEvent("keydown", { key: "t", bubbles: true, cancelable: true }));
      expect(onTyping.mock.calls).toEqual([[true]]);
      expect(onMatch).toHaveBeenCalledWith(0, expect.any(KeyboardEvent));

      // Closing without moving focus resets the buffer and ends the typing session.
      stubState.open = false;
      tick();
      expect(onTyping.mock.calls).toEqual([[true], [false]]);

      // The pending reset timer must not report a second session end.
      vi.useFakeTimers();
      vi.advanceTimersByTime(750);
      expect(onTyping.mock.calls).toEqual([[true], [false]]);
    } finally {
      dispose();
    }
  });

  it("does not call onTyping(false) on close when no typing happened", () => {
    const onTyping = vi.fn();

    const { stubState, stubStore } = setupStub();

    function Test(): null {
      createTypeahead({ rootStore: stubStore } as any, {
        listRef: { current: ["tomato", "apple"] },
        onTyping,
      });
      return null;
    }
    const { dispose } = mount(Test);

    try {
      tick();
      stubState.open = false;
      tick();

      expect(onTyping).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });

  it("passes the matching keydown event to onMatch", () => {
    const onMatch = vi.fn();

    const { stubStore } = setupStub();

    let keyDown!: (event: KeyboardEvent) => void;
    function Test(): null {
      const { reference } = createTypeahead({ rootStore: stubStore } as any, {
        listRef: { current: ["one", "two", "three"] },
        onMatch,
      });
      keyDown = reference().onKeyDown;
      return null;
    }
    const { dispose } = mount(Test);

    try {
      tick();

      const event = new KeyboardEvent("keydown", { key: "t", bubbles: true, cancelable: true });
      keyDown(event);

      expect(onMatch).toHaveBeenCalledTimes(1);
      expect(onMatch.mock.calls[0][0]).toBe(1);
      expect(onMatch.mock.calls[0][1]).toBe(event);
    } finally {
      dispose();
    }
  });
});
