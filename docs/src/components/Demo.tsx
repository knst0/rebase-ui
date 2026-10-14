import { Collapsible } from "@rebase-ui/solid/collapsible";
import { For, Show, createMemo, createSignal } from "solid-js";
import { Icon } from "znaki/solid";

import type { DemoVariant } from "../../plugins";
import { useFramework, type FrameworkId } from "../framework";
import { CodeBlock } from "./CodeBlock";
import { DemoPreview, type DemoLoader } from "./DemoPreview";

export function Demo(props: { name: string; variants: Record<FrameworkId, DemoVariant[]>; loaders: Record<FrameworkId, DemoLoader[]> }) {
  const framework = useFramework();
  const [variant, setVariant] = createSignal(0);
  const [file, setFile] = createSignal(0);
  const [open, setOpen] = createSignal(false);
  const variants = createMemo(() => props.variants[framework().id]);
  const index = createMemo(() => Math.min(variant(), variants().length - 1));
  const files = createMemo(() => variants()[index()]?.files ?? []);
  const fileIndex = createMemo(() => Math.min(file(), Math.max(files().length - 1, 0)));
  const preview = createMemo(() => props.loaders[framework().id][index()]);

  return (
    <div class="my-6">
      <Show when={preview()}>
        {(load) => (
          <div class="squircle border-border bg-bg flex min-h-40 items-center justify-center rounded-lg border p-8 shadow">
            <DemoPreview framework={framework().id} load={load()} />
          </div>
        )}
      </Show>
      <Show when={files().length > 0}>
        <Collapsible.Root
          open={open}
          onOpenChange={setOpen}
          class="squircle border-border bg-bg-code mt-3 overflow-hidden rounded-lg border shadow"
        >
          <div class="flex h-9 items-center gap-1 px-1.5">
            <Collapsible.Trigger class="text-fg/60 hover:text-fg flex items-center gap-1 rounded px-1.5 py-1 text-sm">
              <span class={["transition-transform", { "rotate-90": open() }]}>
                <Icon name="tabler:chevron-right" size={14} />
              </span>
              <span>Code</span>
            </Collapsible.Trigger>
            <Show when={open() && files().length > 1}>
              <div class="ml-1 flex items-center gap-0.5 overflow-x-auto">
                <For each={files()}>
                  {(item, at) => (
                    <button
                      type="button"
                      class={[
                        "rounded px-2 py-1 text-xs whitespace-nowrap transition-colors",
                        { "bg-bg text-fg": at() === fileIndex(), "text-fg/50 hover:text-fg": at() !== fileIndex() },
                      ]}
                      onClick={() => setFile(at())}
                    >
                      {item.name}
                    </button>
                  )}
                </For>
              </div>
            </Show>
            <Show when={variants().length > 1}>
              <div class="ml-auto flex items-center gap-0.5">
                <For each={variants()}>
                  {(item, at) => (
                    <button
                      type="button"
                      class={[
                        "rounded px-2 py-1 text-xs whitespace-nowrap transition-colors",
                        { "bg-bg text-fg": at() === index(), "text-fg/50 hover:text-fg": at() !== index() },
                      ]}
                      onClick={() => {
                        setVariant(at());
                        setFile(0);
                      }}
                    >
                      {item.title}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <Collapsible.Panel class="border-border border-t">
            <CodeBlock
              value={files()[fileIndex()]?.value ?? ""}
              language={files()[fileIndex()]?.language}
              collapsible
              open={open()}
              class="border-none"
            />
          </Collapsible.Panel>
        </Collapsible.Root>
      </Show>
    </div>
  );
}
