import { render } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { afterAll, afterEach, describe, expect, it } from "vite-plus/test";

import { MenuStore } from "../menu/store/MenuStore";
import { useTriggerSwitchTransition } from "./useTriggerSwitchTransition";

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

  function setup() {
    const store = new MenuStore({}, "test-id", false);
    const [open, setOpenSignal] = createSignal(false);
    const [domReference, setDomReference] = createSignal<Element | null>(null);
    const positioner = document.createElement("div");
    document.body.appendChild(positioner);

    render(() => {
      useTriggerSwitchTransition({
        store,
        domReference,
        positionerElement: () => positioner,
        open,
      });
      return <div />;
    });
    flush();

    const setOpened = (value: boolean) => {
      setOpenSignal(value);
      store.update({ open: value });
      flush();
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
    flush();
    expect(store.peek("instantType")).toBe(undefined);

    setDomReference(second);
    flush();
    expect(store.peek("instantType")).toBe("trigger-change");
  });

  it("drops a restored trigger-change when the popup closes", () => {
    const { store, setOpened, setDomReference } = setup();

    const first = document.createElement("button");
    const second = document.createElement("button");
    document.body.append(first, second);

    setOpened(true);
    setDomReference(first);
    flush();
    setDomReference(second);
    flush();
    expect(store.peek("instantType")).toBe("trigger-change");

    setOpened(false);
    expect(store.peekState().instantType).toBe(undefined);
    expect(store.peek("instantType")).toBe(undefined);
  });

  it("ignores trigger changes while closed", () => {
    const { store, setDomReference } = setup();

    const first = document.createElement("button");
    const second = document.createElement("button");
    document.body.append(first, second);

    setDomReference(first);
    flush();
    setDomReference(second);
    flush();

    expect(store.peekState().instantType).toBe(undefined);
  });
});
