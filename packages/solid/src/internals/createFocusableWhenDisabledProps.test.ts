import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import {
  type CreateFocusableWhenDisabledPropsParameters,
  createFocusableWhenDisabledProps,
  type FocusableWhenDisabledProps,
} from "./createFocusableWhenDisabledProps";

function legacyCreateFocusableWhenDisabledProps(parameters: CreateFocusableWhenDisabledPropsParameters): FocusableWhenDisabledProps {
  const { disabled, isNativeButton } = parameters;
  const focusableWhenDisabled = () => parameters.focusableWhenDisabled?.();
  const composite = () => parameters.composite?.() ?? false;
  const tabIndex = () => parameters.tabIndex?.() ?? 0;

  const isFocusableComposite = () => composite() && focusableWhenDisabled() !== false;
  const isNonFocusableComposite = () => composite() && focusableWhenDisabled() === false;

  const props: FocusableWhenDisabledProps = {
    onKeyDown: (event) => {
      if (disabled() && focusableWhenDisabled() && event.key !== "Tab") {
        event.preventDefault();
      }
    },
  };

  const defineProp = (key: keyof FocusableWhenDisabledProps, get: () => any) => {
    Object.defineProperty(props, key, { enumerable: true, configurable: true, get });
  };

  defineProp("tabIndex", () => {
    if (composite()) {
      return undefined;
    }
    if (!isNativeButton() && disabled()) {
      return focusableWhenDisabled() ? tabIndex() : -1;
    }
    return tabIndex();
  });

  defineProp("aria-disabled", () => {
    if ((isNativeButton() && (focusableWhenDisabled() || isFocusableComposite())) || (!isNativeButton() && disabled())) {
      return disabled() ? "true" : "false";
    }
    return undefined;
  });

  defineProp("disabled", () => {
    if (isNativeButton() && (!focusableWhenDisabled() || isNonFocusableComposite())) {
      return disabled();
    }
    return undefined;
  });

  return props;
}

const BOOLEANS = [true, false];
const OPTIONAL_BOOLEANS = [true, false, undefined];
const TAB_INDEXES = [undefined, 0, 3];

function forEachCombination(callback: (parameters: CreateFocusableWhenDisabledPropsParameters) => void) {
  for (const disabled of BOOLEANS) {
    for (const isNativeButton of BOOLEANS) {
      for (const focusableWhenDisabled of OPTIONAL_BOOLEANS) {
        for (const composite of OPTIONAL_BOOLEANS) {
          for (const tabIndex of TAB_INDEXES) {
            callback({
              disabled: () => disabled,
              isNativeButton: () => isNativeButton,
              focusableWhenDisabled: () => focusableWhenDisabled,
              composite: () => composite,
              tabIndex: () => tabIndex,
            });
          }
        }
      }
    }
  }
}

describe("createFocusableWhenDisabledProps", () => {
  it("matches the previous defineProp implementation for every input combination", () => {
    forEachCombination((parameters) => {
      const actual = createFocusableWhenDisabledProps(parameters);
      const expected = legacyCreateFocusableWhenDisabledProps(parameters);

      expect({ ...actual, onKeyDown: undefined }).toEqual({ ...expected, onKeyDown: undefined });
    });
  });

  it("exposes the reactive props as enumerable own properties", () => {
    const props = createFocusableWhenDisabledProps({
      disabled: () => true,
      isNativeButton: () => true,
    });

    expect(Object.keys(props).sort()).toEqual(["aria-disabled", "disabled", "onKeyDown", "tabIndex"]);
  });

  it("reads its accessors lazily on every property access", () => {
    const disabled = vi.fn(() => false);
    const props = createFocusableWhenDisabledProps({ disabled, isNativeButton: () => true });

    expect(disabled).not.toHaveBeenCalled();

    void props.disabled;
    void props.disabled;

    expect(disabled).toHaveBeenCalledTimes(2);
  });

  it("reflects signal updates without recreating the props object", () => {
    const [disabled, setDisabled] = createSignal(false);
    const props = createFocusableWhenDisabledProps({
      disabled,
      isNativeButton: () => false,
      focusableWhenDisabled: () => false,
    });

    expect(props.tabIndex).toBe(0);
    expect(props["aria-disabled"]).toBe(undefined);

    setDisabled(true);
    flush();

    expect(props.tabIndex).toBe(-1);
    expect(props["aria-disabled"]).toBe("true");
  });

  it("prevents default on non-Tab keys only when disabled and focusable", () => {
    const [disabled, setDisabled] = createSignal(true);
    const props = createFocusableWhenDisabledProps({
      disabled,
      isNativeButton: () => true,
      focusableWhenDisabled: () => true,
    });

    const enter = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
    props.onKeyDown(enter);
    expect(enter.defaultPrevented).toBe(true);

    const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    props.onKeyDown(tab);
    expect(tab.defaultPrevented).toBe(false);

    setDisabled(false);
    flush();

    const enterEnabled = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
    props.onKeyDown(enterEnabled);
    expect(enterEnabled.defaultPrevented).toBe(false);
  });
});
