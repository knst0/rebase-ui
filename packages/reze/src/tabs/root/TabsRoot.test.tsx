import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import * as Tabs from "../index.parts";
import * as TabsTabDataAttributes from "../tab/TabsTabDataAttributes";
import type { TabsRootChangeEventDetails } from "./TabsRoot";
import * as TabsRootDataAttributes from "./TabsRootDataAttributes";

afterEach(cleanup);

function getRoot(el: ParentNode): HTMLElement {
  const root = el.firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error("tabs root not found");
  }
  return root;
}

describe("<Tabs.Root />", () => {
  it("renders a div element by default", () => {
    const { el } = mount(() => <Tabs.Root />);
    tick();

    expect(getRoot(el).tagName).toBe("DIV");
  });

  it("renders the customized root element", () => {
    const { el } = mount(() => <Tabs.Root as="section" />);
    tick();

    expect(getRoot(el).tagName).toBe("SECTION");
  });

  it("attaches a callback ref to the root element", () => {
    let instance: HTMLElement | null = null;
    const { el } = mount(() => (
      <Tabs.Root
        ref={(value: HTMLElement) => {
          instance = value;
        }}
      />
    ));
    tick();

    expect(instance).toBe(getRoot(el));
  });

  it("sets `data-orientation`", () => {
    const { el } = mount(() => <Tabs.Root orientation="vertical" />);
    tick();

    expect(getRoot(el)).toHaveAttribute(TabsRootDataAttributes.orientation, "vertical");
  });

  it("selects the first tab by default", () => {
    mount(() => (
      <Tabs.Root>
        <Tabs.List>
          <Tabs.Tab value={0}>One</Tabs.Tab>
          <Tabs.Tab value={1}>Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab1).toHaveAttribute("aria-selected", "true");
    expect(tab1).toHaveAttribute(TabsTabDataAttributes.active);
    expect(tab2).toHaveAttribute("aria-selected", "false");
  });

  it("honors `defaultValue`", () => {
    mount(() => (
      <Tabs.Root defaultValue="two">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab1).toHaveAttribute("aria-selected", "false");
    expect(tab2).toHaveAttribute("aria-selected", "true");
  });

  it("supports a function as the default value", () => {
    const functionValue = () => 1;

    mount(() => (
      <Tabs.Root defaultValue={functionValue}>
        <Tabs.List>
          <Tabs.Tab value={0}>One</Tabs.Tab>
          <Tabs.Tab value={functionValue}>Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab1).toHaveAttribute("aria-selected", "false");
    expect(tab2).toHaveAttribute("aria-selected", "true");
  });

  it("selects no tab when the value is null", () => {
    mount(() => (
      <Tabs.Root value={null}>
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("aria-selected", "false");
    }
  });

  it("updates when the controlled value changes", () => {
    function Test() {
      let value: string = signal("one");
      return (
        <>
          <Tabs.Root value={value}>
            <Tabs.List>
              <Tabs.Tab value="one">One</Tabs.Tab>
              <Tabs.Tab value="two">Two</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
          <button onClick={() => (value = "two")}>Change</button>
        </>
      );
    }
    mount(() => <Test />);
    tick();

    const [tab1] = screen.getAllByRole("tab");
    expect(tab1).toHaveAttribute("aria-selected", "true");

    fire(screen.getByRole("button", { name: "Change" }), "click");
    tick();

    const [, tab2] = screen.getAllByRole("tab");
    expect(tab1).toHaveAttribute("aria-selected", "false");
    expect(tab2).toHaveAttribute("aria-selected", "true");
  });

  it("calls `onValueChange` with the reason and activation direction", async () => {
    const onValueChange = vi.fn();

    const user = userEvent.setup();
    mount(() => (
      <Tabs.Root defaultValue="one" onValueChange={onValueChange}>
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    await user.click(screen.getAllByRole("tab")[1]);
    tick();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe("two");
    expect(onValueChange.mock.calls[0][1].reason).toBe("none");
    expect(onValueChange.mock.calls[0][1].activationDirection).toBe("right");
  });

  it("does not change the value when the event is canceled", async () => {
    const user = userEvent.setup();
    mount(() => (
      <Tabs.Root defaultValue="one" onValueChange={(_value: unknown, eventDetails: TabsRootChangeEventDetails) => eventDetails.cancel()}>
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    const [tab1, tab2] = screen.getAllByRole("tab");

    await user.click(tab2);
    tick();

    expect(tab1).toHaveAttribute("aria-selected", "true");
    expect(tab2).toHaveAttribute("aria-selected", "false");
  });

  it("falls back to the first enabled tab when the implicit initial value is disabled", () => {
    const onValueChange = vi.fn();

    mount(() => (
      <Tabs.Root onValueChange={onValueChange}>
        <Tabs.List>
          <Tabs.Tab value={0} disabled>
            One
          </Tabs.Tab>
          <Tabs.Tab value={1}>Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab1).toHaveAttribute("aria-selected", "false");
    expect(tab2).toHaveAttribute("aria-selected", "true");
    expect(onValueChange.mock.calls[0][1].reason).toBe("initial");
  });

  it("honors an explicit `defaultValue` pointing at a disabled tab", () => {
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one" disabled>
            One
          </Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(screen.getAllByRole("tab")[0]).toHaveAttribute("aria-selected", "true");
  });

  it("keeps a controlled value that matches no tab", () => {
    mount(() => (
      <Tabs.Root value="missing">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("aria-selected", "false");
    }
  });

  it("sets `data-activation-direction` on the root", async () => {
    const user = userEvent.setup();
    const { el } = mount(() => (
      <Tabs.Root defaultValue="two">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(getRoot(el)).toHaveAttribute(TabsRootDataAttributes.activationDirection, "none");

    await user.click(screen.getAllByRole("tab")[0]);
    tick();

    expect(getRoot(el)).toHaveAttribute(TabsRootDataAttributes.activationDirection, "left");
  });

  it("mirrors the horizontal activation direction in a right-to-left list", async () => {
    const user = userEvent.setup();
    // happy-dom does not propagate `dir` into computed `direction`, so the
    // inline style carries the direction here; real browsers resolve `dir`.
    const { el } = mount(() => (
      <Tabs.Root defaultValue="one" dir="rtl" style={{ direction: "rtl" }}>
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    await user.click(screen.getAllByRole("tab")[1]);
    tick();

    expect(getRoot(el)).toHaveAttribute(TabsRootDataAttributes.activationDirection, "left");

    await user.click(screen.getAllByRole("tab")[0]);
    tick();

    expect(getRoot(el)).toHaveAttribute(TabsRootDataAttributes.activationDirection, "right");
  });

  it("reports the vertical activation direction from document order", async () => {
    const user = userEvent.setup();
    const { el } = mount(() => (
      <Tabs.Root defaultValue="one" orientation="vertical">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    await user.click(screen.getAllByRole("tab")[1]);
    tick();

    expect(getRoot(el)).toHaveAttribute(TabsRootDataAttributes.activationDirection, "down");
  });

  it("reads the activation direction without measuring tab rects", async () => {
    const user = userEvent.setup();
    const getBoundingClientRect = vi.spyOn(window.HTMLElement.prototype, "getBoundingClientRect");

    try {
      const { el } = mount(() => (
        <Tabs.Root defaultValue="one">
          <Tabs.List>
            <Tabs.Tab value="one">One</Tabs.Tab>
            <Tabs.Tab value="two">Two</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      tick();

      getBoundingClientRect.mockClear();
      await user.click(screen.getAllByRole("tab")[1]);
      tick();

      expect(getRoot(el)).toHaveAttribute(TabsRootDataAttributes.activationDirection, "right");
      expect(getBoundingClientRect).not.toHaveBeenCalled();
    } finally {
      getBoundingClientRect.mockRestore();
    }
  });

  describe("render props", () => {
    it("calls the class function with the component state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <Tabs.Root
          orientation="vertical"
          class={(state) => {
            stateArgument = state;
            return "";
          }}
        />
      ));
      tick();

      expect(getRoot(el)).toBeTruthy();
      expect(stateArgument).toEqual({ orientation: "vertical", tabActivationDirection: "none" });
    });

    it("forwards the style prop defined as a function of state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <Tabs.Root
          style={(state) => {
            stateArgument = state;
            return { color: "green" };
          }}
        />
      ));
      tick();

      expect(getRoot(el).style.color).toBe("green");
      expect(stateArgument).toEqual({ orientation: "horizontal", tabActivationDirection: "none" });
    });

    it("renders children defined as a function of state", () => {
      const { el } = mount(() => <Tabs.Root orientation="vertical">{(state) => (state.orientation === "vertical" ? "V" : "H")}</Tabs.Root>);
      tick();

      expect(getRoot(el).textContent).toBe("V");
    });

    it("forwards custom props to the root element", () => {
      const { el } = mount(() => <Tabs.Root lang="fr" data-foobar="test-value" />);
      tick();

      expect(getRoot(el).getAttribute("lang")).toBe("fr");
      expect(getRoot(el).getAttribute("data-foobar")).toBe("test-value");
    });
  });
});
