import { OTPField } from "@rebase-ui/solid/otp-field";
import { createMemo, createUniqueId, For } from "solid-js";

const OTP_LENGTH = 6;

export default function OTPFieldGroupedDemo() {
  const id = createUniqueId();

  return (
    <div class="flex w-full max-w-80 flex-col items-start gap-1">
      <label for={id} class="text-sm font-bold text-neutral-950 dark:text-white">
        Verification code
      </label>
      <OTPField.Root id={id} length={OTP_LENGTH} class="flex w-full items-center gap-2">
        <div class="flex gap-2">
          <For each={Array.from({ length: 3 })}>
            {(_, index) => {
              const i = createMemo(() => index());
              return (
                <OTPField.Input
                  class="m-0 h-10 w-10 rounded-none border border-neutral-950 bg-white dark:bg-neutral-950 text-center font-inherit text-base font-normal text-neutral-950 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white"
                  aria-label={i() === 0 ? undefined : `Character ${i() + 1} of ${OTP_LENGTH}`}
                />
              );
            }}
          </For>
        </div>
        <OTPField.Separator class="h-px w-4 bg-current text-neutral-950 dark:text-white" />
        <div class="flex gap-2">
          <For each={Array.from({ length: 3 })}>
            {(_, index) => {
              const i = createMemo(() => index());
              return (
                <OTPField.Input
                  class="m-0 h-10 w-10 rounded-none border border-neutral-950 bg-white dark:bg-neutral-950 text-center font-inherit text-base font-normal text-neutral-950 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white"
                  aria-label={`Character ${i() + 4} of ${OTP_LENGTH}`}
                />
              );
            }}
          </For>
        </div>
      </OTPField.Root>
    </div>
  );
}
