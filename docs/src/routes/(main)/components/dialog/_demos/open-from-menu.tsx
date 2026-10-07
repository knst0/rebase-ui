import { Dialog } from "@rebase-ui/solid/dialog";
import { createSignal, onCleanup, Show } from "solid-js";

export default function ExampleDialog() {
  const [dialogOpen, setDialogOpen] = createSignal(false);

  return (
    <>
      <DemoMenu onDetails={() => setDialogOpen(true)} />

      {/* Control the dialog state */}
      <Dialog.Root open={dialogOpen()} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop class="fixed inset-0 min-h-dvh bg-black opacity-20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute dark:opacity-50" />
          <Dialog.Popup class="fixed top-1/2 left-1/2 -mt-8 flex w-96 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 border border-neutral-950 bg-white p-4 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none">
            <div class="flex flex-col gap-1">
              <Dialog.Title class="text-base font-bold">Playlist details</Dialog.Title>
              <Dialog.Description class="text-sm text-neutral-600 dark:text-neutral-400">
                This playlist contains 24 songs and was last updated today.
              </Dialog.Description>
            </div>
            <div class="flex justify-end gap-3">
              <Dialog.Close class={buttonClass}>Close</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

const buttonClass =
  "flex h-8 items-center justify-center gap-1.5 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-pressed:bg-neutral-100 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-pressed:bg-neutral-800 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white";

const itemClass =
  "flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white";

function CaretDownIcon(props: { class?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class={props.class} style="display: block;">
      <path d="M12 6H4l4 4.5z" />
    </svg>
  );
}

/**
 * Stands in for `<Menu>` from `@base-ui/react/menu`, which is not ported yet.
 * Opens the dialog imperatively from a menu item, like the upstream demo.
 */
function DemoMenu(props: { onDetails: () => void }) {
  const [menuOpen, setMenuOpen] = createSignal(false);
  let menuRoot: HTMLDivElement | undefined;

  const closeOnOutsidePress = (event: PointerEvent) => {
    if (menuOpen() && menuRoot && !menuRoot.contains(event.target as Node)) {
      setMenuOpen(false);
    }
  };

  const closeOnEscape = (event: KeyboardEvent) => {
    if (menuOpen() && event.key === "Escape") {
      setMenuOpen(false);
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    onCleanup(() => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    });
  }

  return (
    <div
      class="relative"
      ref={(element: HTMLDivElement | null) => {
        menuRoot = element ?? undefined;
      }}
    >
      <button
        type="button"
        class={buttonClass}
        aria-haspopup="menu"
        aria-expanded={menuOpen() ? "true" : "false"}
        onClick={() => setMenuOpen((open) => !open)}
      >
        Playlist <CaretDownIcon />
      </button>
      <Show when={menuOpen()}>
        <div
          role="menu"
          class="absolute top-full left-0 z-10 mt-2 min-w-44 border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-hidden dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
        >
          <div role="menuitem" class={itemClass}>
            Play
          </div>
          <div role="menuitem" class={itemClass}>
            Share
          </div>
          <div role="separator" class="mx-1 my-1 h-px bg-neutral-950 dark:bg-white" />
          {/* Open the dialog when the menu item is clicked */}
          <button
            type="button"
            role="menuitem"
            class={itemClass}
            onClick={() => {
              setMenuOpen(false);
              props.onDetails();
            }}
          >
            Details…
          </button>
        </div>
      </Show>
    </div>
  );
}
