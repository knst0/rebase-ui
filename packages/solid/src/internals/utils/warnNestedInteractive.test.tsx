import { render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vite-plus/test";

import { Button } from "../../button/Button";
import { PreviewCard } from "../../preview-card";
import { Tooltip } from "../../tooltip";
import { reset } from "./error";

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
    vi.restoreAllMocks();
  });

  it("warns when a Button is nested inside Tooltip.Trigger", () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger>
          <Button>x</Button>
        </Tooltip.Trigger>
      </Tooltip.Root>
    ));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("<button> is nested inside <button>"));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("`as` prop"));
  });

  it("does not warn when the component is composed through `as`", () => {
    const { container } = render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger as={Button}>x</Tooltip.Trigger>
      </Tooltip.Root>
    ));

    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("warns about a link nested inside a trigger", () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger>
          <a href="/somewhere">x</a>
        </Tooltip.Trigger>
      </Tooltip.Root>
    ));

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("<a> is nested inside <button>"));
  });

  it("warns for PreviewCard.Trigger wrapping a button", () => {
    render(() => (
      <PreviewCard.Root>
        <PreviewCard.Trigger href="/somewhere">
          <Button>x</Button>
        </PreviewCard.Trigger>
      </PreviewCard.Root>
    ));

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("<button> is nested inside <a>"));
  });

  it("warns for button-like parts that use createButton", () => {
    render(() => (
      <Button>
        <Button>x</Button>
      </Button>
    ));

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("<button> is nested inside <button>"));
  });

  it("does not warn for a trigger with plain content", () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger>
          <span>icon</span>
        </Tooltip.Trigger>
      </Tooltip.Root>
    ));

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
