import type { JSX } from "@solidjs/web";
import { Show, createSignal, createUniqueId } from "solid-js";

import { cx } from "../utils/cva";
import { CodePanel } from "./HighlightedCode";

const PLACEMENT = {
  top: "bottom-full mb-1",
  bottom: "top-full mt-1",
} as const;

export type CodeTooltipState = {
  open: () => boolean;
  id: string;
  describedBy: () => string | undefined;
  show: () => void;
  hide: () => void;
  toggle: () => void;
};

export type CodeTooltipProps = {
  source: string;
  placement?: "top" | "bottom";
  panelClass?: string;
  children: (state: CodeTooltipState) => JSX.Element;
};

export function CodeTooltip(props: CodeTooltipProps) {
  const [open, setOpen] = createSignal(false);
  const id = createUniqueId();

  return (
    <span class="relative inline-block">
      {props.children({
        open,
        id,
        describedBy: () => (open() ? id : undefined),
        show: () => setOpen(true),
        hide: () => setOpen(false),
        toggle: () => setOpen(!open()),
      })}
      <Show when={open()}>
        <span
          id={id}
          role="tooltip"
          class={cx(
            "squircle border-border absolute left-0 z-50 block w-max overflow-x-auto rounded-lg border p-3 text-left shadow-lg",
            PLACEMENT[props.placement ?? "top"],
            props.panelClass,
          )}
        >
          <CodePanel value={props.source} />
        </span>
      </Show>
    </span>
  );
}
