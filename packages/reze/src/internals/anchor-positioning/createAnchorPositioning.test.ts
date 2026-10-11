import { autoUpdate as realAutoUpdate } from "@floating-ui/dom";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { store } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import { useFloatingRootContext } from "../floating/useFloatingRootContext";
import { createAnchorPositioning, type CreateAnchorPositioningReturnValue } from "./createAnchorPositioning";

vi.mock("@floating-ui/dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("@floating-ui/dom")>();
  return {
    ...original,
    autoUpdate: vi.fn(original.autoUpdate),
  };
});

const autoUpdateMock = vi.mocked(realAutoUpdate);

afterEach(cleanup);

async function tickAsync() {
  await nextFrames();
  tick();
}

function setupAnchor(options: {
  anchor: () => Element | null;
  keepMounted?: boolean;
  setFloating?: HTMLElement | null;
  setReference?: Element | null;
}) {
  let positioning: CreateAnchorPositioningReturnValue | undefined;
  function Test(): null {
    const rootStore = useFloatingRootContext({ open: () => true });
    positioning = createAnchorPositioning({
      anchor: options.anchor,
      mounted: () => true,
      disableAnchorTracking: false,
      keepMounted: options.keepMounted,
      collisionAvoidance: { fallbackAxisSide: "none" },
      floatingRootContext: rootStore,
    });
    return null;
  }
  const { dispose } = mount(Test);
  tick();
  if (options.setReference) {
    positioning!.refs.setReference(options.setReference);
  }
  if (options.setFloating) {
    positioning!.refs.setFloating(options.setFloating);
  }
  tick();
  return { positioning: positioning!, dispose };
}

describe("createAnchorPositioning anchor guard", () => {
  it("registers a connected, enabled anchor as the position reference", () => {
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    try {
      const { positioning, dispose } = setupAnchor({ anchor: () => anchor });
      try {
        expect(positioning.refs.reference.current).not.toBe(null);
      } finally {
        dispose();
      }
    } finally {
      anchor.remove();
    }
  });

  it("skips a disabled anchor", () => {
    const anchor = document.createElement("button");
    anchor.setAttribute("disabled", "");
    document.body.appendChild(anchor);
    try {
      const { positioning, dispose } = setupAnchor({ anchor: () => anchor });
      try {
        expect(positioning.refs.reference.current).toBe(null);
      } finally {
        dispose();
      }
    } finally {
      anchor.remove();
    }
  });

  it("skips a detached anchor", () => {
    const anchor = document.createElement("button");
    const { positioning, dispose } = setupAnchor({ anchor: () => anchor });
    try {
      expect(positioning.refs.reference.current).toBe(null);
    } finally {
      dispose();
    }
  });

  it("keeps the previous registration when the anchor becomes detached", () => {
    const attached = document.createElement("button");
    document.body.appendChild(attached);
    const anchorState = store({ anchor: attached as Element | null });
    const detached = document.createElement("button");

    try {
      const { positioning, dispose } = setupAnchor({ anchor: () => anchorState.anchor });
      try {
        tick();
        const registered = positioning.refs.reference.current;
        expect(registered).not.toBe(null);

        anchorState.anchor = detached;
        tick();
        expect(positioning.refs.reference.current).toBe(registered);
      } finally {
        dispose();
      }
    } finally {
      attached.remove();
    }
  });

  it("tracks a connected reference with keepMounted auto updates", async () => {
    autoUpdateMock.mockClear();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const floating = document.createElement("div");
    document.body.appendChild(floating);
    try {
      const { dispose } = setupAnchor({
        anchor: () => null,
        keepMounted: true,
        setReference: trigger,
        setFloating: floating,
      });
      try {
        await tickAsync();

        // The keepMounted effect passes explicit options; floating-ui's own
        // default tracking calls without them.
        const manualCalls = autoUpdateMock.mock.calls.filter((call) => call[3] !== undefined);
        expect(manualCalls.length).toBeGreaterThan(0);
      } finally {
        dispose();
      }
    } finally {
      trigger.remove();
      floating.remove();
    }
  });

  it("does not recalculate a disabled reference with keepMounted auto updates", async () => {
    autoUpdateMock.mockClear();
    const trigger = document.createElement("button");
    trigger.setAttribute("disabled", "");
    document.body.appendChild(trigger);
    const floating = document.createElement("div");
    document.body.appendChild(floating);
    try {
      const { dispose } = setupAnchor({
        anchor: () => null,
        keepMounted: true,
        setReference: trigger,
        setFloating: floating,
      });
      try {
        await tickAsync();

        const manualCalls = autoUpdateMock.mock.calls.filter((call) => call[3] !== undefined);
        expect(manualCalls).toHaveLength(0);
      } finally {
        dispose();
      }
    } finally {
      trigger.remove();
      floating.remove();
    }
  });
});
