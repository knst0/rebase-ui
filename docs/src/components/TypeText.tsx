import { For, Show, createMemo } from "solid-js";

import { highlightTs } from "./HighlightedCode";
import { CodeTooltip } from "./Tooltip";

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
    <CodeTooltip source={props.definition} panelClass="bg-bg max-w-[min(34rem,70vw)]">
      {(state) => (
        <span
          tabindex="0"
          role="button"
          aria-describedby={state.describedBy()}
          class="decoration-fg/40 cursor-help underline decoration-dotted underline-offset-4"
          onMouseEnter={state.show}
          onMouseLeave={state.hide}
          onFocus={state.show}
          onBlur={state.hide}
          innerHTML={highlightTs(props.text)}
        />
      )}
    </CodeTooltip>
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
