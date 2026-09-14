import { stringifyAsLabel } from "../../../select/utils/resolveValueLabel";
import { createCollatorItemFilter, createSingleSelectionCollatorFilter } from "./index";

export interface UseFilterOptions {
  /**
   * The locale to use for string comparison.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * Whether matching is case-insensitive.
   * @default true
   */
  ignoreCase?: boolean | undefined;
  /**
   * Whether matching ignores diacritics (accents).
   * @default true
   */
  ignoreAccents?: boolean | undefined;
  /**
   * Whether the query and item labels are trimmed before matching.
   * @default true
   */
  trim?: boolean | undefined;
}

export interface Filter {
  contains: (item: any, query: string, itemToString?: (item: any) => string) => boolean;
  startsWith: (item: any, query: string, itemToString?: (item: any) => string) => boolean;
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Matches items against a query using `Intl.Collator` semantics for robust string matching
 * (case- and diacritics-insensitive by default).
 */
export function getFilter(options: UseFilterOptions = {}): Filter {
  const { locale, ignoreCase = true, ignoreAccents = true, trim = true } = options;

  const collator = new Intl.Collator(locale, {
    usage: "search",
    sensitivity: ignoreCase
      ? ignoreAccents
        ? "base"
        : "accent"
      : ignoreAccents
        ? "case"
        : "variant",
  });

  function normalize(value: string): string {
    let normalized = value;
    if (trim) {
      normalized = normalized.trim();
    }
    if (ignoreAccents) {
      normalized = stripDiacritics(normalized);
    }
    return normalized;
  }

  function compareSubstring(label: string, query: string, fromStart: boolean): boolean {
    const normalizedQuery = normalize(query);
    if (normalizedQuery === "") {
      return true;
    }
    const normalizedLabel = normalize(label);
    if (fromStart) {
      const prefix = normalizedLabel.slice(0, normalizedQuery.length);
      return (
        prefix.length === normalizedQuery.length && collator.compare(prefix, normalizedQuery) === 0
      );
    }
    if (normalizedQuery.length > normalizedLabel.length) {
      return false;
    }
    for (let index = 0; index + normalizedQuery.length <= normalizedLabel.length; index += 1) {
      if (
        collator.compare(normalizedLabel.slice(index, index + normalizedQuery.length), normalizedQuery) ===
        0
      ) {
        return true;
      }
    }
    return false;
  }

  function match(
    item: any,
    query: string,
    itemToString: ((item: any) => string) | undefined,
    fromStart: boolean,
  ): boolean {
    if (item == null) {
      return false;
    }
    return compareSubstring(stringifyAsLabel(item, itemToString), query, fromStart);
  }

  return {
    contains: (item, query, itemToString) => match(item, query, itemToString, false),
    startsWith: (item, query, itemToString) => match(item, query, itemToString, true),
  };
}

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 */
export const useCoreFilter = getFilter;

export interface UseComboboxFilterOptions extends UseFilterOptions {
  /**
   * Whether the combobox is in multiple selection mode.
   * @default false
   */
  multiple?: boolean | undefined;
  /**
   * The current value of the combobox, used to keep every item visible while the query still
   * matches the selection.
   */
  value?: any;
}

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 */
export function useComboboxFilter(options: UseComboboxFilterOptions = {}): Filter {
  const { multiple = false, value, ...collatorOptions } = options;

  const coreFilter = getFilter(collatorOptions);

  const contains: Filter["contains"] = (
    item: any,
    query: string,
    itemToString?: (item: any) => string,
  ) => {
    if (multiple) {
      return createCollatorItemFilter(coreFilter, itemToString)(item, query);
    }
    return createSingleSelectionCollatorFilter(coreFilter, itemToString, value)(item, query);
  };

  return { ...coreFilter, contains };
}
