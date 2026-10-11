import { omitProps, type JSX } from "reze-js";

import {
  FilterDropdownInput,
  type FilterDropdownInputProps,
  type FilterDropdownInputState,
} from "../../filter-dropdown/input/FilterDropdownInput";
import { useFilterDropdownValueContext } from "../../filter-dropdown/root/FilterDropdownRootContext";
import { activeElement } from "../../internals/floating/utils/element";
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
export function MenuInput<T extends JSX.ElementType = "input">(props: MenuInput.Props<T>) {
  useMenuFilterPart("Input");
  const { store } = useMenuRootContext();
  const value = useFilterDropdownValueContext();

  const rest = omitProps(props, "ref", "onKeyDown", "onFocus", "onBlur");

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

  function ref(element: HTMLInputElement | null) {
    handleInputRef(element);
    (props.ref as ((element: HTMLInputElement | null) => void) | undefined)?.(element);
  }

  // Live view of the consumer handlers omitted from the spread above.
  const userHandlers = props as unknown as {
    onKeyDown?: ((event: KeyboardEvent) => void) | undefined;
    onFocus?: ((event: FocusEvent) => void) | undefined;
    onBlur?: ((event: FocusEvent) => void) | undefined;
  };

  // Mirror the filter input's chaining (consumer first, then internal, then host): the menu's
  // key routing runs after the consumer's, and focus bookkeeping alongside it.
  function onKeyDown(event: KeyboardEvent) {
    userHandlers.onKeyDown?.(event);
    handleKeyDown(event);
  }

  function onFocus(event: FocusEvent & { currentTarget: HTMLInputElement }) {
    store.set("inputFocused", true);
    (userHandlers.onFocus as ((event: unknown) => void) | undefined)?.(event);
  }

  function onBlur(event: FocusEvent & { currentTarget: HTMLInputElement }) {
    store.set("inputFocused", false);
    (userHandlers.onBlur as ((event: unknown) => void) | undefined)?.(event);
  }

  return (
    <FilterDropdownInput
      {...(rest as unknown as FilterDropdownInputProps)}
      activeItemId={activeItemId()}
      navigationProps={inputProps()}
      ref={ref}
      // Spread (not a direct prop): the filter input's element prop types omit `onKeyDown`.
      {...({ onKeyDown } as Record<string, unknown>)}
      onFocus={onFocus as (event: FocusEvent) => void}
      onBlur={onBlur as (event: FocusEvent) => void}
    />
  );
}

export interface MenuInputState extends FilterDropdownInputState {}
export type MenuInputProps<T extends JSX.ElementType = "input"> = FilterDropdownInputProps<T>;

export namespace MenuInput {
  export type State = MenuInputState;
  export type Props<T extends JSX.ElementType = "input"> = MenuInputProps<T>;
}
