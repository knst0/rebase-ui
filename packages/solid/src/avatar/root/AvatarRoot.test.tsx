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

  it("has no loading state attributes while idle", () => {
    render(() => <Avatar.Root data-testid="root" />);

    const root = screen.getByTestId("root");

    expect(root).not.toHaveAttribute("data-loading");
    expect(root).not.toHaveAttribute("data-error");
  });
});
