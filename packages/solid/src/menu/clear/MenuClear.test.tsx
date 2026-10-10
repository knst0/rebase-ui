import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vite-plus/test";

import * as Menu from "../index.parts";

describe("<Menu.Clear />", () => {
  it("throws outside a filterable menu", () => {
    expect(() => render(() => <Menu.Clear>Clear</Menu.Clear>)).toThrow(/must be placed in a menu wrapped in <Menu\.FilterProvider>/);
  });
});
