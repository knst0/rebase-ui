import { Dynamic } from "@solidjs/web";
import { For, Show, createMemo, createSignal } from "solid-js";
import type { Component } from "solid-js";
import { Icon } from "znaki/solid";

import type { DemoFile, DemoVariant } from "../../plugins";
import { highlightCode } from "../../plugins/highlightCode";

function Source(props: { file: DemoFile }) {
  return (
    <pre class="w-max min-w-full p-4 text-sm">
      <code innerHTML={highlightCode(props.file.value, { language: props.file.language })} />
    </pre>
  );
}

export function Demo(props: { name: string; variants: DemoVariant[]; components: Component[] }) {
  const [variant, setVariant] = createSignal(0);
  const [file, setFile] = createSignal(0);
  const [open, setOpen] = createSignal(true);

  const index = createMemo(() => Math.min(variant(), props.variants.length - 1));
  const files = createMemo(() => props.variants[index()]?.files ?? []);
  const fileIndex = createMemo(() => Math.min(file(), Math.max(files().length - 1, 0)));
  const active = createMemo(() => files()[fileIndex()]);
  const preview = createMemo(() => props.components[index()]);

  return (
    <div class="my-6">
      <Show when={preview()}>
        {(component) => (
          <div class="squircle border-border bg-bg flex min-h-40 items-center justify-center rounded-lg border p-8 shadow">
            <Dynamic component={component()} />
          </div>
        )}
      </Show>

      <Show when={files().length > 0}>
        <div class="squircle border-border bg-bg-code mt-3 overflow-hidden rounded-lg border shadow">
          <div class="border-border flex h-9 items-center gap-1 border-b px-1.5">
            <button
              type="button"
              class="text-fg/60 hover:text-fg flex items-center gap-1 rounded px-1.5 py-1 text-sm"
              onClick={() => setOpen(!open())}
            >
              <span class={["transition-transform", { "rotate-90": open() }]}>
                <Icon name="tabler:chevron-right" size={14} />
              </span>
              <span textContent="Code" />
            </button>

            <Show when={open()}>
              <div class="ml-1 flex items-center gap-0.5 overflow-x-auto">
                <For each={files()}>
                  {(item, at) => (
                    <button
                      type="button"
                      class={[
                        "rounded px-2 py-1 text-xs whitespace-nowrap transition-colors",
                        {
                          "bg-bg text-fg": at() === fileIndex(),
                          "text-fg/50 hover:text-fg": at() !== fileIndex(),
                        },
                      ]}
                      textContent={item.name}
                      onClick={() => setFile(at())}
                    />
                  )}
                </For>
              </div>
            </Show>

            <Show when={props.variants.length > 1}>
              <div class="ml-auto flex items-center gap-0.5">
                <For each={props.variants}>
                  {(item, at) => (
                    <button
                      type="button"
                      class={[
                        "rounded px-2 py-1 text-xs whitespace-nowrap transition-colors",
                        {
                          "bg-bg text-fg": at() === index(),
                          "text-fg/50 hover:text-fg": at() !== index(),
                        },
                      ]}
                      textContent={item.title}
                      onClick={() => {
                        setVariant(at());
                        setFile(0);
                      }}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>

          <Show when={open() && active()}>
            {(item) => (
              <div class="max-w-full overflow-x-auto">
                <Source file={item()} />
              </div>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}
