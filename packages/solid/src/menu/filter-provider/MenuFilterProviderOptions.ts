import type { FilterDropdownFilter, FilterDropdownRoot } from "../../filter-dropdown/root/FilterDropdownRootContext";

export interface MenuFilterProviderOptions {
  /**
   * Custom filter logic used when filtering items. Pass `null` to turn filtering off.
   */
  filter?: FilterDropdownFilter | null | undefined;
  /**
   * The controlled filter input value.
   */
  value?: string | undefined;
  /**
   * The uncontrolled initial filter input value.
   * @default ''
   */
  defaultValue?: string | undefined;
  /**
   * Event handler called when the filter input value changes.
   */
  onValueChange?: ((value: string, eventDetails: FilterDropdownRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Whether the first matching item should be highlighted automatically.
   * `'always'` keeps the highlight on the first item even with an empty query.
   * @default false
   */
  autoHighlight?: boolean | "always" | undefined;
  /**
   * Locale used for filtering comparisons.
   */
  locale?: Intl.LocalesArgument | undefined;
}
