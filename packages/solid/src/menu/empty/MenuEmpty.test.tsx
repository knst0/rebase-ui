import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vite-plus/test";

import * as Menu from "../index.parts";

describe("<Menu.Empty />", () => {
  it("throws outside a filterable menu", () => {
    expect(() => render(() => <Menu.Empty>No matches</Menu.Empty>)).toThrow(/must be placed in a menu wrapped in <Menu\.FilterProvider>/);
  });
});
