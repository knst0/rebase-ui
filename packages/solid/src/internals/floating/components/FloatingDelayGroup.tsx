import { type JSX } from "@solidjs/web";
import { type Accessor, createContext, createEffect, createSignal, onCleanup, untrack, useContext } from "solid-js";

import type { RebaseUIChangeEventDetails } from "../../event-details/createEventDetails";
import { createChangeEventDetails } from "../../event-details/createEventDetails";
import { REASONS } from "../../event-details/reasons";
import type { FloatingRootStore } from "../tree/FloatingRootStore";
import type { Delay, FloatingContext, FloatingRootContext } from "../types";
import { isMouseLikePointerType } from "../utils/event";

// Minimal `setTimeout` wrapper mirroring the `@base-ui/utils` Timeout surface
// (same approach as the floating `safePolygon` port).
class Timeout {
  private currentId: number | undefined;

  start(delay: number, fn: () => void) {
    this.clear();
    this.currentId = setTimeout(() => {
      this.currentId = undefined;
      fn();
    }, delay) as unknown as number;
  }

  clear = () => {
    if (this.currentId !== undefined) {
      clearTimeout(this.currentId);
      this.currentId = undefined;
    }
  };
}

// Delay resolution ported from the `useHoverShared` hook group (not yet
// ported), needed here to keep group timing identical to upstream.
function resolveDelayValue<T>(value: T | (() => T) | undefined, pointerType?: PointerEvent["pointerType"]): T | 0 | undefined {
  if (pointerType != null && !isMouseLikePointerType(pointerType)) {
    return 0;
  }

  if (typeof value === "function") {
    return (value as () => T)();
  }

  return value;
}

function getDelay(value: Delay | (() => Delay) | undefined, prop: "open" | "close", pointerType?: PointerEvent["pointerType"]) {
  const result = resolveDelayValue(value, pointerType);
  if (typeof result === "number") {
    return result;
  }

  return result?.[prop];
}

interface DelayGroupContextValue {
  hasProvider: boolean;
  timeoutMs: number;
  delayRef: { current: Delay };
  initialDelayRef: { current: Delay };
  timeout: Timeout;
  currentIdRef: { current: string | null | undefined };
  currentContextRef: {
    current: {
      onOpenChange: (open: boolean, eventDetails: RebaseUIChangeEventDetails<any>) => void;
      setIsInstantPhase: (value: boolean) => void;
    } | null;
  };
}

const FloatingDelayGroupContext = createContext<DelayGroupContextValue>({
  hasProvider: false,
  timeoutMs: 0,
  delayRef: { current: 0 },
  initialDelayRef: { current: 0 },
  timeout: new Timeout(),
  currentIdRef: { current: null },
  currentContextRef: { current: null },
});

function resetDelayRef(delayRef: { current: Delay }, initialDelayRef: { current: Delay }) {
  delayRef.current = initialDelayRef.current;
}

export interface FloatingDelayGroupProps {
  children?: JSX.Element;
  /**
   * The delay to use for the group when it's not in the instant phase.
   */
  delay: Delay;
  /**
   * An optional explicit timeout to use for the group, which represents when
   * grouping logic will no longer be active after the close delay completes.
   * This is useful if you want grouping to “last” longer than the close delay,
   * for example if there is no close delay at all.
   */
  timeoutMs?: number | undefined;
}

/**
 * Provides context for a group of floating elements that should share a
 * `delay`. Unlike `FloatingDelayGroup`, `useDelayGroup` with this
 * component does not cause a re-render of unrelated consumers of the
 * context when the delay changes.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function FloatingDelayGroup(props: FloatingDelayGroupProps): JSX.Element {
  const timeoutMs = untrack(() => props.timeoutMs ?? 0);

  const delayRef: { current: Delay } = { current: untrack(() => props.delay) };
  const initialDelayRef: { current: Delay } = { current: untrack(() => props.delay) };
  const currentIdRef: { current: string | null } = { current: null };
  const currentContextRef: DelayGroupContextValue["currentContextRef"] = { current: null };
  const timeout = new Timeout();
  onCleanup(() => timeout.clear());

  createEffect(
    () => props.delay,
    (delay) => {
      initialDelayRef.current = delay;

      if (!currentIdRef.current) {
        delayRef.current = delay;
        return;
      }

      delayRef.current = {
        open: getDelay(delayRef.current, "open"),
        close: getDelay(delay, "close"),
      };
    },
  );

  const value: DelayGroupContextValue = {
    hasProvider: true,
    delayRef,
    initialDelayRef,
    currentIdRef,
    timeoutMs,
    currentContextRef,
    timeout,
  };

  return <FloatingDelayGroupContext value={value}>{props.children}</FloatingDelayGroupContext>;
}

export interface UseDelayGroupOptions {
  /**
   * Whether the trigger this hook is used in has opened the tooltip.
   * Accepts an accessor so the group stays in sync in Solid's single-run
   * component bodies; a plain boolean is read once.
   */
  open: boolean | Accessor<boolean>;
}

export interface UseDelayGroupReturn {
  /**
   * The id of the floating element keeping the delay group active.
   */
  activeIdRef: { current: string | null | undefined };
  /**
   * The delay reference object.
   */
  delayRef: { current: Delay };
  /**
   * Whether animations should be removed.
   */
  isInstantPhase: Accessor<boolean>;
  /**
   * Whether a `<FloatingDelayGroup>` provider is present.
   */
  hasProvider: boolean;
}

// Store surface `useDelayGroup` needs. Satisfied by `FloatingRootStore`;
// the structural `FloatingRootContext` type gains these members once the
// hooks group is ported.
type DelayGroupStore = Pick<FloatingRootStore, "select" | "setOpen" | "useState">;

/**
 * Enables grouping when called inside a component that's a child of a
 * `FloatingDelayGroup`.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function useDelayGroup(
  context: FloatingRootContext | FloatingContext,
  options: UseDelayGroupOptions = { open: false },
): UseDelayGroupReturn {
  const openSource = options.open;
  const isOpen: Accessor<boolean> = typeof openSource === "function" ? openSource : () => openSource;

  const store = ("rootStore" in context ? context.rootStore : context) as unknown as DelayGroupStore;
  const floatingId = store.useState("floatingId");

  const groupContext = useContext(FloatingDelayGroupContext);
  const { currentIdRef, delayRef, timeoutMs, initialDelayRef, currentContextRef, hasProvider, timeout } = groupContext;

  const [isInstantPhase, setIsInstantPhase] = createSignal(false);
  const openRef: { current: boolean } = { current: untrack(isOpen) };

  createEffect(
    () => isOpen(),
    (open) => {
      openRef.current = open;
    },
  );

  createEffect(
    () => ({ open: isOpen(), id: floatingId() }),
    ({ open, id }) => {
      function unset() {
        currentContextRef.current?.setIsInstantPhase(false);
        currentIdRef.current = null;
        currentContextRef.current = null;
        delayRef.current = initialDelayRef.current;
        timeout.clear();
      }

      if (!currentIdRef.current) {
        return undefined;
      }

      if (!open && currentIdRef.current === id) {
        setIsInstantPhase(false);

        if (timeoutMs) {
          const closingId = id;
          timeout.start(timeoutMs, () => {
            // If another tooltip has taken over the group, skip resetting.
            if (untrack(() => store.select("open")) || (currentIdRef.current && currentIdRef.current !== closingId)) {
              return;
            }
            unset();
          });
          return () => {
            if (openRef.current || currentIdRef.current !== closingId) {
              timeout.clear();
            }
          };
        }

        unset();
      }

      return undefined;
    },
  );

  createEffect(
    () => ({ open: isOpen(), id: floatingId() }),
    ({ open, id }) => {
      if (!open) {
        return;
      }

      const prevContext = currentContextRef.current;
      const prevId = currentIdRef.current;

      // A new tooltip is opening, so cancel any pending timeout that would reset
      // the group's delay back to the initial value.
      timeout.clear();
      currentContextRef.current = { onOpenChange: store.setOpen, setIsInstantPhase };
      currentIdRef.current = id;
      delayRef.current = {
        open: 0,
        close: getDelay(initialDelayRef.current, "close"),
      };

      if (prevId !== null && prevId !== id) {
        setIsInstantPhase(true);
        prevContext?.setIsInstantPhase(true);
        prevContext?.onOpenChange(false, createChangeEventDetails(REASONS.none));
      } else {
        setIsInstantPhase(false);
        prevContext?.setIsInstantPhase(false);
      }
    },
  );

  // `floatingId` is stable for the lifetime of the store: capture it once so this
  // teardown runs on disposal only. Reading it in the compute would subscribe to
  // every store update and re-run (and clear) the group ownership while open.
  const initialFloatingId = untrack(() => floatingId());
  createEffect(
    () => initialFloatingId,
    (id) => {
      return () => {
        if (currentIdRef.current === id) {
          currentContextRef.current = null;

          if (!openRef.current) {
            return;
          }

          currentIdRef.current = null;
          resetDelayRef(delayRef, initialDelayRef);
          timeout.clear();
        }
      };
    },
  );

  return {
    activeIdRef: currentIdRef,
    hasProvider,
    delayRef,
    isInstantPhase,
  };
}
