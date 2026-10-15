import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { RebaseUIEvent } from "../../types";
import * as Avatar from "../index.parts";
import type { ImageLoadingStatus } from "../root/AvatarRoot";

afterEach(cleanup);

// 1x1 transparent PNG.
const LOADABLE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const BROKEN_IMAGE = "data:image/png;base64,Tk9UQU5JTUFHRQ==";

function getImage(root: ParentNode): HTMLElement {
  const found = root.querySelector('[data-testid="image"]');
  if (!(found instanceof HTMLElement)) {
    throw new Error("avatar image not found");
  }
  return found;
}

function waitForStatus(statuses: () => string[], expected: string) {
  return vi.waitFor(() => {
    tick();
    expect(statuses()).toContain(expected);
  });
}

describe("<Avatar.Image />", () => {
  it("renders an img element by default", () => {
    const { el } = mount(() => (
      <Avatar.Root>
        <Avatar.Image data-testid="image" src="avatar.png" />
      </Avatar.Root>
    ));

    expect(getImage(el).tagName).toBe("IMG");
  });

  it("renders the customized root element with the as prop", () => {
    const { el } = mount(() => (
      <Avatar.Root>
        <Avatar.Image data-testid="image" as="div" />
      </Avatar.Root>
    ));

    expect(getImage(el).tagName).toBe("DIV");
  });

  it("attaches a callback ref to the image element", () => {
    let instance: HTMLElement | null = null;
    const { el } = mount(() => (
      <Avatar.Root>
        <Avatar.Image
          data-testid="image"
          src="avatar.png"
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        />
      </Avatar.Root>
    ));

    expect(instance).toBe(getImage(el));
    expect(instance).toBeInstanceOf(window.HTMLImageElement);
  });

  it("stays mounted while the image is loading", () => {
    const { el } = mount(() => (
      <Avatar.Root>
        <Avatar.Image data-testid="image" src="avatar.png" />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    expect(getImage(el)).toHaveAttribute("src", "avatar.png");
    expect(el.textContent).toContain("JD");
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
      mount(() => (
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
    const { el } = mount(() => (
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

    const image = getImage(el);

    expect(image).toHaveAttribute("crossorigin", "anonymous");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(image).toHaveAttribute("sizes", "48px");
    expect(image).toHaveAttribute("srcset", "avatar.png 1x, avatar@2x.png 2x");
  });

  it("reports an error when there is no source", () => {
    const onLoadingStatusChange = vi.fn();

    const { el } = mount(() => (
      <Avatar.Root>
        <Avatar.Image data-testid="image" onLoadingStatusChange={onLoadingStatusChange} />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    tick();

    expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual(["error"]);
    expect(getImage(el)).toHaveAttribute("aria-hidden", "true");
    expect(el.textContent).toContain("JD");
  });

  it("calls the class function with the component state", () => {
    const stateArguments: unknown[] = [];
    const { el } = mount(() => (
      <Avatar.Root>
        <Avatar.Image
          data-testid="image"
          src="avatar.png"
          class={(state) => {
            stateArguments.push(state);
            return "";
          }}
        />
      </Avatar.Root>
    ));

    expect(getImage(el)).toBeTruthy();
    // The initial render observes the loading status; later updates depend on the DOM.
    expect(stateArguments[0]).toEqual({ imageLoadingStatus: "loading", transitionStatus: undefined });
  });

  describe("loading status", () => {
    function renderWithStatusSpy(ui: (onLoadingStatusChange: (status: ImageLoadingStatus) => void) => void) {
      const onLoadingStatusChange = vi.fn();
      ui(onLoadingStatusChange);
      tick();

      return {
        statuses: () => onLoadingStatusChange.mock.calls.map(([status]) => status) as string[],
      };
    }

    it("resolves to loaded from the element's own load event", async () => {
      let root!: HTMLElement;
      const { statuses } = renderWithStatusSpy((onLoadingStatusChange) => {
        const mounted = mount(() => (
          <Avatar.Root>
            <Avatar.Image data-testid="image" src={LOADABLE_IMAGE} onLoadingStatusChange={onLoadingStatusChange} />
            <Avatar.Fallback>JD</Avatar.Fallback>
          </Avatar.Root>
        ));
        root = mounted.el;
      });

      fire(getImage(root), "load");
      await waitForStatus(statuses, "loaded");

      expect(statuses()).toEqual(["loading", "loaded"]);
      expect(root.textContent).not.toContain("JD");
    });

    it("resolves to error from the element's own error event", async () => {
      let root!: HTMLElement;
      const { statuses } = renderWithStatusSpy((onLoadingStatusChange) => {
        const mounted = mount(() => (
          <Avatar.Root>
            <Avatar.Image data-testid="image" src={BROKEN_IMAGE} onLoadingStatusChange={onLoadingStatusChange} />
            <Avatar.Fallback>JD</Avatar.Fallback>
          </Avatar.Root>
        ));
        root = mounted.el;
      });

      fire(getImage(root), "error");
      await waitForStatus(statuses, "error");

      expect(statuses()).toEqual(["loading", "error"]);
      expect(getImage(root)).not.toBe(null);
      expect(root.textContent).toContain("JD");
    });

    it("resets to loading when the src changes", async () => {
      const onLoadingStatusChange = vi.fn();
      const statuses = () => onLoadingStatusChange.mock.calls.map(([status]) => status) as string[];

      function Test() {
        let src = signal(LOADABLE_IMAGE);
        return (
          <Avatar.Root>
            <Avatar.Image data-testid="image" src={src} onLoadingStatusChange={onLoadingStatusChange} />
            <Avatar.Fallback>JD</Avatar.Fallback>
            <button data-testid="swap" onClick={() => (src = BROKEN_IMAGE)}>
              Swap
            </button>
          </Avatar.Root>
        );
      }
      const { el } = mount(() => <Test />);

      fire(getImage(el), "load");
      await waitForStatus(statuses, "loaded");
      onLoadingStatusChange.mockClear();

      (el.querySelector('[data-testid="swap"]') as HTMLButtonElement).click();
      tick();

      expect(statuses()).toContain("loading");
      expect(el.textContent).toContain("JD");

      fire(getImage(el), "error");
      await waitForStatus(statuses, "error");
    });

    it("keeps the fallback until the image resolves", () => {
      const { el } = mount(() => (
        <Avatar.Root>
          <Avatar.Image data-testid="image" src="avatar.png" />
          <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
        </Avatar.Root>
      ));

      tick();

      expect(getImage(el)).toHaveAttribute("aria-hidden", "true");
      expect(el.querySelector('[data-testid="fallback"]')).not.toBe(null);
    });
  });

  describe("accessibility", () => {
    it("hides the image from assistive technology until it loads", () => {
      const { el } = mount(() => (
        <Avatar.Root>
          <Avatar.Image alt="Jane Doe" data-testid="image" src="avatar.png" />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));

      tick();

      expect(getImage(el)).toHaveAttribute("aria-hidden", "true");
      expect(screen.queryByRole("img")).toBe(null);
    });

    it("exposes the image once it loads", async () => {
      const { el } = mount(() => (
        <Avatar.Root>
          <Avatar.Image alt="Jane Doe" data-testid="image" src={LOADABLE_IMAGE} />
        </Avatar.Root>
      ));

      fire(getImage(el), "load");

      await vi.waitFor(() => {
        tick();
        expect(getImage(el)).not.toHaveAttribute("aria-hidden");
      });

      expect(screen.getByRole("img", { name: "Jane Doe" })).not.toBe(null);
    });

    it("keeps the image hidden from assistive technology after an error", async () => {
      const onLoadingStatusChange = vi.fn();

      const { el } = mount(() => (
        <Avatar.Root>
          <Avatar.Image alt="Jane Doe" data-testid="image" onLoadingStatusChange={onLoadingStatusChange} src={BROKEN_IMAGE} />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));

      fire(getImage(el), "error");

      await vi.waitFor(() => {
        tick();
        expect(onLoadingStatusChange).toHaveBeenCalledWith("error");
      });

      expect(getImage(el)).toHaveAttribute("aria-hidden", "true");
      expect(screen.queryByRole("img")).toBe(null);
    });
  });

  describe("prop: onLoad / onError", () => {
    it("calls the user onLoad handler", async () => {
      const onLoad = vi.fn();

      const { el } = mount(() => (
        <Avatar.Root>
          <Avatar.Image data-testid="image" onLoad={onLoad} src={LOADABLE_IMAGE} />
        </Avatar.Root>
      ));

      fire(getImage(el), "load");

      await vi.waitFor(() => {
        tick();
        expect(onLoad).toHaveBeenCalledTimes(1);
      });

      expect(getImage(el)).not.toHaveAttribute("aria-hidden");
    });

    it("calls the user onError handler", async () => {
      const onError = vi.fn();

      const { el } = mount(() => (
        <Avatar.Root>
          <Avatar.Image data-testid="image" onError={onError} src={BROKEN_IMAGE} />
        </Avatar.Root>
      ));

      fire(getImage(el), "error");

      await vi.waitFor(() => {
        tick();
        expect(onError).toHaveBeenCalledTimes(1);
      });

      expect(getImage(el)).toHaveAttribute("aria-hidden", "true");
    });

    it("lets a user handler prevent the status update", () => {
      const onLoadingStatusChange = vi.fn();

      const { el } = mount(() => (
        <Avatar.Root>
          <Avatar.Image
            data-testid="image"
            onLoad={(event) => (event as unknown as RebaseUIEvent<Event>).preventRebaseUIHandler()}
            onLoadingStatusChange={onLoadingStatusChange}
            src="avatar.png"
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>
      ));

      tick();
      const statusesBefore = onLoadingStatusChange.mock.calls.map(([status]) => status);

      fire(getImage(el), "load");
      tick();

      // The prevented load resolves nothing: no new statuses and never "loaded".
      expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual(statusesBefore);
      expect(statusesBefore).not.toContain("loaded");
      expect(getImage(el)).toHaveAttribute("aria-hidden", "true");
      expect(el.textContent).toContain("JD");
    });
  });
});
