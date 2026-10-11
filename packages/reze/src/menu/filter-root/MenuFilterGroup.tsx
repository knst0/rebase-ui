import type { JSX } from "reze-js";

import { FilterDropdownGroupContext } from "../../filter-dropdown/group/FilterDropdownGroupContext";
import { useFilterDropdownGroup } from "../../filter-dropdown/group/useFilterDropdownGroup";
import { MenuGroupPlain, type MenuGroup } from "../group/MenuGroup";
import { MenuRadioGroupPlain, type MenuRadioGroup } from "../radio-group/MenuRadioGroup";

/**
 * `Menu.Group` in a filterable menu: hidden, label included, once the query filters out all of
 * its items.
 *
 * @internal
 */
export function MenuFilterGroup<T extends JSX.ElementType = "div">(props: MenuGroup.Props<T>) {
  const { hidden, context } = useFilterDropdownGroup();

  return (
    <FilterDropdownGroupContext value={context}>
      <MenuGroupPlain {...(props as Record<string, unknown>)} hidden={hidden() || (props as { hidden?: boolean }).hidden || undefined} />
    </FilterDropdownGroupContext>
  );
}

/**
 * `Menu.RadioGroup` in a filterable menu, hidden like `MenuFilterGroup`.
 *
 * @internal
 */
export function MenuFilterRadioGroup<T extends JSX.ElementType = "div">(props: MenuRadioGroup.Props<T>) {
  const { hidden, context } = useFilterDropdownGroup();

  return (
    <FilterDropdownGroupContext value={context}>
      <MenuRadioGroupPlain
        {...(props as Record<string, unknown>)}
        hidden={hidden() || (props as { hidden?: boolean }).hidden || undefined}
      />
    </FilterDropdownGroupContext>
  );
}
