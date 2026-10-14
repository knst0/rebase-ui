import { Menu } from "@rebase-ui/solid/menu";
import type { JSX } from "@solidjs/web";
import { createSignal } from "solid-js";

export default function ExampleMenu() {
  const [value, setValue] = createSignal("date");
  return (
    <Menu.Root>
      <Menu.Trigger class="flex h-8 items-center justify-center gap-1.5 rounded-none border border-neutral-950 bg-white pr-2 pl-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 data-pressed:bg-neutral-100 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 dark:data-pressed:bg-neutral-800">
        Sort <CaretDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner class="outline-hidden" sideOffset={8} align="start">
          <Menu.Popup class="relative origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-hidden transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
            <Menu.RadioGroup value={value()} onValueChange={setValue}>
              <Menu.RadioItem value="date" class={radioItemClass}>
                <Menu.RadioItemIndicator class="col-start-1">
                  <CheckIcon />
                </Menu.RadioItemIndicator>
                <span class="col-start-2">Date</span>
              </Menu.RadioItem>
              <Menu.RadioItem value="name" class={radioItemClass}>
                <Menu.RadioItemIndicator class="col-start-1">
                  <CheckIcon />
                </Menu.RadioItemIndicator>
                <span class="col-start-2">Name</span>
              </Menu.RadioItem>
              <Menu.RadioItem value="type" class={radioItemClass}>
                <Menu.RadioItemIndicator class="col-start-1">
                  <CheckIcon />
                </Menu.RadioItemIndicator>
                <span class="col-start-2">Type</span>
              </Menu.RadioItem>
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

const radioItemClass =
  "grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 py-2 pr-8 pl-2.5 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] data-disabled:text-neutral-500 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white dark:data-disabled:text-neutral-400";

function CaretDownIcon(props: { style?: JSX.CSSProperties }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" {...props} style={{ display: "block", ...props.style }}>
      <path d="M12 6H4l4 4.5z" />
    </svg>
  );
}

function CheckIcon(props: { style?: JSX.CSSProperties }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{ display: "block", ...props.style }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
