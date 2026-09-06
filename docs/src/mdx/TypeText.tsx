import { For, Show, createMemo, createSignal } from "solid-js";
import { highlight } from "sugar-high";
import { lang } from "sugar-high/lang";

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
  const [open, setOpen] = createSignal(false);

  return (
    <span class="relative inline-block">
      <span
        tabindex="0"
        role="button"
        class="decoration-fg/40 cursor-help underline decoration-dotted underline-offset-4"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        innerHTML={highlight(props.text, { lang: lang("typescript") })}
      />
      <Show when={open()}>
        <span
          role="tooltip"
          class="squircle border-border bg-bg absolute bottom-full left-0 z-50 mb-1 block w-max max-w-[min(34rem,70vw)] overflow-x-auto rounded-lg border p-3 text-left shadow-lg"
        >
          <pre class="text-xs">
            <code innerHTML={highlight(props.definition, { lang: lang("typescript") })} />
          </pre>
        </span>
      </Show>
    </span>
  );
}

export function TypeText(props: { value: string; definitions?: Record<string, string> }) {
  const parts = createMemo(() => segments(props.value, props.definitions ?? {}));

  return (
    <code class="text-xs whitespace-pre-wrap">
      <For each={parts()}>
        {(part) => (
          <Show when={part.definition} fallback={<span innerHTML={highlight(part.text, { lang: lang("typescript") })} />}>
            {(definition) => <Token text={part.text} definition={definition()} />}
          </Show>
        )}
      </For>
    </code>
  );
}
