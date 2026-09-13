import { type Accessor, createRenderEffect, createSignal, type Setter, untrack } from "solid-js";

export type TransitionStatus = "starting" | "ending" | "idle" | undefined;

export interface CreateTransitionStatusReturnValue {
  mounted: Accessor<boolean>;
  setMounted: Setter<boolean>;
  transitionStatus: Accessor<TransitionStatus>;
}

export interface CreateTransitionStatusOptions {
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
   * guaranteed at least one painted frame. Popups pass their mounted element:
   * subtree replacement (e.g. a payload-driven remount on trigger switch) and
   * deferred portal rendering can otherwise mount the element after the blind
   * frame, silently dropping the enter transition.
   * @default () => true
   */
  ready?: Accessor<boolean> | undefined;
}

/**
 * Provides a status string for CSS animations.
 * @param open - whether the element is open.
 * @param options - see {@link CreateTransitionStatusOptions}.
 */
export function createTransitionStatus(
  open: Accessor<boolean>,
  options: CreateTransitionStatusOptions = {},
): CreateTransitionStatusReturnValue {
  const { enableIdleState = false, deferEndingState = false, alwaysMounted = false, ready = () => true } = options;
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

      if (!isOpen && isMounted && status !== "ending" && !deferEndingState && !alwaysMounted) {
        setTransitionStatus("ending");
        return;
      }

      if (!isOpen && !isMounted && status === "ending") {
        setTransitionStatus(undefined);
        return;
      }

      // An always-mounted element never reaches `"ending"`, so nothing else
      // clears the entry status it kept from the last time it opened.
      if (!isOpen && alwaysMounted && status !== undefined) {
        setTransitionStatus(undefined);
      }
    },
  );

  createRenderEffect(
    () => ({ open: open(), mounted: mounted(), status: transitionStatus() }),
    ({ open: isOpen, mounted: isMounted, status }) => {
      if (isOpen || !isMounted || status === "ending" || !deferEndingState || alwaysMounted) {
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

  createRenderEffect(
    () => ({ isOpen: open(), isReady: ready() }),
    ({ isOpen, isReady }) => {
      if (!isOpen || enableIdleState || !isReady) {
        return undefined;
      }

      const frame = requestAnimationFrame(() => {
        setTransitionStatus(undefined);
      });

      return () => {
        cancelAnimationFrame(frame);
      };
    },
  );

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
