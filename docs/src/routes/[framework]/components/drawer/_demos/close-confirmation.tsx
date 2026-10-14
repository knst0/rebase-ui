import { AlertDialog } from "@rebase-ui/solid/alert-dialog";
import { Drawer } from "@rebase-ui/solid/drawer";
import { createSignal, createUniqueId } from "solid-js";

export default function ExampleDrawer() {
  const [drawerOpen, setDrawerOpen] = createSignal(false);
  const [confirmationOpen, setConfirmationOpen] = createSignal(false);
  const [textareaValue, setTextareaValue] = createSignal("");
  const titleId = createUniqueId();

  return (
    <Drawer.Root
      swipeDirection="right"
      open={drawerOpen()}
      onOpenChange={(open, eventDetails) => {
        // Show the close confirmation if there’s text in the textarea
        if (!open && textareaValue()) {
          eventDetails.cancel();
          setConfirmationOpen(true);
          return;
        }
        if (!open) {
          // Reset the textarea value
          setTextareaValue("");
        }
        setDrawerOpen(open);
      }}
    >
      <Drawer.Trigger class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400">
        Tweet
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop class="fixed inset-0 min-h-dvh bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] [--backdrop-opacity:0.2] data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute dark:[--backdrop-opacity:0.7]" />
        <Drawer.Viewport class="fixed inset-0 flex items-stretch justify-end p-(--viewport-padding) [--viewport-padding:0px] supports-[-webkit-touch-callout:none]:[--viewport-padding:0.625rem]">
          <Drawer.Popup
            class={`relative -mr-[3rem] h-full w-[calc(20rem+3rem)] max-w-[calc(100vw-3rem+3rem)] [transform:translateX(var(--drawer-swipe-movement-x))] touch-auto overflow-y-auto overscroll-contain border-l border-neutral-950 bg-white p-6 pr-[calc(1.5rem+3rem)] text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] outline-none [--bleed:3rem] after:pointer-events-none after:absolute after:inset-0 after:bg-black/5 after:opacity-0 after:transition-opacity after:duration-100 after:ease-out data-ending-style:[transform:translateX(calc(100%-var(--bleed)+var(--viewport-padding)+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:[transform:translateX(calc(100%-var(--bleed)+var(--viewport-padding)+2px))] data-swiping:select-none supports-[-webkit-touch-callout:none]:mr-0 supports-[-webkit-touch-callout:none]:w-[20rem] supports-[-webkit-touch-callout:none]:max-w-[calc(100vw-3rem)] supports-[-webkit-touch-callout:none]:border supports-[-webkit-touch-callout:none]:pr-6 supports-[-webkit-touch-callout:none]:[--bleed:0px] dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none ${
              confirmationOpen() ? "after:opacity-100" : ""
            }`}
          >
            <Drawer.Content class="mx-auto flex w-full max-w-[32rem] flex-col gap-4">
              <Drawer.Title id={titleId} class="text-base font-bold">
                New tweet
              </Drawer.Title>
              <form
                class="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  // Close the drawer when submitting
                  setTextareaValue("");
                  setDrawerOpen(false);
                }}
              >
                <textarea
                  aria-labelledby={titleId}
                  required
                  class="min-h-32 w-full border border-neutral-950 bg-white p-2 text-sm font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400 dark:focus:outline-white any-pointer-coarse:text-base"
                  placeholder="What’s on your mind?"
                  value={textareaValue()}
                  onInput={(event) => setTextareaValue(event.target.value)}
                />
                <div class="flex justify-end gap-3">
                  <Drawer.Close class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400">
                    Cancel
                  </Drawer.Close>
                  <button
                    type="submit"
                    class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400"
                  >
                    Tweet
                  </button>
                </div>
              </form>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>

      {/* Confirmation dialog */}
      <AlertDialog.Root open={confirmationOpen()} onOpenChange={setConfirmationOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Popup class="fixed top-1/2 left-1/2 -mt-8 flex w-96 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 border border-neutral-950 bg-white p-4 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[translate,scale,opacity] duration-100 ease-out data-ending-style:translate-y-[calc(-50%+0.25rem)] data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:translate-y-[calc(-50%+0.25rem)] data-starting-style:scale-[0.96] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
            <div class="flex flex-col gap-1">
              <AlertDialog.Title class="text-base font-bold">Discard tweet?</AlertDialog.Title>
              <AlertDialog.Description class="text-sm text-neutral-600 dark:text-neutral-400">
                Your tweet will be lost.
              </AlertDialog.Description>
            </div>
            <div class="flex justify-end gap-3">
              <AlertDialog.Close class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400">
                Go back
              </AlertDialog.Close>
              <button
                type="button"
                class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400"
                onClick={() => {
                  setConfirmationOpen(false);
                  setTextareaValue("");
                  setDrawerOpen(false);
                }}
              >
                Discard
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </Drawer.Root>
  );
}
