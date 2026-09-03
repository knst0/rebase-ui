import { type Accessor, createEffect, createSignal, type Setter, untrack } from "solid-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import type { TransitionStatus } from "../../internals/transition-status";
import type { CollapsibleRootChangeEventDetails } from "../root/CollapsibleRoot";
import { measuredSizeStrategy } from "./measuredSizeStrategy";
import { nativeSizeStrategy } from "./nativeSizeStrategy";
import { isNativeSizingEnabled, supportsInterpolateSize } from "./panelStrategy";

export type CollapsiblePanelSizing = "auto" | "measured" | "native";

export interface CreateCollapsiblePanelParameters {
  hiddenUntilFound: Accessor<boolean>;
  id: Accessor<string | undefined>;
  keepMounted: Accessor<boolean>;
  mounted: Accessor<boolean>;
  onOpenChange: (open: boolean, eventDetails: CollapsibleRootChangeEventDetails) => void;
  open: Accessor<boolean>;
  setMounted: Setter<boolean>;
  setOpen: (open: boolean) => void;
  sizing?: Accessor<CollapsiblePanelSizing>;
  transitionStatus: Accessor<TransitionStatus>;
}

export interface CreateCollapsiblePanelReturnValue {
  height: Accessor<number | undefined>;
  width: Accessor<number | undefined>;
  panelElement: Accessor<HTMLElement | null>;
  props: Record<string, any>;
  ref: (element: HTMLElement | null) => void;
  shouldRender: () => boolean;
  transitionStatus: Accessor<TransitionStatus>;
}

export function createCollapsiblePanel(parameters: CreateCollapsiblePanelParameters): CreateCollapsiblePanelReturnValue {
  const { hiddenUntilFound, keepMounted, mounted, onOpenChange, open, setMounted, setOpen, sizing, transitionStatus } = parameters;

  const [panelElement, setPanelElement] = createSignal<HTMLElement | null>(null);

  const requestedSizing = untrack(() => sizing?.() ?? "auto");
  const useNative = requestedSizing === "native" || (requestedSizing === "auto" && isNativeSizingEnabled());

  if (process.env.NODE_ENV !== "production") {
    if (requestedSizing === "native" && !supportsInterpolateSize()) {
      console.error(
        'Rebase UI: `sizing="native"` was requested on a Collapsible panel, but this engine does not support `interpolate-size: allow-keywords`. The panel will not animate.',
      );
    }
  }

  const strategy = useNative
    ? nativeSizeStrategy({ mounted, open, panelElement, setMounted, transitionStatus })
    : measuredSizeStrategy({ mounted, open, panelElement, setMounted, transitionStatus });

  createEffect(
    () => ({ element: panelElement() }),
    ({ element }) => {
      if (element === null) {
        return undefined;
      }

      const handleBeforeMatch = (event: Event) => {
        const eventDetails = createChangeEventDetails(REASONS.none, event);

        onOpenChange(true, eventDetails);

        if (eventDetails.isCanceled) {
          return;
        }

        strategy.notifyOpenedByFind();
        setOpen(true);
      };

      element.addEventListener("beforematch", handleBeforeMatch);

      return () => {
        element.removeEventListener("beforematch", handleBeforeMatch);
      };
    },
  );

  const shouldRender = () => keepMounted() || hiddenUntilFound() || mounted() || open();

  return {
    height: strategy.height,
    width: strategy.width,
    props: {
      get hidden() {
        if (!open() && !mounted()) {
          return hiddenUntilFound() ? ("until-found" as const) : true;
        }
        return undefined;
      },
      get id() {
        return parameters.id();
      },
    },
    ref: setPanelElement,
    panelElement,
    shouldRender,
    transitionStatus: strategy.transitionStatus,
  };
}

export { getAnimationType, isNativeSizingEnabled, supportsInterpolateSize } from "./panelStrategy";
