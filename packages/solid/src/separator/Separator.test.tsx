import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { describeConformance } from "#test-utils";

import { Separator } from "./Separator";

describe("<Separator />", () => {
  describeConformance((props) => <Separator {...props} />, {
    defaultElement: "div",
    as: { targetElement: "span" },
  });

  describe("prop: orientation", () => {
    ["horizontal", "vertical"].forEach((orientation) => {
      it(orientation, () => {
        render(() => <Separator orientation={orientation as Separator.Props["orientation"]} />);
        expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", orientation);
      });
    });
  });
});
