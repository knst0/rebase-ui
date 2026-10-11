/**
 * A boolean prop that is either the shorthand literal `true`
 * or an accessor, so dynamic values stay reactive.
 */
export type ReactiveBoolean = (() => boolean) | true;

export function accessBoolean(value: ReactiveBoolean | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value === true ? true : value();
}
