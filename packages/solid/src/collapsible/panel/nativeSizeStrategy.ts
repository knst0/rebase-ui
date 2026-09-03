import { createEffect, createMemo, createRenderEffect, createSignal, untrack } from "solid-js";

import { createAnimationsFinishedRunner } from "../../internals/createAnimationsFinishedRunner";
import { type PanelStrategyParameters, type PanelStrategyReturnValue, setTemporaryStyle } from "./panelStrategy";

/**
 * Sizing strategy for engines that support `interpolate-size: allow-keywords`.
 * The panel never measures itself: consumer CSS animates `height`/`width`
 * to and from `auto`, keyed off the `data-open` / `data-closed` attributes.
 */
export function nativeSizeStrategy(parameters: PanelStrategyParameters): PanelStrategyReturnValue {
  const { mounted, open, panelElement, setMounted, transitionStatus } = parameters;

  const [shouldPreventMountAnimation, setShouldPreventMountAnimation] = createSignal(untrack(open));

  const shouldPreventOpenAnimation = createMemo(() => open() && shouldPreventMountAnimation());

  createRenderEffect(
    () => ({ element: panelElement(), prevent: shouldPreventOpenAnimation() }),
    ({ element, prevent }) => {
      if (element === null || !prevent) return;
      return setTemporaryStyle(element, "animation-name", "none");
    },
  );

  createRenderEffect(
    () => ({ element: panelElement() }),
    ({ element }) => {
      if (element === null) return;
      element.style.setProperty("interpolate-size", "allow-keywords");
    },
  );

  const runOnceAnimationsFinished = createAnimationsFinishedRunner(panelElement);

  createEffect(
    () => ({ isOpen: open(), isMounted: mounted(), status: transitionStatus(), element: panelElement() }),
    ({ isOpen, isMounted, element }) => {
      if (isOpen || !isMounted || element === null) {
        return undefined;
      }

      setShouldPreventMountAnimation(false);

      const abortController = new AbortController();
      let frame: number | undefined = requestAnimationFrame(() => {
        frame = undefined;
        runOnceAnimationsFinished(() => {
          if (untrack(open)) {
            return;
          }

          setMounted(false);
        }, abortController.signal);
      });

      return () => {
        if (frame !== undefined) {
          cancelAnimationFrame(frame);
        }
        abortController.abort();
      };
    },
  );

  return {
    height: () => undefined,
    width: () => undefined,
    transitionStatus,
    notifyOpenedByFind: () => {},
  };
}
