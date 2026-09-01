import type { TabsTabValue } from "../tab/TabsTab";

const ID_SAFE = /^[A-Za-z0-9-]+$/;
const ID_UNSAFE = /[^A-Za-z0-9-]/g;

const objectKeys = new WeakMap<object, string>();
const symbolKeys = new Map<symbol, string>();
let objectKeyCount = 0;

function escape(source: string): string {
  return ID_SAFE.test(source) ? source : source.replace(ID_UNSAFE, (character) => `_${character.codePointAt(0)!.toString(36)}_`);
}

/**
 * Maps a tab value to a token that is stable, unique per value and safe inside an
 * HTML `id`. Primitives encode to a pure function of the value so server and client
 * derive the same token without coordinating; object values fall back to identity.
 */
export function tabsValueKey(value: TabsTabValue): string {
  switch (typeof value) {
    case "string":
      return `s${escape(value)}`;
    case "number":
      return `n${escape(String(value))}`;
    case "bigint":
      return `i${escape(String(value))}`;
    case "boolean":
      return value ? "bt" : "bf";
    case "undefined":
      return "u";
    case "symbol": {
      let key = symbolKeys.get(value);
      if (key === undefined) {
        key = `y${(objectKeyCount++).toString(36)}`;
        symbolKeys.set(value, key);
      }
      return key;
    }
    default: {
      if (value === null) {
        return "x";
      }

      let key = objectKeys.get(value);
      if (key === undefined) {
        key = `o${(objectKeyCount++).toString(36)}`;
        objectKeys.set(value, key);
      }
      return key;
    }
  }
}
