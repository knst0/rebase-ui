import { Radio } from "@rebase-ui/solid/radio";
import { RadioGroup } from "@rebase-ui/solid/radio-group";
import { createUniqueId } from "solid-js";

export default function ExampleRadioGroup() {
  const id = createUniqueId();
  return (
    <RadioGroup aria-labelledby={id} defaultValue="fuji-apple" class="flex flex-col items-start gap-1 text-neutral-950 dark:text-white">
      <div class="text-sm font-bold" id={id}>
        Best apple
      </div>

      <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
        <Radio.Root
          value="fuji-apple"
          class="flex size-4 shrink-0 items-center justify-center rounded-full border border-neutral-950 bg-white p-0 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-checked:bg-neutral-950 data-checked:text-white dark:border-white dark:bg-neutral-950 dark:text-neutral-950 dark:focus-visible:outline-white dark:data-checked:bg-white dark:data-checked:text-neutral-950"
        >
          <Radio.Indicator class="flex items-center justify-center before:size-2 before:rounded-full before:bg-current data-unchecked:hidden" />
        </Radio.Root>
        Fuji
      </label>

      <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
        <Radio.Root
          value="gala-apple"
          class="flex size-4 shrink-0 items-center justify-center rounded-full border border-neutral-950 bg-white p-0 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-checked:bg-neutral-950 data-checked:text-white dark:border-white dark:bg-neutral-950 dark:text-neutral-950 dark:focus-visible:outline-white dark:data-checked:bg-white dark:data-checked:text-neutral-950"
        >
          <Radio.Indicator class="flex items-center justify-center before:size-2 before:rounded-full before:bg-current data-unchecked:hidden" />
        </Radio.Root>
        Gala
      </label>

      <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
        <Radio.Root
          value="granny-smith-apple"
          class="flex size-4 shrink-0 items-center justify-center rounded-full border border-neutral-950 bg-white p-0 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 data-checked:bg-neutral-950 data-checked:text-white dark:border-white dark:bg-neutral-950 dark:text-neutral-950 dark:focus-visible:outline-white dark:data-checked:bg-white dark:data-checked:text-neutral-950"
        >
          <Radio.Indicator class="flex items-center justify-center before:size-2 before:rounded-full before:bg-current data-unchecked:hidden" />
        </Radio.Root>
        Granny Smith
      </label>
    </RadioGroup>
  );
}
