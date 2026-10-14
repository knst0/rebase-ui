import { OTPField } from "@rebase-ui/reze/otp-field";
import { createUniqueId, For } from "reze-js";

const CODE_LENGTH = 6;

export default function OTPFieldPasswordDemo() {
  const id = createUniqueId();
  const descriptionId = `${id}-description`;

  return (
    <div class="flex w-full max-w-80 flex-col items-start gap-1">
      <label for={id} class="text-sm font-bold text-neutral-950 dark:text-white">
        Access code
      </label>
      <OTPField.Root id={id} length={CODE_LENGTH} mask aria-describedby={descriptionId} class="flex w-full gap-2">
        <For each={Array.from({ length: CODE_LENGTH })}>
          {(_, index) => (
            <OTPField.Input
              class="font-inherit m-0 h-10 w-10 rounded-none border border-neutral-950 bg-white text-center text-base font-normal text-neutral-950 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus:outline-white"
              aria-label={index === 0 ? undefined : `Character ${index + 1} of ${CODE_LENGTH}`}
            />
          )}
        </For>
      </OTPField.Root>
      <p id={descriptionId} class="m-0 text-sm text-neutral-600 dark:text-neutral-400">
        Use <code class="font-mono">mask</code> to obscure the code on shared screens.
      </p>
    </div>
  );
}
