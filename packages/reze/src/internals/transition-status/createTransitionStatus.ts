import { effect, onCleanup, untrack } from "reze-js";

export type TransitionStatus = "starting" | "ending" | "idle" | undefined;

export interface CreateTransitionStatusParameters {
  /**
   * Whether the element is open.
   */
  open: () => boolean;
  /**
   * Whether the element is mounted.
   */
  mounted: () => boolean;
  transitionStatus: () => TransitionStatus;
  setMounted: (mounted: boolean) => void;
  setTransitionStatus: (status: TransitionStatus) => void;
  /**
   * Enables the `"idle"` state between `"starting"` and `"ending"`.
   * @default false
   */
  enableIdleState?: boolean | undefined;
  /**
   * Delays the `"ending"` state by one animation frame.
   * @default false
   */
  deferEndingState?: boolean | undefined;
  /**
   * Whether the element stays in the DOM once it is no longer open. The
   * `"ending"` state exists to animate an element on its way out, so an element
   * that never unmounts would otherwise start an exit transition and reverse it
   * as soon as it opens again.
   * @default false
   */
  alwaysMounted?: boolean | undefined;
  /**
   * Whether the entering element is ready to animate. The `"starting"` status
   * is cleared one frame after this becomes true, so the starting styles are
   * guaranteed at least one painted frame.
   * @default () => true
   */
  ready?: (() => boolean) | undefined;
}

/**
 * Provides a status string for CSS animations. Reads the open state and writes
 * the mounted/transition state through the given accessors, so callers keep the
 * state in their own store.
 */
export function createTransitionStatus(parameters: CreateTransitionStatusParameters): void {
  const enableIdleState = parameters.enableIdleState ?? false;
  const deferEndingState = parameters.deferEndingState ?? false;
  const alwaysMounted = parameters.alwaysMounted ?? false;
  const ready = parameters.ready ?? (() => true);

  const initiallyOpen = untrack(parameters.open);
  parameters.setMounted(initiallyOpen);
  parameters.setTransitionStatus(initiallyOpen && enableIdleState ? "idle" : undefined);

  effect(() => {
    const isOpen = parameters.open();
    const isMounted = parameters.mounted();
    const status = parameters.transitionStatus();

    if (isOpen && !isMounted) {
      parameters.setMounted(true);
      parameters.setTransitionStatus("starting");
      return;
    }

    if (!isOpen && isMounted && status !== "ending" && !deferEndingState && !alwaysMounted) {
      parameters.setTransitionStatus("ending");
      return;
    }

    if (!isOpen && !isMounted && status === "ending") {
      parameters.setTransitionStatus(undefined);
      return;
    }

    // An always-mounted element never reaches `"ending"`, so nothing else
    // clears the entry status it kept from the last time it opened.
    if (!isOpen && alwaysMounted && status !== undefined) {
      parameters.setTransitionStatus(undefined);
    }
  });

  effect(() => {
    const isOpen = parameters.open();
    const isMounted = parameters.mounted();
    const status = parameters.transitionStatus();

    if (isOpen || !isMounted || status === "ending" || !deferEndingState || alwaysMounted) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      parameters.setTransitionStatus("ending");
    });

    onCleanup(() => {
      cancelAnimationFrame(frame);
    });
  });

  effect(() => {
    const isOpen = parameters.open();
    const isReady = ready();

    if (!isOpen || enableIdleState || !isReady) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      parameters.setTransitionStatus(undefined);
    });

    onCleanup(() => {
      cancelAnimationFrame(frame);
    });
  });

  effect(() => {
    const isOpen = parameters.open();
    const isMounted = parameters.mounted();
    const status = parameters.transitionStatus();

    if (!isOpen || !enableIdleState) {
      return;
    }

    if (isMounted && status !== "idle") {
      parameters.setTransitionStatus("starting");
    }

    const frame = requestAnimationFrame(() => {
      parameters.setTransitionStatus("idle");
    });

    onCleanup(() => {
      cancelAnimationFrame(frame);
    });
  });
}
