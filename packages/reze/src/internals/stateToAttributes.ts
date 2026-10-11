type UnwrapAccessor<T> = T extends () => infer R ? R : T;

export interface StateAttributeMapping<Value> {
  keys: readonly string[];
  map: (value: Value) => Record<string, string> | null;
}

export type StateAttributesMapping<State> = {
  [Property in keyof State]?: StateAttributeMapping<UnwrapAccessor<State[Property]>>;
};

export function toStateAttributeValue(value: unknown): string | undefined {
  if (value === true) return "";
  if (value === false || value == null || value === "") return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return undefined;
}
