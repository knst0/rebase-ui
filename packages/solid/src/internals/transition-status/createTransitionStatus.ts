import { type Accessor, createRenderEffect, createSignal, type Setter, untrack } from "solid-js";

export type TransitionStatus = "starting" | "ending" | "idle" | undefined;

export interface CreateTransitionStatusReturnValue {
  mounted: Accessor<boolean>;
  setMounted: Setter<boolean>;
  transitionStatus: Accessor<TransitionStatus>;
}

/**
 * Provides a status string for CSS animations.
 * @param open - whether the element is open.
 * @param enableIdleState - enables the `"idle"` state between `"starting"` and `"ending"`.
 * @param deferEndingState - delays the `"ending"` state by one animation frame.
 */
export function createTransitionStatus(
  open: Accessor<boolean>,
  enableIdleState: boolean = false,
  deferEndingState: boolean = false,
): CreateTransitionStatusReturnValue {
  const initiallyOpen = untrack(open);

  const [transitionStatus, setTransitionStatus] = createSignal<TransitionStatus>(initiallyOpen && enableIdleState ? "idle" : undefined);
  const [mounted, setMounted] = createSignal(initiallyOpen);

  createRenderEffect(
    () => ({ open: open(), mounted: mounted(), status: transitionStatus() }),
    ({ open: isOpen, mounted: isMounted, status }) => {
      if (isOpen && !isMounted) {
        setMounted(true);
        setTransitionStatus("starting");
        return;
      }

      if (!isOpen && isMounted && status !== "ending" && !deferEndingState) {
        setTransitionStatus("ending");
        return;
      }

      if (!isOpen && !isMounted && status === "ending") {
        setTransitionStatus(undefined);
      }
    },
  );

  createRenderEffect(
    () => ({ open: open(), mounted: mounted(), status: transitionStatus() }),
    ({ open: isOpen, mounted: isMounted, status }) => {
      if (isOpen || !isMounted || status === "ending" || !deferEndingState) {
        return undefined;
      }

      const frame = requestAnimationFrame(() => {
        setTransitionStatus("ending");
      });

      return () => {
        cancelAnimationFrame(frame);
      };
    },
  );

  createRenderEffect(open, (isOpen) => {
    if (!isOpen || enableIdleState) {
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      setTransitionStatus(undefined);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  });

  createRenderEffect(
    () => ({ open: open(), mounted: mounted(), status: transitionStatus() }),
    ({ open: isOpen, mounted: isMounted, status }) => {
      if (!isOpen || !enableIdleState) {
        return undefined;
      }

      if (isMounted && status !== "idle") {
        setTransitionStatus("starting");
      }

      const frame = requestAnimationFrame(() => {
        setTransitionStatus("idle");
      });

      return () => {
        cancelAnimationFrame(frame);
      };
    },
  );

  return {
    mounted,
    setMounted,
    transitionStatus,
  };
}
