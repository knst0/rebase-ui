import "@testing-library/jest-dom/vitest";
import { cleanup, mount } from "@rezejs/testing-library";
import { screen, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { Autocomplete } from "..";

afterEach(cleanup);

const fruits = ["Apple", "Apricot", "Banana"];

function Example(props: Autocomplete.Root.Props<string>) {
  return (
    <Autocomplete.Root items={fruits} {...props}>
      <Autocomplete.Input data-testid="input" />
      <Autocomplete.Portal>
        <Autocomplete.Positioner>
          <Autocomplete.Popup>
            <Autocomplete.List>{(item: string) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}</Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

describe("<Autocomplete.Root />", () => {
  it("filters the list by the typed value and fills the input on item press", async () => {
    const onValueChange = vi.fn();
    mount(() => <Example onValueChange={onValueChange} />);
    const user = userEvent.setup();
    const input = screen.getByTestId("input") as HTMLInputElement;

    await user.type(input, "ap");
    await waitFor(() => expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Apple", "Apricot"]));

    await user.click(screen.getByRole("option", { name: "Apple" }));
    await waitFor(() => expect(input.value).toBe("Apple"));
    expect(onValueChange).toHaveBeenLastCalledWith("Apple", expect.anything());
  });

  it("keeps items static in mode none", async () => {
    mount(() => <Example mode="none" />);
    const user = userEvent.setup();
    await user.type(screen.getByTestId("input"), "ap");
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
  });

  it("previews the highlighted label in mode inline without changing the value", async () => {
    const onValueChange = vi.fn();
    mount(() => <Example mode="inline" onValueChange={onValueChange} />);
    const user = userEvent.setup();
    const input = screen.getByTestId("input") as HTMLInputElement;

    await user.type(input, "b");
    onValueChange.mockClear();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(input.value).toBe("Apple"));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("does not open on input click by default", async () => {
    mount(() => <Example />);
    await userEvent.setup().click(screen.getByTestId("input"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("renders the input value through Autocomplete.Value", async () => {
    mount(() => (
      <Autocomplete.Root defaultValue="hello">
        <span data-testid="value">
          <Autocomplete.Value />
        </span>
      </Autocomplete.Root>
    ));
    expect(screen.getByTestId("value")).toHaveTextContent("hello");
  });
});
