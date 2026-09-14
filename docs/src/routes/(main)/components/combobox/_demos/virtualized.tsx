import { Combobox } from "@rebase-ui/solid/combobox";
import type { ComponentProps } from "@solidjs/web";
import { For, Show, createMemo, createSignal } from "solid-js";

// Fixed row height used for windowing. The upstream React demo measures rows
// with `@tanstack/react-virtual`; that dependency is not part of this workspace,
// so this port windows the list with a fixed estimated size instead.
const ESTIMATE_SIZE = 32;
const OVERSCAN = 20;

interface VirtualListApi {
  getCount: () => number;
  scrollToIndex: (index: number, align: "start" | "end") => void;
}

export default function ExampleVirtualizedCombobox() {
  const [open, setOpen] = createSignal(false);
  const listApi = {} as VirtualListApi;

  return (
    <Combobox.Root
      virtualized
      items={virtualizedItems}
      open={open()}
      onOpenChange={setOpen}
      itemToStringLabel={getItemLabel}
      onItemHighlighted={(item, { reason, index }) => {
        if (!item) {
          return;
        }

        const isStart = index === 0;
        const isEnd = index === listApi.getCount() - 1;
        const shouldScroll = reason === "none" || (reason === "keyboard" && (isStart || isEnd));

        if (shouldScroll) {
          queueMicrotask(() => {
            listApi.scrollToIndex(index, isEnd ? "start" : "end");
          });
        }
      }}
    >
      <label class="flex flex-col gap-1 text-sm leading-5 font-bold text-neutral-950 dark:text-white">
        Search 10,000 items
        <Combobox.Input class="h-8 w-64 border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white" />
      </label>

      <Combobox.Portal>
        <Combobox.Positioner class="outline-none" sideOffset={4}>
          <Combobox.Popup class="w-[var(--anchor-width)] max-w-[var(--available-width)] border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0_rgb(0_0_0_/_12%)] dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
            <Combobox.Empty>
              <div class="py-3 px-2 text-sm leading-4 text-neutral-500 dark:text-neutral-400">
                No items found.
              </div>
            </Combobox.Empty>
            <Combobox.List class="p-0">
              <VirtualizedList api={listApi} />
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function VirtualizedList(props: { api: VirtualListApi }) {
  const filteredItems = createMemo(() => Combobox.useFilteredItems<VirtualizedItem>());

  let scrollElement: HTMLDivElement | undefined;
  const [scrollTop, setScrollTop] = createSignal(0);

  const totalSize = () => filteredItems().length * ESTIMATE_SIZE;
  const startIndex = () => Math.max(0, Math.floor(scrollTop() / ESTIMATE_SIZE) - OVERSCAN);
  const endIndex = () => {
    const viewportHeight = scrollElement?.clientHeight ?? 360;
    return Math.min(
      filteredItems().length,
      Math.ceil((scrollTop() + viewportHeight) / ESTIMATE_SIZE) + OVERSCAN,
    );
  };
  const visibleItems = () =>
    filteredItems()
      .slice(startIndex(), endIndex())
      .map((item, offset) => ({ item, index: startIndex() + offset }));

  props.api.getCount = () => filteredItems().length;
  props.api.scrollToIndex = (index, align) => {
    const element = scrollElement;
    if (!element) {
      return;
    }
    const top =
      align === "start"
        ? index * ESTIMATE_SIZE
        : (index + 1) * ESTIMATE_SIZE - element.clientHeight;
    element.scrollTo({ top });
  };

  return (
    <Show when={filteredItems().length > 0}>
      <div
        role="presentation"
        ref={(element) => {
          scrollElement = element;
        }}
        onScroll={(event) => {
          setScrollTop(event.currentTarget.scrollTop);
        }}
        class="h-[min(22.5rem,var(--total-size))] max-h-[var(--available-height)] overflow-auto overscroll-contain scroll-py-1"
        style={`--total-size: ${totalSize()}px`}
      >
        <div role="presentation" class="relative w-full" style={`height: ${totalSize()}px`}>
          <For each={visibleItems()}>
            {({ item, index }) => (
              <Combobox.Item
                index={index}
                data-index={index}
                value={item}
                class="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 p-2 text-sm leading-4 outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                aria-setsize={filteredItems().length}
                aria-posinset={index + 1}
                style={{
                  position: "absolute",
                  top: "0",
                  left: "0",
                  width: "100%",
                  height: `${ESTIMATE_SIZE}px`,
                  transform: `translateY(${index * ESTIMATE_SIZE}px)`,
                }}
              >
                <Combobox.ItemIndicator class="col-start-1">
                  <CheckIcon aria-hidden="true" />
                </Combobox.ItemIndicator>
                <span class="col-start-2">{item.name}</span>
              </Combobox.Item>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

function CheckIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{ display: "block", ...(typeof props.style === "object" ? props.style : {}) }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

interface VirtualizedItem {
  id: string;
  name: string;
}

function getItemLabel(item: VirtualizedItem | null) {
  return item ? item.name : "";
}

const virtualizedItems: VirtualizedItem[] = Array.from({ length: 10000 }, (_, index) => {
  const id = String(index + 1);
  const indexLabel = id.padStart(4, "0");
  return { id, name: `Item ${indexLabel}` };
});
