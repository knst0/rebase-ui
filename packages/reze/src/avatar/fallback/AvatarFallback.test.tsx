import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { Show, signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import * as Avatar from "../index.parts";

afterEach(cleanup);

// 1x1 transparent PNG.
const LOADABLE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const BROKEN_IMAGE = "data:image/png;base64,Tk9UQU5JTUFHRQ==";

describe("<Avatar.Fallback />", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a span element by default", () => {
    const { el } = mount(() => (
      <Avatar.Root>
        <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    const fallback = el.querySelector('[data-testid="fallback"]');
    expect(fallback).not.toBe(null);
    expect((fallback as HTMLElement).tagName).toBe("SPAN");
  });

  it("renders the customized root element with the as prop", () => {
    const { el } = mount(() => (
      <Avatar.Root>
        <Avatar.Fallback data-testid="fallback" as="div">
          JD
        </Avatar.Fallback>
      </Avatar.Root>
    ));

    expect((el.querySelector('[data-testid="fallback"]') as HTMLElement).tagName).toBe("DIV");
  });

  it("attaches a callback ref to the fallback element", () => {
    let instance: HTMLElement | null = null;
    const { el } = mount(() => (
      <Avatar.Root>
        <Avatar.Fallback
          data-testid="fallback"
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        >
          JD
        </Avatar.Fallback>
      </Avatar.Root>
    ));

    expect(instance).toBe(el.querySelector('[data-testid="fallback"]'));
    expect(instance).toBeInstanceOf(window.HTMLSpanElement);
  });

  it("renders while the image is loading", () => {
    const { el } = mount(() => (
      <Avatar.Root>
        <Avatar.Image src="avatar.png" />
        <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    tick();

    expect(el.querySelector('[data-testid="fallback"]')).not.toBe(null);
  });

  it("renders when the image fails to load", async () => {
    const onLoadingStatusChange = vi.fn();

    const { el } = mount(() => (
      <Avatar.Root>
        <Avatar.Image data-testid="image" onLoadingStatusChange={onLoadingStatusChange} src={BROKEN_IMAGE} />
        <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    fire(el.querySelector('[data-testid="image"]') as HTMLElement, "error");

    await vi.waitFor(() => {
      tick();
      expect(onLoadingStatusChange).toHaveBeenCalledWith("error");
    });

    expect(el.querySelector('[data-testid="fallback"]')).not.toBe(null);
  });

  it("does not render once the image loads", async () => {
    const { el } = mount(() => (
      <Avatar.Root>
        <Avatar.Image data-testid="image" src={LOADABLE_IMAGE} />
        <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    fire(el.querySelector('[data-testid="image"]') as HTMLElement, "load");

    await vi.waitFor(() => {
      tick();
      expect(el.querySelector('[data-testid="fallback"]')).toBe(null);
    });
  });

  it("renders again when a loaded image is unmounted", async () => {
    function Test() {
      let showImage = signal(true);
      return (
        <Avatar.Root>
          <Show when={showImage}>
            <Avatar.Image data-testid="image" src={LOADABLE_IMAGE} />
          </Show>
          <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
          <button data-testid="hide" onClick={() => (showImage = false)}>
            Hide
          </button>
        </Avatar.Root>
      );
    }
    const { el } = mount(() => <Test />);

    fire(el.querySelector('[data-testid="image"]') as HTMLElement, "load");

    await vi.waitFor(() => {
      tick();
      expect(el.querySelector('[data-testid="fallback"]')).toBe(null);
    });

    (el.querySelector('[data-testid="hide"]') as HTMLButtonElement).click();
    tick();

    expect(el.querySelector('[data-testid="fallback"]')).not.toBe(null);
    expect(el.querySelector('[data-testid="image"]')).toBe(null);
  });

  it("calls the class function with the component state", () => {
    const stateArguments: unknown[] = [];
    const { el } = mount(() => (
      <Avatar.Root>
        <Avatar.Image src="avatar.png" />
        <Avatar.Fallback
          data-testid="fallback"
          class={(state) => {
            stateArguments.push(state);
            return "";
          }}
        >
          JD
        </Avatar.Fallback>
      </Avatar.Root>
    ));

    tick();

    expect(el.querySelector('[data-testid="fallback"]')).not.toBe(null);
    // The initial render observes the loading status; later updates depend on the DOM.
    expect(stateArguments[0]).toEqual({ imageLoadingStatus: "loading" });
  });

  describe("prop: delay", () => {
    it("renders once the delay has elapsed", () => {
      vi.useFakeTimers();

      const { el } = mount(() => (
        <Avatar.Root>
          <Avatar.Image src="avatar.png" />
          <Avatar.Fallback delay={100}>JD</Avatar.Fallback>
        </Avatar.Root>
      ));

      tick();

      expect(el.textContent).not.toContain("JD");

      vi.advanceTimersByTime(100);
      tick();

      expect(el.textContent).toContain("JD");
    });

    it("renders immediately when the delay is 0", () => {
      const { el } = mount(() => (
        <Avatar.Root>
          <Avatar.Image src="avatar.png" />
          <Avatar.Fallback delay={0}>JD</Avatar.Fallback>
        </Avatar.Root>
      ));

      tick();

      expect(el.textContent).toContain("JD");
    });
  });
});
