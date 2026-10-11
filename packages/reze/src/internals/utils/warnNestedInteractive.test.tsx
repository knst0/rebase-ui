import { cleanup, mount, tick } from "@rezejs/testing-library";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vite-plus/test";

import { Button } from "../../button/Button";
import { PreviewCard } from "../../preview-card";
import { Tooltip } from "../../tooltip";
import { reset } from "./error";

function flushMicrotasks() {
  return new Promise<void>((resolve) => {
    queueMicrotask(() => queueMicrotask(resolve));
  });
}

describe("warnNestedInteractive", () => {
  let errorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    reset();
    errorSpy = vi
      .spyOn(console, "error")
      .mockName("console.error")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("warns when a Button is nested inside Tooltip.Trigger", async () => {
    mount(() => (
      <Tooltip.Root>
        <Tooltip.Trigger>
          <Button>x</Button>
        </Tooltip.Trigger>
      </Tooltip.Root>
    ));
    tick();
    await flushMicrotasks();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("<button> is nested inside <button>"));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("`as` prop"));
  });

  it("does not warn when the component is composed through `as`", async () => {
    const { el } = mount(() => (
      <Tooltip.Root>
        <Tooltip.Trigger as={Button}>x</Tooltip.Trigger>
      </Tooltip.Root>
    ));
    tick();
    await flushMicrotasks();

    expect(el.querySelectorAll("button")).toHaveLength(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("warns about a link nested inside a trigger", async () => {
    mount(() => (
      <Tooltip.Root>
        <Tooltip.Trigger>
          <a href="/somewhere">x</a>
        </Tooltip.Trigger>
      </Tooltip.Root>
    ));
    tick();
    await flushMicrotasks();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("<a> is nested inside <button>"));
  });

  it("warns for PreviewCard.Trigger wrapping a button", async () => {
    mount(() => (
      <PreviewCard.Root>
        <PreviewCard.Trigger href="/somewhere">
          <Button>x</Button>
        </PreviewCard.Trigger>
      </PreviewCard.Root>
    ));
    tick();
    await flushMicrotasks();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("<button> is nested inside <a>"));
  });

  it("warns for button-like parts that use createButton", async () => {
    mount(() => (
      <Button>
        <Button>x</Button>
      </Button>
    ));
    tick();
    await flushMicrotasks();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("<button> is nested inside <button>"));
  });

  it("does not warn for a trigger with plain content", async () => {
    mount(() => (
      <Tooltip.Root>
        <Tooltip.Trigger>
          <span>icon</span>
        </Tooltip.Trigger>
      </Tooltip.Root>
    ));
    tick();
    await flushMicrotasks();

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
