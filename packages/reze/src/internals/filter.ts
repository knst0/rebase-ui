import { serializeValue } from "@rebase-ui/core/serializeValue";

const filterCache = new Map<string, Filter>();

// Local copy of `select/utils/resolveValueLabel`'s `stringifyAsLabel` (the
// select group is not yet ported to Reze). Replace with the shared import once
// it lands.
function stringifyAsLabel(item: any, itemToStringLabel?: (item: any) => string) {
  if (itemToStringLabel && item != null) {
    return itemToStringLabel(item) ?? "";
  }
  if (item && typeof item === "object") {
    if ("label" in item && item.label != null) {
      return String(item.label);
    }
    if ("value" in item) {
      return String(item.value);
    }
  }
  return serializeValue(item);
}

function stringifyLocale(locale: Intl.LocalesArgument | undefined): string {
  if (locale == null) {
    return "";
  }
  return Array.isArray(locale) ? locale.join(",") : String(locale);
}

export function getFilter(options: GetFilterParameters = {}): Filter {
  const { locale, ...restOptions } = options;
  const collatorOptions: Intl.CollatorOptions = {
    usage: "search",
    sensitivity: "base",
    ignorePunctuation: true,
    ...restOptions,
  };

  const cacheKey = `${stringifyLocale(locale)}|${JSON.stringify(collatorOptions)}`;
  const cachedFilter = filterCache.get(cacheKey);

  if (cachedFilter) {
    return cachedFilter;
  }

  const collator = new Intl.Collator(locale, collatorOptions);

  const filter: Filter = {
    contains<Item>(item: Item, query: string, itemToString?: (item: Item) => string) {
      if (!query) {
        return true;
      }

      const itemString = stringifyAsLabel(item, itemToString);

      for (let i = 0; i <= itemString.length - query.length; i += 1) {
        if (collator.compare(itemString.slice(i, i + query.length), query) === 0) {
          return true;
        }
      }

      return false;
    },
    startsWith<Item>(item: Item, query: string, itemToString?: (item: Item) => string) {
      if (!query) {
        return true;
      }

      const itemString = stringifyAsLabel(item, itemToString);

      return collator.compare(itemString.slice(0, query.length), query) === 0;
    },
    endsWith<Item>(item: Item, query: string, itemToString?: (item: Item) => string) {
      if (!query) {
        return true;
      }

      const itemString = stringifyAsLabel(item, itemToString);
      const queryLength = query.length;

      return itemString.length >= queryLength && collator.compare(itemString.slice(itemString.length - queryLength), query) === 0;
    },
  };

  filterCache.set(cacheKey, filter);
  return filter;
}

export interface GetFilterParameters extends Intl.CollatorOptions {
  /**
   * The locale to use for string comparison.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
}

export interface Filter {
  /** Returns whether the item matches the query anywhere. */
  contains: <Item>(item: Item, query: string, itemToString?: (item: Item) => string) => boolean;
  /** Returns whether the item starts with the query. */
  startsWith: <Item>(item: Item, query: string, itemToString?: (item: Item) => string) => boolean;
  /** Returns whether the item ends with the query. */
  endsWith: <Item>(item: Item, query: string, itemToString?: (item: Item) => string) => boolean;
}
