import { Checkbox } from "@rebase-ui/solid/checkbox";
import { CheckboxGroup } from "@rebase-ui/solid/checkbox-group";
import type { ComponentProps } from "@solidjs/web";
import { createSignal, createUniqueId, For, Show } from "solid-js";

const apples = [
  { value: "fuji-apple", label: "Fuji" },
  { value: "gala-apple", label: "Gala" },
  { value: "granny-smith-apple", label: "Granny Smith" },
];

const allValues = apples.map((apple) => apple.value);

const checkboxClass =
  "flex size-4 shrink-0 items-center justify-center rounded-none border border-neutral-950 bg-white p-0 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-checked:bg-neutral-950 data-checked:text-white data-indeterminate:bg-neutral-950 data-indeterminate:text-white dark:border-white dark:bg-neutral-950 dark:text-neutral-950 dark:focus-visible:outline-white dark:data-checked:bg-white dark:data-checked:text-neutral-950 dark:data-indeterminate:bg-white dark:data-indeterminate:text-neutral-950";

const itemClass = "flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white";

export default function ExampleParentCheckbox() {
  const id = createUniqueId();
  const [value, setValue] = createSignal<string[]>([]);

  return (
    <CheckboxGroup
      aria-labelledby={id}
      value={value()}
      onValueChange={setValue}
      allValues={allValues}
      class="ml-4 flex flex-col items-start gap-1"
    >
      <label class={`${itemClass} -ml-4`} id={id}>
        <Checkbox.Root parent class={checkboxClass}>
          <Checkbox.Indicator class="flex data-unchecked:hidden">
            {(state) => (
              <Show when={state.indeterminate()} fallback={<CheckIcon />}>
                <HorizontalRuleIcon />
              </Show>
            )}
          </Checkbox.Indicator>
        </Checkbox.Root>
        Apples
      </label>

      <For each={apples}>
        {(apple) => (
          <label class={itemClass}>
            <Checkbox.Root value={apple.value} class={checkboxClass}>
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

function HorizontalRuleIcon(props: ComponentProps<"svg">) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke-width={1} style={{ display: "block" }} {...props}>
      <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" vector-effect="non-scaling-stroke" />
    </svg>
  );
}
