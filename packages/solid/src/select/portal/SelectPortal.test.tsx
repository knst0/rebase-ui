import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as Select from "../index.parts";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { SelectPopup } from "../popup/SelectPopup";
import { SelectPositioner } from "../positioner/SelectPositioner";
import { useSelectRootContext } from "../root/SelectRootContext";
import type { SelectStore } from "../store/SelectStore";
import { SelectPortal } from "./SelectPortal";

function CaptureStore(props: { onStore: (store: SelectStore) => void }) {
  props.onStore(useSelectRootContext());
  return null;
}

describe("<Select.Portal />", () => {
  it("renders nothing when the select is closed", () => {
    render(() => (
      <Select.Root>
        <SelectPortal>
          <div data-testid="portal-content">hello</div>
        </SelectPortal>
      </Select.Root>
    ));
    flush();

    expect(screen.queryByTestId("portal-content")).toBeNull();
  });

  it("portals its children to document.body when open", async () => {
    render(() => (
      <Select.Root defaultOpen>
        <div data-testid="outside">outside</div>
        <SelectPortal>
          <div data-testid="portal-content">hello</div>
        </SelectPortal>
      </Select.Root>
    ));
    flush();
    await nextFrames();

    const content = screen.getByTestId("portal-content");
    expect(content).toBeInTheDocument();
    expect(content.closest("[data-testid='outside']")).toBeNull();
    expect(document.body.contains(content)).toBe(true);
  });

  it("renders into a custom container", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    try {
      render(() => (
        <Select.Root defaultOpen>
          <SelectPortal container={container}>
            <div data-testid="portal-content">hello</div>
          </SelectPortal>
        </Select.Root>
      ));
      flush();
      await nextFrames();

      expect(container.querySelector("[data-testid='portal-content']")).not.toBeNull();
    } finally {
      container.remove();
    }
  });

  it("mounts the floating tree when a closed select opens", async () => {
    let captured: SelectStore | undefined;
    render(() => (
      <Select.Root>
        <CaptureStore
          onStore={(store) => {
            captured = store;
          }}
        />
        <SelectPortal>
          <SelectPositioner data-testid="positioner" alignItemWithTrigger={false}>
            <SelectPopup data-testid="popup">Content</SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </Select.Root>
    ));
    flush();
    expect(screen.queryByTestId("popup")).toBeNull();

    captured?.context.setOpen(true, createChangeEventDetails(REASONS.triggerPress));
    flush();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("popup")).toBeInTheDocument();
    expect(screen.getByTestId("positioner")).toHaveAttribute("data-open");
  });
});
