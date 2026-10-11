import { cleanup, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterAll, afterEach, describe, expect, it } from "vite-plus/test";

import { useTriggerSwitchTransition, type TriggerSwitchTransitionStore } from "./useTriggerSwitchTransition";

afterEach(cleanup);

describe("useTriggerSwitchTransition", () => {
  const previousAnimationsFlag = globalThis.REBASE_UI_ANIMATIONS_DISABLED;
  globalThis.REBASE_UI_ANIMATIONS_DISABLED = true;

  afterEach(() => {
    document.body.innerHTML = "";
    globalThis.REBASE_UI_ANIMATIONS_DISABLED = true;
  });

  afterAll(() => {
    globalThis.REBASE_UI_ANIMATIONS_DISABLED = previousAnimationsFlag;
  });

  // Minimal stand-in for the popup stores (Menu/Popover): the hook only needs
  // the `TriggerSwitchTransitionStore` surface. Unlike the real stores, `peek`
  // reads the raw snapshot, which is exactly what the hook observes.
  class FakePopupStore implements TriggerSwitchTransitionStore {
    private snapshot: { open: boolean; instantType: string | undefined } = { open: false, instantType: undefined };

    peekState() {
      return this.snapshot;
    }

    peek(key: "open"): boolean {
      return this.snapshot[key];
    }

    set(key: "instantType", value: "trigger-change" | undefined): void {
      this.snapshot[key] = value;
    }

    update(next: Partial<{ open: boolean; instantType: string | undefined }>) {
      Object.assign(this.snapshot, next);
    }
  }

  function setup() {
    const store = new FakePopupStore();
    let openState = signal(false);
    let triggerState = signal<Element | null>(null);
    const positioner = document.createElement("div");
    document.body.appendChild(positioner);

    function Test() {
      useTriggerSwitchTransition({
        store,
        domReference: () => triggerState,
        positionerElement: () => positioner,
        open: () => openState,
      });
      return <div />;
    }
    mount(() => <Test />);
    tick();

    const setOpened = (value: boolean) => {
      openState = value;
      store.update({ open: value });
      tick();
    };

    const setDomReference = (element: Element | null) => {
      triggerState = element;
      tick();
    };

    return { store, setOpened, setDomReference };
  }

  it("restores trigger-change after moving between triggers while open", () => {
    const { store, setOpened, setDomReference } = setup();

    const first = document.createElement("button");
    const second = document.createElement("button");
    document.body.append(first, second);

    setOpened(true);
    setDomReference(first);
    expect(store.peekState().instantType).toBe(undefined);

    setDomReference(second);
    expect(store.peekState().instantType).toBe("trigger-change");
  });

  it("drops a restored trigger-change when the popup closes", () => {
    const { store, setOpened, setDomReference } = setup();

    const first = document.createElement("button");
    const second = document.createElement("button");
    document.body.append(first, second);

    setOpened(true);
    setDomReference(first);
    setDomReference(second);
    expect(store.peekState().instantType).toBe("trigger-change");

    setOpened(false);
    expect(store.peekState().instantType).toBe(undefined);
  });

  it("ignores trigger changes while closed", () => {
    const { store, setDomReference } = setup();

    const first = document.createElement("button");
    const second = document.createElement("button");
    document.body.append(first, second);

    setDomReference(first);
    setDomReference(second);

    expect(store.peekState().instantType).toBe(undefined);
  });
});
