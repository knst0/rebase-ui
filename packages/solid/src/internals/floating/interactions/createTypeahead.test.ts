import { createRoot, createSignal, flush } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { createTypeahead } from "./createTypeahead";

describe("createTypeahead", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onTyping(false) when the popup closes with a pending buffer", () => {
    const onTyping = vi.fn();
    const onMatch = vi.fn();

    // Created outside the root so the test can write it freely.
    const [open, setOpen] = createSignal(true);
    const stubStore = {
      select: (key: string) => (key === "open" ? open() : null),
      peek: (key: string) => (key === "open" ? open() : null),
    };

    let keyDown!: (event: KeyboardEvent) => void;
    const dispose = createRoot((disposeRoot) => {
      const { reference } = createTypeahead({ rootStore: stubStore } as any, {
        listRef: { current: ["tomato", "apple"] },
        onMatch,
        onTyping,
      });
      keyDown = reference().onKeyDown;
      return disposeRoot;
    });

    try {
      flush();
      expect(onTyping).not.toHaveBeenCalled();

      keyDown(new KeyboardEvent("keydown", { key: "t", bubbles: true, cancelable: true }));
      expect(onTyping.mock.calls).toEqual([[true]]);
      expect(onMatch).toHaveBeenCalledWith(0, expect.any(KeyboardEvent));

      // Closing without moving focus resets the buffer and ends the typing session.
      setOpen(false);
      flush();
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

    const [open, setOpen] = createSignal(true);
    const stubStore = {
      select: (key: string) => (key === "open" ? open() : null),
      peek: (key: string) => (key === "open" ? open() : null),
    };

    const dispose = createRoot((disposeRoot) => {
      createTypeahead({ rootStore: stubStore } as any, {
        listRef: { current: ["tomato", "apple"] },
        onTyping,
      });
      return disposeRoot;
    });

    try {
      flush();
      setOpen(false);
      flush();

      expect(onTyping).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });

  it("passes the matching keydown event to onMatch", () => {
    const onMatch = vi.fn();

    const [open] = createSignal(true);
    const stubStore = {
      select: (key: string) => (key === "open" ? open() : null),
      peek: (key: string) => (key === "open" ? open() : null),
    };

    let keyDown!: (event: KeyboardEvent) => void;
    const dispose = createRoot((disposeRoot) => {
      const { reference } = createTypeahead({ rootStore: stubStore } as any, {
        listRef: { current: ["one", "two", "three"] },
        onMatch,
      });
      keyDown = reference().onKeyDown;
      return disposeRoot;
    });

    try {
      flush();

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
