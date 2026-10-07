import { createContext as _createContext, useContext as _useContext } from "solid-js";

export const MISSING = Symbol("rebase-ui.missing-context");

export type Missing = typeof MISSING;

export type Context<T> = ReturnType<typeof _createContext<T | Missing>>;

export function createContext<T>(): Context<T> {
  return _createContext<T | Missing>(MISSING);
}

export function useContext<T>(context: Context<T>): T | undefined {
  const value = _useContext(context);
  return value === MISSING ? undefined : value;
}
