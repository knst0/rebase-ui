import { PreviewCard } from "@rebase-ui/solid/preview-card";
import { For, Show, createMemo } from "solid-js";

import { CodePanel, highlightTs } from "./HighlightedCode";

const TOKEN = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g;

type Segment = { text: string; definition?: string };

function segments(value: string, definitions: Record<string, string>): Segment[] {
  const parts: Segment[] = [];
  let index = 0;

  for (const match of value.matchAll(TOKEN)) {
    const definition = definitions[match[0]];
    if (definition === undefined) continue;
    if (match.index > index) parts.push({ text: value.slice(index, match.index) });
    parts.push({ text: match[0], definition });
    index = match.index + match[0].length;
  }

  if (index < value.length) parts.push({ text: value.slice(index) });
  return parts;
}

function Token(props: { text: string; definition: string }) {
  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        as="span"
        tabindex="0"
        role="button"
        class="decoration-fg/40 cursor-help underline decoration-dotted underline-offset-4"
      >
        <span innerHTML={highlightTs(props.text)} />
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner side="top" sideOffset={4}>
          <PreviewCard.Popup class="squircle border-border bg-bg max-w-[min(34rem,70vw)] overflow-x-auto rounded-lg border p-3 text-left shadow-lg transition-[transform,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
            <CodePanel value={props.definition} />
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}

export function TypeText(props: { value: string; definitions?: Record<string, string> }) {
  const parts = createMemo(() => segments(props.value, props.definitions ?? {}));

  return (
    <code class="text-xs whitespace-pre-wrap">
      <For each={parts()}>
        {(part) => (
          <Show when={part.definition} fallback={<span innerHTML={highlightTs(part.text)} />}>
            {(definition) => <Token text={part.text} definition={definition()} />}
          </Show>
        )}
      </For>
    </code>
  );
}
