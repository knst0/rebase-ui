import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { FilterDropdownEmpty } from "../empty/FilterDropdownEmpty";
import { FilterDropdownInput } from "../input/FilterDropdownInput";
import { useFilterDropdownItem } from "../item/useFilterDropdownItem";
import { FilterDropdownRoot } from "./FilterDropdownRoot";
import { useFilterDropdownValueContext } from "./FilterDropdownRootContext";

function Item(props: { label: string }) {
  const { visible, ref } = useFilterDropdownItem({ label: props.label });
  return (
    <div
      ref={(element) => {
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
  const [value, setValue] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal<number | null>(null);
  const onValueChange = vi.fn((next: string) => setValue(next));
  const listRef = { current: [] as Array<HTMLElement | null> };

  render(() => (
    <FilterDropdownRoot
      open
      value={value()}
      onValueChange={onValueChange}
      autoHighlight={options.autoHighlight}
      listRef={listRef}
      getActiveIndex={activeIndex}
      setActiveIndex={setActiveIndex}
    >
      <FilterDropdownInput data-testid="input" />
      <Item label="Apple" />
      <Item label="Banana" />
      <Item label="Cherry" />
      <FilterDropdownEmpty data-testid="empty">No matches</FilterDropdownEmpty>
      <ValueProbe />
    </FilterDropdownRoot>
  ));
  flush();

  return { value, activeIndex, onValueChange, listRef };
}

describe("<FilterDropdownRoot />", () => {
  it("publishes visibility per item and shows empty state when nothing matches", async () => {
    setup();
    const user = userEvent.setup();
    const input = screen.getByTestId("input") as HTMLInputElement;

    expect(screen.queryByTestId("empty")).toBeNull();

    await user.type(input, "ap");
    flush();

    expect(screen.getByTestId("value").textContent).toBe("ap");
    expect(screen.getByTestId("item-Apple").style.display).toBe("");
    expect(screen.getByTestId("item-Banana").style.display).toBe("none");
    expect(screen.getByTestId("item-Cherry").style.display).toBe("none");
    expect(screen.queryByTestId("empty")).toBeNull();

    await user.clear(input);
    await user.type(input, "zzz");
    flush();
    expect(screen.getByTestId("empty")).toHaveTextContent("No matches");
  });

  it("auto-highlights the first match only when enabled", async () => {
    const highlighted = setup({ autoHighlight: true });
    const user = userEvent.setup();

    await user.type(screen.getByTestId("input"), "an");
    flush();
    expect(highlighted.value()).toBe("an");
    expect(highlighted.activeIndex()).toBe(0);

    const plain = setup();
    const user2 = userEvent.setup();
    const inputs = screen.getAllByTestId("input");
    await user2.type(inputs[1], "an");
    flush();
    expect(plain.value()).toBe("an");
    expect(plain.activeIndex()).toBeNull();
  });

  it("clears the highlight when the query changes without autoHighlight", async () => {
    const { activeIndex } = setup();
    const user = userEvent.setup();

    await user.type(screen.getByTestId("input"), "a");
    flush();
    expect(activeIndex()).toBeNull();
  });
});
