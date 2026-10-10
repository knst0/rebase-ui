import type { MenuFilterImpl } from "./MenuFilterContext";
import { MenuFilterGroup, MenuFilterRadioGroup } from "./MenuFilterGroup";
import { MenuFilterList } from "./MenuFilterList";
import { MenuFilterPopup } from "./MenuFilterPopup";
import { useMenuFilterItem } from "./useMenuFilterItem";
import { useMenuFilterSubmenuTrigger } from "./useMenuFilterSubmenuTrigger";
import { useVirtualFocusParentHandoff } from "./useVirtualFocusParentHandoff";

/**
 * The filter implementation that a filterable root hands to the parts below it. Only the roots
 * `Menu.FilterProvider` renders import it, so a plain menu never bundles it.
 */
export const MENU_FILTER_IMPL: MenuFilterImpl = {
  Popup: MenuFilterPopup,
  List: MenuFilterList,
  Group: MenuFilterGroup,
  RadioGroup: MenuFilterRadioGroup,
  useItem: useMenuFilterItem,
  useSubmenuTrigger: useMenuFilterSubmenuTrigger,
  useParentHandoff: useVirtualFocusParentHandoff,
};
