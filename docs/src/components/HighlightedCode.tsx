import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";
import { highlight } from "sugar-high";
import { lang } from "sugar-high/lang";

import { cx } from "../utils/cva";

const TYPESCRIPT = lang("typescript");

export function highlightTs(value: string): string {
  return highlight(value, { lang: TYPESCRIPT });
}

export type HighlightedCodeProps = Omit<ComponentProps<"code">, "innerHTML" | "children"> & { value: string };

export function HighlightedCode(props: HighlightedCodeProps) {
  const rest = omit(props, "value", "class");
  return <code class={cx("text-xs whitespace-pre-wrap", props.class)} innerHTML={highlightTs(props.value)} {...rest} />;
}

export function CodePanel(props: { value: string }) {
  return (
    <pre class="text-xs">
      <HighlightedCode value={props.value} />
    </pre>
  );
}
