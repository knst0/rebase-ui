import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { describeConformance } from "#test-utils";

import { Avatar } from "../index";

// 1x1 transparent PNG.
const LOADABLE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const BROKEN_IMAGE = "data:image/png;base64,Tk9UQU5JTUFHRQ==";

function waitForStatus(statuses: () => string[], expected: string) {
  return vi.waitFor(() => {
    flush();
    expect(statuses()).toContain(expected);
  });
}

describe("<Avatar.Image />", () => {
  describeConformance(
    (props) => (
      <Avatar.Root>
        <Avatar.Image src="avatar.png" {...props} />
      </Avatar.Root>
    ),
    {
      defaultElement: "img",
      as: { targetElement: "div" },
      refInstanceof: window.HTMLImageElement,
    },
  );

  it("stays mounted while the image is loading", () => {
    render(() => (
      <Avatar.Root>
        <Avatar.Image data-testid="image" src="avatar.png" />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    expect(screen.getByTestId("image")).toHaveAttribute("src", "avatar.png");
    expect(screen.getByText("JD")).not.toBe(null);
  });

  it("does not preload the image with a detached element", () => {
    const OriginalImage = window.Image;
    const constructed: unknown[] = [];

    class TrackedImage extends OriginalImage {
      constructor() {
        super();
        constructed.push(this);
      }
    }

    window.Image = TrackedImage as typeof window.Image;

    try {
      render(() => (
        <Avatar.Root>
          <Avatar.Image data-testid="image" src={LOADABLE_IMAGE} />
        </Avatar.Root>
      ));

      expect(constructed.length).toBe(0);
    } finally {
      window.Image = OriginalImage;
    }
  });

  it("passes native image props to the rendered image", () => {
    render(() => (
      <Avatar.Root>
        <Avatar.Image
          crossorigin="anonymous"
          data-testid="image"
          loading="lazy"
          referrerpolicy="no-referrer"
          sizes="48px"
          src="avatar.png"
          srcset="avatar.png 1x, avatar@2x.png 2x"
        />
      </Avatar.Root>
    ));

    const image = screen.getByTestId("image");

    expect(image).toHaveAttribute("crossorigin", "anonymous");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(image).toHaveAttribute("sizes", "48px");
    expect(image).toHaveAttribute("srcset", "avatar.png 1x, avatar@2x.png 2x");
  });

  it("reports an error when there is no source", () => {
    const onLoadingStatusChange = vi.fn();

    render(() => (
      <Avatar.Root>
        <Avatar.Image data-testid="image" onLoadingStatusChange={onLoadingStatusChange} />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    flush();

    expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual(["error"]);
    expect(screen.getByTestId("image")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("JD")).not.toBe(null);
  });

  describe("loading status", () => {
    function renderWithStatusSpy(ui: (onLoadingStatusChange: (status: string) => void) => void) {
      const onLoadingStatusChange = vi.fn();
      ui(onLoadingStatusChange);
      flush();

      return {
        statuses: () => onLoadingStatusChange.mock.calls.map(([status]) => status) as string[],
      };
    }

    it("resolves to loaded from the element's own load event", async () => {
      const { statuses } = renderWithStatusSpy((onLoadingStatusChange) => {
        render(() => (
          <Avatar.Root>
            <Avatar.Image data-testid="image" src={LOADABLE_IMAGE} onLoadingStatusChange={onLoadingStatusChange} />
            <Avatar.Fallback>JD</Avatar.Fallback>
          </Avatar.Root>
        ));
      });

      fireEvent.load(screen.getByTestId("image"));
      await waitForStatus(statuses, "loaded");

      expect(statuses()).toEqual(["loading", "loaded"]);
      expect(screen.queryByText("JD")).toBe(null);
    });

    it("resolves to error from the element's own error event", async () => {
      const { statuses } = renderWithStatusSpy((onLoadingStatusChange) => {
        render(() => (
          <Avatar.Root>
            <Avatar.Image data-testid="image" src={BROKEN_IMAGE} onLoadingStatusChange={onLoadingStatusChange} />
            <Avatar.Fallback>JD</Avatar.Fallback>
          </Avatar.Root>
        ));
      });

      fireEvent.error(screen.getByTestId("image"));
      await waitForStatus(statuses, "error");

      expect(statuses()).toEqual(["loading", "error"]);
      expect(screen.getByTestId("image")).not.toBe(null);
      expect(screen.getByText("JD")).not.toBe(null);
    });

    it("resets to loading when the src changes", async () => {
      const [src, setSrc] = createSignal(LOADABLE_IMAGE);
      const onLoadingStatusChange = vi.fn();
      const statuses = () => onLoadingStatusChange.mock.calls.map(([status]) => status) as string[];

      render(() => (
        <Avatar.Root>
          <Avatar.Image data-testid="image" src={src()} onLoadingStatusChange={onLoadingStatusChange} />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));

      fireEvent.load(screen.getByTestId("image"));
      await waitForStatus(statuses, "loaded");
      onLoadingStatusChange.mockClear();

      setSrc(BROKEN_IMAGE);
      flush();

      expect(statuses()).toContain("loading");
      expect(screen.getByText("JD")).not.toBe(null);

      fireEvent.error(screen.getByTestId("image"));
      await waitForStatus(statuses, "error");
    });

    it("keeps the fallback until the image resolves", () => {
      render(() => (
        <Avatar.Root>
          <Avatar.Image data-testid="image" src="avatar.png" />
          <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
        </Avatar.Root>
      ));

      flush();

      expect(screen.getByTestId("image")).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByTestId("fallback")).not.toBe(null);
    });
  });

  describe("accessibility", () => {
    it("hides the image from assistive technology until it loads", () => {
      render(() => (
        <Avatar.Root>
          <Avatar.Image alt="Jane Doe" data-testid="image" src="avatar.png" />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));

      flush();

      expect(screen.getByTestId("image")).toHaveAttribute("aria-hidden", "true");
      expect(screen.queryByRole("img")).toBe(null);
    });

    it("exposes the image once it loads", async () => {
      render(() => (
        <Avatar.Root>
          <Avatar.Image alt="Jane Doe" data-testid="image" src={LOADABLE_IMAGE} />
        </Avatar.Root>
      ));

      fireEvent.load(screen.getByTestId("image"));

      await vi.waitFor(() => {
        flush();
        expect(screen.getByTestId("image")).not.toHaveAttribute("aria-hidden");
      });

      expect(screen.getByRole("img", { name: "Jane Doe" })).not.toBe(null);
    });

    it("keeps the image hidden from assistive technology after an error", async () => {
      const onLoadingStatusChange = vi.fn();

      render(() => (
        <Avatar.Root>
          <Avatar.Image alt="Jane Doe" data-testid="image" onLoadingStatusChange={onLoadingStatusChange} src={BROKEN_IMAGE} />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));

      fireEvent.error(screen.getByTestId("image"));

      await vi.waitFor(() => {
        flush();
        expect(onLoadingStatusChange).toHaveBeenCalledWith("error");
      });

      expect(screen.getByTestId("image")).toHaveAttribute("aria-hidden", "true");
      expect(screen.queryByRole("img")).toBe(null);
    });
  });

  describe("prop: onLoad / onError", () => {
    it("calls the user onLoad handler", async () => {
      const onLoad = vi.fn();

      render(() => (
        <Avatar.Root>
          <Avatar.Image data-testid="image" onLoad={onLoad} src={LOADABLE_IMAGE} />
        </Avatar.Root>
      ));

      fireEvent.load(screen.getByTestId("image"));

      await vi.waitFor(() => {
        flush();
        expect(onLoad).toHaveBeenCalledTimes(1);
      });

      expect(screen.getByTestId("image")).not.toHaveAttribute("aria-hidden");
    });

    it("calls the user onError handler", async () => {
      const onError = vi.fn();

      render(() => (
        <Avatar.Root>
          <Avatar.Image data-testid="image" onError={onError} src={BROKEN_IMAGE} />
        </Avatar.Root>
      ));

      fireEvent.error(screen.getByTestId("image"));

      await vi.waitFor(() => {
        flush();
        expect(onError).toHaveBeenCalledTimes(1);
      });

      expect(screen.getByTestId("image")).toHaveAttribute("aria-hidden", "true");
    });

    it("lets a user handler prevent the status update", () => {
      const onLoadingStatusChange = vi.fn();

      render(() => (
        <Avatar.Root>
          <Avatar.Image
            data-testid="image"
            onLoad={(event) => event.preventRebaseUIHandler()}
            onLoadingStatusChange={onLoadingStatusChange}
            src="avatar.png"
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));

      flush();

      fireEvent.load(screen.getByTestId("image"));
      flush();

      expect(screen.getByTestId("image")).toHaveAttribute("aria-hidden", "true");
      expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual(["loading"]);
      expect(screen.getByText("JD")).not.toBe(null);
    });
  });
});
