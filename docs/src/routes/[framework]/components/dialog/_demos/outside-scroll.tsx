import { Dialog } from "@rebase-ui/solid/dialog";
import { ScrollArea } from "@rebase-ui/solid/scroll-area";
import { createSignal, For } from "solid-js";

export default function OutsideScrollDialog() {
  const [popupElement, setPopupElement] = createSignal<HTMLDivElement | null>(null);
  return (
    <Dialog.Root>
      <Dialog.Trigger class="flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:not-data-disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-disabled:border-neutral-500 data-disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:focus-visible:outline-white dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400">
        Open dialog
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop class="fixed inset-0 bg-black/20 transition-opacity duration-[600ms] ease-[var(--ease-out-fast)] data-ending-style:opacity-0 data-ending-style:duration-[350ms] data-ending-style:ease-[cubic-bezier(0.375,0.015,0.545,0.455)] data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute dark:bg-black/50" />
        <Dialog.Viewport class="group/dialog fixed inset-0">
          <ScrollArea.Root
            style={{ position: undefined }}
            class="h-full overscroll-contain group-data-ending-style/dialog:pointer-events-none"
          >
            <ScrollArea.Viewport class="h-full overscroll-contain group-data-ending-style/dialog:pointer-events-none">
              <ScrollArea.Content class="flex min-h-full items-center justify-center">
                <Dialog.Popup
                  ref={(element: HTMLDivElement | null) => {
                    setPopupElement(element);
                  }}
                  initialFocus={popupElement}
                  class="relative mx-auto my-16 flex w-[min(40rem,calc(100vw-2rem))] flex-col gap-4 border border-neutral-950 bg-white p-4 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-0 transition-[translate] duration-[700ms] ease-[cubic-bezier(0.45,1.005,0,1.005)] data-ending-style:translate-y-[max(100dvh,100%)] data-ending-style:duration-[350ms] data-ending-style:ease-[cubic-bezier(0.375,0.015,0.545,0.455)] data-starting-style:translate-y-[100dvh] motion-reduce:transition-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
                >
                  <div class="relative flex flex-col gap-1 pr-8">
                    <Dialog.Title class="text-base font-bold">Dialog</Dialog.Title>
                    <Dialog.Description class="text-sm text-neutral-600 dark:text-neutral-400">
                      This layout keeps an outer container scrollable while the dialog can extend past the bottom edge.
                    </Dialog.Description>
                    <Dialog.Close
                      aria-label="Close"
                      class="absolute -top-1 -right-1 inline-flex h-8 w-8 items-center justify-center border-none bg-transparent p-0 text-neutral-950 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 active:bg-neutral-200 dark:text-white dark:hover:bg-neutral-800 dark:focus-visible:outline-white dark:active:bg-neutral-700"
                    >
                      <XIcon />
                    </Dialog.Close>
                  </div>

                  <div class="flex flex-col gap-4">
                    <For each={CONTENT_SECTIONS}>
                      {(item) => (
                        <section class="flex flex-col gap-1">
                          <h3 class="text-sm font-bold">{item.title}</h3>
                          <p class="text-sm text-neutral-700 dark:text-neutral-300">{item.body}</p>
                        </section>
                      )}
                    </For>
                  </div>

                  <p class="text-sm text-neutral-600 dark:text-neutral-400">
                    Related docs:{" "}
                    <For each={RELATED_LINKS}>
                      {(item, index) => (
                        <>
                          {index() > 0 ? ", " : null}
                          <a
                            class="text-neutral-950 underline decoration-[1px] underline-offset-[0.16em] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:text-white dark:focus-visible:outline-white"
                            href={item.href}
                          >
                            {item.label}
                          </a>
                        </>
                      )}
                    </For>
                    .
                  </p>
                </Dialog.Popup>
              </ScrollArea.Content>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar class="pointer-events-none flex w-4 justify-center bg-black/12 opacity-0 transition-opacity duration-[250ms] group-data-ending-style/dialog:opacity-0 group-data-ending-style/dialog:duration-[250ms] hover:pointer-events-auto hover:opacity-100 hover:delay-[0ms] hover:duration-[75ms] data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:delay-[0ms] data-scrolling:duration-[75ms] dark:bg-white/12">
              <ScrollArea.Thumb class="w-full bg-neutral-950 dark:bg-white" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
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

const CONTENT_SECTIONS = [
  {
    title: "What a dialog is for",
    body: "Use a dialog when you need the user to complete a focused task or read something important without navigating away. It opens on top of the page and returns focus back where it started when closed.",
  },
  {
    title: "Anatomy at a glance",
    body: "Root, Trigger, Portal, Backdrop, Viewport, Popup, Title, Description, Close. Keep the title short and the first paragraph specific so screen readers announce something meaningful.",
  },
  {
    title: "Opening and closing",
    body: "Control it using external state via the `open` and `onOpenChange` props, or let it manage state for you internally.",
  },
  {
    title: "Keyboard and focus behavior",
    body: "Focus moves inside the dialog when it opens. Tab and Shift+Tab loop within, and Esc requests close.",
  },
  {
    title: "Accessible labeling",
    body: "Set an explicit title and description using the `Dialog.Title` and `Dialog.Description` components.",
  },
  {
    title: "Backdrop and page scrolling",
    body: "The backdrop visually separates layers while background content is inert. Don’t rely on dimness alone—keep copy clear and buttons obvious so actions are easy to choose.",
  },
  {
    title: "Portals and stacking",
    body: "Dialogs render in a portal so they sit above the `isolation: isolate` app content and avoid local z-index wars.",
  },
  {
    title: "Viewport overflow",
    body: "Let long content overflow the bottom edge and reveal as you scroll the page container. Keep generous padding at the top and bottom so the dialog doesn’t feel jammed against the edges.",
  },
  {
    title: "Nested dialogs and confirmations",
    body: "If closing a dialog needs confirmation, open a child alert dialog rather than mutating the current one. The parent stays visible behind it; only the topmost layer should feel interactive.",
  },
  {
    title: "Transitions that respect motion settings",
    body: "Use small, fast transitions (opacity plus a few pixels of Y translation or scale). Subtle motion helps people notice what changed without slowing them down.",
  },
  {
    title: "Controlled vs. uncontrolled",
    body: "Controlled state is best when other parts of the page need to react to open/close. Uncontrolled is fine for local cases where only the dialog matters.",
  },
  {
    title: "Close affordances",
    body: "Always offer a visible close button in the corner. Don’t rely only on Esc or the backdrop for pointer outside presses. Touch screen readers and accessibility users benefit from a clear, targetable control to click to close the dialog.",
  },
  {
    title: "Forms inside dialogs",
    body: "Keep forms short; longer flows usually deserve a full page. Validate inline, keep button text specific (“Create project”), and disable destructive actions until the input is valid.",
  },
  {
    title: "Content guidelines",
    body: "Lead with the outcome (“Rename project?”) and follow with one or two short, concrete sentences. Avoid long prose; link out for details instead.",
  },
  {
    title: "SSR and hydration notes",
    body: "Because dialogs render in a portal, make sure your portal container exists on the client.",
  },
  {
    title: "Mobile ergonomics",
    body: "Use larger touch targets and keep the close button reachable with the thumb. Avoid full-screen modals unless the task truly needs a whole screen.",
  },
  {
    title: "Theming and density",
    body: "Match spacing and corner radius to your system. Use a slightly denser layout than pages so the dialog feels purpose-built, not like a mini web page.",
  },
  {
    title: "Internationalization",
    body: "Plan for longer text. Buttons can grow to two lines; titles should wrap gracefully. Keep destructive terms consistent across locales.",
  },
  {
    title: "Performance",
    body: "Children are mounted lazily when the dialog opens. If the dialog can reopen often, consider the `keepMounted` prop sparingly to perform the work only once on mount to avoid re-initializing complex component trees on each open.",
  },
  {
    title: "When a popover is better",
    body: "If the content is a small hint or a few quick actions anchored to a control, use a popover or menu instead of a dialog. Dialogs interrupt on purpose—use that sparingly.",
  },
  {
    title: "Follow-up and cleanup",
    body: "After a successful action, close the dialog and show confirmation in context (toast, inline message, or updated UI) so people can see the result of what they just did.",
  },
];

const RELATED_LINKS = [
  { href: "/components/scroll-area", label: "Scroll Area" },
  { href: "/components/drawer", label: "Drawer" },
  { href: "/components/popover", label: "Popover" },
] as const;
