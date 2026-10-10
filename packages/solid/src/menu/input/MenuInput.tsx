import type { ValidComponent } from "@solidjs/web";

import {
  FilterDropdownInput,
  type FilterDropdownInputProps,
  type FilterDropdownInputState,
} from "../../filter-dropdown/input/FilterDropdownInput";
import { useFilterDropdownValueContext } from "../../filter-dropdown/root/FilterDropdownRootContext";
import { activeElement } from "../../internals/floating/utils/element";
import { mergeRefs } from "../../internals/mergeRefs";
import { useMenuFilterPart } from "../filter-root/MenuFilterContext";
import { useMenuFilterKeyDown } from "../filter-root/useMenuFilterKeyDown";
import { useMenuRootContext } from "../root/MenuRootContext";

/**
 * A search field that filters the menu items.
 * Requires the menu to be wrapped in `Menu.FilterProvider`.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuInput<T extends ValidComponent = "input">(props: MenuInput.Props<T>) {
  useMenuFilterPart("Input");
  const { store } = useMenuRootContext();
  const value = useFilterDropdownValueContext();

  const inputProps = () => {
    const { onKeyDown: _onKeyDown, ...navigationProps } = (store.select("inputProps") as Record<string, unknown>) ?? {};
    return navigationProps;
  };
  const activeItemId = () => store.select("highlightedItemId") as string | undefined;

  const handleKeyDown = useMenuFilterKeyDown(() => value() !== "");

  function handleInputRef(input: HTMLInputElement | null) {
    // Ref changes cover input removal without blur and restore focus after replayed mounts.
    store.set("inputFocused", input !== null && activeElement(input.ownerDocument) === input);
  }

  const { ref: _ignoredRef, ...restProps } = props as Record<string, unknown>;

  return (
    <FilterDropdownInput
      {...(restProps as FilterDropdownInputProps)}
      activeItemId={activeItemId()}
      navigationProps={inputProps()}
      ref={mergeRefs(handleInputRef, (props as { ref?: (element: HTMLInputElement | null) => void }).ref)}
      onKeyDown={handleKeyDown}
      onFocus={(event: FocusEvent & { currentTarget: HTMLInputElement }) => {
        store.set("inputFocused", true);
        (restProps as { onFocus?: (event: unknown) => void }).onFocus?.(event);
      }}
      onBlur={(event: FocusEvent & { currentTarget: HTMLInputElement }) => {
        store.set("inputFocused", false);
        (restProps as { onBlur?: (event: unknown) => void }).onBlur?.(event);
      }}
    />
  );
}

export interface MenuInputState extends FilterDropdownInputState {}
export type MenuInputProps<T extends ValidComponent = "input"> = FilterDropdownInputProps<T>;

export namespace MenuInput {
  export type State = MenuInputState;
  export type Props<T extends ValidComponent = "input"> = MenuInputProps<T>;
}
