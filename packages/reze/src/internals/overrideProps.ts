function isReservedKey(key: string) {
  return key === "__proto__" || key === "constructor";
}

/**
 * Copies `externalProps` lazily, replacing every own key of `overrides`.
 * Getters on either side stay lazy, so reads keep tracking the original sources.
 */
export function overrideProps(externalProps: Record<string, any>, overrides: Record<string, any>): Record<string, any> {
  const target: Record<string, any> = {};

  for (const key in externalProps) {
    if (Object.hasOwn(overrides, key) || isReservedKey(key)) {
      continue;
    }
    Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
  }

  for (const key of Object.keys(overrides)) {
    if (isReservedKey(key)) {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(overrides, key)!;

    if (descriptor.get === undefined && descriptor.set === undefined) {
      target[key] = descriptor.value;
    } else {
      Object.defineProperty(target, key, descriptor);
    }
  }

  return target;
}
