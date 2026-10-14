import { Drawer } from "@rebase-ui/solid/drawer";
import { createSignal } from "solid-js";

export default function ExampleDrawer() {
  const [portalContainer, setPortalContainer] = createSignal<HTMLDivElement | null>(null);

  return (
    <Drawer.Provider>
      <div ref={setPortalContainer} class="relative w-full overflow-hidden [--bleed:3rem]">
        <Drawer.IndentBackground class="absolute inset-0 bg-black dark:bg-neutral-300" />
        <Drawer.Indent class="relative min-h-80 origin-[center_top] [transform:scale(1)_translateY(0)] border border-neutral-950 bg-white p-4 text-neutral-950 [transition-duration:calc(400ms*var(--indent-transition)),calc(250ms*var(--indent-transition))] will-change-transform [--indent-radius:calc(1rem*(1-var(--drawer-swipe-progress)))] [--indent-transition:calc(1-clamp(0,calc(var(--drawer-swipe-progress)*100000),1))] [transition:transform_0.4s_cubic-bezier(0.32,0.72,0,1),border-radius_0.25s_cubic-bezier(0.32,0.72,0,1)] data-active:transform-[scale(calc(0.98+(0.02*var(--drawer-swipe-progress))))_translateY(calc(0.5rem*(1-var(--drawer-swipe-progress))))] data-active:rounded-tl-(--indent-radius) data-active:rounded-tr-(--indent-radius) dark:border-white dark:bg-neutral-950 dark:text-white">
          <div class="flex min-h-80 items-center justify-center">
            <Drawer.Root modal={false}>
              <Drawer.Trigger class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400">
                Open drawer
              </Drawer.Trigger>
              <Drawer.Portal container={portalContainer() ?? undefined}>
                <Drawer.Backdrop class="absolute inset-0 min-h-dvh bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] [--backdrop-opacity:0.2] [--bleed:3rem] data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute dark:[--backdrop-opacity:0.7]" />
                <Drawer.Viewport class="absolute inset-0 flex items-end justify-center">
                  <Drawer.Popup class="-mb-[var(--bleed)] max-h-[calc(80vh+var(--bleed))] w-full [transform:translateY(var(--drawer-swipe-movement-y))] overflow-y-auto overscroll-contain border-t border-neutral-950 bg-white px-6 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px)+var(--bleed))] text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] outline-none data-ending-style:[transform:translateY(calc(100%-var(--bleed)+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:[transform:translateY(calc(100%-var(--bleed)+2px))] data-swiping:select-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
                    <div class="mx-auto mb-4 h-1 w-12 bg-neutral-300 dark:bg-neutral-700" />
                    <Drawer.Content class="mx-auto w-full max-w-[32rem]">
                      <Drawer.Title class="mt-0 mb-1 text-center text-base font-bold">Notifications</Drawer.Title>
                      <Drawer.Description class="mb-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
                        You are all caught up. Good job!
                      </Drawer.Description>
                      <div class="flex justify-center gap-3">
                        <Drawer.Close class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400">
                          Close
                        </Drawer.Close>
                      </div>
                    </Drawer.Content>
                  </Drawer.Popup>
                </Drawer.Viewport>
              </Drawer.Portal>
            </Drawer.Root>
          </div>
        </Drawer.Indent>
      </div>
    </Drawer.Provider>
  );
}
