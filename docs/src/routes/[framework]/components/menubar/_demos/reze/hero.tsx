import { Menu } from "@rebase-ui/reze/menu";
import { Menubar } from "@rebase-ui/reze/menubar";

export default function ExampleMenubar() {
  return (
    <Menubar class="flex items-center">
      <Menu.Root>
        <Menu.Trigger class="h-8 border-0 bg-transparent px-3 font-[inherit] text-sm font-normal text-neutral-950 select-none focus-visible:relative focus-visible:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-disabled:text-neutral-500 data-pressed:bg-neutral-100 dark:text-white dark:focus-visible:bg-neutral-800 dark:focus-visible:outline-white dark:data-disabled:text-neutral-400 dark:data-pressed:bg-neutral-800">
          File
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner class="outline-none" sideOffset={4}>
            <Menu.Popup class="origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
              <Menu.Item
                onClick={handleClick}
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
              >
                New
              </Menu.Item>
              <Menu.Item
                onClick={handleClick}
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
              >
                Open
              </Menu.Item>
              <Menu.Item
                onClick={handleClick}
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
              >
                Save
              </Menu.Item>

              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger class="flex cursor-default items-center justify-between gap-4 py-2 pr-2 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] data-popup-open:relative data-popup-open:z-0 data-popup-open:before:absolute data-popup-open:before:inset-x-1 data-popup-open:before:inset-y-0 data-popup-open:before:z-[-1] data-popup-open:before:bg-neutral-100 data-popup-open:before:content-[''] data-highlighted:data-popup-open:before:bg-neutral-950 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white dark:data-popup-open:before:bg-neutral-800 dark:data-highlighted:data-popup-open:before:bg-white">
                  Export
                  <CaretRightIcon />
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner class="outline-none" sideOffset={-4} alignOffset={-4}>
                    <Menu.Popup class="origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
                      <Menu.Item
                        onClick={handleClick}
                        class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                      >
                        PDF
                      </Menu.Item>
                      <Menu.Item
                        onClick={handleClick}
                        class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                      >
                        PNG
                      </Menu.Item>
                      <Menu.Item
                        onClick={handleClick}
                        class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                      >
                        SVG
                      </Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>

              <Menu.Separator class="mx-1 my-1 h-px bg-neutral-950 dark:bg-white" />
              <Menu.Item
                onClick={handleClick}
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
              >
                Print
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Menu.Root>
        <Menu.Trigger class="h-8 border-0 bg-transparent px-3 font-[inherit] text-sm font-normal text-neutral-950 select-none focus-visible:relative focus-visible:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-disabled:text-neutral-500 data-pressed:bg-neutral-100 dark:text-white dark:focus-visible:bg-neutral-800 dark:focus-visible:outline-white dark:data-disabled:text-neutral-400 dark:data-pressed:bg-neutral-800">
          Edit
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner class="outline-none" sideOffset={4}>
            <Menu.Popup class="origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
              <Menu.Item
                onClick={handleClick}
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
              >
                Cut
              </Menu.Item>
              <Menu.Item
                onClick={handleClick}
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
              >
                Copy
              </Menu.Item>
              <Menu.Item
                onClick={handleClick}
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
              >
                Paste
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Menu.Root>
        <Menu.Trigger class="h-8 border-0 bg-transparent px-3 font-[inherit] text-sm font-normal text-neutral-950 select-none focus-visible:relative focus-visible:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-disabled:text-neutral-500 data-pressed:bg-neutral-100 dark:text-white dark:focus-visible:bg-neutral-800 dark:focus-visible:outline-white dark:data-disabled:text-neutral-400 dark:data-pressed:bg-neutral-800">
          View
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner class="outline-none" sideOffset={4}>
            <Menu.Popup class="origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
              <Menu.Item
                onClick={handleClick}
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
              >
                Zoom In
              </Menu.Item>
              <Menu.Item
                onClick={handleClick}
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
              >
                Zoom Out
              </Menu.Item>

              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger class="flex cursor-default items-center justify-between gap-4 py-2 pr-2 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] data-popup-open:relative data-popup-open:z-0 data-popup-open:before:absolute data-popup-open:before:inset-x-1 data-popup-open:before:inset-y-0 data-popup-open:before:z-[-1] data-popup-open:before:bg-neutral-100 data-popup-open:before:content-[''] data-highlighted:data-popup-open:before:bg-neutral-950 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white dark:data-popup-open:before:bg-neutral-800 dark:data-highlighted:data-popup-open:before:bg-white">
                  Layout
                  <CaretRightIcon />
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner class="outline-none" sideOffset={-4} alignOffset={-4}>
                    <Menu.Popup class="origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[scale,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
                      <Menu.Item
                        onClick={handleClick}
                        class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                      >
                        Single Page
                      </Menu.Item>
                      <Menu.Item
                        onClick={handleClick}
                        class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                      >
                        Two Pages
                      </Menu.Item>
                      <Menu.Item
                        onClick={handleClick}
                        class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                      >
                        Continuous
                      </Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>

              <Menu.Separator class="mx-1 my-1 h-px bg-neutral-950 dark:bg-white" />
              <Menu.Item
                onClick={handleClick}
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
              >
                Full Screen
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Menu.Root disabled>
        <Menu.Trigger class="h-8 border-0 bg-transparent px-3 font-[inherit] text-sm font-normal text-neutral-950 select-none focus-visible:relative focus-visible:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 data-disabled:text-neutral-500 data-pressed:bg-neutral-100 dark:text-white dark:focus-visible:bg-neutral-800 dark:focus-visible:outline-white dark:data-disabled:text-neutral-400 dark:data-pressed:bg-neutral-800">
          Help
        </Menu.Trigger>
      </Menu.Root>
    </Menubar>
  );
}

function handleClick(event: MouseEvent) {
  // eslint-disable-next-line no-console
  console.log(`${(event.currentTarget as HTMLElement).textContent} clicked`);
}

function CaretRightIcon(props: { class?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class={props.class} style="display: block;">
      <path d="M6 12V4l4.5 4z" />
    </svg>
  );
}
