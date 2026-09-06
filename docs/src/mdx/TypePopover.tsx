import { Show, createSignal } from "solid-js";
import { highlight } from "sugar-high";
import { lang } from "sugar-high/lang";

let counter = 0;

export function TypePopover(props: { label: string; source: string; id?: string }) {
  const [open, setOpen] = createSignal(false);
  const id = props.id ?? `type-popover-${(counter += 1)}`;

  return (
    <span class="relative inline-block">
      <button
        type="button"
        class="text-accent cursor-help underline decoration-dotted underline-offset-4"
        aria-describedby={open() ? id : undefined}
        aria-expanded={open()}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(!open())}
        textContent={props.label}
      />
      <Show when={open()}>
        <span
          id={id}
          role="tooltip"
          class="squircle border-border bg-bg-code absolute top-full left-0 z-50 mt-1 block w-max max-w-[min(32rem,80vw)] overflow-x-auto rounded-lg border p-3 shadow-lg"
        >
          <pre class="text-xs">
            <code innerHTML={highlight(props.source, { lang: lang("typescript") })} />
          </pre>
        </span>
      </Show>
    </span>
  );
}
