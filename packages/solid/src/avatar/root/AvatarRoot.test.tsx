import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { describeConformance } from "#test-utils";

import { Avatar } from "../index";

describe("<Avatar.Root />", () => {
  describeConformance((props) => <Avatar.Root {...props} />, {
    defaultElement: "span",
    as: { targetElement: "div" },
    refInstanceof: window.HTMLSpanElement,
  });

  it("renders its children", () => {
    render(() => (
      <Avatar.Root data-testid="root">
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    expect(screen.getByTestId("root")).toContainElement(screen.getByText("JD"));
  });

  it("renders the fallback when it has no image", () => {
    render(() => (
      <Avatar.Root data-testid="root">
        <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    expect(screen.getByTestId("fallback")).not.toBe(null);
  });
});
