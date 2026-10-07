import { PreviewCard } from "@rebase-ui/solid/preview-card";

import { CodePanel } from "./HighlightedCode";

export function TypePopover(props: { label: string; source: string }) {
  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        as="button"
        type="button"
        class="text-accent cursor-help underline decoration-dotted underline-offset-4"
        delay={0}
      >
        {props.label}
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner sideOffset={4}>
          <PreviewCard.Popup class="squircle border-border bg-bg-code max-w-[min(32rem,80vw)] overflow-x-auto rounded-lg border p-3 text-left shadow-lg transition-[transform,opacity] duration-100 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
            <CodePanel value={props.source} />
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}
