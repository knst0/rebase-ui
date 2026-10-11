import { effectScope, getOwner, onCleanup, runWithOwner, type JSX } from "reze-js";

import type { ChildrenValue, ClassValue, StyleValue } from "./types";

function noop() {}

function isThunk(value: unknown): value is () => unknown {
  return typeof value === "function" && (value as (...args: never[]) => unknown).length === 0;
}

/** Eagerly evaluates thunks in place, recursing into arrays (fragments). */
function unwrapDeep<T>(value: T): T {
  let current: unknown = value;
  while (isThunk(current)) {
    current = (current as () => unknown)();
  }
  if (Array.isArray(current)) {
    return current.map(unwrapDeep) as T;
  }
  return current as T;
}

/** Whether a render result may contain thunks needing owner-scoped evaluation. */
function needsScope(value: unknown): boolean {
  return isThunk(value) || Array.isArray(value);
}

export interface ScopedRender {
  /**
   * Binds an already-invoked render result (accessor-style render props, run
   * once in the body). A thunk result is wrapped to re-evaluate per change:
   * `subscribe` re-reads the render inputs (the scope switch does not track).
   */
  bindResult<T>(result: T, subscribe?: () => void): T;
  /**
   * Invokes a render function per binding evaluation (value-style render
   * props) under a fresh generation scope.
   */
  call<T>(render: () => T): T;
}

/**
 * Creates render-prop invokers bound to this owner. Reactive JSX compiles to
 * thunks that evaluate at insert time under the mount owner, which sees none
 * of the local providers — so every evaluation runs inside a fresh child
 * scope of this owner instead. The previous generation is disposed first, so
 * re-created parts (chip registrations, listeners) never leak across runs.
 * Call the factory once in the component body.
 */
export function createScopedRender(): ScopedRender {
  const owner = getOwner();
  let disposeGeneration: (() => void) | undefined;
  onCleanup(() => {
    disposeGeneration?.();
  });

  function evaluate<T>(render: () => T): T {
    disposeGeneration?.();
    let out!: T;
    runWithOwner(owner, () => {
      disposeGeneration = effectScope(() => {
        // Unwrap nested thunks eagerly: leaving one for insert-time would
        // evaluate it under the mount owner, outside the providers.
        out = unwrapDeep(render());
      });
    });
    return out;
  }

  return {
    bindResult<T>(result: T, subscribe: () => void = noop): T {
      if (!needsScope(result)) {
        return result;
      }
      const capture = result as T;
      return ((() => {
        subscribe();
        return evaluate(() => capture);
      }) as unknown) as T;
    },
    call<T>(render: () => T): T {
      return evaluate(render);
    },
  };
}

export function resolveClassValue<State>(value: ClassValue<State> | undefined, state: State): JSX.ClassValue | undefined {
  if (typeof value === "function") {
    return resolveClassValue(value(state), state);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveClassValue(item, state));
  }
  // Array.isArray is true for readonly arrays at runtime, so only non-array values reach here.
  return value as JSX.ClassValue | undefined;
}

export function resolveStyleValue<State>(
  value: StyleValue<State> | undefined,
  state: State,
): string | JSX.CSSProperties | null | undefined {
  if (typeof value === "function") {
    return value(state);
  }
  return value;
}

export function resolveChildrenValue<State>(value: ChildrenValue<State> | undefined, state: () => State): JSX.Element {
  // Zero-argument functions pass through untouched: Reze control-flow primitives return
  // thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
  // The state thunk runs only for render-prop functions so merely passing children through
  // never subscribes the binding to dialog state (which would recreate child components).
  if (typeof value === "function" && value.length >= 1) {
    return (value as (state: State) => JSX.Element)(state());
  }
  return value as JSX.Element;
}

/**
 * Merges an internal style object with the resolved user style. Object styles merge
 * per-property with later (user) layers winning; a string user style cannot merge,
 * so it wins wholesale, matching the last-wins behavior of layered static props.
 */
export function mergeStyleValue(
  internal: Record<string, string | undefined>,
  user: string | JSX.CSSProperties | null | undefined,
): string | JSX.CSSProperties | undefined {
  if (typeof user === "string") {
    return user;
  }
  if (user == null) {
    return internal;
  }
  return { ...internal, ...user };
}
