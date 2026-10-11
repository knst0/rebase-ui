import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { store } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { FilterDropdownEmpty } from "../empty/FilterDropdownEmpty";
import { FilterDropdownInput } from "../input/FilterDropdownInput";
import { useFilterDropdownItem } from "../item/useFilterDropdownItem";
import { FilterDropdownRoot } from "./FilterDropdownRoot";
import { useFilterDropdownValueContext } from "./FilterDropdownRootContext";

afterEach(cleanup);

function getByTestId(root: ParentNode, testId: string): HTMLElement {
  const found = root.querySelector(`[data-testid="${testId}"]`);
  if (!(found instanceof HTMLElement)) {
    throw new Error(`element with data-testid="${testId}" not found`);
  }
  return found;
}

function queryByTestId(root: ParentNode, testId: string): HTMLElement | null {
  return root.querySelector(`[data-testid="${testId}"]`);
}

function Item(props: { label: string }) {
  const { visible, ref } = useFilterDropdownItem({ label: props.label });
  return (
    <div
      ref={(element: HTMLDivElement | null) => {
        ref.current = element;
      }}
      data-testid={`item-${props.label}`}
      style={visible() ? undefined : { display: "none" }}
    >
      {props.label}
    </div>
  );
}

function ValueProbe() {
  const value = useFilterDropdownValueContext();
  return <span data-testid="value">{value()}</span>;
}

function setup(options: { autoHighlight?: boolean | "always" } = {}) {
  const state = store({ value: "", activeIndex: null as number | null });
  const onValueChange = vi.fn((next: string) => {
    state.value = next;
  });
  const listRef = { current: [] as Array<HTMLElement | null> };

  const { el } = mount(() => (
    <FilterDropdownRoot
      open
      value={state.value}
      onValueChange={onValueChange}
      autoHighlight={options.autoHighlight}
      listRef={listRef}
      getActiveIndex={() => state.activeIndex}
      setActiveIndex={(index) => {
        state.activeIndex = index;
      }}
    >
      <FilterDropdownInput data-testid="input" />
      <Item label="Apple" />
      <Item label="Banana" />
      <Item label="Cherry" />
      <FilterDropdownEmpty data-testid="empty">No matches</FilterDropdownEmpty>
      <ValueProbe />
    </FilterDropdownRoot>
  ));
  tick();

  return { el, state, onValueChange, listRef };
}

function type(input: HTMLInputElement, text: string): void {
  for (const char of text) {
    input.value += char;
    fire(input, "input");
    tick();
  }
}

function clear(input: HTMLInputElement): void {
  input.value = "";
  fire(input, "input");
  tick();
}

describe("<FilterDropdownRoot />", () => {
  it("publishes visibility per item and shows empty state when nothing matches", () => {
    const { el } = setup();
    const input = getByTestId(el, "input") as HTMLInputElement;

    expect(queryByTestId(el, "empty")).toBeNull();

    type(input, "ap");

    expect(getByTestId(el, "value").textContent).toBe("ap");
    expect((getByTestId(el, "item-Apple") as HTMLElement).style.display).toBe("");
    expect((getByTestId(el, "item-Banana") as HTMLElement).style.display).toBe("none");
    expect((getByTestId(el, "item-Cherry") as HTMLElement).style.display).toBe("none");
    expect(queryByTestId(el, "empty")).toBeNull();

    clear(input);
    type(input, "zzz");
    expect(getByTestId(el, "empty").textContent).toBe("No matches");
  });

  it("auto-highlights the first match only when enabled", () => {
    const highlighted = setup({ autoHighlight: true });

    type(getByTestId(highlighted.el, "input") as HTMLInputElement, "an");
    expect(highlighted.state.value).toBe("an");
    expect(highlighted.state.activeIndex).toBe(0);

    const plain = setup();
    type(getByTestId(plain.el, "input") as HTMLInputElement, "an");
    expect(plain.state.value).toBe("an");
    expect(plain.state.activeIndex).toBeNull();
  });

  it("clears the highlight when the query changes without autoHighlight", () => {
    const { el, state } = setup();

    type(getByTestId(el, "input") as HTMLInputElement, "a");
    expect(state.activeIndex).toBeNull();
  });
});
