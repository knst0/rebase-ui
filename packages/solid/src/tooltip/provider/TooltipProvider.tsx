import type { JSX } from "@solidjs/web";
import { untrack } from "solid-js";

import { FloatingDelayGroup } from "../../internals/floating";
import { TooltipProviderContext } from "./TooltipProviderContext";

/**
 * Provides a shared delay for multiple tooltips. The grouping logic ensures that
 * once a tooltip becomes visible, the adjacent tooltips will be shown instantly.
 *
 * Documentation: [Rebase UI Tooltip](https://rebase-ui.knst.dev/components/tooltip)
 */
export function TooltipProvider(props: TooltipProvider.Props) {
  const delay = untrack(() => props.delay);
  const closeDelay = untrack(() => props.closeDelay);
  const timeout = untrack(() => props.timeout ?? 400);

  return (
    <TooltipProviderContext value={delay}>
      <FloatingDelayGroup delay={{ open: delay, close: closeDelay }} timeoutMs={timeout}>
        {untrack(() => props.children)}
      </FloatingDelayGroup>
    </TooltipProviderContext>
  );
}

export interface TooltipProviderState {}

export interface TooltipProviderProps {
  children?: JSX.Element;
  /**
   * How long to wait before opening the tooltip on hover. Specified in milliseconds.
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing a tooltip. Specified in milliseconds.
   */
  closeDelay?: number | undefined;
  /**
   * Another tooltip will open instantly if the previous tooltip
   * is closed within this timeout. Specified in milliseconds.
   * @default 400
   */
  timeout?: number | undefined;
}

export namespace TooltipProvider {
  export type State = TooltipProviderState;
  export type Props = TooltipProviderProps;
}
