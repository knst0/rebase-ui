import { Checkbox } from "@rebase-ui/solid/checkbox";
import type { ComponentProps } from "@solidjs/web";

export default function ExampleCheckbox() {
  return (
    <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
      <Checkbox.Root
        defaultChecked
        class="flex size-4 shrink-0 items-center justify-center rounded-none border border-neutral-950 bg-white p-0 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-checked:bg-neutral-950 data-checked:text-white dark:border-white dark:bg-neutral-950 dark:text-neutral-950 dark:focus-visible:outline-white dark:data-checked:bg-white dark:data-checked:text-neutral-950"
      >
        <Checkbox.Indicator class="flex data-unchecked:hidden">
          <CheckIcon />
        </Checkbox.Indicator>
      </Checkbox.Root>
      Enable notifications
    </label>
  );
}

function CheckIcon(props: ComponentProps<"svg">) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style={{ display: "block" }} {...props}>
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
