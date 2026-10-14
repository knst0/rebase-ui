import { ScrollArea } from "@rebase-ui/solid/scroll-area";
import { For } from "solid-js";

const items = Array.from({ length: 100 }, (_, i) => i + 1);

export default function ExampleScrollAreaBoth() {
  return (
    <ScrollArea.Root class="h-80 w-80 max-w-[calc(100vw-8rem)]">
      <ScrollArea.Viewport class="h-full border border-neutral-950 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:border-white dark:focus-visible:outline-white">
        <ScrollArea.Content class="pt-3 pr-6 pb-6 pl-3">
          <ul class="m-0 grid list-none grid-cols-[repeat(10,6.25rem)] grid-rows-[repeat(10,6.25rem)] gap-3 p-0">
            <For each={items}>
              {(item) => (
                <li class="flex items-center justify-center bg-neutral-200 text-sm font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                  {item}
                </li>
              )}
            </For>
          </ul>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        aria-hidden="true"
        class="pointer-events-none relative m-px flex bg-black/12 opacity-0 transition-opacity data-hovering:pointer-events-auto data-hovering:opacity-100 data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:duration-0 data-[orientation=horizontal]:h-4 data-[orientation=vertical]:w-4 dark:bg-white/12"
      >
        <ScrollArea.Thumb class="w-full bg-neutral-950 dark:bg-white" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar
        aria-hidden="true"
        class="pointer-events-none relative m-px flex bg-black/12 opacity-0 transition-opacity data-hovering:pointer-events-auto data-hovering:opacity-100 data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:duration-0 data-[orientation=horizontal]:h-4 data-[orientation=vertical]:w-4 dark:bg-white/12"
        orientation="horizontal"
      >
        <ScrollArea.Thumb class="w-full bg-neutral-950 dark:bg-white" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner />
    </ScrollArea.Root>
  );
}
