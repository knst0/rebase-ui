import { autoUpdate as realAutoUpdate } from "@floating-ui/dom";
import { createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { nextFrames } from "#test-utils";

import { createAnchorPositioning } from "./createAnchorPositioning";
import { useFloatingRootContext } from "../floating/useFloatingRootContext";

vi.mock("@floating-ui/dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("@floating-ui/dom")>();
  return {
    ...original,
    autoUpdate: vi.fn(original.autoUpdate),
  };
});

const autoUpdateMock = vi.mocked(realAutoUpdate);

async function tick() {
  await nextFrames();
  flush();
}

function setupAnchor(options: {
  anchor: () => Element | null;
  keepMounted?: boolean;
  setFloating?: HTMLElement | null;
  setReference?: Element | null;
}) {
  const store = useFloatingRootContext({ open: () => true });
  const positioning = createAnchorPositioning({
    get anchor() {
      return options.anchor();
    },
    mounted: () => true,
    disableAnchorTracking: false,
    keepMounted: options.keepMounted,
    collisionAvoidance: { fallbackAxisSide: "none" },
    floatingRootContext: store,
  });
  if (options.setReference) {
    positioning.refs.setReference(options.setReference);
  }
  if (options.setFloating) {
    positioning.refs.setFloating(options.setFloating);
  }
  flush();
  return { positioning };
}

describe("createAnchorPositioning anchor guard", () => {
  it("registers a connected, enabled anchor as the position reference", () =>
    createRoot((dispose) => {
      const anchor = document.createElement("button");
      document.body.appendChild(anchor);
      try {
        const { positioning } = setupAnchor({ anchor: () => anchor });
        expect(positioning.refs.reference.current).not.toBe(null);
      } finally {
        anchor.remove();
        dispose();
      }
    }));

  it("skips a disabled anchor", () =>
    createRoot((dispose) => {
      const anchor = document.createElement("button");
      anchor.setAttribute("disabled", "");
      document.body.appendChild(anchor);
      try {
        const { positioning } = setupAnchor({ anchor: () => anchor });
        expect(positioning.refs.reference.current).toBe(null);
      } finally {
        anchor.remove();
        dispose();
      }
    }));

  it("skips a detached anchor", () =>
    createRoot((dispose) => {
      const anchor = document.createElement("button");
      const { positioning } = setupAnchor({ anchor: () => anchor });
      expect(positioning.refs.reference.current).toBe(null);
      dispose();
    }));

  it("keeps the previous registration when the anchor becomes detached", () => {
    const attached = document.createElement("button");
    document.body.appendChild(attached);
    const [anchor, setAnchor] = createSignal<Element | null>(attached, { ownedWrite: true });
    const detached = document.createElement("button");

    return createRoot((dispose) => {
      try {
        const { positioning } = setupAnchor({ anchor });
        flush();
        const registered = positioning.refs.reference.current;
        expect(registered).not.toBe(null);

        setAnchor(detached);
        flush();
        expect(positioning.refs.reference.current).toBe(registered);
      } finally {
        attached.remove();
        dispose();
      }
    });
  });

  it("tracks a connected reference with keepMounted auto updates", async () => {
    await createRoot(async (dispose) => {
      autoUpdateMock.mockClear();
      const trigger = document.createElement("button");
      document.body.appendChild(trigger);
      const floating = document.createElement("div");
      document.body.appendChild(floating);
      try {
        setupAnchor({
          anchor: () => null,
          keepMounted: true,
          setReference: trigger,
          setFloating: floating,
        });
        await tick();

        // The keepMounted effect passes explicit options; floating-ui's own
        // default tracking calls without them.
        const manualCalls = autoUpdateMock.mock.calls.filter((call) => call[3] !== undefined);
        expect(manualCalls.length).toBeGreaterThan(0);
      } finally {
        trigger.remove();
        floating.remove();
        dispose();
      }
    });
  });

  it("does not recalculate a disabled reference with keepMounted auto updates", async () => {
    await createRoot(async (dispose) => {
      autoUpdateMock.mockClear();
      const trigger = document.createElement("button");
      trigger.setAttribute("disabled", "");
      document.body.appendChild(trigger);
      const floating = document.createElement("div");
      document.body.appendChild(floating);
      try {
        setupAnchor({
          anchor: () => null,
          keepMounted: true,
          setReference: trigger,
          setFloating: floating,
        });
        await tick();

        const manualCalls = autoUpdateMock.mock.calls.filter((call) => call[3] !== undefined);
        expect(manualCalls).toHaveLength(0);
      } finally {
        trigger.remove();
        floating.remove();
        dispose();
      }
    });
  });
});
