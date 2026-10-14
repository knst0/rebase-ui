import { describe, expect, it } from "vite-plus/test";

import { collectApi, parseAttributes } from "./collect";

describe("parseAttributes", () => {
  it("reads the attribute type from `@type` tags", () => {
    const attributes = parseAttributes(
      `/**
        * Indicates the index of the accordion item.
        * @type {number}
        */
        export const index = "data-index";`,
      new Map(),
    );

    expect(attributes).toEqual([{ name: "data-index", type: "number", description: "Indicates the index of the accordion item." }]);
  });

  it("leaves untyped attributes without a type", () => {
    const attributes = parseAttributes(
      `/**
        * Present when the accordion panel is open.
        */
        export const panelOpen = "data-panel-open";`,
      new Map(),
    );

    expect(attributes).toEqual([{ name: "data-panel-open", type: undefined, description: "Present when the accordion panel is open." }]);
  });

  it("resolves aliased constants through the shared table", () => {
    const attributes = parseAttributes(
      `/**
        * Present when the panel begins animating in.
        */
        export const startingStyle = TransitionStatusDataAttributes.startingStyle;`,
      new Map([["startingStyle", "data-starting-style"]]),
    );

    expect(attributes).toEqual([
      { name: "data-starting-style", type: undefined, description: "Present when the panel begins animating in." },
    ]);
  });
});

describe("collectApi", () => {
  it("collects the accordion trigger data-index row", async () => {
    const root = new URL("../../..", import.meta.url).pathname;
    const api = await collectApi(root, { dir: "../packages/solid/src", packageName: "@rebase-ui/solid" });

    const trigger = api.accordion.parts.find((part) => part.name === "Trigger");

    expect(trigger?.attributes).toContainEqual({
      name: "data-index",
      type: "number",
      description: "Indicates the index of the accordion item.",
    });
  }, 60000);

  it("collects metadata namespaces added by the v1.9.0 sync (#5243, #5901)", async () => {
    const root = new URL("../../..", import.meta.url).pathname;
    const api = await collectApi(root, { dir: "../packages/solid/src", packageName: "@rebase-ui/solid" });

    const viewport = api.dialog.parts.find((part) => part.name === "Viewport");
    expect(viewport?.attributes).toContainEqual({
      name: "data-nested",
      type: undefined,
      description: "Present when the dialog is nested within another dialog.",
    });

    const alertTrigger = api["alert-dialog"].parts.find((part) => part.name === "Trigger");
    expect(alertTrigger?.attributes).toContainEqual({
      name: "data-popup-open",
      type: undefined,
      description: "Present when the corresponding alert dialog is open.",
    });

    const legend = api.fieldset.parts.find((part) => part.name === "Legend");
    expect(legend?.attributes).toContainEqual({
      name: "data-disabled",
      type: undefined,
      description: "Present when the fieldset is disabled.",
    });
  }, 60000);
});
