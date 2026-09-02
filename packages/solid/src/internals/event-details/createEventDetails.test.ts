import { describe, expect, it } from "vitest";

import { createChangeEventDetails, createGenericEventDetails } from "./createEventDetails";

describe("createChangeEventDetails", () => {
  it("carries the reason, event and trigger", () => {
    const event = new MouseEvent("click");
    const trigger = document.createElement("button");
    const details = createChangeEventDetails("trigger-press", event, trigger);

    expect(details.reason).toBe("trigger-press");
    expect(details.event).toBe(event);
    expect(details.trigger).toBe(trigger);
  });

  it("substitutes a placeholder event when none is given", () => {
    const details = createChangeEventDetails("none");

    expect(details.event).toBeInstanceOf(Event);
    expect(details.event.type).toBe("rebase-ui");
    expect(details.trigger).toBeUndefined();
  });

  it("gives each instance its own placeholder event", () => {
    expect(createChangeEventDetails("none").event).not.toBe(createChangeEventDetails("none").event);
  });

  it("starts uncanceled and not allowed to propagate", () => {
    const details = createChangeEventDetails("none");

    expect(details.isCanceled).toBe(false);
    expect(details.isPropagationAllowed).toBe(false);
  });

  it("flips its flags independently", () => {
    const canceled = createChangeEventDetails("none");
    canceled.cancel();
    expect(canceled.isCanceled).toBe(true);
    expect(canceled.isPropagationAllowed).toBe(false);

    const propagating = createChangeEventDetails("none");
    propagating.allowPropagation();
    expect(propagating.isPropagationAllowed).toBe(true);
    expect(propagating.isCanceled).toBe(false);
  });

  it("keeps instances isolated from one another", () => {
    const first = createChangeEventDetails("none");
    const second = createChangeEventDetails("none");

    first.cancel();
    first.allowPropagation();

    expect(second.isCanceled).toBe(false);
    expect(second.isPropagationAllowed).toBe(false);
  });

  it("is idempotent", () => {
    const details = createChangeEventDetails("none");
    details.cancel();
    details.cancel();
    expect(details.isCanceled).toBe(true);
  });

  it("merges custom properties without disturbing the built-ins", () => {
    const details = createChangeEventDetails("item-press", undefined, undefined, { value: 7, label: "x" });

    expect(details.value).toBe(7);
    expect(details.label).toBe("x");
    expect(details.reason).toBe("item-press");
    details.cancel();
    expect(details.isCanceled).toBe(true);
  });

  it("exposes cancel and allowPropagation as callable methods", () => {
    const details = createChangeEventDetails("none");

    expect(details.cancel).toBeTypeOf("function");
    expect(details.allowPropagation).toBeTypeOf("function");
    expect(Object.hasOwn(details, "cancel")).toBe(false);
    expect("cancel" in details).toBe(true);
  });
});

describe("createGenericEventDetails", () => {
  it("carries the reason and event", () => {
    const event = new KeyboardEvent("keydown");
    const details = createGenericEventDetails("keyboard", event);

    expect(details.reason).toBe("keyboard");
    expect(details.event).toBe(event);
  });

  it("substitutes a placeholder event when none is given", () => {
    expect(createGenericEventDetails("none").event.type).toBe("rebase-ui");
  });

  it("merges custom properties", () => {
    const details = createGenericEventDetails("none", undefined, { index: 2 });
    expect(details.index).toBe(2);
    expect(details.reason).toBe("none");
  });

  it("has no cancellation surface", () => {
    const details = createGenericEventDetails("none");
    expect("cancel" in details).toBe(false);
    expect("isCanceled" in details).toBe(false);
  });
});
