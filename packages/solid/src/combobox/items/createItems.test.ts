import { describe, expect, it, vi } from "vitest";

import { defaultItemEquality } from "../../select/utils/itemEquality";
import { createComboboxItems } from "./createItems";
import { findCollectionItem } from "./itemCollection";

interface User {
  id: number;
  name: string;
}

const users: User[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Carol" },
];

function createUserItems(data: User[] | undefined = users) {
  return createComboboxItems(data, {
    getValue: (user) => user.id,
    getLabel: (user) => user.name,
  });
}

describe("createComboboxItems", () => {
  it("passes data through and projects values without running accessors at creation", () => {
    const getValue = vi.fn((user: User) => user.id);
    const getLabel = vi.fn((user: User) => user.name);
    const collection = createComboboxItems(users, { getValue, getLabel });

    expect(getValue).not.toHaveBeenCalled();
    expect(getLabel).not.toHaveBeenCalled();

    const internal = collection as unknown as {
      data: User[] | undefined;
      value: (item: User) => number;
      itemLabel: (item: User) => string;
    };
    expect(internal.data).toBe(users);
    expect(internal.value(users[0])).toBe(1);
    expect(internal.itemLabel(users[1])).toBe("Bob");
  });

  it("keeps absent data absent instead of defaulting to an empty list", () => {
    const collection = createComboboxItems(undefined, {
      getValue: (user: User) => user.id,
      getLabel: (user: User) => user.name,
    });

    const internal = collection as unknown as { data: unknown };
    expect(internal.data).toBe(undefined);
    expect(
      (collection as unknown as { hasValue: (value: number, isEqual: typeof defaultItemEquality) => boolean }).hasValue(
        1,
        defaultItemEquality,
      ),
    ).toBe(false);
  });

  it("resolves membership through hasValue", () => {
    const internal = createUserItems() as unknown as {
      hasValue: (value: number, isEqual: typeof defaultItemEquality) => boolean;
    };

    expect(internal.hasValue(2, defaultItemEquality)).toBe(true);
    expect(internal.hasValue(99, defaultItemEquality)).toBe(false);
  });

  it("resolves labels for known values and falls back otherwise", () => {
    const internal = createUserItems() as unknown as {
      label: (
        value: number,
        isEqual: typeof defaultItemEquality,
        fallback?: (value: number) => string,
      ) => string;
    };

    expect(internal.label(1, defaultItemEquality)).toBe("Alice");
    expect(internal.label(99, defaultItemEquality, (value) => `User ${value}`)).toBe("User 99");
    expect(internal.label(99, defaultItemEquality)).toBe("99");
  });

  it("supports custom equality when resolving values", () => {
    const internal = createUserItems() as unknown as {
      hasValue: (value: number, isEqual: (a: any, b: any) => boolean) => boolean;
    };
    const looseEqual = (a: any, b: any) => String(a) === String(b);

    expect(internal.hasValue("2" as unknown as number, looseEqual)).toBe(true);
    expect(internal.hasValue(99, looseEqual)).toBe(false);
  });

  it("derives values across grouped data", () => {
    const collection = createComboboxItems([{ items: users }] as const, {
      getValue: (user: User) => user.id,
      getLabel: (user: User) => user.name,
    });
    const internal = collection as unknown as {
      hasValue: (value: number, isEqual: typeof defaultItemEquality) => boolean;
      label: (value: number, isEqual: typeof defaultItemEquality) => string;
    };

    expect(internal.hasValue(3, defaultItemEquality)).toBe(true);
    expect(internal.label(3, defaultItemEquality)).toBe("Carol");
  });

  it("reports duplicated derived values in development", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const internal = createComboboxItems(
        [
          { id: 1, name: "Alice" },
          { id: 1, name: "Alicia" },
        ],
        {
          getValue: (user: User) => user.id,
          getLabel: (user: User) => user.name,
        },
      ) as unknown as {
        label: (value: number, isEqual: typeof defaultItemEquality) => string;
      };

      // First occurrence wins the label; the duplicate is reported once.
      expect(internal.label(1, defaultItemEquality)).toBe("Alice");
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("findCollectionItem", () => {
  it("returns the exact entry and short-circuits custom equality with the default comparer", () => {
    const item = { id: 1, name: "Alice" };
    const index = new Map([[1, item]]);
    const customEqual = vi.fn(() => true);

    expect(findCollectionItem(index, 1, customEqual)).toBe(item);
    expect(customEqual).not.toHaveBeenCalled();
    expect(findCollectionItem(index, 2, defaultItemEquality)).toBe(undefined);
  });

  it("scans entries with a custom comparer", () => {
    const item = { id: 1, name: "Alice" };
    const index = new Map([[1, item]]);

    expect(findCollectionItem(index, 1, (a, b) => String(a) === String(b))).toBe(item);
    expect(findCollectionItem(index, 2, (a, b) => String(a) === String(b))).toBe(undefined);
  });
});
