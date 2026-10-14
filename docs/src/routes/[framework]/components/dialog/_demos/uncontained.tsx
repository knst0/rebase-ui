import { Dialog } from "@rebase-ui/solid/dialog";

export default function ExampleUncontainedDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400">
        Open dialog
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop class="fixed inset-0 min-h-dvh bg-black/20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute dark:bg-black/50" />
        <Dialog.Viewport class="fixed inset-0 grid place-items-center px-4 py-12 xl:py-6">
          <Dialog.Popup class="group/popup pointer-events-none relative flex h-full w-full max-w-[70rem] justify-center transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 xl:max-w-none">
            <Dialog.Close
              class="pointer-events-auto absolute -top-10 right-0 flex h-8 w-8 items-center justify-center border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:bg-neutral-200 xl:top-0 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none dark:hover:bg-neutral-800 dark:focus-visible:outline-white dark:active:bg-neutral-700"
              aria-label="Close"
            >
              <XIcon />
            </Dialog.Close>
            <div class="pointer-events-auto h-full w-full max-w-[70rem] border border-neutral-950 bg-white p-4 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[scale] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-starting-style/popup:scale-105 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none" />
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function XIcon(props: { class?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-linecap="square"
      stroke-linejoin="round"
      class={props.class}
      style="display: block;"
    >
      <path d="m2.5 2.5 11 11m-11 0 11-11" />
    </svg>
  );
}
