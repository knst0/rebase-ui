import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { safePolygon } from "../safePolygon";
import type { FloatingNodeType } from "../types";
import {
  createGridCellMap,
  findNonDisabledListIndex,
  getGridCellIndexOfCorner,
  getGridCellIndices,
  getMaxListIndex,
  getMinListIndex,
  isDifferentGridRow,
  isIndexOutOfListBounds,
} from "./composite";
import { createEventEmitter } from "./createEventEmitter";
import { isTargetInsideEnabledTrigger } from "./element";
import { getEmptyRootContext } from "./getEmptyRootContext";
import { markOthers } from "./markOthers";
import { getDeepestNode, getNodeAncestors, getNodeChildren } from "./nodes";
import { disableFocusInside, enableFocusInside, isTabbable, tabbable } from "./tabbable";

afterEach(() => {
  document.body.innerHTML = "";
});

function attachButtons(count: number) {
  const container = document.createElement("div");
  const elements = Array.from({ length: count }, () => document.createElement("button"));
  for (const element of elements) {
    container.appendChild(element);
  }
  document.body.appendChild(container);
  return { container, elements };
}

describe("createEventEmitter", () => {
  it("emits to subscribed listeners and stops after off", () => {
    const events = createEventEmitter();
    const listener = vi.fn();
    events.on("open", listener);
    events.emit("open", { value: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ value: 1 });

    events.off("open", listener);
    events.emit("open", { value: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores emitting unknown events", () => {
    const events = createEventEmitter();
    expect(() => events.emit("missing")).not.toThrow();
  });
});

describe("composite helpers", () => {
  it("detects grid row changes and list bounds", () => {
    expect(isDifferentGridRow(3, 3, 0)).toBe(true);
    expect(isDifferentGridRow(1, 3, 0)).toBe(false);
    expect(isIndexOutOfListBounds([null, null], -1)).toBe(true);
    expect(isIndexOutOfListBounds([null, null], 2)).toBe(true);
    expect(isIndexOutOfListBounds([null, null], 1)).toBe(false);
  });

  it("finds non-disabled indices forward and backward", () => {
    const { elements } = attachButtons(3);
    expect(findNonDisabledListIndex(elements, { disabledIndices: [0] })).toBe(1);
    expect(
      findNonDisabledListIndex(elements, {
        startingIndex: 3,
        decrement: true,
        disabledIndices: [2],
      }),
    ).toBe(1);
    expect(findNonDisabledListIndex(elements, { disabledIndices: (index) => index === 1 })).toBe(0);
  });

  it("resolves min/max indices from ref objects", () => {
    const { elements } = attachButtons(2);
    expect(getMinListIndex({ current: elements }, [0])).toBe(1);
    expect(getMaxListIndex({ current: elements }, [1])).toBe(0);
  });

  it("maps grid cells and corners", () => {
    const sizes = [
      { width: 1, height: 1 },
      { width: 2, height: 1 },
    ];
    const cellMap = createGridCellMap(sizes, 3, false);
    expect(cellMap).toEqual([0, 1, 1]);
    expect(getGridCellIndexOfCorner(1, sizes, cellMap, 3, "tl")).toBe(1);
    expect(getGridCellIndexOfCorner(1, sizes, cellMap, 3, "br")).toBe(2);
    expect(getGridCellIndexOfCorner(-1, sizes, cellMap, 3, "tl")).toBe(-1);
    expect(getGridCellIndices([1], cellMap)).toEqual([1, 2]);
  });
});

describe("nodes helpers", () => {
  function makeNode(id: string, parentId: string | null, open = true): FloatingNodeType {
    return { id, parentId, context: { open } as FloatingNodeType["context"] };
  }

  const nodes = [makeNode("root", null), makeNode("child", "root"), makeNode("closed", "root", false)];

  it("collects open children by default and all on demand", () => {
    expect(getNodeChildren(nodes, "root").map((node) => node.id)).toEqual(["child"]);
    expect(getNodeChildren(nodes, "root", false).map((node) => node.id)).toEqual(["child", "closed"]);
  });

  it("finds ancestors and the deepest node", () => {
    expect(getNodeAncestors(nodes, "child").map((node) => node.id)).toEqual(["root"]);
    expect(getDeepestNode(nodes, "root")?.id).toBe("child");
  });
});

describe("markOthers", () => {
  it("toggles aria-hidden and restores on cleanup", () => {
    const other = document.createElement("div");
    document.body.appendChild(other);
    const target = document.createElement("div");
    document.body.appendChild(target);

    const cleanup = markOthers([target], { ariaHidden: true });
    expect(other.getAttribute("aria-hidden")).toBe("true");

    cleanup();
    expect(other.getAttribute("aria-hidden")).toBe(null);
  });

  it("keeps nested locks until every cleanup runs", () => {
    const other = document.createElement("div");
    document.body.appendChild(other);
    const first = document.createElement("div");
    document.body.appendChild(first);

    const cleanupFirst = markOthers([first], { ariaHidden: true });
    const second = document.createElement("div");
    document.body.appendChild(second);
    const cleanupSecond = markOthers([second], { ariaHidden: true });

    expect(first.getAttribute("aria-hidden")).toBe("true");

    cleanupSecond();
    expect(other.getAttribute("aria-hidden")).toBe("true");

    cleanupFirst();
    expect(other.getAttribute("aria-hidden")).toBe(null);
  });
});

describe("tabbable helpers", () => {
  it("detects tabbable elements and skips disabled ones", () => {
    const { elements } = attachButtons(2);
    (elements[1] as HTMLButtonElement).disabled = true;
    expect(isTabbable(elements[0])).toBe(true);
    expect(isTabbable(elements[1])).toBe(false);
    expect(isTabbable(null)).toBe(false);
  });

  it("lists tabbable elements in order and suspends focus inside", () => {
    const { container, elements } = attachButtons(2);
    expect(tabbable(container)).toEqual(elements);

    disableFocusInside(container as HTMLElement);
    expect(isTabbable(elements[0])).toBe(false);

    enableFocusInside(container as HTMLElement);
    expect(tabbable(container)).toEqual(elements);
  });
});

describe("getEmptyRootContext", () => {
  it("returns a closed context with a working trigger registry", () => {
    const context = getEmptyRootContext();
    expect(context.open).toBe(false);
    expect(context.floatingElement).toBe(null);

    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    context.triggerElements.add("trigger", trigger);
    expect(isTargetInsideEnabledTrigger(trigger, context.triggerElements)).toBe(true);

    trigger.setAttribute("data-trigger-disabled", "");
    expect(isTargetInsideEnabledTrigger(trigger, context.triggerElements)).toBe(false);
    expect(isTargetInsideEnabledTrigger(document.body, context.triggerElements)).toBe(false);
  });
});

describe("safePolygon", () => {
  function createRect(left: number, top: number, width: number, height: number) {
    return {
      x: left,
      y: top,
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      toJSON() {
        return this;
      },
    } satisfies DOMRect;
  }

  function setup() {
    const domReference = document.createElement("button");
    const floating = document.createElement("div");
    document.body.appendChild(domReference);
    document.body.appendChild(floating);
    domReference.getBoundingClientRect = () => createRect(0, 0, 10, 10);
    floating.getBoundingClientRect = () => createRect(20, 0, 10, 10);
    const onClose = vi.fn();
    return { domReference, floating, onClose };
  }

  function mouseMove(clientX: number, clientY: number) {
    return {
      type: "mousemove",
      clientX,
      clientY,
      relatedTarget: null,
      composedPath: () => [document.createElement("div")],
    } as unknown as MouseEvent;
  }

  it("closes when the cursor moves far outside the polygon", () => {
    const { domReference, floating, onClose } = setup();
    const onMouseMove = safePolygon()({
      x: 2,
      y: 5,
      placement: "right",
      elements: { domReference, floating },
      onClose,
      tree: { nodesRef: { current: [] } },
    });

    onMouseMove(mouseMove(500, 500));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open while traversing the trough between elements", () => {
    const { domReference, floating, onClose } = setup();
    const onMouseMove = safePolygon()({
      x: 2,
      y: 5,
      placement: "right",
      elements: { domReference, floating },
      onClose,
      tree: { nodesRef: { current: [] } },
    });

    onMouseMove(mouseMove(15, 5));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("exposes blockPointerEvents through __options", () => {
    expect(safePolygon({ blockPointerEvents: true }).__options?.blockPointerEvents).toBe(true);
  });
});
