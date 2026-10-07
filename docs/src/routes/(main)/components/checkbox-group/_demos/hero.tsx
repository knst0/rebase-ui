import { Checkbox } from "@rebase-ui/solid/checkbox";
import { CheckboxGroup } from "@rebase-ui/solid/checkbox-group";
import type { ComponentProps } from "@solidjs/web";
import { createUniqueId, For } from "solid-js";

const apples = [
  { value: "fuji-apple", label: "Fuji" },
  { value: "gala-apple", label: "Gala" },
  { value: "granny-smith-apple", label: "Granny Smith" },
];

export default function ExampleCheckboxGroup() {
  const id = createUniqueId();

  return (
    <CheckboxGroup
      aria-labelledby={id}
      defaultValue={["fuji-apple"]}
      class="flex flex-col items-start gap-1 text-neutral-950 dark:text-white"
    >
      <div class="text-sm font-bold" id={id}>
        Apples
      </div>

      <For each={apples}>
        {(apple) => (
          <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
            <Checkbox.Root
              name="apple"
              value={apple.value}
              class="flex size-4 shrink-0 items-center justify-center rounded-none border border-neutral-950 bg-white p-0 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-checked:bg-neutral-950 data-checked:text-white dark:border-white dark:bg-neutral-950 dark:text-neutral-950 dark:focus-visible:outline-white dark:data-checked:bg-white dark:data-checked:text-neutral-950"
            >
              <Checkbox.Indicator class="flex data-unchecked:hidden">
                <CheckIcon />
              </Checkbox.Indicator>
            </Checkbox.Root>
            {apple.label}
          </label>
        )}
      </For>
    </CheckboxGroup>
  );
}

function CheckIcon(props: ComponentProps<"svg">) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" style={{ display: "block" }} {...props}>
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
