import { cleanup, mount } from "@rezejs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as Menu from "../index.parts";

afterEach(cleanup);

describe("<Menu.Empty />", () => {
  it("throws outside a filterable menu", () => {
    expect(() => mount(() => <Menu.Empty>No matches</Menu.Empty>)).toThrow(/must be placed in a menu wrapped in <Menu\.FilterProvider>/);
  });
});
