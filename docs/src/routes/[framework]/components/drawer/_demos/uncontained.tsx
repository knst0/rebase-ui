import { Drawer } from "@rebase-ui/solid/drawer";
import { For, Show, createSignal } from "solid-js";

const ACTIONS = ["Unfollow", "Mute", "Add to Favourites", "Add to Close Friends", "Restrict"];

export default function ExampleDrawerUncontained() {
  const [open, setOpen] = createSignal(false);

  return (
    <Drawer.Root open={open()} onOpenChange={setOpen}>
      <Drawer.Trigger class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400">
        Open action sheet
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop class="fixed inset-0 min-h-dvh bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] [--backdrop-opacity:0.4] data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute dark:[--backdrop-opacity:0.7]" />
        <Drawer.Viewport class="fixed inset-0 flex items-end justify-center">
          <Drawer.Popup class="pointer-events-none flex w-full max-w-[20rem] [transform:translateY(var(--drawer-swipe-movement-y))] flex-col gap-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] outline-none focus-visible:outline-none data-ending-style:[transform:translateY(calc(100%+1rem+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:[transform:translateY(calc(100%+1rem+2px))] data-swiping:select-none">
            <Drawer.Content class="pointer-events-auto overflow-hidden border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
              <Drawer.Title class="sr-only">Profile actions</Drawer.Title>
              <Drawer.Description class="sr-only">Choose an action for this user.</Drawer.Description>

              <ul class="m-0 list-none divide-y divide-neutral-950 p-0 dark:divide-white" aria-label="Profile actions">
                <For each={ACTIONS}>
                  {(action, index) => (
                    <li>
                      <Show when={index() === 0}>
                        <Drawer.Close class="sr-only">Close action sheet</Drawer.Close>
                      </Show>
                      <button
                        type="button"
                        class="h-10 w-full border-0 bg-transparent px-5 text-center text-sm text-neutral-950 select-none hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none active:bg-neutral-200 dark:text-white dark:hover:bg-neutral-800 dark:focus-visible:bg-neutral-800 dark:active:bg-neutral-700"
                        onClick={() => setOpen(false)}
                      >
                        {action}
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Drawer.Content>
            <div class="pointer-events-auto overflow-hidden border border-neutral-950 bg-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:border-white dark:bg-neutral-950 dark:shadow-none">
              <button
                type="button"
                class="h-10 w-full border-0 bg-transparent px-5 text-center text-sm text-red-700 select-none hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none active:bg-neutral-200 dark:text-red-400 dark:hover:bg-neutral-800 dark:focus-visible:bg-neutral-800 dark:active:bg-neutral-700"
                onClick={() => setOpen(false)}
              >
                Block User
              </button>
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
