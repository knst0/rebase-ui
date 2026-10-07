import type { ComponentProps } from "@solidjs/web";
import { omit, Show } from "solid-js";

import { highlightCode } from "../../plugins/mdx/highlightCode";
import { cx } from "../utils/cva";

export type CodeBlockProps = ComponentProps<"div"> & {
  value: string;
  language?: string;
  title?: string;
  collapsible?: boolean;
  open?: boolean;
};

export function CodeBlock(props: CodeBlockProps) {
  const rest = omit(props, "value", "language", "title", "collapsible", "open", "class");
  return (
    <div class={cx("squircle border-border bg-bg-code max-w-full overflow-hidden rounded-lg border shadow", props.class)} {...rest}>
      <Show when={props.title}>
        <div class="border-border flex h-9 items-center border-b pr-1.5 pl-3">
          <span class="text-fg/70 text-sm" textContent={props.title} />
        </div>
      </Show>
      <Show when={!props.collapsible || props.open}>
        <div class="max-w-full overflow-x-auto">
          <pre class="w-max min-w-full p-4 text-sm">
            <code innerHTML={highlightCode(props.value, { language: props.language })} />
          </pre>
        </div>
      </Show>
    </div>
  );
}
