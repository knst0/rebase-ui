type Group<T> = readonly (keyof T & string)[];

type Defaulted<P, D> = Omit<P, keyof D> & { [K in Extract<keyof P, keyof D>]-?: Exclude<P[K], undefined> };

type Grouped<T, G extends readonly Group<T>[], D> = {
  [I in keyof G]: Defaulted<Pick<T, G[I][number]>, D>;
};

type Rest<T, G extends readonly Group<T>[], D> = Defaulted<Omit<T, G[number][number]>, D>;

export interface SplitOptions<T, D extends Partial<T>> {
  default?: D | undefined;
}

export function split<T extends Record<string, any>, const G extends readonly Group<T>[]>(
  props: T,
  ...groups: G
): [...Grouped<T, G, {}>, Rest<T, G, {}>];
export function split<T extends Record<string, any>, const G extends readonly Group<T>[], D extends Partial<T> = {}>(
  props: T,
  options: SplitOptions<T, D>,
  ...groups: G
): [...Grouped<T, G, D>, Rest<T, G, D>];
export function split(props: Record<string, any>, ...args: any[]): any[] {
  const hasOptions = args.length > 0 && !Array.isArray(args[0]);
  const groups: string[][] = hasOptions ? args.slice(1) : args;
  const defaults: Record<string, any> | undefined = hasOptions ? args[0].default : undefined;

  const targets: Record<string, any>[] = [];
  const owners = new Map<string, Record<string, any>>();

  for (const group of groups) {
    const target: Record<string, any> = {};
    targets.push(target);
    for (const key of group) {
      if (!owners.has(key)) {
        owners.set(key, target);
      }
    }
  }

  const rest: Record<string, any> = {};
  targets.push(rest);

  const seen = new Set<string>();

  for (const key in props) {
    seen.add(key);
    forwardProp(owners.get(key) ?? rest, props, key, defaults);
  }

  if (defaults !== undefined) {
    for (const key in defaults) {
      if (!seen.has(key)) {
        forwardProp(owners.get(key) ?? rest, props, key, defaults);
      }
    }
  }

  return targets;
}

function forwardProp(target: Record<string, any>, props: Record<string, any>, key: string, defaults: Record<string, any> | undefined) {
  if (defaults === undefined || !(key in defaults)) {
    const descriptor = Object.getOwnPropertyDescriptor(props, key);
    if (descriptor !== undefined && descriptor.get === undefined && descriptor.set === undefined) {
      Object.defineProperty(target, key, { enumerable: true, configurable: true, writable: true, value: descriptor.value });
      return;
    }
  }

  const get = defaults !== undefined && key in defaults ? () => (key in props ? props[key] : defaults[key]) : () => props[key];

  Object.defineProperty(target, key, { enumerable: true, configurable: true, get });
}
