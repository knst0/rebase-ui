import { render, screen } from "@solidjs/testing-library";
import { Show, createSignal, flush } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { describeConformance } from "#test-utils";

import { Avatar } from "../index";

// 1x1 transparent PNG.
const LOADABLE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const BROKEN_IMAGE = "data:image/png;base64,Tk9UQU5JTUFHRQ==";

describe("<Avatar.Fallback />", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describeConformance(
    (props) => (
      <Avatar.Root>
        <Avatar.Fallback {...props} />
      </Avatar.Root>
    ),
    {
      defaultElement: "span",
      as: { targetElement: "div" },
      refInstanceof: window.HTMLSpanElement,
    },
  );

  it("renders while the image is loading", () => {
    render(() => (
      <Avatar.Root>
        <Avatar.Image src="avatar.png" />
        <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    flush();

    expect(screen.getByTestId("fallback")).not.toBe(null);
  });

  it("renders when the image fails to load", async () => {
    const onLoadingStatusChange = vi.fn();

    render(() => (
      <Avatar.Root>
        <Avatar.Image data-testid="image" onLoadingStatusChange={onLoadingStatusChange} src={BROKEN_IMAGE} />
        <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    await vi.waitFor(() => {
      flush();
      expect(onLoadingStatusChange).toHaveBeenCalledWith("error");
    });

    expect(screen.getByTestId("fallback")).not.toBe(null);
  });

  it("does not render once the image loads", async () => {
    render(() => (
      <Avatar.Root>
        <Avatar.Image src={LOADABLE_IMAGE} />
        <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    await vi.waitFor(() => {
      flush();
      expect(screen.queryByTestId("fallback")).toBe(null);
    });
  });

  it("renders again when a loaded image is unmounted", async () => {
    const [showImage, setShowImage] = createSignal(true);

    render(() => (
      <Avatar.Root>
        <Show when={showImage()}>
          <Avatar.Image data-testid="image" src={LOADABLE_IMAGE} />
        </Show>
        <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    await vi.waitFor(() => {
      flush();
      expect(screen.queryByTestId("fallback")).toBe(null);
    });

    setShowImage(false);
    flush();

    expect(screen.getByTestId("fallback")).not.toBe(null);
    expect(screen.queryByTestId("image")).toBe(null);
  });

  describe("prop: delay", () => {
    it("renders once the delay has elapsed", () => {
      vi.useFakeTimers();

      render(() => (
        <Avatar.Root>
          <Avatar.Image src="avatar.png" />
          <Avatar.Fallback delay={100}>JD</Avatar.Fallback>
        </Avatar.Root>
      ));

      flush();

      expect(screen.queryByText("JD")).toBe(null);

      vi.advanceTimersByTime(100);
      flush();

      expect(screen.queryByText("JD")).not.toBe(null);
    });

    it("renders immediately when the delay is 0", () => {
      render(() => (
        <Avatar.Root>
          <Avatar.Image src="avatar.png" />
          <Avatar.Fallback delay={0}>JD</Avatar.Fallback>
        </Avatar.Root>
      ));

      flush();

      expect(screen.queryByText("JD")).not.toBe(null);
    });
  });
});
