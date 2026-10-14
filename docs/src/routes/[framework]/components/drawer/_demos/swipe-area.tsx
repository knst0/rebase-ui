import { Drawer } from "@rebase-ui/solid/drawer";
import { createSignal } from "solid-js";

export default function ExampleDrawerSwipeArea() {
  const [portalContainer, setPortalContainer] = createSignal<HTMLDivElement | null>(null);

  return (
    <div
      ref={setPortalContainer}
      class="relative min-h-80 w-full overflow-hidden border border-neutral-950 bg-white text-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white"
    >
      <Drawer.Root swipeDirection="right" modal={false}>
        <Drawer.SwipeArea class="absolute inset-y-0 right-0 z-[1] w-10 border-l-2 border-dashed border-blue-800 bg-blue-800/10 dark:border-blue-500 dark:bg-blue-500/10">
          <span class="pointer-events-none absolute top-1/2 right-0 z-0 mr-2 origin-center -translate-y-1/2 -rotate-90 text-xs font-bold tracking-[0.12em] whitespace-nowrap text-blue-800 uppercase dark:text-blue-500">
            Swipe here
          </span>
        </Drawer.SwipeArea>
        <div class="flex min-h-80 flex-col items-center justify-center gap-3 p-4 text-center">
          <p class="pr-12 text-center text-sm text-neutral-600 dark:text-neutral-400">Swipe from the right edge to open the drawer.</p>
        </div>
        <Drawer.Portal container={portalContainer() ?? undefined}>
          <Drawer.Backdrop class="absolute inset-0 min-h-dvh bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] [--backdrop-opacity:0.2] [--bleed:3rem] data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute dark:[--backdrop-opacity:0.7]" />
          <Drawer.Viewport class="absolute inset-0 z-20 flex items-stretch justify-end p-(--viewport-padding) [--viewport-padding:0px] supports-[-webkit-touch-callout:none]:[--viewport-padding:0.625rem]">
            <Drawer.Popup class="-mr-[3rem] h-full w-[calc(20rem+3rem)] max-w-[calc(100vw-3rem+3rem)] [transform:translateX(var(--drawer-swipe-movement-x))] touch-auto overflow-y-auto border-l border-neutral-950 bg-white p-6 pr-[calc(1.5rem+3rem)] text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] outline-none [--bleed:3rem] data-ending-style:[transform:translateX(calc(100%-var(--bleed)+var(--viewport-padding)+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:[transform:translateX(calc(100%-var(--bleed)+var(--viewport-padding)+2px))] data-swiping:select-none supports-[-webkit-touch-callout:none]:mr-0 supports-[-webkit-touch-callout:none]:w-[20rem] supports-[-webkit-touch-callout:none]:max-w-[calc(100vw-3rem)] supports-[-webkit-touch-callout:none]:border supports-[-webkit-touch-callout:none]:pr-6 supports-[-webkit-touch-callout:none]:[--bleed:0px] dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
              <Drawer.Content class="mx-auto w-full max-w-[32rem]">
                <Drawer.Title class="mb-1 text-base font-bold">Library</Drawer.Title>
                <Drawer.Description class="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
                  Swipe from the edge whenever you want to jump back into your playlists.
                </Drawer.Description>
                <div class="flex justify-end gap-3">
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
  );
}
