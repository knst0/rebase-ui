import type { JSX } from "reze-js";

import { FloatingDelayGroup } from "../../internals/floating";
import { TooltipProviderContext } from "./TooltipProviderContext";

/**
 * Provides a shared delay for multiple tooltips. The grouping logic ensures that
 * once a tooltip becomes visible, the adjacent tooltips will be shown instantly.
 *
 * Documentation: [Rebase UI Tooltip](https://rebase-ui.knst.dev/components/tooltip)
 */
export function TooltipProvider(props: TooltipProvider.Props) {
  // Deliberately not hoisted: provider children must be created inside the delay
  // group below, not in this body. Reading the children getter here would run the
  // tooltip bodies outside the group, leaving them without the shared delay.
  const delay = props.delay;
  const closeDelay = props.closeDelay;
  const timeout = props.timeout ?? 400;

  return (
    <TooltipProviderContext value={delay}>
      <FloatingDelayGroup delay={{ open: delay, close: closeDelay }} timeoutMs={timeout}>
        {props.children}
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
