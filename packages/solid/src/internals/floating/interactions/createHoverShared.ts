import type { Delay, ExtendedElements, Placement } from "../types";
import { isMouseLikePointerType } from "../utils/event";

// Close-handler contracts live in the already-ported safe polygon module.
export type { HandleClose, HandleCloseContext, HandleCloseOptions } from "../safePolygon";
export { isTargetInsideEnabledTrigger as isInsideEnabledTrigger } from "../utils/element";

export interface HandleCloseContextBase {
  placement: Placement | null;
  elements: Pick<ExtendedElements, "domReference" | "floating">;
  nodeId?: string | undefined;
  leave?: boolean | undefined;
}

type HoverDelay = number | Partial<{ open: number; close: number }>;

function resolveValue<T>(value: T | (() => T) | undefined, pointerType?: PointerEvent["pointerType"]): T | 0 | undefined {
  if (pointerType != null && !isMouseLikePointerType(pointerType)) {
    return 0;
  }

  if (typeof value === "function") {
    return (value as () => T)();
  }

  return value;
}

// Solid port of upstream `getDelay` (mui/base-ui v1.8.0). Function-form values
// are evaluated per event; non-mouse pointer types resolve to 0.
export function getDelay(
  value: HoverDelay | (() => HoverDelay) | undefined,
  prop: "open" | "close",
  pointerType?: PointerEvent["pointerType"],
) {
  const result = resolveValue(value, pointerType);
  if (typeof result === "number") {
    return result;
  }

  return result?.[prop];
}

export function getRestMs(value: number | (() => number)) {
  if (typeof value === "function") {
    return value();
  }
  return value;
}

export function isClickLikeOpenEvent(openEventType: string | undefined, interactedInside: boolean) {
  return interactedInside || openEventType === "click" || openEventType === "mousedown";
}

export function isHoverOpenEvent(openEventType: string | undefined) {
  return openEventType?.includes("mouse") && openEventType !== "mousedown";
}

export type { Delay };
