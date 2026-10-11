export interface LayoutReadCounts {
  getComputedStyle: number;
  scrollHeight: number;
  scrollWidth: number;
  total: number;
}

function findGetterOwner(property: string): object {
  let proto: object | null = HTMLElement.prototype;
  while (proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, property);
    if (descriptor?.get) {
      return proto;
    }
    proto = Object.getPrototypeOf(proto);
  }
  throw new Error(`No getter found for "${property}"`);
}

/**
 * Counts the forced style/layout reads performed while `fn` runs.
 */
export async function countLayoutReads<T>(fn: () => T | Promise<T>): Promise<{ result: T; counts: LayoutReadCounts }> {
  const counts: LayoutReadCounts = { getComputedStyle: 0, scrollHeight: 0, scrollWidth: 0, total: 0 };

  const originalGetComputedStyle = window.getComputedStyle;
  const patchedGetters = (["scrollHeight", "scrollWidth"] as const).map((property) => {
    const owner = findGetterOwner(property);
    const descriptor = Object.getOwnPropertyDescriptor(owner, property)!;
    const originalGetter = descriptor.get!;

    Object.defineProperty(owner, property, {
      ...descriptor,
      get(this: Element) {
        counts[property] += 1;
        counts.total += 1;
        return originalGetter.call(this);
      },
    });

    return { owner, property, descriptor };
  });

  window.getComputedStyle = function patchedGetComputedStyle(this: Window, ...args: Parameters<typeof originalGetComputedStyle>) {
    counts.getComputedStyle += 1;
    counts.total += 1;
    return originalGetComputedStyle.apply(this, args);
  };

  try {
    const result = await fn();
    return { result, counts };
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
    for (const { owner, property, descriptor } of patchedGetters) {
      Object.defineProperty(owner, property, descriptor);
    }
  }
}

export interface CallTally {
  readonly count: number;
  reset: () => void;
  wrap: <A extends unknown[], R>(fn: (...args: A) => R) => (...args: A) => R;
}

/**
 * Creates a tally that counts invocations of every function it wraps.
 */
export function countCalls(): CallTally {
  let count = 0;

  return {
    get count() {
      return count;
    },
    reset() {
      count = 0;
    },
    wrap(fn) {
      return (...args) => {
        count += 1;
        return fn(...args);
      };
    },
  };
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}
